// ============================================================
// LEAD INTEGRITY ENFORCEMENT ENGINE
// Zero-tolerance for test/internal/fallback emails.
// Every lead must be a verified external business contact.
// ============================================================

// ─── SECTION 1: PERMANENT BLOCKLIST ──────────────────────────────────────────
export const INTERNAL_EMAIL_BLOCKLIST: Set<string> = new Set([
  // Warm-up test accounts (HARD BLOCK — used for inbox placement testing only)
  'kedelin261@gmail.com',
  'jkbarclay261@gmail.com',
  'mkbrown261@gmail.com',
  'edelinken@gmail.com',
  'kceesq@gmail.com',
  'mnbrown261@gmail.com',
  'mbrown261@gmail.com',
  // System / developer / own domain
  'alex@websitedemopro.org',
  'admin@websitedemopro.org',
  'noreply@websitedemopro.org',
  'support@websitedemopro.org',
  'dmarc@websitedemopro.org',
]);

// Any email on these domains is auto-blocked (our own infrastructure)
export const BLOCKED_DOMAINS: Set<string> = new Set([
  'websitedemopro.org',
  'leadgenpro.com',
]);

// Personal domains that require business verification before allowing
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

// ─── INTERFACES ──────────────────────────────────────────────────────────────
export interface LeadCandidate {
  email: string;
  business_name: string;
  phone?: string;
  city?: string;
  industry?: string;
  source?: string;           // 'google_maps' | 'yelp' | 'osm' | 'yellowpages' | etc.
  website_status?: 'NONE' | 'WEAK' | 'EXISTS';
}

export type ValidationStatus = 'ACCEPTED' | 'REJECTED';

export interface LeadAuditEntry {
  email: string;
  business_name: string;
  status: ValidationStatus;
  reason: string;
  timestamp: string;
  checks_passed: string[];
  checks_failed: string[];
}

export interface IntegrityReport {
  status: 'REAL_LEADS_ONLY' | 'DATA_INTEGRITY_FAILURE' | 'SCRAPER_INSUFFICIENT_DATA';
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

// ─── SECTION 7 + 8: VALIDATION CORE ─────────────────────────────────────────
export function validateLead(
  lead: LeadCandidate,
  previouslySentEmails: Set<string> = new Set()
): LeadAuditEntry {
  const ts = new Date().toISOString();
  const passed: string[] = [];
  const failed: string[] = [];

  const email = (lead.email || '').toLowerCase().trim();
  const domain = email.includes('@') ? email.split('@')[1] : '';

  // ── Check 1: Email exists ─────────────────────────────────────────────────
  if (!email || !email.includes('@') || !domain) {
    failed.push('MISSING_EMAIL');
    return {
      email: lead.email || '(empty)',
      business_name: lead.business_name || '(unknown)',
      status: 'REJECTED',
      reason: 'Email field is missing or malformed.',
      timestamp: ts,
      checks_passed: passed,
      checks_failed: failed,
    };
  }
  passed.push('EMAIL_FORMAT_OK');

  // ── Check 2: Blocklist (hard stop — specific addresses) ──────────────────
  if (INTERNAL_EMAIL_BLOCKLIST.has(email)) {
    failed.push('BLOCKLIST_HIT');
    return {
      email,
      business_name: lead.business_name,
      status: 'REJECTED',
      reason: `Email is on the internal/test blocklist. This address was used for warm-up testing and CANNOT receive real outreach.`,
      timestamp: ts,
      checks_passed: passed,
      checks_failed: failed,
    };
  }
  passed.push('NOT_IN_BLOCKLIST');

  // ── Check 3: Blocked domain (own infrastructure) ─────────────────────────
  if (BLOCKED_DOMAINS.has(domain)) {
    failed.push('BLOCKED_DOMAIN');
    return {
      email,
      business_name: lead.business_name,
      status: 'REJECTED',
      reason: `Domain "${domain}" is blocked — own infrastructure email cannot receive outreach.`,
      timestamp: ts,
      checks_passed: passed,
      checks_failed: failed,
    };
  }
  passed.push('DOMAIN_NOT_BLOCKED');

  // ── Check 4: Duplicate / previously sent ─────────────────────────────────
  if (previouslySentEmails.has(email)) {
    failed.push('DUPLICATE_EMAIL');
    return {
      email,
      business_name: lead.business_name,
      status: 'REJECTED',
      reason: `Email already exists in a previous send batch. Duplicate outreach blocked.`,
      timestamp: ts,
      checks_passed: passed,
      checks_failed: failed,
    };
  }
  passed.push('NOT_DUPLICATE');

  // ── Check 5: Required fields (Section 3) ─────────────────────────────────
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
      reason: `Missing required fields: ${missingFields.join(', ')}. All of business_name, phone_number, city, industry must be present.`,
      timestamp: ts,
      checks_passed: passed,
      checks_failed: failed,
    };
  }
  passed.push('REQUIRED_FIELDS_PRESENT');

  // ── Check 6: Personal domain → business verification (Section 4) ─────────
  if (PERSONAL_DOMAINS.has(domain)) {
    // Allow IF business_name + phone + real source present
    const hasSource = !!(lead.source && lead.source !== '' && lead.source !== 'test' && lead.source !== 'fallback');
    if (!hasSource) {
      failed.push('PERSONAL_DOMAIN_UNVERIFIED');
      return {
        email,
        business_name: lead.business_name,
        status: 'REJECTED',
        reason: `Personal domain (${domain}) without verified business source. Lead must come from Google Maps, Yelp, or a directory with source field set.`,
        timestamp: ts,
        checks_passed: passed,
        checks_failed: failed,
      };
    }
    passed.push('PERSONAL_DOMAIN_BUSINESS_VERIFIED');
  } else {
    passed.push('BUSINESS_DOMAIN');
  }

  // ── Check 7: Source must not be test/internal/fallback ───────────────────
  const blockedSources = ['test', 'fallback', 'internal', 'mock', 'seed', 'demo'];
  if (lead.source && blockedSources.includes(lead.source.toLowerCase())) {
    failed.push('BLOCKED_SOURCE');
    return {
      email,
      business_name: lead.business_name,
      status: 'REJECTED',
      reason: `Lead source "${lead.source}" is not a real external source. Only Google Maps, Yelp, OSM, or verified directories are accepted.`,
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
    timestamp: ts,
    checks_passed: passed,
    checks_failed: [],
  };
}

// ─── SECTION 9: PIPELINE INTEGRITY GATE ─────────────────────────────────────
const HARD_STOP_REJECTION_THRESHOLD = 0.10; // 10%

export function runIntegrityGate(
  leads: LeadCandidate[],
  previouslySentEmails: Set<string> = new Set()
): IntegrityReport {

  if (leads.length === 0) {
    return {
      status: 'SCRAPER_INSUFFICIENT_DATA',
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
    const entry = validateLead(lead, seenEmails);
    audit_log.push(entry);

    if (entry.status === 'ACCEPTED') {
      accepted.push(lead);
      seenEmails.add(entry.email); // mark as seen to catch duplicates within this batch
    } else {
      rejected.push(lead);
    }
  }

  const total = leads.length;
  const rejectedCount = rejected.length;
  const rejection_rate_pct = parseFloat(((rejectedCount / total) * 100).toFixed(1));

  // ── Section 9: Hard stop check ────────────────────────────────────────────
  // Count rejections due to internal/test/duplicate reasons specifically
  const integrityRejections = audit_log.filter(e =>
    e.status === 'REJECTED' &&
    (e.checks_failed.includes('BLOCKLIST_HIT') ||
     e.checks_failed.includes('BLOCKED_DOMAIN') ||
     e.checks_failed.includes('DUPLICATE_EMAIL') ||
     e.checks_failed.includes('BLOCKED_SOURCE'))
  ).length;

  const integrityRejectionRate = integrityRejections / total;
  const hardStop = integrityRejectionRate > HARD_STOP_REJECTION_THRESHOLD;

  if (hardStop) {
    return {
      status: 'DATA_INTEGRITY_FAILURE',
      valid_leads: accepted.length,
      rejected_leads: rejectedCount,
      rejection_rate_pct,
      ready_for_outreach: false,
      audit_log,
      accepted: [],      // clear accepted — do NOT proceed
      rejected,
      hard_stop_triggered: true,
      hard_stop_reason: `${(integrityRejectionRate * 100).toFixed(1)}% of leads failed integrity checks (internal/test/duplicate). Pipeline halted. Investigate lead source before retrying.`,
    };
  }

  return {
    status: 'REAL_LEADS_ONLY',
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

// ─── SCRAPER INSUFFICIENT DATA RESPONSE ──────────────────────────────────────
export function scraperInsufficientData(found: number, required: number) {
  return {
    status: 'SCRAPER_INSUFFICIENT_DATA' as const,
    leads_found: found,
    required,
    action: 'EXPAND_SEARCH_OR_CHANGE_FILTERS',
  };
}
