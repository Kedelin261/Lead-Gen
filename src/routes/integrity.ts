// ============================================================
// INTEGRITY ROUTE — /api/integrity
// Exposes the lead integrity enforcement engine as an API.
// Provides: validation, audit, blocklist inspection, pipeline gate.
// ============================================================

import { Hono } from 'hono';
import type { Bindings } from '../types';
import {
  runIntegrityGate,
  validateLead,
  INTERNAL_EMAIL_BLOCKLIST,
  BLOCKED_DOMAINS,
  PERSONAL_DOMAINS,
  scraperInsufficientData,
  type LeadCandidate,
} from '../lib/lead-integrity';

const integrity = new Hono<{ Bindings: Bindings }>();

// ─── POST /api/integrity/validate ────────────────────────────────────────────
// Validate a batch of lead candidates through the full integrity pipeline.
// Returns the full report: accepted, rejected, audit log, hard-stop decision.
integrity.post('/validate', async (c) => {
  const body = await c.req.json() as {
    leads: LeadCandidate[];
    previously_sent?: string[];
  };

  if (!Array.isArray(body.leads) || body.leads.length === 0) {
    return c.json({ error: 'Provide a non-empty leads array' }, 400);
  }

  const previouslySent = new Set<string>((body.previously_sent || []).map(e => e.toLowerCase().trim()));
  const report = runIntegrityGate(body.leads, previouslySent);

  return c.json(report, report.hard_stop_triggered ? 403 : 200);
});

// ─── POST /api/integrity/check-one ───────────────────────────────────────────
// Quick single-lead check.
integrity.post('/check-one', async (c) => {
  const lead = await c.req.json() as LeadCandidate;
  const result = validateLead(lead);
  return c.json(result, result.status === 'REJECTED' ? 422 : 200);
});

// ─── GET /api/integrity/blocklist ────────────────────────────────────────────
// Inspect the current blocklist (safe to expose — no secrets).
integrity.get('/blocklist', (c) => {
  return c.json({
    blocked_emails: [...INTERNAL_EMAIL_BLOCKLIST],
    blocked_domains: [...BLOCKED_DOMAINS],
    personal_domains_flagged: [...PERSONAL_DOMAINS],
    rule: 'Blocked emails cannot receive outreach. Blocked domains are fully rejected. Personal domains require verified business source.',
  });
});

// ─── POST /api/integrity/scraper-check ───────────────────────────────────────
// Validate scraper output — returns SCRAPER_INSUFFICIENT_DATA if below threshold.
integrity.post('/scraper-check', async (c) => {
  const { leads_found, required = 20 } = await c.req.json() as {
    leads_found: number;
    required?: number;
  };

  if (leads_found < required) {
    return c.json(scraperInsufficientData(leads_found, required), 422);
  }

  return c.json({
    status: 'SCRAPER_OK',
    leads_found,
    required,
    action: 'PROCEED_TO_FILTER',
  });
});

// ─── POST /api/integrity/purge-test-emails ───────────────────────────────────
// Scan all micro-scale lead DB records and remove blocked email addresses.
// This corrects any previously injected test emails.
integrity.post('/purge-test-emails', async (c) => {
  const { DB } = c.env;

  let rows: { key: string; value: string }[] = [];
  try {
    const result = await DB.prepare(
      `SELECT key, value FROM settings WHERE key LIKE 'micro_lead_%'`
    ).all<{ key: string; value: string }>();
    rows = result.results || [];
  } catch {
    return c.json({ error: 'DB not available' }, 500);
  }

  const purged: { lead_id: string; blocked_email: string; reason: string }[] = [];
  const clean: string[] = [];

  for (const row of rows) {
    let lead: Record<string, unknown>;
    try { lead = JSON.parse(row.value); } catch { continue; }

    const email = ((lead.email as string) || '').toLowerCase().trim();
    if (!email) { clean.push(row.key); continue; }

    const onBlocklist = INTERNAL_EMAIL_BLOCKLIST.has(email);
    const onBlockedDomain = email.includes('@') && BLOCKED_DOMAINS.has(email.split('@')[1]);

    if (onBlocklist || onBlockedDomain) {
      // Remove the email from this lead record
      lead.email = '';
      lead.day1_email_sent = false;
      lead.tracking = {
        ...((lead.tracking as Record<string, boolean>) || {}),
        sent: false,
      };
      lead.resend_ids = [];
      lead.last_sent_at = null;

      await DB.prepare(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
      ).bind(row.key, JSON.stringify(lead)).run();

      purged.push({
        lead_id: row.key.replace('micro_lead_', ''),
        blocked_email: email,
        reason: onBlocklist ? 'INTERNAL_TEST_EMAIL' : 'BLOCKED_DOMAIN',
      });
    } else {
      clean.push(row.key);
    }
  }

  return c.json({
    purged_count: purged.length,
    clean_count: clean.length,
    purged,
    message: purged.length > 0
      ? `${purged.length} test/internal email(s) removed from lead records. These leads now require real business emails.`
      : 'No blocked emails found in stored lead records.',
  });
});

export default integrity;
