// ============================================================
// INTEGRITY ROUTE — /api/integrity
// Environment-aware lead validation engine.
//
// ENV stored in DB settings key: 'app_env'
// Default: PRODUCTION
//
// GET  /api/integrity/env            → read current ENV
// POST /api/integrity/env            → set ENV (TEST|PRODUCTION)
// POST /api/integrity/validate       → validate leads with current ENV
// POST /api/integrity/check-one      → quick single-lead check
// GET  /api/integrity/blocklist      → inspect test list + infra list
// POST /api/integrity/scraper-check  → scraper output sufficiency gate
// POST /api/integrity/purge-test-emails → tag (NOT delete) test email records
// ============================================================

import { Hono } from 'hono';
import type { Bindings } from '../types';
import {
  runIntegrityGate,
  validateLead,
  resolveEnv,
  TEST_EMAIL_LIST,
  INFRA_EMAIL_BLOCKLIST,
  INTERNAL_EMAIL_BLOCKLIST,
  BLOCKED_DOMAINS,
  PERSONAL_DOMAINS,
  scraperInsufficientData,
  type LeadCandidate,
  type AppEnv,
} from '../lib/lead-integrity';

const integrity = new Hono<{ Bindings: Bindings }>();

// ─── HELPER: read ENV from DB ─────────────────────────────────────────────────
async function readEnv(DB: D1Database): Promise<AppEnv> {
  try {
    const row = await DB.prepare(
      `SELECT value FROM settings WHERE key = 'app_env'`
    ).first<{ value: string }>();
    return resolveEnv(row?.value);
  } catch {
    return 'PRODUCTION';
  }
}

// ─── GET /api/integrity/env ───────────────────────────────────────────────────
integrity.get('/env', async (c) => {
  const env = await readEnv(c.env.DB);
  return c.json({
    status: 'ENVIRONMENT_FILTER_ACTIVE',
    mode: env,
    test_emails_blocked_in_production: env === 'PRODUCTION',
    test_email_count: TEST_EMAIL_LIST.size,
    infra_email_count: INFRA_EMAIL_BLOCKLIST.size,
    description: env === 'PRODUCTION'
      ? 'PRODUCTION mode — test emails are blocked but preserved. Switch to TEST to allow them.'
      : 'TEST mode — test emails are allowed and tagged lead_type=TEST. Never deploy outreach in this mode.',
  });
});

// ─── POST /api/integrity/env ──────────────────────────────────────────────────
// Body: { "mode": "TEST" | "PRODUCTION" }
integrity.post('/env', async (c) => {
  const { mode } = await c.req.json() as { mode: string };
  const resolved = resolveEnv(mode);

  try {
    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('app_env', ?)`
    ).bind(resolved).run();
  } catch (e: unknown) {
    return c.json({ error: 'DB write failed', detail: String(e) }, 500);
  }

  return c.json({
    status: 'ENVIRONMENT_FILTER_ACTIVE',
    mode: resolved,
    test_emails_blocked_in_production: resolved === 'PRODUCTION',
    message: resolved === 'PRODUCTION'
      ? 'Switched to PRODUCTION. Test emails will be blocked (not deleted). Real outreach only.'
      : 'Switched to TEST. Test emails are now allowed and tagged lead_type=TEST. Do NOT send real outreach.',
    warning: resolved === 'TEST'
      ? '⚠️ TEST mode active — all sends are tagged TEST. Switch back to PRODUCTION before real outreach.'
      : null,
  });
});

// ─── POST /api/integrity/validate ─────────────────────────────────────────────
// Body: { leads: LeadCandidate[], previously_sent?: string[], env_override?: string }
integrity.post('/validate', async (c) => {
  const body = await c.req.json() as {
    leads: LeadCandidate[];
    previously_sent?: string[];
    env_override?: string;
  };

  if (!Array.isArray(body.leads) || body.leads.length === 0) {
    return c.json({ error: 'Provide a non-empty leads array' }, 400);
  }

  // env_override lets caller force a mode; otherwise read from DB
  const env: AppEnv = body.env_override
    ? resolveEnv(body.env_override)
    : await readEnv(c.env.DB);

  const previouslySent = new Set<string>(
    (body.previously_sent || []).map(e => e.toLowerCase().trim())
  );

  const report = runIntegrityGate(body.leads, env, previouslySent);

  return c.json(report, report.hard_stop_triggered ? 403 : 200);
});

// ─── POST /api/integrity/check-one ───────────────────────────────────────────
// Quick single-lead validation against current ENV
integrity.post('/check-one', async (c) => {
  const body = await c.req.json() as LeadCandidate & { env_override?: string };
  const env: AppEnv = body.env_override
    ? resolveEnv(body.env_override)
    : await readEnv(c.env.DB);

  const result = validateLead(body, env);
  return c.json(result, result.status === 'REJECTED' ? 422 : 200);
});

// ─── GET /api/integrity/blocklist ─────────────────────────────────────────────
integrity.get('/blocklist', async (c) => {
  const env = await readEnv(c.env.DB);
  return c.json({
    current_env: env,
    test_emails: {
      list: [...TEST_EMAIL_LIST],
      count: TEST_EMAIL_LIST.size,
      behavior_in_production: 'BLOCKED — tagged TEST_EMAIL_IN_PRODUCTION, preserved in DB',
      behavior_in_test: 'ALLOWED — tagged lead_type=TEST, environment_used=TEST',
    },
    infra_emails: {
      list: [...INFRA_EMAIL_BLOCKLIST],
      count: INFRA_EMAIL_BLOCKLIST.size,
      behavior: 'ALWAYS BLOCKED in all environments — own system addresses',
    },
    blocked_domains: {
      list: [...BLOCKED_DOMAINS],
      behavior: 'ALWAYS BLOCKED — own infrastructure domains',
    },
    personal_domains_flagged: {
      list: [...PERSONAL_DOMAINS],
      behavior: 'Require verified business source field (google_maps, yelp, osm, etc.)',
    },
  });
});

// ─── POST /api/integrity/scraper-check ───────────────────────────────────────
integrity.post('/scraper-check', async (c) => {
  const { leads_found, required = 20 } = await c.req.json() as {
    leads_found: number;
    required?: number;
  };
  if (leads_found < required) {
    return c.json(scraperInsufficientData(leads_found, required), 422);
  }
  return c.json({ status: 'SCRAPER_OK', leads_found, required, action: 'PROCEED_TO_FILTER' });
});

// ─── POST /api/integrity/purge-test-emails ────────────────────────────────────
// NON-DESTRUCTIVE: tags test email lead records with lead_type=TEST
// and clears their email only if ENV=PRODUCTION (so they can't be sent).
// Does NOT delete the lead record itself.
integrity.post('/purge-test-emails', async (c) => {
  const { DB } = c.env;
  const env = await readEnv(DB);

  let rows: { key: string; value: string }[] = [];
  try {
    const result = await DB.prepare(
      `SELECT key, value FROM settings WHERE key LIKE 'micro_lead_%'`
    ).all<{ key: string; value: string }>();
    rows = result.results || [];
  } catch {
    return c.json({ error: 'DB not available' }, 500);
  }

  const tagged: { lead_id: string; email: string; action: string; lead_type: string }[] = [];
  const clean: string[] = [];

  for (const row of rows) {
    let lead: Record<string, unknown>;
    try { lead = JSON.parse(row.value); } catch { continue; }

    const email = ((lead.email as string) || '').toLowerCase().trim();
    if (!email) { clean.push(row.key); continue; }

    const isTestEmail = TEST_EMAIL_LIST.has(email);
    const isInfra = INFRA_EMAIL_BLOCKLIST.has(email);
    const isOwnDomain = email.includes('@') && BLOCKED_DOMAINS.has(email.split('@')[1]);

    if (isTestEmail || isInfra || isOwnDomain) {
      // Section 4: tag the lead, don't delete it
      lead.lead_type = isTestEmail ? 'TEST' : 'REAL';
      lead.environment_used = env;

      if (env === 'PRODUCTION') {
        // Production: clear the email so it can't be dispatched — lead record stays
        lead.email = '';
        lead.day1_email_sent = false;
        lead.tracking = {
          ...((lead.tracking as Record<string, boolean>) || {}),
          sent: false,
        };
        lead.resend_ids = [];
        lead.last_sent_at = null;

        tagged.push({
          lead_id: row.key.replace('micro_lead_', ''),
          email,
          action: isTestEmail
            ? 'EMAIL_CLEARED_TEST_EMAIL_IN_PRODUCTION'
            : 'EMAIL_CLEARED_INFRA_OR_OWN_DOMAIN',
          lead_type: lead.lead_type as string,
        });
      } else {
        // Test mode: keep email, just tag it
        tagged.push({
          lead_id: row.key.replace('micro_lead_', ''),
          email,
          action: 'TAGGED_AS_TEST_EMAIL_ALLOWED_IN_TEST_ENV',
          lead_type: lead.lead_type as string,
        });
      }

      await DB.prepare(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
      ).bind(row.key, JSON.stringify(lead)).run();
    } else {
      clean.push(row.key);
    }
  }

  return c.json({
    status: 'ENVIRONMENT_FILTER_ACTIVE',
    mode: env,
    test_emails_blocked_in_production: env === 'PRODUCTION',
    tagged_count: tagged.length,
    clean_count: clean.length,
    tagged,
    message: env === 'PRODUCTION'
      ? `${tagged.length} test/infra email(s) found. Emails cleared from lead records — lead data preserved. Set ENV=TEST to allow them for testing.`
      : `${tagged.length} test email(s) tagged as lead_type=TEST. Emails kept — TEST mode active.`,
  });
});

export default integrity;
