// ============================================================
// SYSTEM ORCHESTRATOR — /api/system
//
// POST /api/system/run-daily   → Full pipeline: env check → safety →
//                                scrape → demo → route → outreach → log
// POST /api/system/run-daily?force=true  → Manual override (skips paused check)
//
// Daily Schedule: 10:00 AM (cron 0 10 * * *)
//
// SECTIONS IMPLEMENTED:
//   §1  Entrypoint
//   §2  Scheduler hook (cron fires handleSystemScheduled)
//   §3  Environment isolation (7 rules, breach hard-stop)
//   §4  Daily execution flow (5 steps)
//   §5  Lead routing engine (email-first vs phone-first)
//   §6  Phone-first outreach (call rules, time window, max attempts, script)
//   §7  SMS follow-up with opt-out + personalized demo URL
//   §8  Email system (send limits, content rules)
//   §9  Link policy (reply / thread depth / warmup gate)
//   §10 Daily limits enforcement
//   §11 Per-lead tracking
//   §12 Safety rules (spam/bounce/breach)
//   §13 Daily run log
//   §14 Manual override (?force=true)
// ============================================================

import { Hono } from 'hono';
import type { Bindings } from '../types';
import {
  resolveEnv,
  runIntegrityGate,
  type AppEnv,
  type LeadCandidate,
} from '../lib/lead-integrity';
import {
  checkScalingGate,
  checkLinkPolicy,
  calculateMetrics,
  type SendRecord,
} from '../lib/warmup-engine';
import { MEMPHIS_LEADS, type MicroLead } from './micro-scale';

const system = new Hono<{ Bindings: Bindings }>();

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const SYSTEM_VERSION = '1.0.0';

/** §10 Daily limits */
const DAILY_LIMITS = {
  emails:  8,   // Day 3-4 max; Day 1-2 capped at 5 inside sendEmail
  calls:  20,
  sms:    15,
  leads:  20,
} as const;

/** §8 Email send caps by outreach day */
const EMAIL_CAP_BY_DAY: Record<number, number> = {
  1: 5,
  2: 5,
  3: 8,
  4: 8,
};

/** §6 Call window: 9am–6pm local (we use UTC-5 offset for CST) */
const CALL_WINDOW_START_HOUR = 9;   // local
const CALL_WINDOW_END_HOUR   = 18;  // local
const CST_OFFSET_HOURS       = -5;

/** §6 Max call attempts per lead */
const MAX_CALL_ATTEMPTS = 3;
const MIN_CALL_GAP_HOURS = 24;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function readKey<T>(DB: D1Database, key: string, fallback: T): Promise<T> {
  try {
    const row = await DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{ value: string }>();
    if (!row) return fallback;
    return JSON.parse(row.value) as T;
  } catch { return fallback; }
}

async function writeKey(DB: D1Database, key: string, value: unknown): Promise<void> {
  const v = JSON.stringify(value);
  await DB.prepare(`INSERT INTO settings (key, value) VALUES (?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(key, v).run();
}

async function readAppEnv(DB: D1Database): Promise<AppEnv> {
  const row = await DB.prepare('SELECT value FROM settings WHERE key=?').bind('APP_ENV').first<{ value: string }>();
  return resolveEnv(row?.value);
}

/** §3 Build demo URL with env isolation */
function buildDemoUrl(slug: string, env: AppEnv, appUrl = 'https://websitedemopro.org'): string {
  const base = appUrl.replace(/\/$/, '');
  return env === 'TEST' ? `${base}/demo/test/${slug}` : `${base}/demo/${slug}`;
}

/** §3 Validate demo URL matches env rule */
function validateDemoUrl(url: string, env: AppEnv): boolean {
  if (env === 'TEST')       return url.includes('/demo/test/');
  if (env === 'PRODUCTION') return url.includes('/demo/') && !url.includes('/demo/test/');
  return false;
}

/** §6 Is current time within call window? */
function isCallWindowOpen(): boolean {
  const nowUtc  = new Date();
  const localH  = nowUtc.getUTCHours() + CST_OFFSET_HOURS;
  const h       = ((localH % 24) + 24) % 24; // normalize
  return h >= CALL_WINDOW_START_HOUR && h < CALL_WINDOW_END_HOUR;
}

/** §6 Hours since last call attempt */
function hoursSince(isoStr?: string | null): number {
  if (!isoStr) return 9999;
  return (Date.now() - new Date(isoStr).getTime()) / 3_600_000;
}

/** §7 SMS body — compliant, personalized, opt-out included */
function buildSmsFollowUp(lead: MicroLead, demoUrl: string): string {
  return `Hey, this is Alex — just tried calling about ${lead.business_name}.\nI put together something quick for you: ${demoUrl}\nLet me know what you think. Reply STOP to opt out`;
}

/** §6 Call script (for UI display / logging) */
function buildCallScript(lead: MicroLead): string {
  return `Hey, is this the owner of ${lead.business_name}?\n\nI'll be quick — I actually put together something for your business and wanted your quick opinion.\n\nWould it be okay if I texted it over to you?`;
}

// ─── TRACKING ────────────────────────────────────────────────────────────────

interface LeadTracking {
  lead_id: string;
  business_name: string;
  called: boolean;
  answered: boolean;
  voicemail: boolean;
  sms_sent: boolean;
  email_sent: boolean;
  replied: boolean;
  interested: boolean;
  status: 'NEW' | 'CONTACTED' | 'INTERESTED' | 'CLOSED' | 'LOST';
  call_attempts: number;
  last_called_at: string | null;
  last_sms_at: string | null;
  last_email_at: string | null;
  env: AppEnv;
}

async function getLeadTracking(DB: D1Database, leadId: string): Promise<LeadTracking | null> {
  return readKey<LeadTracking | null>(DB, `system_track_${leadId}`, null);
}

async function saveLeadTracking(DB: D1Database, t: LeadTracking): Promise<void> {
  await writeKey(DB, `system_track_${t.lead_id}`, t);
}

// ─── DAILY RUN LOG ───────────────────────────────────────────────────────────

interface DailyRunLog {
  date: string;
  run_id: string;
  triggered_by: string;
  env: AppEnv;
  emails_sent: number;
  calls_made: number;
  sms_sent: number;
  leads_processed: number;
  conversations_started: number;
  state: 'THROTTLE' | 'PROCEED' | 'HOLD' | 'STOP_ALL' | 'HARD_STOP' | 'ENV_BLOCK' | 'PAUSED';
  errors: string[];
  duration_ms: number;
  finished_at: string;
}

async function appendDailyLog(DB: D1Database, log: DailyRunLog): Promise<void> {
  const existing = await readKey<DailyRunLog[]>(DB, 'system_daily_log', []);
  existing.unshift(log);
  await writeKey(DB, 'system_daily_log', existing.slice(0, 60));
}

// ─── DAILY COUNTERS ──────────────────────────────────────────────────────────

interface SystemCounters {
  date: string;
  emails_sent: number;
  calls_made: number;
  sms_sent: number;
  leads_processed: number;
}

async function getOrInitCounters(DB: D1Database): Promise<SystemCounters> {
  const today = new Date().toISOString().slice(0, 10);
  const stored = await readKey<SystemCounters | null>(DB, 'system_daily_counters', null);
  if (stored && stored.date === today) return stored;
  const fresh: SystemCounters = { date: today, emails_sent: 0, calls_made: 0, sms_sent: 0, leads_processed: 0 };
  await writeKey(DB, 'system_daily_counters', fresh);
  return fresh;
}

// ─── EMAIL SENDER ────────────────────────────────────────────────────────────

interface EmailSendResult {
  lead_id: string;
  status: 'SENT' | 'DRY_RUN' | 'SKIPPED' | 'FAILED' | 'CAP_REACHED' | 'ENV_BLOCK' | 'INTEGRITY_BLOCKED';
  reason?: string;
  resend_id?: string;
  channel: 'email';
}

async function sendEmail(params: {
  DB: D1Database;
  lead: MicroLead & { outreach_day?: number; thread_depth?: number; reply_received?: boolean; last_sent_at?: string | null };
  demoUrl: string;
  env: AppEnv;
  resendKey: string;
  counters: SystemCounters;
  dryRun: boolean;
}): Promise<EmailSendResult> {
  const { DB, lead, demoUrl, env, resendKey, counters, dryRun } = params;

  // §3 Lead env isolation
  const leadEnv = (lead as unknown as Record<string, string>).environment_used || env;
  if (leadEnv.toUpperCase() !== env) {
    return { lead_id: lead.id, status: 'ENV_BLOCK', reason: `lead.environment_used=${leadEnv} != current env=${env}`, channel: 'email' };
  }

  // §8 Must have email and be REAL lead
  if (!lead.email) return { lead_id: lead.id, status: 'SKIPPED', reason: 'No email — will route to phone fallback', channel: 'email' };
  const leadType = (lead as unknown as Record<string, string>).lead_type || 'REAL';
  if (leadType === 'TEST') return { lead_id: lead.id, status: 'ENV_BLOCK', reason: 'TEST lead in PRODUCTION pipeline', channel: 'email' };

  // §10 Cap check
  const outreachDay = lead.outreach_day ?? 1;
  const dayEmailCap = EMAIL_CAP_BY_DAY[outreachDay] || 5;
  if (counters.emails_sent >= Math.min(dayEmailCap, DAILY_LIMITS.emails)) {
    return { lead_id: lead.id, status: 'CAP_REACHED', reason: `Daily cap reached (${counters.emails_sent}/${dayEmailCap})`, channel: 'email' };
  }

  // §3 Demo URL validation
  if (!validateDemoUrl(demoUrl, env)) {
    return { lead_id: lead.id, status: 'ENV_BLOCK', reason: `Demo URL invalid for env=${env}: ${demoUrl}`, channel: 'email' };
  }

  // §9 Link policy
  const totalSends = await readKey<number>(DB, `system_total_sends_${lead.id}`, 0);
  const warmupStatus = await readKey<{ day?: number }>(DB, 'warmup_status', {});
  const warmupDay = warmupStatus.day ?? 1;
  const runLog = await readKey<Array<{ emails_sent: number; sms_sent: number }>>(DB, 'system_daily_log', []);
  const sendRecords: SendRecord[] = runLog.map(r => ({
    id: `log-${Math.random()}`,
    sent_at: new Date().toISOString(),
    email: lead.email || '',
    subject: '',
    channel: 'email' as const,
    is_reply: false,
  }));
  const engagementMetrics = calculateMetrics(sendRecords);
  const linkPolicy = checkLinkPolicy({
    reply_received: lead.reply_received ?? false,
    thread_depth:   lead.thread_depth  ?? 1,
    total_sends:    totalSends,
    warmup_day:     warmupDay,
    reply_rate:     engagementMetrics.reply_rate,
  });

  // Build subject + body
  let subject: string;
  let body: string;
  const biz = lead.business_name;
  const city = lead.city || 'Memphis';

  if (outreachDay <= 2) {
    // §8 Day 1-2: NO links
    const subjectOptions = [
      `Quick thought about ${biz}`,
      `Question for ${biz}`,
      `${city} businesses like ${biz}`,
    ];
    subject = subjectOptions[Math.floor(Math.random() * subjectOptions.length)];
    body = `<p>Hey,</p>
<p>Was looking around ${city} and came across ${biz} — just had a quick thought I wanted to share.</p>
<p>Most businesses in your space are missing something pretty easy to fix online. Would it be worth a 2-minute look?</p>
<p>Let me know either way — no pressure at all.</p>
<p>— Alex</p>`;
  } else {
    // §8 Day 3-4: link if allowed
    const linkLine = linkPolicy.allow_link
      ? `<p>Here's what I put together for you: <a href="${demoUrl}">${demoUrl}</a></p>`
      : `<p>I put together something specific to ${biz} — happy to send it over if you'd like a look.</p>`;
    subject = `Something I built for ${biz}`;
    body = `<p>Hey again,</p>
<p>Just following up on my last note about ${biz}.</p>
${linkLine}
<p>Takes about 60 seconds to check out. Let me know what you think.</p>
<p>— Alex</p>`;
  }

  if (dryRun) {
    return { lead_id: lead.id, status: 'DRY_RUN', reason: `DRY_RUN — would send Day ${outreachDay} email, link_allowed=${linkPolicy.allow_link}`, channel: 'email' };
  }

  // §8 Send via Resend
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'Alex <alex@websitedemopro.org>',
        to:      [lead.email],
        subject,
        html:    body,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { lead_id: lead.id, status: 'FAILED', reason: err, channel: 'email' };
    }
    const data = await res.json() as { id?: string };
    // Persist tracking
    await writeKey(DB, `system_total_sends_${lead.id}`, totalSends + 1);
    const track = await getLeadTracking(DB, lead.id) || buildEmptyTracking(lead.id, lead.business_name, env);
    track.email_sent = true;
    track.status = 'CONTACTED';
    track.last_email_at = new Date().toISOString();
    await saveLeadTracking(DB, track);
    return { lead_id: lead.id, status: 'SENT', resend_id: data.id, channel: 'email' };
  } catch (err) {
    return { lead_id: lead.id, status: 'FAILED', reason: String(err), channel: 'email' };
  }
}

// ─── SMS SENDER ──────────────────────────────────────────────────────────────

interface SmsSendResult {
  lead_id: string;
  status: 'SENT' | 'DRY_RUN' | 'SKIPPED' | 'FAILED' | 'CAP_REACHED' | 'NO_PHONE' | 'NO_TWILIO';
  reason?: string;
  channel: 'sms';
}

async function sendSms(params: {
  DB: D1Database;
  lead: MicroLead;
  demoUrl: string;
  env: AppEnv;
  twilioSid?: string;
  twilioToken?: string;
  twilioFrom?: string;
  counters: SystemCounters;
  dryRun: boolean;
}): Promise<SmsSendResult> {
  const { DB, lead, demoUrl, env, twilioSid, twilioToken, twilioFrom, counters, dryRun } = params;

  if (!lead.phone) return { lead_id: lead.id, status: 'NO_PHONE', reason: 'No phone number', channel: 'sms' };
  if (counters.sms_sent >= DAILY_LIMITS.sms) return { lead_id: lead.id, status: 'CAP_REACHED', reason: `SMS cap ${DAILY_LIMITS.sms} reached`, channel: 'sms' };

  // §3 Demo URL validation
  if (!validateDemoUrl(demoUrl, env)) {
    return { lead_id: lead.id, status: 'SKIPPED', reason: `Invalid demo URL for env=${env}`, channel: 'sms' };
  }

  const body = buildSmsFollowUp(lead, demoUrl);

  if (dryRun || !twilioSid || !twilioToken || !twilioFrom) {
    return {
      lead_id: lead.id,
      status: dryRun ? 'DRY_RUN' : 'NO_TWILIO',
      reason: dryRun ? `DRY_RUN — body: ${body.slice(0, 80)}...` : 'Twilio not configured (set TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM secrets)',
      channel: 'sms',
    };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: lead.phone, From: twilioFrom, Body: body }).toString(),
    });
    if (!res.ok) {
      const err = await res.text();
      return { lead_id: lead.id, status: 'FAILED', reason: err, channel: 'sms' };
    }
    // Update tracking
    const track = await getLeadTracking(DB, lead.id) || buildEmptyTracking(lead.id, lead.business_name, env);
    track.sms_sent = true;
    track.status = 'CONTACTED';
    track.last_sms_at = new Date().toISOString();
    await saveLeadTracking(DB, track);
    return { lead_id: lead.id, status: 'SENT', channel: 'sms' };
  } catch (err) {
    return { lead_id: lead.id, status: 'FAILED', reason: String(err), channel: 'sms' };
  }
}

// ─── CALL QUEUER ─────────────────────────────────────────────────────────────

interface CallQueueEntry {
  lead_id: string;
  business_name: string;
  phone: string;
  demo_url: string;
  call_script: string;
  sms_followup: string;
  queued_at: string;
  call_attempts: number;
  last_called_at: string | null;
  env: AppEnv;
  status: 'QUEUED' | 'CALLED' | 'ANSWERED' | 'VOICEMAIL' | 'NO_ANSWER' | 'REJECTED' | 'SMS_SENT' | 'LOST';
}

async function queueCallTask(params: {
  DB: D1Database;
  lead: MicroLead;
  demoUrl: string;
  env: AppEnv;
  counters: SystemCounters;
}): Promise<{ queued: boolean; reason?: string; entry?: CallQueueEntry }> {
  const { DB, lead, demoUrl, env, counters } = params;

  if (!lead.phone) return { queued: false, reason: 'No phone number' };
  if (counters.calls_made >= DAILY_LIMITS.calls) return { queued: false, reason: `Call cap ${DAILY_LIMITS.calls} reached` };

  // §6 Check call window
  if (!isCallWindowOpen()) {
    return { queued: false, reason: `Outside call window (${CALL_WINDOW_START_HOUR}am–${CALL_WINDOW_END_HOUR}pm local)` };
  }

  // §6 Check max attempts + gap
  const track = await getLeadTracking(DB, lead.id);
  const attempts = track?.call_attempts ?? 0;
  if (attempts >= MAX_CALL_ATTEMPTS) {
    return { queued: false, reason: `Max call attempts (${MAX_CALL_ATTEMPTS}) reached` };
  }
  if (track?.last_called_at && hoursSince(track.last_called_at) < MIN_CALL_GAP_HOURS) {
    return { queued: false, reason: `Min gap of ${MIN_CALL_GAP_HOURS}h not met (last called ${hoursSince(track.last_called_at).toFixed(1)}h ago)` };
  }

  const entry: CallQueueEntry = {
    lead_id:      lead.id,
    business_name: lead.business_name,
    phone:        lead.phone,
    demo_url:     demoUrl,
    call_script:  buildCallScript(lead),
    sms_followup: buildSmsFollowUp(lead, demoUrl),
    queued_at:    new Date().toISOString(),
    call_attempts: attempts,
    last_called_at: track?.last_called_at ?? null,
    env,
    status: 'QUEUED',
  };

  // Persist into call queue
  const queue = await readKey<CallQueueEntry[]>(DB, 'system_call_queue', []);
  const existing = queue.findIndex(e => e.lead_id === lead.id);
  if (existing >= 0) {
    queue[existing] = entry; // update
  } else {
    queue.push(entry);
  }
  await writeKey(DB, 'system_call_queue', queue);

  // Update tracking
  const t = track || buildEmptyTracking(lead.id, lead.business_name, env);
  t.called = true;
  t.status = 'CONTACTED';
  await saveLeadTracking(DB, t);

  return { queued: true, entry };
}

function buildEmptyTracking(leadId: string, businessName: string, env: AppEnv): LeadTracking {
  return {
    lead_id: leadId,
    business_name: businessName,
    called: false,
    answered: false,
    voicemail: false,
    sms_sent: false,
    email_sent: false,
    replied: false,
    interested: false,
    status: 'NEW',
    call_attempts: 0,
    last_called_at: null,
    last_sms_at: null,
    last_email_at: null,
    env,
  };
}

// ─── CORE PIPELINE ──────────────────────────────────────────────────────────

async function runDailyPipeline(params: {
  DB: D1Database;
  env: Bindings;
  force?: boolean;
  dryRun?: boolean;
}): Promise<object> {
  const { DB, env, force = false, dryRun = false } = params;
  const startedAt = Date.now();
  const runId = `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const errors: string[] = [];
  let emails_sent = 0;
  let calls_made = 0;
  let sms_sent = 0;
  let leads_processed = 0;
  let conversations_started = 0;
  const results: object[] = [];

  // ── §14 Manual override flag already passed in via `force` ────────────────

  // ── §4 STEP 1 — CHECK ENV ─────────────────────────────────────────────────
  const appEnv = await readAppEnv(DB);
  if (appEnv !== 'PRODUCTION' && !force) {
    return {
      status: 'ENV_BLOCK',
      reason: `System is in ${appEnv} mode. Set ENV=PRODUCTION or use ?force=true`,
      env: appEnv,
      run_id: runId,
    };
  }

  // ── §4 STEP 2 — CHECK SYSTEM SAFETY ───────────────────────────────────────
  const warmupStatus = await readKey<{ action?: string; state?: string }>(DB, 'warmup_status', {});
  const gateAction = warmupStatus.action || warmupStatus.state || 'PROCEED';
  if ((gateAction === 'STOP_ALL' || gateAction === 'HOLD') && !force) {
    return {
      status: 'SAFETY_HALT',
      reason: `Warmup gate returned ${gateAction} — system halted for safety`,
      gate_action: gateAction,
      run_id: runId,
    };
  }

  // Check if paused
  const paused = await readKey<boolean>(DB, 'engine_paused', false);
  if (paused && !force) {
    return { status: 'PAUSED', reason: 'Engine is paused. Use POST /api/engine/resume or ?force=true', run_id: runId };
  }

  // ── §4 STEP 3 — LOAD + VALIDATE LEADS ────────────────────────────────────
  // Load Memphis leads with persisted state
  const rawLeads = [...MEMPHIS_LEADS];
  const mergedLeads: (MicroLead & Record<string, unknown>)[] = [];
  for (const lead of rawLeads.slice(0, DAILY_LIMITS.leads)) {
    const saved = await readKey<Partial<MicroLead>>(DB, `micro_lead_${lead.id}`, {});
    mergedLeads.push({ ...lead, ...saved });
  }

  // §3 Breach check — no TEST leads in PRODUCTION pipeline
  const breachLeads = mergedLeads.filter(l => {
    const lEnv = (l.environment_used as string || '').toUpperCase();
    return lEnv === 'TEST' && appEnv === 'PRODUCTION';
  });
  if (breachLeads.length > 0 && !force) {
    // §3 Rule 4 — hard stop
    await writeKey(DB, 'isolation_breach_log', {
      breach_at: new Date().toISOString(),
      breach_leads: breachLeads.map(l => l.id),
      action: 'HALTED',
    });
    return {
      status: 'ENVIRONMENT_BREACH',
      action: 'HALTED',
      breach_leads: breachLeads.map(l => ({ id: l.id, business_name: l.business_name, environment_used: l.environment_used })),
      run_id: runId,
    };
  }

  // §3 §4 Step 3 — Integrity gate
  const candidateLeads: LeadCandidate[] = mergedLeads
    .filter(l => !!(l.email || l.phone))
    .map(l => ({
      id: l.id,
      email: l.email || '',
      name: l.business_name,
      phone: l.phone || undefined,
      source: 'micro-scale',
      environment_used: (l.environment_used as AppEnv | undefined) || appEnv,
    }));

  const integrityReport = runIntegrityGate(candidateLeads, appEnv);
  const acceptedIds = new Set(integrityReport.accepted.map(a => a.id));

  if (integrityReport.accepted.length === 0) {
    return {
      status: 'NO_VALID_LEADS',
      reason: 'Integrity gate rejected all leads',
      rejected: integrityReport.rejected.length,
      run_id: runId,
    };
  }

  // ── §4 STEP 4 — VALIDATE DEMO URLS ───────────────────────────────────────
  const appUrl = env.APP_URL || 'https://websitedemopro.org';
  const leadsWithDemos = mergedLeads
    .filter(l => acceptedIds.has(l.id))
    .map(l => {
      const demoUrl = buildDemoUrl(l.slug, appEnv, appUrl);
      const valid = validateDemoUrl(demoUrl, appEnv);
      return { lead: l, demoUrl, demoValid: valid };
    })
    .filter(entry => {
      // §4 Step 4 — stop if demo invalid or is homepage
      if (!entry.demoValid) return false;
      if (entry.demoUrl === appUrl || entry.demoUrl === appUrl + '/') return false;
      return true;
    });

  if (leadsWithDemos.length === 0) {
    return { status: 'NO_VALID_DEMOS', reason: 'All demos failed validation', run_id: runId };
  }

  // ── §4 STEP 5 + §5 — LEAD ROUTING ENGINE ─────────────────────────────────
  const counters = await getOrInitCounters(DB);
  const emailLeads: typeof leadsWithDemos = [];
  const phoneLeads: typeof leadsWithDemos = [];
  const droppedLeads: string[] = [];

  for (const entry of leadsWithDemos) {
    const { lead } = entry;
    const hasEmail = !!(lead.email && lead.email.trim());
    const hasPhone = !!(lead.phone && lead.phone.trim());

    if (hasEmail) {
      // §5 email EXISTS → PRIMARY=EMAIL, SECONDARY=CALL
      emailLeads.push(entry);
    } else if (hasPhone) {
      // §5 no email but has phone → PRIMARY=CALL, SECONDARY=SMS
      phoneLeads.push(entry);
    } else {
      // §5 neither → DROP
      droppedLeads.push(lead.id);
    }
  }

  // ── §8 EMAIL CHANNEL ──────────────────────────────────────────────────────
  for (const { lead, demoUrl } of emailLeads) {
    if (counters.emails_sent >= DAILY_LIMITS.emails) break;
    const r = await sendEmail({
      DB, lead, demoUrl, env: appEnv,
      resendKey: env.RESEND_API_KEY || '',
      counters,
      dryRun,
    });
    results.push(r);
    if (r.status === 'SENT' || r.status === 'DRY_RUN') {
      emails_sent++;
      counters.emails_sent++;
      leads_processed++;
      // Count as conversation started if day1
      const od = (lead as unknown as Record<string, unknown>).outreach_day as number ?? 1;
      if (od === 1) conversations_started++;
    }
    if (!dryRun) await writeKey(DB, 'system_daily_counters', counters);
  }

  // ── §6 PHONE-FIRST CHANNEL (no-email leads) ───────────────────────────────
  for (const { lead, demoUrl } of phoneLeads) {
    // §6 PRIMARY = CALL QUEUE
    const callResult = await queueCallTask({ DB, lead, demoUrl, env: appEnv, counters });
    if (callResult.queued) {
      calls_made++;
      counters.calls_made++;
      leads_processed++;
      conversations_started++;
      results.push({
        lead_id: lead.id,
        business_name: lead.business_name,
        channel: 'call_queued',
        status: 'QUEUED',
        call_script: callResult.entry?.call_script,
        demo_url: demoUrl,
        sms_followup_ready: callResult.entry?.sms_followup,
      });
    } else {
      results.push({
        lead_id: lead.id,
        business_name: lead.business_name,
        channel: 'call_queued',
        status: 'SKIPPED',
        reason: callResult.reason,
      });
    }

    // §6 SECONDARY = SMS (sent alongside call queue prep OR if call window closed)
    if (counters.sms_sent < DAILY_LIMITS.sms) {
      const smsR = await sendSms({
        DB, lead, demoUrl, env: appEnv,
        twilioSid:   (env as unknown as Record<string, string>).TWILIO_SID,
        twilioToken: (env as unknown as Record<string, string>).TWILIO_TOKEN,
        twilioFrom:  (env as unknown as Record<string, string>).TWILIO_FROM,
        counters,
        dryRun,
      });
      results.push(smsR);
      if (smsR.status === 'SENT' || smsR.status === 'DRY_RUN') {
        sms_sent++;
        counters.sms_sent++;
      }
      if (!dryRun) await writeKey(DB, 'system_daily_counters', counters);
    }
  }

  // ── §12 SAFETY CHECK ─────────────────────────────────────────────────────
  const bounceData  = await readKey<{ rate?: number }>(DB, 'delivery_bounce_rate', {});
  const spamData    = await readKey<{ rate?: number }>(DB, 'delivery_spam_rate', {});
  const bounce_rate = bounceData.rate ?? 0;
  const spam_rate   = spamData.rate   ?? 0;
  let safetyHalt = false;
  let safetyReason = '';
  if (spam_rate   > 0.10) { safetyHalt = true; safetyReason = `Spam rate ${(spam_rate*100).toFixed(1)}% > 10%`; }
  if (bounce_rate > 0.05) { safetyHalt = true; safetyReason = `Bounce rate ${(bounce_rate*100).toFixed(1)}% > 5%`; }

  // ── §13 SAVE DAILY RUN LOG ────────────────────────────────────────────────
  const state: DailyRunLog['state'] = safetyHalt ? 'STOP_ALL'
    : gateAction === 'THROTTLE' ? 'THROTTLE'
    : gateAction === 'HOLD'     ? 'HOLD'
    : 'PROCEED';

  const logEntry: DailyRunLog = {
    date:               new Date().toISOString().slice(0, 10),
    run_id:             runId,
    triggered_by:       force ? 'MANUAL_FORCE' : 'SCHEDULED',
    env:                appEnv,
    emails_sent:        dryRun ? 0 : emails_sent,
    calls_made:         dryRun ? 0 : calls_made,
    sms_sent:           dryRun ? 0 : sms_sent,
    leads_processed,
    conversations_started,
    state,
    errors,
    duration_ms:        Date.now() - startedAt,
    finished_at:        new Date().toISOString(),
  };
  await appendDailyLog(DB, logEntry);
  if (!dryRun) await writeKey(DB, 'system_daily_counters', counters);

  // ── §1 FINAL OUTPUT ───────────────────────────────────────────────────────
  return {
    status:                  safetyHalt ? 'SAFETY_HALT' : 'MULTI_CHANNEL_DAILY_RUN_COMPLETE',
    env:                     appEnv,
    run_id:                  runId,
    dry_run:                 dryRun,
    emails_sent:             dryRun ? 0 : emails_sent,
    calls_made:              dryRun ? 0 : calls_made,
    sms_sent:                dryRun ? 0 : sms_sent,
    leads_processed,
    conversations_started,
    next_run:                'scheduled',
    cron:                    '0 10 * * *',
    routing_summary: {
      email_leads:           emailLeads.length,
      phone_first_leads:     phoneLeads.length,
      dropped_leads:         droppedLeads.length,
      integrity_rejected:    integrityReport.rejected.length,
    },
    safety: {
      spam_rate:             `${(spam_rate * 100).toFixed(1)}%`,
      bounce_rate:           `${(bounce_rate * 100).toFixed(1)}%`,
      halt:                  safetyHalt,
      reason:                safetyHalt ? safetyReason : null,
    },
    gate_action:             gateAction,
    results,
    errors,
    duration_ms:             Date.now() - startedAt,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// ─── §1 + §14: POST /api/system/run-daily ────────────────────────────────────
system.post('/run-daily', async (c) => {
  const { DB } = c.env;
  const force   = c.req.query('force') === 'true';
  const dryRun  = c.req.query('dry_run') === 'true';
  const result  = await runDailyPipeline({ DB, env: c.env, force, dryRun });
  return c.json(result);
});

// ─── GET /api/system/status ──────────────────────────────────────────────────
system.get('/status', async (c) => {
  const { DB } = c.env;
  const appEnv   = await readAppEnv(DB);
  const counters = await getOrInitCounters(DB);
  const log      = await readKey<DailyRunLog[]>(DB, 'system_daily_log', []);
  const callQueue = await readKey<CallQueueEntry[]>(DB, 'system_call_queue', []);
  const paused   = await readKey<boolean>(DB, 'engine_paused', false);

  return c.json({
    version:       SYSTEM_VERSION,
    env:           appEnv,
    paused,
    counters,
    limits:        DAILY_LIMITS,
    call_queue:    { total: callQueue.length, queued: callQueue.filter(e => e.status === 'QUEUED').length },
    last_run:      log[0] || null,
    total_runs:    log.length,
    cron_schedule: '0 10 * * *',
    endpoints: {
      run_daily:    'POST /api/system/run-daily',
      run_force:    'POST /api/system/run-daily?force=true',
      run_dry:      'POST /api/system/run-daily?dry_run=true',
      status:       'GET  /api/system/status',
      log:          'GET  /api/system/log',
      call_queue:   'GET  /api/system/call-queue',
      call_outcome: 'POST /api/system/call-outcome',
      tracking:     'GET  /api/system/tracking',
    },
  });
});

// ─── GET /api/system/log ─────────────────────────────────────────────────────
system.get('/log', async (c) => {
  const { DB } = c.env;
  const log = await readKey<DailyRunLog[]>(DB, 'system_daily_log', []);
  const limit = parseInt(c.req.query('limit') || '20');
  return c.json({ runs: log.slice(0, limit), total: log.length });
});

// ─── GET /api/system/call-queue ──────────────────────────────────────────────
system.get('/call-queue', async (c) => {
  const { DB } = c.env;
  const queue = await readKey<CallQueueEntry[]>(DB, 'system_call_queue', []);
  return c.json({ total: queue.length, queue });
});

// ─── POST /api/system/call-outcome ───────────────────────────────────────────
// §6 Record call disposition + trigger SMS if YES/VOICEMAIL
system.post('/call-outcome', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json() as {
    lead_id: string;
    disposition: 'ANSWERED' | 'VOICEMAIL' | 'NO_ANSWER' | 'REJECTED' | 'WRONG_NUMBER' | 'INTERESTED';
    send_sms?: boolean;
  };

  const queue  = await readKey<CallQueueEntry[]>(DB, 'system_call_queue', []);
  const idx    = queue.findIndex(e => e.lead_id === body.lead_id);
  if (idx < 0) return c.json({ error: 'Lead not found in call queue' }, 404);

  const entry  = queue[idx];
  const appEnv = await readAppEnv(DB);

  // §6 Outcome handling
  const disposition = body.disposition;
  let smsResult: SmsSendResult | null = null;

  entry.status = disposition === 'INTERESTED' ? 'ANSWERED'
    : disposition === 'VOICEMAIL'   ? 'VOICEMAIL'
    : disposition === 'REJECTED'    ? 'REJECTED'
    : 'NO_ANSWER';

  entry.call_attempts++;
  queue[idx] = entry;
  await writeKey(DB, 'system_call_queue', queue);

  // Update tracking
  const track = await getLeadTracking(DB, body.lead_id) || buildEmptyTracking(body.lead_id, entry.business_name, appEnv);
  track.call_attempts = entry.call_attempts;
  track.last_called_at = new Date().toISOString();

  if (disposition === 'INTERESTED') {
    track.answered   = true;
    track.interested = true;
    track.status     = 'INTERESTED';
  } else if (disposition === 'REJECTED') {
    track.status = 'LOST';
  } else if (disposition === 'VOICEMAIL') {
    track.voicemail = true;
  }
  await saveLeadTracking(DB, track);

  // §6 YES or VOICEMAIL → send SMS immediately
  const shouldSms = disposition === 'INTERESTED' || disposition === 'VOICEMAIL' || (disposition === 'NO_ANSWER' && body.send_sms !== false);
  if (shouldSms) {
    // Find lead in Memphis list
    const allLeads = [...MEMPHIS_LEADS];
    const lead = allLeads.find(l => l.id === body.lead_id);
    if (lead) {
      const counters = await getOrInitCounters(DB);
      smsResult = await sendSms({
        DB, lead,
        demoUrl:     entry.demo_url,
        env:         appEnv,
        twilioSid:   (DB as unknown as Record<string, string>).TWILIO_SID,
        twilioToken: (DB as unknown as Record<string, string>).TWILIO_TOKEN,
        twilioFrom:  (DB as unknown as Record<string, string>).TWILIO_FROM,
        counters,
        dryRun:      false,
      });
    }
  }

  return c.json({
    lead_id:     body.lead_id,
    disposition,
    tracking:    track,
    sms_sent:    smsResult?.status === 'SENT',
    sms_result:  smsResult,
  });
});

// ─── GET /api/system/tracking ─────────────────────────────────────────────────
system.get('/tracking', async (c) => {
  const { DB } = c.env;
  const allLeads = [...MEMPHIS_LEADS];
  const tracking: LeadTracking[] = [];
  for (const lead of allLeads) {
    const t = await getLeadTracking(DB, lead.id);
    tracking.push(t || buildEmptyTracking(lead.id, lead.business_name, 'PRODUCTION'));
  }
  const summary = {
    total:          tracking.length,
    new:            tracking.filter(t => t.status === 'NEW').length,
    contacted:      tracking.filter(t => t.status === 'CONTACTED').length,
    interested:     tracking.filter(t => t.status === 'INTERESTED').length,
    closed:         tracking.filter(t => t.status === 'CLOSED').length,
    lost:           tracking.filter(t => t.status === 'LOST').length,
    emails_sent:    tracking.filter(t => t.email_sent).length,
    sms_sent:       tracking.filter(t => t.sms_sent).length,
    calls_made:     tracking.filter(t => t.called).length,
  };
  return c.json({ summary, leads: tracking });
});

export default system;

// ─── CLOUDFLARE CRON HANDLER (§2) ────────────────────────────────────────────
// Schedule: 0 10 * * *  →  10:00 AM UTC daily
// Wire in src/index.tsx: scheduled handler calls handleSystemScheduled(env)
export async function handleSystemScheduled(env: Bindings): Promise<void> {
  const DB = env.DB;
  if (!DB) return;

  console.log(`[SYSTEM-CRON] Firing daily pipeline — ${new Date().toISOString()}`);

  const result = await runDailyPipeline({ DB, env, force: false, dryRun: false }) as Record<string, unknown>;

  console.log(`[SYSTEM-CRON] Complete — status=${result.status} emails=${result.emails_sent} calls=${result.calls_made} sms=${result.sms_sent} duration=${result.duration_ms}ms`);

  if (result.status === 'ENVIRONMENT_BREACH') {
    console.error('[SYSTEM-CRON] ENVIRONMENT_BREACH — pipeline halted');
  }
}
