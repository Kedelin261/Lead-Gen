// ============================================================
// EXECUTION ISOLATION ENGINE
//
// Enforces strict TEST ↔ PRODUCTION separation across:
//   Section 1 — Job queue (ENV tag on every job, mismatch = skip)
//   Section 2 — Send pipeline guard (environment_used check)
//   Section 3 — Demo URL isolation (/demo/test/ vs /demo/)
//   Section 4 — CRM visual flagging (badge metadata)
//   Section 5 — Metrics separation (test vs production)
//   Section 6 — Hard breach detection (TEST lead in PROD pipeline)
// ============================================================

import type { AppEnv } from './lead-integrity';

// ─── SECTION 1: JOB QUEUE ISOLATION ─────────────────────────────────────────

export type JobStatus =
  | 'QUEUED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'FAILED'
  | 'ENV_MISMATCH_SKIPPED';

export interface QueuedJob {
  id: string;
  env: AppEnv;                      // REQUIRED — every job must declare its env
  type: 'SEND_EMAIL' | 'SEND_SMS' | 'SEND_FOLLOWUP' | 'SEND_LINK' | 'TRACK_EVENT';
  lead_id: string;
  lead_type: 'TEST' | 'REAL';
  environment_used: AppEnv;         // the env the lead was created in
  payload: Record<string, unknown>;
  created_at: string;
  status: JobStatus;
  skip_reason?: string;
}

export interface JobQueueResult {
  job_id: string;
  executed: boolean;
  status: JobStatus;
  skip_reason?: string;
  env_matched: boolean;
}

/**
 * Section 1 — Queue gate: check job.env against current runtime env.
 * If they don't match → skip, log ENV_MISMATCH_SKIPPED.
 */
export function checkJobEnvMatch(job: QueuedJob, currentEnv: AppEnv): JobQueueResult {
  if (job.env !== currentEnv) {
    return {
      job_id: job.id,
      executed: false,
      status: 'ENV_MISMATCH_SKIPPED',
      skip_reason: `ENV_MISMATCH_SKIPPED — job.env="${job.env}" does not match current ENV="${currentEnv}". Job preserved in queue; switch to ${job.env} to execute.`,
      env_matched: false,
    };
  }

  return {
    job_id: job.id,
    executed: true,
    status: 'EXECUTING',
    env_matched: true,
  };
}

/**
 * Filter a batch of jobs to only those matching currentEnv.
 * Returns { eligible, skipped } with full skip audit.
 */
export function filterJobsByEnv(
  jobs: QueuedJob[],
  currentEnv: AppEnv
): {
  eligible: QueuedJob[];
  skipped: JobQueueResult[];
  total: number;
  eligible_count: number;
  skipped_count: number;
} {
  const eligible: QueuedJob[] = [];
  const skipped: JobQueueResult[] = [];

  for (const job of jobs) {
    const result = checkJobEnvMatch(job, currentEnv);
    if (result.executed) {
      eligible.push(job);
    } else {
      skipped.push(result);
    }
  }

  return {
    eligible,
    skipped,
    total: jobs.length,
    eligible_count: eligible.length,
    skipped_count: skipped.length,
  };
}

// ─── SECTION 2: SEND PIPELINE GUARD ─────────────────────────────────────────

export interface PipelineGuardResult {
  allowed: boolean;
  breach_detected: boolean;
  reason: string;
  guard_code: string;
}

/**
 * Section 2 + 6 — Hard check before any send.
 * lead.environment_used MUST equal currentEnv.
 * A TEST lead entering PRODUCTION pipeline = ENVIRONMENT_BREACH → halt all.
 */
export function checkSendPipelineGuard(
  lead: { lead_type: 'TEST' | 'REAL'; environment_used: AppEnv },
  currentEnv: AppEnv
): PipelineGuardResult {

  // Section 6: TEST lead attempting PRODUCTION send = hard breach
  if (lead.lead_type === 'TEST' && currentEnv === 'PRODUCTION') {
    return {
      allowed: false,
      breach_detected: true,
      reason: 'TEST lead detected in PRODUCTION send pipeline. All sends halted.',
      guard_code: 'ENVIRONMENT_BREACH',
    };
  }

  // Section 2: environment_used mismatch
  if (lead.environment_used !== currentEnv) {
    return {
      allowed: false,
      breach_detected: false,
      reason: `Lead was created in ENV=${lead.environment_used} but current ENV=${currentEnv}. Send blocked — ENV mismatch.`,
      guard_code: 'ENV_MISMATCH_BLOCKED',
    };
  }

  return {
    allowed: true,
    breach_detected: false,
    reason: `Lead env matches current env (${currentEnv}). Pipeline clear.`,
    guard_code: 'PIPELINE_CLEAR',
  };
}

// ─── SECTION 3: DEMO URL ISOLATION ──────────────────────────────────────────

export interface DemoUrlResult {
  url: string;
  valid: boolean;
  reason: string;
  env: AppEnv;
}

const TEST_DEMO_PATH_MARKER = '/demo/test/';
const PROD_DEMO_PATH_MARKER = '/demo/';

/**
 * Section 3 — Validate that demo URL matches env.
 * TEST  → must include /demo/test/
 * PROD  → must NOT include /test/ anywhere in path
 */
export function validateDemoUrl(url: string, env: AppEnv): DemoUrlResult {
  if (!url) {
    return { url, valid: false, reason: 'Demo URL is empty.', env };
  }

  if (env === 'TEST') {
    if (!url.includes(TEST_DEMO_PATH_MARKER)) {
      return {
        url,
        valid: false,
        reason: `TEST env requires demo URL to include "${TEST_DEMO_PATH_MARKER}". Got: ${url}`,
        env,
      };
    }
    return { url, valid: true, reason: `Demo URL correctly scoped to TEST path.`, env };
  }

  // PRODUCTION — must NOT contain /test/
  if (url.includes('/test/')) {
    return {
      url,
      valid: false,
      reason: `PRODUCTION demo URL must not include "/test/" path segment. Got: ${url}`,
      env,
    };
  }
  return { url, valid: true, reason: `Demo URL correctly scoped to PRODUCTION path.`, env };
}

/**
 * Build a correctly-scoped demo URL for a given env.
 */
export function buildDemoUrl(
  baseUrl: string,
  slug: string,
  env: AppEnv
): string {
  const base = baseUrl.replace(/\/$/, '');
  if (env === 'TEST') {
    return `${base}/demo/test/${slug}`;
  }
  return `${base}/demo/${slug}`;
}

// ─── SECTION 4: CRM VISUAL FLAGGING ─────────────────────────────────────────

export interface LeadBadge {
  label: string;
  color: string;
  bg_color: string;
  border_color: string;
  icon: string;
  visible: boolean;
}

/**
 * Section 4 — Return badge metadata for CRM display.
 * TEST leads get a distinct visual marker to prevent confusion.
 */
export function getLeadBadge(
  lead_type: 'TEST' | 'REAL',
  environment_used: AppEnv
): LeadBadge {
  if (lead_type === 'TEST') {
    return {
      label: 'TEST',
      color: '#f59e0b',
      bg_color: '#431407',
      border_color: '#92400e',
      icon: '🧪',
      visible: true,
    };
  }

  if (environment_used === 'TEST') {
    // Real lead that was used in test context
    return {
      label: 'TEST-CTX',
      color: '#fb923c',
      bg_color: '#3a1a00',
      border_color: '#7c2d12',
      icon: '⚠️',
      visible: true,
    };
  }

  return {
    label: 'REAL',
    color: '#4ade80',
    bg_color: '#052e16',
    border_color: '#166534',
    icon: '✅',
    visible: false, // real leads don't need a prominent badge
  };
}

// ─── SECTION 5: METRICS SEPARATION ───────────────────────────────────────────

export interface IsolatedMetrics {
  test: EnvMetrics;
  production: EnvMetrics;
  combined_disabled: true;           // explicitly signals: DO NOT combine
  isolation_active: true;
}

export interface EnvMetrics {
  env: AppEnv;
  total_sent: number;
  total_replies: number;
  total_interested: number;
  total_clicked: number;
  total_closed: number;
  reply_rate: number;
  interest_rate: number;
  click_rate: number;
  close_rate: number;
  placement: {
    primary: number;
    promotions: number;
    spam: number;
    unknown: number;
    primary_rate: number;
  };
}

function emptyMetrics(env: AppEnv): EnvMetrics {
  return {
    env,
    total_sent: 0,
    total_replies: 0,
    total_interested: 0,
    total_clicked: 0,
    total_closed: 0,
    reply_rate: 0,
    interest_rate: 0,
    click_rate: 0,
    close_rate: 0,
    placement: { primary: 0, promotions: 0, spam: 0, unknown: 0, primary_rate: 0 },
  };
}

function rate(num: number, denom: number): number {
  return denom > 0 ? parseFloat(((num / denom) * 100).toFixed(1)) : 0;
}

/**
 * Section 5 — Compute metrics split by environment_used.
 * TEST and PRODUCTION buckets are NEVER combined.
 */
export function computeIsolatedMetrics(
  leads: Array<{
    lead_type: 'TEST' | 'REAL';
    environment_used: AppEnv;
    tracking: {
      sent: boolean;
      replied: boolean;
      interested: boolean;
      clicked: boolean;
      closed: boolean;
    };
    placement?: 'PRIMARY' | 'PROMOTIONS' | 'SPAM' | 'UNKNOWN';
  }>
): IsolatedMetrics {
  const buckets: Record<AppEnv, EnvMetrics> = {
    TEST: emptyMetrics('TEST'),
    PRODUCTION: emptyMetrics('PRODUCTION'),
  };

  for (const lead of leads) {
    // Section 5: route to correct bucket by environment_used
    // TEST leads ALWAYS go to TEST bucket, even if current env is PRODUCTION
    const bucket = lead.lead_type === 'TEST' ? buckets['TEST'] : buckets[lead.environment_used];

    if (lead.tracking.sent)       bucket.total_sent++;
    if (lead.tracking.replied)    bucket.total_replies++;
    if (lead.tracking.interested) bucket.total_interested++;
    if (lead.tracking.clicked)    bucket.total_clicked++;
    if (lead.tracking.closed)     bucket.total_closed++;

    const p = lead.placement || 'UNKNOWN';
    if (p === 'PRIMARY')    bucket.placement.primary++;
    else if (p === 'PROMOTIONS') bucket.placement.promotions++;
    else if (p === 'SPAM')  bucket.placement.spam++;
    else                    bucket.placement.unknown++;
  }

  // Calculate rates per bucket
  for (const env of ['TEST', 'PRODUCTION'] as AppEnv[]) {
    const b = buckets[env];
    const sent = b.total_sent;
    b.reply_rate    = rate(b.total_replies,    sent);
    b.interest_rate = rate(b.total_interested, sent);
    b.click_rate    = rate(b.total_clicked,    sent);
    b.close_rate    = rate(b.total_closed,     sent);
    const totalPlacements = b.placement.primary + b.placement.promotions + b.placement.spam + b.placement.unknown;
    b.placement.primary_rate = rate(b.placement.primary, totalPlacements);
  }

  return {
    test: buckets['TEST'],
    production: buckets['PRODUCTION'],
    combined_disabled: true,
    isolation_active: true,
  };
}

// ─── SECTION 6: ENVIRONMENT BREACH RESPONSE ──────────────────────────────────

export interface BreachReport {
  status: 'ENVIRONMENT_BREACH';
  action: 'HALTED';
  reason: string;
  breach_lead_id?: string;
  breach_lead_type?: string;
  breach_environment_used?: AppEnv;
  current_env: AppEnv;
  timestamp: string;
}

export function buildBreachReport(
  currentEnv: AppEnv,
  breachLeadId?: string,
  breachLeadType?: string,
  breachEnvUsed?: AppEnv
): BreachReport {
  return {
    status: 'ENVIRONMENT_BREACH',
    action: 'HALTED',
    reason: 'TEST_LEAD_IN_PRODUCTION_PIPELINE',
    breach_lead_id: breachLeadId,
    breach_lead_type: breachLeadType,
    breach_environment_used: breachEnvUsed,
    current_env: currentEnv,
    timestamp: new Date().toISOString(),
  };
}
