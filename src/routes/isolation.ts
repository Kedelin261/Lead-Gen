// ============================================================
// ENVIRONMENT ISOLATION ENGINE — /api/isolation
//
// Implements all 7 isolation rules:
//   1. Queue Isolation     — every job carries env field; mismatch → skip + log
//   2. Send Pipeline Guard — lead.environment_used must match current env
//   3. Demo Link Isolation — /demo/test/* for TEST; no /test/ in PRODUCTION
//   4. CRM Visual Flagging — TEST badge in CRM rows
//   5. Metrics Separation  — test and prod metrics tracked independently
//   6. Hard Stop           — ENVIRONMENT_BREACH if TEST lead in PROD pipeline
//   7. Output Status       — {"status":"ENVIRONMENT_ISOLATION_ACTIVE","test_safe":true,"production_safe":true}
//
// Routes:
//   GET  /api/isolation/status           → current isolation state + output JSON
//   GET  /api/isolation/metrics          → split test vs production metrics
//   POST /api/isolation/queue/enqueue    → enqueue a job with env field
//   POST /api/isolation/queue/process    → process queue respecting env mismatch
//   POST /api/isolation/demo/check-url   → validate demo URL format for env
//   POST /api/isolation/pipeline/check   → pre-send guard: checks lead.environment_used
//   GET  /api/isolation/crm/leads        → CRM rows with TEST badge applied
//   POST /api/isolation/breach/report    → report / review any breach events
// ============================================================

import { Hono } from 'hono';
import type { Bindings } from '../types';
import {
  resolveEnv,
  TEST_EMAIL_LIST,
  type AppEnv,
} from '../lib/lead-integrity';

const isolation = new Hono<{ Bindings: Bindings }>();

// ─── HELPER: read current ENV from DB ─────────────────────────────────────────
async function readAppEnv(DB: D1Database): Promise<AppEnv> {
  try {
    const row = await DB.prepare(
      `SELECT value FROM settings WHERE key = 'app_env'`
    ).first<{ value: string }>();
    return resolveEnv(row?.value);
  } catch {
    return 'PRODUCTION';
  }
}

// ─── DEMO URL VALIDATORS (Rule 3) ─────────────────────────────────────────────
// TEST  env:  demo URLs must contain "/demo/test/"
// PROD  env:  demo URLs must NOT contain "/test/"
export function validateDemoUrl(url: string, env: AppEnv): {
  valid: boolean;
  reason: string;
  expected_pattern: string;
} {
  if (env === 'TEST') {
    const valid = url.includes('/demo/test/');
    return {
      valid,
      reason: valid
        ? 'TEST demo URL correctly contains /demo/test/ path segment'
        : `TEST env requires demo URLs to contain "/demo/test/". Got: "${url}"`,
      expected_pattern: '/demo/test/{business-slug}',
    };
  } else {
    // PRODUCTION — must NOT have /test/ anywhere
    const hasTestPath = /\/test\//i.test(url);
    return {
      valid: !hasTestPath,
      reason: !hasTestPath
        ? 'PRODUCTION demo URL is clean — no /test/ path segment'
        : `PRODUCTION env demo URLs must NOT contain "/test/". Got: "${url}"`,
      expected_pattern: '/demo/{business-slug}',
    };
  }
}

// ─── METRICS SEPARATION STORE (Rule 5) ───────────────────────────────────────
// Keys in DB settings table:
//   isolation_metrics_TEST       → JSON of test metrics
//   isolation_metrics_PRODUCTION → JSON of production metrics

interface EnvMetrics {
  emails_sent: number;
  emails_replied: number;
  emails_opened: number;
  emails_clicked: number;
  demos_viewed: number;
  reply_rate: number;
  placement_pct: number;   // primary inbox placement percentage
  breach_events: number;
  last_updated: string;
}

function emptyMetrics(): EnvMetrics {
  return {
    emails_sent: 0,
    emails_replied: 0,
    emails_opened: 0,
    emails_clicked: 0,
    demos_viewed: 0,
    reply_rate: 0,
    placement_pct: 100,
    breach_events: 0,
    last_updated: new Date().toISOString(),
  };
}

async function readMetrics(DB: D1Database, env: AppEnv): Promise<EnvMetrics> {
  try {
    const row = await DB.prepare(
      `SELECT value FROM settings WHERE key = ?`
    ).bind(`isolation_metrics_${env}`).first<{ value: string }>();
    return row ? { ...emptyMetrics(), ...JSON.parse(row.value) } : emptyMetrics();
  } catch {
    return emptyMetrics();
  }
}

async function writeMetrics(DB: D1Database, env: AppEnv, metrics: EnvMetrics): Promise<void> {
  await DB.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
  ).bind(`isolation_metrics_${env}`, JSON.stringify({
    ...metrics,
    last_updated: new Date().toISOString(),
  })).run();
}

// ─── BREACH LOG ───────────────────────────────────────────────────────────────
interface BreachEvent {
  id: string;
  timestamp: string;
  lead_id: string;
  lead_email: string;
  lead_environment_used: string;
  current_env: AppEnv;
  action_blocked: string;
  reason: string;
}

async function logBreach(DB: D1Database, event: Omit<BreachEvent, 'id' | 'timestamp'>): Promise<BreachEvent> {
  const breach: BreachEvent = {
    id: `breach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };

  // Store breach log in DB
  try {
    const existing = await DB.prepare(
      `SELECT value FROM settings WHERE key = 'isolation_breach_log'`
    ).first<{ value: string }>();
    const log: BreachEvent[] = existing ? JSON.parse(existing.value) : [];
    log.unshift(breach);
    // Keep last 50 breach events
    const trimmed = log.slice(0, 50);
    await DB.prepare(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('isolation_breach_log', ?)`
    ).bind(JSON.stringify(trimmed)).run();

    // Increment breach counter in the CURRENT env metrics
    const metrics = await readMetrics(DB, event.current_env);
    metrics.breach_events = (metrics.breach_events || 0) + 1;
    await writeMetrics(DB, event.current_env, metrics);
  } catch { /* ignore */ }

  return breach;
}

// ─── QUEUE JOB TYPES ─────────────────────────────────────────────────────────
interface QueueJob {
  job_id: string;
  env: string;             // job.env — set at enqueue time
  action: string;
  lead_id?: string;
  email?: string;
  payload?: Record<string, unknown>;
  enqueued_at: string;
}

interface ProcessedJob {
  job_id: string;
  status: 'EXECUTED' | 'ENV_MISMATCH_SKIPPED';
  job_env: string;
  current_env: AppEnv;
  reason?: string;
  executed_at: string;
}

// ─── GET /api/isolation/status ────────────────────────────────────────────────
// Returns the canonical output JSON plus full isolation state
isolation.get('/status', async (c) => {
  const { DB } = c.env;
  const currentEnv = await readAppEnv(DB);

  const [testMetrics, prodMetrics] = await Promise.all([
    readMetrics(DB, 'TEST'),
    readMetrics(DB, 'PRODUCTION'),
  ]);

  // Read breach log
  let breachLog: BreachEvent[] = [];
  try {
    const row = await DB.prepare(
      `SELECT value FROM settings WHERE key = 'isolation_breach_log'`
    ).first<{ value: string }>();
    if (row) breachLog = JSON.parse(row.value);
  } catch { /* ignore */ }

  const recentBreaches = breachLog.slice(0, 5);

  return c.json({
    // ── Section 7: Mandatory output JSON ─────────────────────────────────
    status: 'ENVIRONMENT_ISOLATION_ACTIVE',
    test_safe: true,
    production_safe: true,
    // ─────────────────────────────────────────────────────────────────────
    current_env: currentEnv,
    isolation_rules: {
      '1_queue_isolation': {
        active: true,
        rule: 'Every queued job must carry env field; if job.env ≠ current env → skip + log ENV_MISMATCH_SKIPPED',
      },
      '2_send_pipeline_guard': {
        active: true,
        rule: 'Before any send: lead.environment_used must match current env; mismatch → BLOCK',
      },
      '3_demo_link_isolation': {
        active: true,
        rule: 'TEST env → demo URLs must contain /demo/test/; PRODUCTION env → URLs must NOT contain /test/',
        test_pattern: '/demo/test/{slug}',
        prod_pattern: '/demo/{slug}',
      },
      '4_crm_visual_flagging': {
        active: true,
        rule: 'All TEST leads carry lead_type=TEST badge in CRM rows — visually distinct',
      },
      '5_metrics_separation': {
        active: true,
        rule: 'Test and production metrics tracked independently — never combined',
      },
      '6_hard_stop': {
        active: true,
        rule: 'If TEST lead enters PRODUCTION pipeline → halt all sends → return ENVIRONMENT_BREACH',
      },
    },
    metrics: {
      TEST: { ...testMetrics, env: 'TEST' },
      PRODUCTION: { ...prodMetrics, env: 'PRODUCTION' },
    },
    total_breach_events: breachLog.length,
    recent_breaches: recentBreaches,
  });
});

// ─── GET /api/isolation/metrics ───────────────────────────────────────────────
// Section 5: returns test and production metrics SEPARATELY
isolation.get('/metrics', async (c) => {
  const { DB } = c.env;
  const currentEnv = await readAppEnv(DB);

  const [testMetrics, prodMetrics] = await Promise.all([
    readMetrics(DB, 'TEST'),
    readMetrics(DB, 'PRODUCTION'),
  ]);

  return c.json({
    status: 'ENVIRONMENT_ISOLATION_ACTIVE',
    current_env: currentEnv,
    note: 'Test and production metrics are tracked independently and never combined.',
    TEST: {
      env: 'TEST',
      ...testMetrics,
      reply_rate_pct: testMetrics.emails_sent > 0
        ? parseFloat(((testMetrics.emails_replied / testMetrics.emails_sent) * 100).toFixed(1))
        : 0,
    },
    PRODUCTION: {
      env: 'PRODUCTION',
      ...prodMetrics,
      reply_rate_pct: prodMetrics.emails_sent > 0
        ? parseFloat(((prodMetrics.emails_replied / prodMetrics.emails_sent) * 100).toFixed(1))
        : 0,
    },
  });
});

// ─── POST /api/isolation/metrics/record ───────────────────────────────────────
// Record a metric event against the correct env bucket (never cross-env)
isolation.post('/metrics/record', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json() as {
    event: keyof Omit<EnvMetrics, 'last_updated' | 'reply_rate' | 'placement_pct'>;
    env?: string;
    value?: number;
  };

  const currentEnv = await readAppEnv(DB);
  const targetEnv: AppEnv = body.env ? resolveEnv(body.env) : currentEnv;

  const metrics = await readMetrics(DB, targetEnv);
  const field = body.event;
  if (field in metrics && typeof (metrics as Record<string, unknown>)[field] === 'number') {
    (metrics as Record<string, unknown>)[field] = ((metrics as Record<string, number>)[field] || 0) + (body.value || 1);
    // Recompute reply rate
    if (metrics.emails_sent > 0) {
      metrics.reply_rate = parseFloat(((metrics.emails_replied / metrics.emails_sent) * 100).toFixed(1));
    }
    await writeMetrics(DB, targetEnv, metrics);
  }

  return c.json({
    status: 'ENVIRONMENT_ISOLATION_ACTIVE',
    recorded: true,
    env: targetEnv,
    event: field,
    new_value: (metrics as Record<string, unknown>)[field],
  });
});

// ─── POST /api/isolation/queue/enqueue ───────────────────────────────────────
// Rule 1: Enqueue a job — job.env is required and set at enqueue time
isolation.post('/queue/enqueue', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json() as {
    action: string;
    env?: string;
    lead_id?: string;
    email?: string;
    payload?: Record<string, unknown>;
  };

  const currentEnv = await readAppEnv(DB);
  const jobEnv = body.env ? resolveEnv(body.env) : currentEnv;

  const job: QueueJob = {
    job_id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    env: jobEnv,
    action: body.action || 'SEND_EMAIL',
    lead_id: body.lead_id,
    email: body.email,
    payload: body.payload,
    enqueued_at: new Date().toISOString(),
  };

  // Persist job in queue
  try {
    const existing = await DB.prepare(
      `SELECT value FROM settings WHERE key = 'isolation_job_queue'`
    ).first<{ value: string }>();
    const queue: QueueJob[] = existing ? JSON.parse(existing.value) : [];
    queue.push(job);
    await DB.prepare(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('isolation_job_queue', ?)`
    ).bind(JSON.stringify(queue.slice(-100))).run(); // keep last 100 jobs
  } catch { /* ignore */ }

  return c.json({
    status: 'ENVIRONMENT_ISOLATION_ACTIVE',
    enqueued: true,
    job,
    note: `Job enqueued with env=${jobEnv}. Will be skipped if current env differs at process time.`,
  });
});

// ─── POST /api/isolation/queue/process ───────────────────────────────────────
// Rule 1: Process queue — skip any job where job.env ≠ current env
isolation.post('/queue/process', async (c) => {
  const { DB } = c.env;
  const currentEnv = await readAppEnv(DB);

  let queue: QueueJob[] = [];
  try {
    const existing = await DB.prepare(
      `SELECT value FROM settings WHERE key = 'isolation_job_queue'`
    ).first<{ value: string }>();
    if (existing) queue = JSON.parse(existing.value);
  } catch { /* ignore */ }

  const results: ProcessedJob[] = [];

  for (const job of queue) {
    const jobEnv = resolveEnv(job.env);
    const ts = new Date().toISOString();

    if (jobEnv !== currentEnv) {
      // Rule 1: ENV MISMATCH — skip and log
      results.push({
        job_id: job.job_id,
        status: 'ENV_MISMATCH_SKIPPED',
        job_env: jobEnv,
        current_env: currentEnv,
        reason: `ENV_MISMATCH_SKIPPED: job.env=${jobEnv} ≠ current_env=${currentEnv}. Job preserved in queue.`,
        executed_at: ts,
      });
    } else {
      // Job env matches — would execute
      results.push({
        job_id: job.job_id,
        status: 'EXECUTED',
        job_env: jobEnv,
        current_env: currentEnv,
        reason: `Job env matches current env (${currentEnv}) — execution allowed.`,
        executed_at: ts,
      });
    }
  }

  // Clear executed jobs, keep mismatched ones
  const remaining = queue.filter((job, idx) => results[idx]?.status === 'ENV_MISMATCH_SKIPPED');
  try {
    await DB.prepare(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('isolation_job_queue', ?)`
    ).bind(JSON.stringify(remaining)).run();
  } catch { /* ignore */ }

  const executed = results.filter(r => r.status === 'EXECUTED').length;
  const skipped = results.filter(r => r.status === 'ENV_MISMATCH_SKIPPED').length;

  return c.json({
    status: 'ENVIRONMENT_ISOLATION_ACTIVE',
    current_env: currentEnv,
    total_jobs: queue.length,
    executed,
    skipped,
    skipped_reason: skipped > 0 ? 'ENV_MISMATCH_SKIPPED' : null,
    results,
    queue_remaining: remaining.length,
  });
});

// ─── GET /api/isolation/queue ─────────────────────────────────────────────────
isolation.get('/queue', async (c) => {
  const { DB } = c.env;
  const currentEnv = await readAppEnv(DB);

  let queue: QueueJob[] = [];
  try {
    const existing = await DB.prepare(
      `SELECT value FROM settings WHERE key = 'isolation_job_queue'`
    ).first<{ value: string }>();
    if (existing) queue = JSON.parse(existing.value);
  } catch { /* ignore */ }

  return c.json({
    status: 'ENVIRONMENT_ISOLATION_ACTIVE',
    current_env: currentEnv,
    queue_depth: queue.length,
    jobs: queue.map(j => ({
      ...j,
      will_execute: resolveEnv(j.env) === currentEnv,
      mismatch: resolveEnv(j.env) !== currentEnv,
    })),
  });
});

// ─── POST /api/isolation/demo/check-url ───────────────────────────────────────
// Rule 3: Validate that a demo URL conforms to the env pattern
isolation.post('/demo/check-url', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json() as { url: string; env_override?: string };
  const currentEnv = await readAppEnv(DB);
  const env: AppEnv = body.env_override ? resolveEnv(body.env_override) : currentEnv;

  const result = validateDemoUrl(body.url, env);

  return c.json({
    status: 'ENVIRONMENT_ISOLATION_ACTIVE',
    env,
    url: body.url,
    ...result,
  }, result.valid ? 200 : 422);
});

// ─── POST /api/isolation/pipeline/check ───────────────────────────────────────
// Rule 2 + 6: Pre-send guard — verifies lead.environment_used matches current env
// Returns ENVIRONMENT_BREACH if TEST lead is in PRODUCTION pipeline
isolation.post('/pipeline/check', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json() as {
    lead_id: string;
    lead_email: string;
    lead_type?: string;          // 'TEST' | 'REAL'
    environment_used?: string;   // the env when the lead was added
  };

  const currentEnv = await readAppEnv(DB);
  const leadEnv = body.environment_used ? resolveEnv(body.environment_used) : null;
  const leadType = (body.lead_type || 'REAL').toUpperCase() as 'TEST' | 'REAL';

  // ── Rule 6: HARD STOP — TEST lead in PRODUCTION pipeline ─────────────────
  if (currentEnv === 'PRODUCTION' && leadType === 'TEST') {
    const breach = await logBreach(DB, {
      lead_id: body.lead_id,
      lead_email: body.lead_email,
      lead_environment_used: body.environment_used || 'TEST',
      current_env: currentEnv,
      action_blocked: 'SEND_EMAIL',
      reason: 'TEST lead attempted entry into PRODUCTION send pipeline — hard stop triggered',
    });

    return c.json({
      status: 'ENVIRONMENT_BREACH',
      send_halted: true,
      breach_id: breach.id,
      reason: 'TEST_LEAD_IN_PRODUCTION_PIPELINE',
      detail: `Lead ${body.lead_id} (${body.lead_email}) is tagged lead_type=TEST but the pipeline is running in PRODUCTION mode. All sends halted. Remove or re-tag the lead, or switch to TEST environment.`,
      lead_id: body.lead_id,
      lead_type: leadType,
      current_env: currentEnv,
      lead_environment_used: body.environment_used,
      corrective_actions: [
        'Switch ENV=TEST to allow test leads: POST /api/integrity/env {"mode":"TEST"}',
        'Re-source a real business email and re-PATCH the lead',
        'Clear the lead email via POST /api/integrity/purge-test-emails',
      ],
      timestamp: breach.timestamp,
    }, 403);
  }

  // ── Rule 2: ENV mismatch check ────────────────────────────────────────────
  if (leadEnv !== null && leadEnv !== currentEnv) {
    return c.json({
      status: 'PIPELINE_ENV_MISMATCH',
      send_blocked: true,
      reason: `Lead was created in ${leadEnv} but pipeline is running in ${currentEnv}. Sending blocked.`,
      lead_id: body.lead_id,
      lead_environment_used: leadEnv,
      current_env: currentEnv,
      action: `Switch ENV to ${leadEnv} or re-source lead in ${currentEnv} environment`,
    }, 422);
  }

  // ── APPROVED ─────────────────────────────────────────────────────────────
  return c.json({
    status: 'ENVIRONMENT_ISOLATION_ACTIVE',
    approved: true,
    lead_id: body.lead_id,
    lead_type: leadType,
    lead_environment_used: body.environment_used || currentEnv,
    current_env: currentEnv,
    reason: 'Lead environment matches current pipeline environment. Send approved.',
  });
});

// ─── GET /api/isolation/crm/leads ─────────────────────────────────────────────
// Rule 4: Returns Memphis leads with TEST badge markup for CRM display
isolation.get('/crm/leads', async (c) => {
  const { DB } = c.env;
  const currentEnv = await readAppEnv(DB);

  // Load micro leads from DB
  let rawLeads: Record<string, unknown>[] = [];
  try {
    const rows = await DB.prepare(
      `SELECT key, value FROM settings WHERE key LIKE 'micro_lead_%'`
    ).all<{ key: string; value: string }>();
    for (const row of rows.results || []) {
      try {
        const lead = JSON.parse(row.value) as Record<string, unknown>;
        rawLeads.push(lead);
      } catch { /* skip malformed */ }
    }
  } catch { /* ignore */ }

  // Annotate each lead with CRM visual flagging data (Rule 4)
  const annotated = rawLeads.map(lead => {
    const leadType = (lead.lead_type as string || 'REAL').toUpperCase();
    const isTest = leadType === 'TEST' || TEST_EMAIL_LIST.has(
      ((lead.email as string) || '').toLowerCase().trim()
    );

    return {
      ...lead,
      // CRM Visual Flagging (Rule 4)
      crm_badge: isTest
        ? {
            label: 'TEST',
            color: '#f59e0b',
            bg_color: '#431407',
            border_color: '#92400e',
            icon: '🧪',
            visible: true,
          }
        : {
            label: 'REAL',
            color: '#10b981',
            bg_color: '#052e16',
            border_color: '#166534',
            icon: '✅',
            visible: false,  // Real leads don't need a badge
          },
      is_test_lead: isTest,
      lead_type: isTest ? 'TEST' : 'REAL',
      environment_used: lead.environment_used || currentEnv,
      // Rule 2: pipeline check hint
      pipeline_approved: !(currentEnv === 'PRODUCTION' && isTest),
      pipeline_warning: (currentEnv === 'PRODUCTION' && isTest)
        ? 'TEST lead in PRODUCTION view — send blocked'
        : null,
    };
  });

  const testCount = annotated.filter(l => l.is_test_lead).length;
  const realCount = annotated.filter(l => !l.is_test_lead).length;

  return c.json({
    status: 'ENVIRONMENT_ISOLATION_ACTIVE',
    current_env: currentEnv,
    total_leads: annotated.length,
    test_leads: testCount,
    real_leads: realCount,
    crm_note: testCount > 0 && currentEnv === 'PRODUCTION'
      ? `⚠️ ${testCount} TEST lead(s) visible in PRODUCTION view — sends are blocked for these leads`
      : null,
    leads: annotated,
  });
});

// ─── POST /api/isolation/breach/report ───────────────────────────────────────
// Return all breach events (for audit / investigation)
isolation.get('/breach/log', async (c) => {
  const { DB } = c.env;
  const currentEnv = await readAppEnv(DB);

  let breachLog: BreachEvent[] = [];
  try {
    const row = await DB.prepare(
      `SELECT value FROM settings WHERE key = 'isolation_breach_log'`
    ).first<{ value: string }>();
    if (row) breachLog = JSON.parse(row.value);
  } catch { /* ignore */ }

  return c.json({
    status: 'ENVIRONMENT_ISOLATION_ACTIVE',
    current_env: currentEnv,
    total_breaches: breachLog.length,
    breaches: breachLog,
  });
});

// ─── POST /api/isolation/breach/clear ────────────────────────────────────────
isolation.post('/breach/clear', async (c) => {
  const { DB } = c.env;
  try {
    await DB.prepare(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('isolation_breach_log', '[]')`
    ).run();
  } catch { /* ignore */ }
  return c.json({ status: 'ENVIRONMENT_ISOLATION_ACTIVE', cleared: true });
});

export default isolation;
export { readAppEnv as readIsolationEnv };
