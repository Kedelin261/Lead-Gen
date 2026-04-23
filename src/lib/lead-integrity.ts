// ============================================================
// LEAD INTEGRITY + ENVIRONMENT CONTROL ENGINE
//
// ENV = "TEST" | "PRODUCTION"  (default: PRODUCTION)
//
// TEST mode  → test emails ALLOWED, tagged lead_type="TEST"
// PRODUCTION → test emails BLOCKED, NOT deleted, NOT globally removed
//
// Test emails are never destroyed — they are context-filtered.
// ============================================================

// ─── SECTION 1: ENVIRONMENT DEFINITION ───────────────────────────────────────
export type AppEnv = 'TEST' | 'PRODUCTION';
export const DEFAULT_ENV: AppEnv = 'PRODUCTION';

// ─── SECTION 2 + 3: TEST EMAIL REGISTRY ──────────────────────────────────────
// These are PRESERVED for testing — not deleted, not globally blocked.
// Behavior is determined by ENV at runtime.
export const TEST_EMAIL_LIST: Set<string> = new Set([
  'kedelin261@gmail.com',
  'jkbarclay261@gmail.com',
  'mkbrown261@gmail.com',
  'edelinken@gmail.com',
  'kceesq@gmail.com',
  'mnbrown261@gmail.com',
  'mbrown261@gmail.com',
]);

// Infrastructure emails — ALWAYS blocked regardless of ENV
// (own domain, system addresses — never outreach targets)
export const INFRA_EMAIL_BLOCKLIST: Set<string> = new Set([
  'alex@websitedemopro.org',
  'admin@websitedemopro.org',
  'noreply@websitedemopro.org',
  'support@websitedemopro.org',
  'dmarc@websitedemopro.org',
]);

// Own domains — always blocked (cannot send to ourselves)
export const BLOCKED_DOMAINS: Set<string> = new Set([
  'websitedemopro.org',
  'leadgenpro.com',
]);

// Personal domains — require business verification
export const PERSONAL_DOMAINS: Set<string> = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'me.com',
  'live.com',
]);

// Keep INTERNAL_EMAIL_BLOCKLIST as a union alias for backward compatibility
// (infra + test — but behavior differs: test emails are env-filtered, not hard-blocked)
export const INTERNAL_EMAIL_BLOCKLIST: Set<string> = new Set([
  ...TEST_EMAIL_LIST,
  ...INFRA_EMAIL_BLOCKLIST,
]);

// ─── SECTION 4: LEAD TAGGING ──────────────────────────────────────────────────
export type LeadType = 'TEST' | 'REAL';

export interface LeadCandidate {
  email: string;
  business_name: string;
  phone?: string;
  city?: string;
  industry?: string;
  source?: string;
  website_status?: 'NONE' | 'WEAK' | 'EXISTS';
  // Section 4 tags — set by engine, not by caller
  lead_type?: LeadType;
  environment_used?: AppEnv;
}

export type ValidationStatus = 'ACCEPTED' | 'REJECTED';

export interface LeadAuditEntry {
  email: string;
  business_name: string;
  status: ValidationStatus;
  reason: string;
  rejection_code?: string;
  lead_type: LeadType;
  environment_used: AppEnv;
  timestamp: string;
  checks_passed: string[];
  checks_failed: string[];
}

export interface IntegrityReport {
  status: 'ENVIRONMENT_FILTER_ACTIVE' | 'DATA_INTEGRITY_FAILURE' | 'SCRAPER_INSUFFICIENT_DATA';
  mode: AppEnv;
  test_emails_blocked_in_production: boolean;
  valid_leads: number;
  rejected_leads: number;
  rejection_rate_pct: number;
  ready_for_outreach: boolean;
  audit_log: LeadAuditEntry[];
  accepted: LeadCandidate[];
  rejected: LeadCandidate[];
  hard_stop_triggered: boolean;
  hard_stop_reason?: string;
}

// ─── SECTION 5 + 7: ENVIRONMENT-AWARE LEAD VALIDATION ────────────────────────
export function validateLead(
  lead: LeadCandidate,
  env: AppEnv = DEFAULT_ENV,
  previouslySentEmails: Set<string> = new Set()
): LeadAuditEntry {
  const ts = new Date().toISOString();
  const passed: string[] = [];
  const failed: string[] = [];

  const email = (lead.email || '').toLowerCase().trim();
  const domain = email.includes('@') ? email.split('@')[1] : '';

  // ── Check 1: Email format ─────────────────────────────────────────────────
  if (!email || !email.includes('@') || !domain) {
    failed.push('MISSING_EMAIL');
    return {
      email: lead.email || '(empty)',
      business_name: lead.business_name || '(unknown)',
      status: 'REJECTED',
      reason: 'Email field is missing or malformed.',
      rejection_code: 'MISSING_EMAIL',
      lead_type: 'REAL',
      environment_used: env,
      timestamp: ts,
      checks_passed: passed,
      checks_failed: failed,
    };
  }
  passed.push('EMAIL_FORMAT_OK');

  // ── Check 2: Infrastructure blocklist (ALWAYS blocked, ENV irrelevant) ────
  if (INFRA_EMAIL_BLOCKLIST.has(email)) {
    failed.push('INFRA_EMAIL_BLOCKED');
    return {
      email,
      business_name: lead.business_name,
      status: 'REJECTED',
      reason: `Infrastructure address — own system email cannot be an outreach target in any environment.`,
      rejection_code: 'INFRA_EMAIL_BLOCKED',
      lead_type: 'REAL',
      environment_used: env,
      timestamp: ts,
      checks_passed: passed,
      checks_failed: failed,
    };
  }
  passed.push('NOT_INFRA_EMAIL');

  // ── Check 3: Own domain (ALWAYS blocked) ─────────────────────────────────
  if (BLOCKED_DOMAINS.has(domain)) {
    failed.push('BLOCKED_DOMAIN');
    return {
      email,
      business_name: lead.business_name,
      status: 'REJECTED',
      reason: `Domain "${domain}" is our own infrastructure — cannot send outreach to own domain.`,
      rejection_code: 'BLOCKED_DOMAIN',
      lead_type: 'REAL',
      environment_used: env,
      timestamp: ts,
      checks_passed: passed,
      checks_failed: failed,
    };
  }
  passed.push('DOMAIN_NOT_BLOCKED');

  // ── Check 4: TEST EMAIL — Section 2/3 logic ───────────────────────────────
  const isTestEmail = TEST_EMAIL_LIST.has(email);

  if (isTestEmail) {
    if (env === 'PRODUCTION') {
      // Section 5: HARD BLOCK in production — do NOT send, do NOT delete
      failed.push('TEST_EMAIL_IN_PRODUCTION');
      return {
        email,
        business_name: lead.business_name,
        status: 'REJECTED',
        reason: `Test email blocked in PRODUCTION mode. This address is reserved for TEST environment only. Email is preserved — switch to ENV=TEST to use it.`,
        rejection_code: 'TEST_EMAIL_IN_PRODUCTION',
        lead_type: 'TEST',
        environment_used: env,
        timestamp: ts,
        checks_passed: passed,
        checks_failed: failed,
      };
    } else {
      // ENV === 'TEST' — Section 2: allow, tag as TEST
      passed.push('TEST_EMAIL_ALLOWED_IN_TEST_ENV');
      return {
        email,
        business_name: lead.business_name,
        status: 'ACCEPTED',
        reason: `Test email allowed in TEST environment. Tagged as lead_type=TEST.`,
        rejection_code: undefined,
        lead_type: 'TEST',
        environment_used: 'TEST',
        timestamp: ts,
        checks_passed: passed,
        checks_failed: [],
      };
    }
  }
  passed.push('NOT_TEST_EMAIL');

  // ── Check 5: Duplicate / previously sent ─────────────────────────────────
  if (previouslySentEmails.has(email)) {
    failed.push('DUPLICATE_EMAIL');
    return {
      email,
      business_name: lead.business_name,
      status: 'REJECTED',
      reason: `Email already exists in a previous send batch. Duplicate outreach blocked.`,
      rejection_code: 'DUPLICATE_EMAIL',
      lead_type: 'REAL',
      environment_used: env,
      timestamp: ts,
      checks_passed: passed,
      checks_failed: failed,
    };
  }
  passed.push('NOT_DUPLICATE');

  // ── Check 6: Required fields ─────────────────────────────────────────────
  const missingFields: string[] = [];
  if (!lead.business_name?.trim()) missingFields.push('business_name');
  if (!lead.phone?.trim())         missingFields.push('phone_number');
  if (!lead.city?.trim())          missingFields.push('city');
  if (!lead.industry?.trim())      missingFields.push('industry');

  if (missingFields.length > 0) {
    failed.push('MISSING_REQUIRED_FIELDS');
    return {
      email,
      business_name: lead.business_name || '(unknown)',
      status: 'REJECTED',
      reason: `Missing required fields: ${missingFields.join(', ')}.`,
      rejection_code: 'MISSING_REQUIRED_FIELDS',
      lead_type: 'REAL',
      environment_used: env,
      timestamp: ts,
      checks_passed: passed,
      checks_failed: failed,
    };
  }
  passed.push('REQUIRED_FIELDS_PRESENT');

  // ── Check 7: Personal domain → must have real source ─────────────────────
  if (PERSONAL_DOMAINS.has(domain)) {
    const hasSource = !!(
      lead.source &&
      lead.source !== '' &&
      !['test', 'fallback', 'internal', 'mock', 'seed', 'demo'].includes(lead.source.toLowerCase())
    );
    if (!hasSource) {
      failed.push('PERSONAL_DOMAIN_UNVERIFIED');
      return {
        email,
        business_name: lead.business_name,
        status: 'REJECTED',
        reason: `Personal domain (${domain}) requires a verified business source (Google Maps, Yelp, or directory). Set the source field.`,
        rejection_code: 'PERSONAL_DOMAIN_UNVERIFIED',
        lead_type: 'REAL',
        environment_used: env,
        timestamp: ts,
        checks_passed: passed,
        checks_failed: failed,
      };
    }
    passed.push('PERSONAL_DOMAIN_BUSINESS_VERIFIED');
  } else {
    passed.push('BUSINESS_DOMAIN');
  }

  // ── Check 8: Source must not be test/internal/fallback ───────────────────
  const blockedSources = ['test', 'fallback', 'internal', 'mock', 'seed', 'demo'];
  if (lead.source && blockedSources.includes(lead.source.toLowerCase())) {
    failed.push('BLOCKED_SOURCE');
    return {
      email,
      business_name: lead.business_name,
      status: 'REJECTED',
      reason: `Source "${lead.source}" is not a real external source. Use: google_maps, yelp, osm, yellowpages, etc.`,
      rejection_code: 'BLOCKED_SOURCE',
      lead_type: 'REAL',
      environment_used: env,
      timestamp: ts,
      checks_passed: passed,
      checks_failed: failed,
    };
  }
  passed.push('SOURCE_VALID');

  // ── ALL CHECKS PASSED ─────────────────────────────────────────────────────
  return {
    email,
    business_name: lead.business_name,
    status: 'ACCEPTED',
    reason: 'All integrity checks passed. Lead is a verified external business contact.',
    lead_type: 'REAL',
    environment_used: env,
    timestamp: ts,
    checks_passed: passed,
    checks_failed: [],
  };
}

// ─── PIPELINE GATE ────────────────────────────────────────────────────────────
// Counts only INFRA/BLOCKED_DOMAIN/DUPLICATE rejections toward hard-stop.
// TEST_EMAIL_IN_PRODUCTION is NOT a hard-stop trigger — it's expected behavior.
const HARD_STOP_REJECTION_THRESHOLD = 0.10;

export function runIntegrityGate(
  leads: LeadCandidate[],
  env: AppEnv = DEFAULT_ENV,
  previouslySentEmails: Set<string> = new Set()
): IntegrityReport {

  if (leads.length === 0) {
    return {
      status: 'SCRAPER_INSUFFICIENT_DATA',
      mode: env,
      test_emails_blocked_in_production: env === 'PRODUCTION',
      valid_leads: 0,
      rejected_leads: 0,
      rejection_rate_pct: 0,
      ready_for_outreach: false,
      audit_log: [],
      accepted: [],
      rejected: [],
      hard_stop_triggered: false,
    };
  }

  const audit_log: LeadAuditEntry[] = [];
  const accepted: LeadCandidate[] = [];
  const rejected: LeadCandidate[] = [];
  const seenEmails = new Set<string>(previouslySentEmails);

  for (const lead of leads) {
    const entry = validateLead(lead, env, seenEmails);
    audit_log.push(entry);

    if (entry.status === 'ACCEPTED') {
      // Section 4: tag the lead before accepting
      accepted.push({
        ...lead,
        lead_type: entry.lead_type,
        environment_used: env,
      });
      seenEmails.add(entry.email);
    } else {
      rejected.push({ ...lead, lead_type: entry.lead_type, environment_used: env });
    }
  }

  const total = leads.length;
  const rejectedCount = rejected.length;
  const rejection_rate_pct = parseFloat(((rejectedCount / total) * 100).toFixed(1));

  // Hard-stop: only triggered by true data integrity failures
  // (infra block, own domain, duplicate) — NOT by env-filtered test emails
  const hardIntegrityRejections = audit_log.filter(e =>
    e.status === 'REJECTED' &&
    ['INFRA_EMAIL_BLOCKED', 'BLOCKED_DOMAIN', 'DUPLICATE_EMAIL', 'BLOCKED_SOURCE'].includes(
      e.rejection_code || ''
    )
  ).length;

  const hardStop = hardIntegrityRejections / total > HARD_STOP_REJECTION_THRESHOLD;

  if (hardStop) {
    return {
      status: 'DATA_INTEGRITY_FAILURE',
      mode: env,
      test_emails_blocked_in_production: env === 'PRODUCTION',
      valid_leads: accepted.length,
      rejected_leads: rejectedCount,
      rejection_rate_pct,
      ready_for_outreach: false,
      audit_log,
      accepted: [],
      rejected,
      hard_stop_triggered: true,
      hard_stop_reason: `${(hardIntegrityRejections / total * 100).toFixed(1)}% of leads triggered hard integrity violations (infra emails, own domains, or duplicates). Pipeline halted.`,
    };
  }

  return {
    status: 'ENVIRONMENT_FILTER_ACTIVE',
    mode: env,
    test_emails_blocked_in_production: env === 'PRODUCTION',
    valid_leads: accepted.length,
    rejected_leads: rejectedCount,
    rejection_rate_pct,
    ready_for_outreach: accepted.length > 0,
    audit_log,
    accepted,
    rejected,
    hard_stop_triggered: false,
  };
}

// ─── SCRAPER INSUFFICIENT DATA ────────────────────────────────────────────────
export function scraperInsufficientData(found: number, required: number) {
  return {
    status: 'SCRAPER_INSUFFICIENT_DATA' as const,
    leads_found: found,
    required,
    action: 'EXPAND_SEARCH_OR_CHANGE_FILTERS',
  };
}

// ─── ENV HELPER ───────────────────────────────────────────────────────────────
export function resolveEnv(raw?: string | null): AppEnv {
  return (raw || '').toUpperCase() === 'TEST' ? 'TEST' : 'PRODUCTION';
}
