/**
 * ═══════════════════════════════════════════════════════════════
 * LEADGEN PRO — VALIDATION MODE ENGINE
 * ═══════════════════════════════════════════════════════════════
 * SYSTEM_MODE = "VALIDATION"
 * SCALING_ALLOWED = false (until all conditions met)
 *
 * Enforces:
 *  - Hard outreach caps (leads≤30, emails≤20, sms≤15, calls≤30/day)
 *  - Single city / single niche lock
 *  - Pre-outreach gate checks (domain, Twilio, OpenAI)
 *  - Test A-D pass gates before any scaling is unlocked
 *  - Auto-pause on spam / low response / high bounce
 * ═══════════════════════════════════════════════════════════════
 */

export type SystemMode = 'VALIDATION' | 'SCALE_READY' | 'PAUSED';

export type ValidationFlag =
  | 'EMAIL_DELIVERABILITY_FAILURE'
  | 'SMS_DELIVERY_FAILURE'
  | 'DEMO_QUALITY_FAILURE'
  | 'DOMAIN_NOT_VERIFIED'
  | 'TWILIO_NOT_CONFIGURED'
  | 'LOW_RESPONSE_RATE'
  | 'HIGH_BOUNCE_RATE'
  | 'SCALING_BLOCKED'
  | 'DAILY_LIMIT_EXCEEDED'
  | 'MULTI_CITY_BLOCKED'
  | 'MULTI_NICHE_BLOCKED';

export interface ValidationState {
  system_mode: SystemMode;
  scaling_allowed: boolean;
  active_flags: ValidationFlag[];
  validation_day: number; // 1-7
  tests_passed: {
    test_a_email: boolean;
    test_b_sms: boolean;
    test_c_demo: boolean;
    test_d_leads: boolean;
  };
  daily_counts: {
    leads: number;
    emails: number;
    sms: number;
    calls: number;
  };
  locked_city: string | null;
  locked_niche: string | null;
}

// ─── VALIDATION LIMITS (ENFORCED, NON-NEGOTIABLE) ──────────────────────────
export const VALIDATION_LIMITS = {
  MAX_LEADS_PER_DAY: 30,
  MAX_EMAILS_PER_DAY: 20,
  MAX_SMS_PER_DAY: 15,
  MAX_CALLS_PER_DAY: 30,
  MIN_EMAIL_INBOX_RATE: 0.70,   // 70% must reach primary inbox
  MIN_SMS_DELIVERY_RATE: 1.00,  // 100% must deliver
  MIN_DEMO_QUALITY_SCORE: 4,    // ≥4/5 demos rated YES
  MIN_RESPONSE_RATE: 0.05,      // ≥5% response rate
} as const;

// ─── GET CURRENT VALIDATION STATE FROM DB ──────────────────────────────────
export async function getValidationState(DB: D1Database): Promise<ValidationState> {
  const rows = await DB.prepare(`SELECT key, value FROM settings WHERE key LIKE 'val_%'`).all();
  const s: Record<string, string> = {};
  for (const r of (rows.results as { key: string; value: string }[])) {
    s[r.key] = r.value;
  }

  return {
    system_mode: (s['val_system_mode'] as SystemMode) || 'VALIDATION',
    scaling_allowed: s['val_scaling_allowed'] === 'true',
    active_flags: JSON.parse(s['val_active_flags'] || '[]'),
    validation_day: parseInt(s['val_validation_day'] || '1'),
    tests_passed: JSON.parse(s['val_tests_passed'] || JSON.stringify({
      test_a_email: false,
      test_b_sms: false,
      test_c_demo: false,
      test_d_leads: false
    })),
    daily_counts: JSON.parse(s['val_daily_counts'] || JSON.stringify({
      leads: 0, emails: 0, sms: 0, calls: 0
    })),
    locked_city: s['val_locked_city'] || null,
    locked_niche: s['val_locked_niche'] || null,
  };
}

// ─── SAVE VALIDATION STATE ─────────────────────────────────────────────────
export async function saveValidationState(DB: D1Database, state: Partial<ValidationState>): Promise<void> {
  const updates: Record<string, string> = {};

  if (state.system_mode !== undefined) updates['val_system_mode'] = state.system_mode;
  if (state.scaling_allowed !== undefined) updates['val_scaling_allowed'] = String(state.scaling_allowed);
  if (state.active_flags !== undefined) updates['val_active_flags'] = JSON.stringify(state.active_flags);
  if (state.validation_day !== undefined) updates['val_validation_day'] = String(state.validation_day);
  if (state.tests_passed !== undefined) updates['val_tests_passed'] = JSON.stringify(state.tests_passed);
  if (state.daily_counts !== undefined) updates['val_daily_counts'] = JSON.stringify(state.daily_counts);
  if (state.locked_city !== undefined) updates['val_locked_city'] = state.locked_city || '';
  if (state.locked_niche !== undefined) updates['val_locked_niche'] = state.locked_niche || '';

  for (const [key, value] of Object.entries(updates)) {
    await DB.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
    `).bind(key, value).run();
  }
}

// ─── ADD / REMOVE FLAG ─────────────────────────────────────────────────────
export async function addFlag(DB: D1Database, flag: ValidationFlag): Promise<void> {
  const state = await getValidationState(DB);
  if (!state.active_flags.includes(flag)) {
    state.active_flags.push(flag);
    await saveValidationState(DB, { active_flags: state.active_flags });

    // Log the flag event
    await DB.prepare(`
      INSERT INTO validation_events (event_type, details, created_at)
      VALUES ('FLAG_ADDED', ?, CURRENT_TIMESTAMP)
    `).bind(JSON.stringify({ flag })).run().catch(() => {});
  }
}

export async function removeFlag(DB: D1Database, flag: ValidationFlag): Promise<void> {
  const state = await getValidationState(DB);
  state.active_flags = state.active_flags.filter(f => f !== flag);
  await saveValidationState(DB, { active_flags: state.active_flags });
}

// ─── GATE: PRE-OUTREACH CHECKS ────────────────────────────────────────────
export interface GateCheckResult {
  allowed: boolean;
  errors: string[];
  warnings: string[];
  blocked_by?: ValidationFlag;
}

export async function runOutreachGateChecks(
  DB: D1Database,
  channel: 'email' | 'sms' | 'call',
  env: { RESEND_API_KEY?: string; TWILIO_ACCOUNT_SID?: string; OPENAI_API_KEY?: string }
): Promise<GateCheckResult> {
  const result: GateCheckResult = { allowed: true, errors: [], warnings: [] };
  const state = await getValidationState(DB);

  // ── Check 1: System not paused ────────────────────────────────────────────
  if (state.system_mode === 'PAUSED') {
    result.allowed = false;
    result.errors.push('SYSTEM PAUSED — outreach blocked pending manual intervention');
    result.blocked_by = 'SCALING_BLOCKED';
    return result;
  }

  // ── Check 2: Active failure flags block outreach ───────────────────────────
  const blockingFlags: ValidationFlag[] = [
    'EMAIL_DELIVERABILITY_FAILURE',
    'SMS_DELIVERY_FAILURE',
    'HIGH_BOUNCE_RATE',
  ];
  for (const flag of blockingFlags) {
    if (state.active_flags.includes(flag)) {
      result.allowed = false;
      result.errors.push(`${flag} active — outreach paused until resolved`);
      result.blocked_by = flag;
      return result;
    }
  }

  // ── Check 3: Channel-specific daily limits ────────────────────────────────
  // Re-query live counts from DB (not cached state)
  const today = await DB.prepare(`
    SELECT
      SUM(CASE WHEN channel='email' THEN 1 ELSE 0 END) as emails,
      SUM(CASE WHEN channel='sms' THEN 1 ELSE 0 END) as sms,
      SUM(CASE WHEN channel='call' THEN 1 ELSE 0 END) as calls
    FROM outreach
    WHERE DATE(created_at) = DATE('now')
  `).first<{ emails: number; sms: number; calls: number }>();

  const counts = {
    emails: today?.emails || 0,
    sms: today?.sms || 0,
    calls: today?.calls || 0,
  };

  if (channel === 'email' && counts.emails >= VALIDATION_LIMITS.MAX_EMAILS_PER_DAY) {
    result.allowed = false;
    result.errors.push(`DAILY_LIMIT_EXCEEDED: Email cap reached (${counts.emails}/${VALIDATION_LIMITS.MAX_EMAILS_PER_DAY}/day) — VALIDATION PHASE ACTIVE`);
    result.blocked_by = 'DAILY_LIMIT_EXCEEDED';
    await addFlag(DB, 'DAILY_LIMIT_EXCEEDED');
    return result;
  }
  if (channel === 'sms' && counts.sms >= VALIDATION_LIMITS.MAX_SMS_PER_DAY) {
    result.allowed = false;
    result.errors.push(`DAILY_LIMIT_EXCEEDED: SMS cap reached (${counts.sms}/${VALIDATION_LIMITS.MAX_SMS_PER_DAY}/day) — VALIDATION PHASE ACTIVE`);
    result.blocked_by = 'DAILY_LIMIT_EXCEEDED';
    await addFlag(DB, 'DAILY_LIMIT_EXCEEDED');
    return result;
  }
  if (channel === 'call' && counts.calls >= VALIDATION_LIMITS.MAX_CALLS_PER_DAY) {
    result.allowed = false;
    result.errors.push(`DAILY_LIMIT_EXCEEDED: Call cap reached (${counts.calls}/${VALIDATION_LIMITS.MAX_CALLS_PER_DAY}/day) — VALIDATION PHASE ACTIVE`);
    result.blocked_by = 'DAILY_LIMIT_EXCEEDED';
    await addFlag(DB, 'DAILY_LIMIT_EXCEEDED');
    return result;
  }

  // ── Check 4: Email domain verified ────────────────────────────────────────
  if (channel === 'email') {
    const domainVerified = await DB.prepare(
      `SELECT value FROM settings WHERE key='email_domain_verified'`
    ).first<{ value: string }>();

    if (domainVerified?.value !== 'true') {
      result.allowed = false;
      result.errors.push('DOMAIN NOT VERIFIED — email sending blocked. Verify your Resend domain before sending outreach emails.');
      result.blocked_by = 'DOMAIN_NOT_VERIFIED';
      await addFlag(DB, 'DOMAIN_NOT_VERIFIED');
      return result;
    }
  }

  // ── Check 5: Twilio configured for SMS/calls ──────────────────────────────
  if ((channel === 'sms' || channel === 'call') && !env.TWILIO_ACCOUNT_SID) {
    result.allowed = false;
    result.errors.push('TWILIO NOT CONFIGURED — SMS/call sending blocked. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to secrets.');
    result.blocked_by = 'TWILIO_NOT_CONFIGURED';
    await addFlag(DB, 'TWILIO_NOT_CONFIGURED');
    return result;
  }

  // ── Check 6: OpenAI capacity warning ─────────────────────────────────────
  if (!env.OPENAI_API_KEY) {
    result.warnings.push('OpenAI not configured — using local fallback templates. Verify demo quality meets ≥4/5 standard.');
  }

  // ── Check 7: LOW_RESPONSE_RATE flag is a warning (not a full block) ───────
  if (state.active_flags.includes('LOW_RESPONSE_RATE')) {
    result.warnings.push('LOW_RESPONSE_RATE flag active — optimization cycle recommended before continuing outreach');
  }

  return result;
}

// ─── GATE: LEAD CREATION LIMIT ────────────────────────────────────────────
export async function checkLeadCreationLimit(DB: D1Database): Promise<GateCheckResult> {
  const result: GateCheckResult = { allowed: true, errors: [], warnings: [] };

  const todayLeads = await DB.prepare(`
    SELECT COUNT(*) as count FROM leads WHERE DATE(created_at) = DATE('now')
  `).first<{ count: number }>();

  const count = todayLeads?.count || 0;
  if (count >= VALIDATION_LIMITS.MAX_LEADS_PER_DAY) {
    result.allowed = false;
    result.errors.push(`VALIDATION PHASE ACTIVE — SCALING BLOCKED: Daily lead limit reached (${count}/${VALIDATION_LIMITS.MAX_LEADS_PER_DAY}). Increase limits only after validation passes.`);
    result.blocked_by = 'SCALING_BLOCKED';
    await addFlag(DB, 'DAILY_LIMIT_EXCEEDED');
  } else if (count >= VALIDATION_LIMITS.MAX_LEADS_PER_DAY * 0.8) {
    result.warnings.push(`Lead count at ${count}/${VALIDATION_LIMITS.MAX_LEADS_PER_DAY} — approaching daily validation limit`);
  }

  return result;
}

// ─── GATE: MULTI-CITY / MULTI-NICHE LOCK ─────────────────────────────────
export async function checkCityNicheLock(
  DB: D1Database,
  city: string,
  niche: string
): Promise<GateCheckResult> {
  const result: GateCheckResult = { allowed: true, errors: [], warnings: [] };
  const state = await getValidationState(DB);

  // If no lock set yet, lock to this city/niche
  if (!state.locked_city || !state.locked_niche) {
    await saveValidationState(DB, {
      locked_city: city.toLowerCase().trim(),
      locked_niche: niche.toLowerCase().trim(),
    });
    result.warnings.push(`Validation lock set: city="${city}", niche="${niche}". All leads must match during validation phase.`);
    return result;
  }

  // Enforce the lock
  if (state.locked_city && city.toLowerCase().trim() !== state.locked_city) {
    result.allowed = false;
    result.errors.push(`VALIDATION PHASE ACTIVE — SCALING BLOCKED: Cannot run campaigns in multiple cities. Locked to "${state.locked_city}". Attempted: "${city}".`);
    result.blocked_by = 'MULTI_CITY_BLOCKED';
    await addFlag(DB, 'MULTI_CITY_BLOCKED');
  }

  if (state.locked_niche && niche.toLowerCase().trim() !== state.locked_niche) {
    result.allowed = false;
    result.errors.push(`VALIDATION PHASE ACTIVE — SCALING BLOCKED: Cannot run campaigns across multiple niches. Locked to "${state.locked_niche}". Attempted: "${niche}".`);
    result.blocked_by = 'MULTI_NICHE_BLOCKED';
    await addFlag(DB, 'MULTI_NICHE_BLOCKED');
  }

  return result;
}

// ─── DECISION ENGINE: EVALUATE SCALING READINESS ─────────────────────────
export interface ScalingDecision {
  scaling_allowed: boolean;
  system_mode: SystemMode;
  passed_conditions: string[];
  failed_conditions: string[];
  recommendations: string[];
}

export async function evaluateScalingReadiness(DB: D1Database): Promise<ScalingDecision> {
  const state = await getValidationState(DB);
  const decision: ScalingDecision = {
    scaling_allowed: false,
    system_mode: 'VALIDATION',
    passed_conditions: [],
    failed_conditions: [],
    recommendations: [],
  };

  // Evaluate Test A: Email deliverability
  if (state.tests_passed.test_a_email) {
    decision.passed_conditions.push('✅ Test A: Email deliverability ≥70% inbox placement');
  } else {
    decision.failed_conditions.push('❌ Test A: Email deliverability not yet validated');
    decision.recommendations.push('Run Test A: Send 10 test emails to Gmail/Outlook/Yahoo and verify inbox placement');
  }

  // Evaluate Test B: SMS delivery
  if (state.tests_passed.test_b_sms) {
    decision.passed_conditions.push('✅ Test B: SMS delivery 100% confirmed');
  } else {
    decision.failed_conditions.push('❌ Test B: SMS delivery not yet validated');
    decision.recommendations.push('Run Test B: Send 10 SMS to real devices and confirm delivery + replies');
  }

  // Evaluate Test C: Demo quality
  if (state.tests_passed.test_c_demo) {
    decision.passed_conditions.push('✅ Test C: Demo quality ≥4/5 sites rated professional');
  } else {
    decision.failed_conditions.push('❌ Test C: Demo quality not yet validated');
    decision.recommendations.push('Run Test C: Generate 5 demos and score each — must get ≥4/5 YES votes');
  }

  // Evaluate Test D: Live lead response rate
  if (state.tests_passed.test_d_leads) {
    decision.passed_conditions.push('✅ Test D: Live campaign response rate ≥5%');
  } else {
    decision.failed_conditions.push('❌ Test D: Live 20-lead campaign response rate not yet validated');
    decision.recommendations.push('Run Test D: Launch 20-lead campaign (1 niche, 1 city) and track 5%+ response rate');
  }

  // Check for blocking flags
  const blockingFlags = state.active_flags.filter(f =>
    ['EMAIL_DELIVERABILITY_FAILURE', 'SMS_DELIVERY_FAILURE', 'DEMO_QUALITY_FAILURE', 'HIGH_BOUNCE_RATE'].includes(f)
  );
  if (blockingFlags.length > 0) {
    decision.failed_conditions.push(`❌ Active failure flags: ${blockingFlags.join(', ')}`);
    decision.recommendations.push(`Resolve active flags before scaling: ${blockingFlags.join(', ')}`);
  }

  // Final verdict
  const allTestsPassed = Object.values(state.tests_passed).every(Boolean);
  const noBlockingFlags = blockingFlags.length === 0;

  if (allTestsPassed && noBlockingFlags) {
    decision.scaling_allowed = true;
    decision.system_mode = 'SCALE_READY';
    decision.passed_conditions.push('🚀 ALL CONDITIONS MET — System ready to scale');
    await saveValidationState(DB, { scaling_allowed: true, system_mode: 'SCALE_READY' });
  } else {
    decision.scaling_allowed = false;
    decision.system_mode = state.active_flags.includes('EMAIL_DELIVERABILITY_FAILURE') ||
      state.active_flags.includes('SMS_DELIVERY_FAILURE') ? 'PAUSED' : 'VALIDATION';
    await saveValidationState(DB, { scaling_allowed: false, system_mode: decision.system_mode });
  }

  return decision;
}

// ─── AUTO-PAUSE TRIGGER ───────────────────────────────────────────────────
export async function checkAutoPauseTriggers(DB: D1Database): Promise<{
  triggered: boolean;
  reasons: string[];
}> {
  const result = { triggered: false, reasons: [] as string[] };
  const state = await getValidationState(DB);

  // Check bounce rate (emails bounced > 10% of sent)
  const bounceStats = await DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='BOUNCED' THEN 1 ELSE 0 END) as bounced
    FROM outreach
    WHERE channel='email' AND DATE(created_at) >= DATE('now', '-7 days')
  `).first<{ total: number; bounced: number }>();

  if (bounceStats && bounceStats.total >= 5) {
    const bounceRate = bounceStats.bounced / bounceStats.total;
    if (bounceRate > 0.10) {
      result.triggered = true;
      result.reasons.push(`HIGH_BOUNCE_RATE: ${(bounceRate * 100).toFixed(1)}% of emails bounced (threshold: 10%)`);
      await addFlag(DB, 'HIGH_BOUNCE_RATE');
    }
  }

  // Check spam placement (outreach with status FAILED and error containing 'spam')
  const spamCount = await DB.prepare(`
    SELECT COUNT(*) as count FROM outreach
    WHERE channel='email' AND status='FAILED'
    AND error_message LIKE '%spam%'
    AND DATE(created_at) = DATE('now')
  `).first<{ count: number }>();

  if ((spamCount?.count || 0) >= 3) {
    result.triggered = true;
    result.reasons.push(`SPAM_PLACEMENT: ${spamCount?.count} emails marked as spam today`);
    await addFlag(DB, 'EMAIL_DELIVERABILITY_FAILURE');
  }

  // Check response rate over last 20 leads
  const responseStat = await DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('RESPONDED','INTERESTED','CLOSED') THEN 1 ELSE 0 END) as responded
    FROM leads
    WHERE created_at >= DATE('now', '-7 days')
    AND status != 'NEW'
  `).first<{ total: number; responded: number }>();

  if (responseStat && responseStat.total >= 15) {
    const responseRate = responseStat.responded / responseStat.total;
    if (responseRate < VALIDATION_LIMITS.MIN_RESPONSE_RATE) {
      result.triggered = true;
      result.reasons.push(`LOW_RESPONSE_RATE: ${(responseRate * 100).toFixed(1)}% response rate (minimum: ${VALIDATION_LIMITS.MIN_RESPONSE_RATE * 100}%)`);
      await addFlag(DB, 'LOW_RESPONSE_RATE');
    }
  }

  // If any trigger fired, pause the system and log
  if (result.triggered) {
    await saveValidationState(DB, { system_mode: 'PAUSED' });
    for (const reason of result.reasons) {
      await DB.prepare(`
        INSERT INTO validation_events (event_type, details, created_at)
        VALUES ('AUTO_PAUSE', ?, CURRENT_TIMESTAMP)
      `).bind(reason).run().catch(() => {});
    }
  }

  return result;
}

// ─── LOG VALIDATION EVENT ─────────────────────────────────────────────────
export async function logValidationEvent(
  DB: D1Database,
  eventType: string,
  details: Record<string, unknown>
): Promise<void> {
  await DB.prepare(`
    INSERT INTO validation_events (event_type, details, created_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).bind(eventType, JSON.stringify(details)).run().catch(() => {});
}
