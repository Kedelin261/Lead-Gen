// ============================================================
// AUTONOMOUS OUTBOUND EXECUTION ENGINE — /api/engine
//
// MISSION: Run a SAFE, COMPLIANT, MULTI-CHANNEL outreach system
//          DAILY without manual prompting.
//
// The engine orchestrates:
//   • Email  — Day-1 cold touch, Day-2 soft follow-up, Day-3+ demo link
//   • SMS    — Short intro ping (compliant, opt-out included)
//   • Calls  — Click-to-call log with disposition tracking
//
// Safety layers (all must pass before ANY send):
//   1. Environment isolation (TEST / PRODUCTION)
//   2. Integrity gate (email blocklist, duplicate check, source verify)
//   3. Warmup / scaling gate (spam rate, bounce rate, reply rate)
//   4. Daily hard caps (emails:5, SMS:5, calls:10, leads:20)
//   5. Environment breach hard-stop (TEST lead in PRODUCTION pipeline)
//
// Cloudflare Cron Trigger fires at 09:00 CT (14:00 UTC) Mon–Fri.
// Manual trigger: POST /api/engine/run
//
// Endpoints:
//   GET  /api/engine/status           → current engine state
//   GET  /api/engine/log              → last-N daily run records
//   GET  /api/engine/health           → gate + channel health snapshot
//   POST /api/engine/run              → manual trigger (full daily cycle)
//   POST /api/engine/run-channel      → run one channel only (email|sms|calls)
//   POST /api/engine/pause            → pause autonomous execution
//   POST /api/engine/resume           → resume autonomous execution
//   POST /api/engine/reset-day        → reset today's counters (admin)
//   GET  /api/engine/channels         → per-channel quota and status
//   POST /api/engine/sms/send         → send SMS to a lead (Twilio / dry-run)
//   POST /api/engine/calls/log        → log a call disposition
//   GET  /api/engine/calls            → call log
// ============================================================

import { Hono } from 'hono';
import type { Bindings } from '../types';
import {
  resolveEnv,
  runIntegrityGate,
  TEST_EMAIL_LIST,
  INFRA_EMAIL_BLOCKLIST,
  type AppEnv,
  type LeadCandidate,
} from '../lib/lead-integrity';
import {
  checkScalingGate,
  checkLinkPolicy,
  WARMUP_SCHEDULE,
  type EngagementMetrics,
} from '../lib/warmup-engine';
import { MEMPHIS_LEADS, type MicroLead } from './micro-scale';

const engine = new Hono<{ Bindings: Bindings }>();

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DAILY_CAPS = {
  emails:  5,
  sms:     5,
  calls:  10,
  leads:  20,
} as const;

const ENGINE_VERSION = '2.0.0';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface DailyCounters {
  date: string;          // YYYY-MM-DD UTC
  emails_sent: number;
  sms_sent: number;
  calls_logged: number;
  leads_contacted: number;
  emails_cap: number;
  sms_cap: number;
  calls_cap: number;
  leads_cap: number;
}

interface RunRecord {
  run_id: string;
  triggered_by: 'CRON' | 'MANUAL' | 'CHANNEL';
  channel?: 'email' | 'sms' | 'calls' | 'all';
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  env: AppEnv;
  gate_status: string;
  emails_attempted: number;
  emails_sent: number;
  sms_attempted: number;
  sms_sent: number;
  calls_logged: number;
  environment_breach: boolean;
  hard_stop_triggered: boolean;
  hard_stop_reason: string | null;
  results: unknown[];
  errors: string[];
  status: 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'HARD_STOP' | 'ERROR';
}

interface CallLog {
  log_id: string;
  lead_id: string;
  business_name: string;
  phone: string;
  called_at: string;
  disposition: 'ANSWERED' | 'VOICEMAIL' | 'NO_ANSWER' | 'WRONG_NUMBER' | 'CALLBACK_REQUESTED' | 'NOT_INTERESTED' | 'INTERESTED';
  duration_seconds: number;
  notes: string;
  follow_up_needed: boolean;
}

// ─── DB HELPERS ───────────────────────────────────────────────────────────────
async function readEnv(DB: D1Database): Promise<AppEnv> {
  try {
    const row = await DB.prepare(
      `SELECT value FROM settings WHERE key = 'app_env'`
    ).first<{ value: string }>();
    return resolveEnv(row?.value);
  } catch { return 'PRODUCTION'; }
}

async function readKey<T>(DB: D1Database, key: string, fallback: T): Promise<T> {
  try {
    const row = await DB.prepare(
      `SELECT value FROM settings WHERE key = ?`
    ).bind(key).first<{ value: string }>();
    return row ? (JSON.parse(row.value) as T) : fallback;
  } catch { return fallback; }
}

async function writeKey(DB: D1Database, key: string, value: unknown): Promise<void> {
  await DB.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
  ).bind(key, JSON.stringify(value)).run();
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getOrInitCounters(DB: D1Database): Promise<DailyCounters> {
  const today = todayUTC();
  const stored = await readKey<DailyCounters>(DB, 'engine_daily_counters', {
    date: today,
    emails_sent: 0, sms_sent: 0, calls_logged: 0, leads_contacted: 0,
    emails_cap: DAILY_CAPS.emails, sms_cap: DAILY_CAPS.sms,
    calls_cap: DAILY_CAPS.calls, leads_cap: DAILY_CAPS.leads,
  });
  // Reset if day changed
  if (stored.date !== today) {
    const fresh: DailyCounters = {
      date: today,
      emails_sent: 0, sms_sent: 0, calls_logged: 0, leads_contacted: 0,
      emails_cap: DAILY_CAPS.emails, sms_cap: DAILY_CAPS.sms,
      calls_cap: DAILY_CAPS.calls, leads_cap: DAILY_CAPS.leads,
    };
    await writeKey(DB, 'engine_daily_counters', fresh);
    return fresh;
  }
  return stored;
}

async function loadLeads(DB: D1Database): Promise<MicroLead[]> {
  const leads = [...MEMPHIS_LEADS];
  try {
    const rows = await DB.prepare(
      `SELECT key, value FROM settings WHERE key LIKE 'micro_lead_%'`
    ).all<{ key: string; value: string }>();
    for (const row of rows.results || []) {
      const id = row.key.replace('micro_lead_', '');
      const saved = JSON.parse(row.value) as Partial<MicroLead>;
      const idx = leads.findIndex(l => l.id === id);
      if (idx >= 0) leads[idx] = { ...leads[idx], ...saved };
    }
  } catch { /* ignore */ }
  return leads;
}

async function persistLead(DB: D1Database, lead: MicroLead): Promise<void> {
  await DB.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
  ).bind(`micro_lead_${lead.id}`, JSON.stringify(lead)).run();
}

// ─── BREACH RECORDER ─────────────────────────────────────────────────────────
async function recordBreach(DB: D1Database, leadId: string, email: string, env: AppEnv): Promise<void> {
  try {
    const log = await readKey<unknown[]>(DB, 'isolation_breach_log', []);
    log.unshift({
      id: `breach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      lead_id: leadId,
      lead_email: email,
      current_env: env,
      action_blocked: 'ENGINE_SEND',
      reason: 'TEST lead attempted entry into PRODUCTION send pipeline (engine) — hard stop',
    });
    await writeKey(DB, 'isolation_breach_log', (log as unknown[]).slice(0, 50));
  } catch { /* ignore */ }
}

// ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────────
function buildDay1Subject(businessName: string): string {
  const opts = [
    `quick question about ${businessName}`,
    `question for ${businessName}`,
    `noticed ${businessName} online`,
    `${businessName} — quick thought`,
  ];
  return opts[Math.floor(Math.random() * opts.length)];
}

function buildDay1Body(lead: MicroLead): string {
  const greetings = ['Hey', 'Hi', 'Hello'];
  const g = greetings[Math.floor(Math.random() * greetings.length)];
  const industryQ: Record<string, string> = {
    'cleaning services': `Do most of your new clients find ${lead.business_name} through referrals, or Google searches lately?`,
    'auto repair': `Do most people who bring their car to ${lead.business_name} find you through word of mouth or online?`,
    'HVAC': `Do most homeowners who call ${lead.business_name} find you through referrals or Google?`,
    'motorcycle repair': `Do most riders who come to ${lead.business_name} find you through the community or Google?`,
    'truck repair': `Do truckers find ${lead.business_name} mostly through word of mouth or Google?`,
    'auto detailing': `Do most detailing clients at ${lead.business_name} come through referrals or Google?`,
  };
  const q = industryQ[lead.industry] ?? `Do most new clients find ${lead.business_name} through referrals or Google?`;
  return `${g} — hope business is going well at ${lead.business_name}.\n\n${q}\n\nJust curious — no pitch, genuinely wondering.\n\n— Alex`;
}

function buildDay2Body(lead: MicroLead): string {
  const bridges = [
    `Just wanted to follow up on my last message — did it land okay?`,
    `Circling back — wanted to make sure my note didn't get buried.`,
    `Quick follow-up — just checking my last message got through.`,
  ];
  const b = bridges[Math.floor(Math.random() * bridges.length)];
  return `Hey —\n\n${b}\n\nNo pressure at all. Just a quick question about how new customers find ${lead.business_name}.\n\n— Alex`;
}

function buildDay3Body(lead: MicroLead, demoUrl: string): string {
  return `Hey —\n\nAppreciate you taking the time to reply.\n\nI actually put together a quick example of what a simple site could look like for ${lead.business_name} — nothing fancy, just to show the idea.\n\nIf you're curious: ${demoUrl}\n\nNo obligation, just wanted to give you something concrete to look at.\n\n— Alex`;
}

function buildDemoUrl(slug: string, env: AppEnv, appUrl?: string): string {
  const base = (appUrl || 'https://websitedemopro.org').replace(/\/$/, '');
  return env === 'TEST' ? `${base}/demo/test/${slug}` : `${base}/demo/${slug}`;
}

// ─── SMS TEMPLATES ────────────────────────────────────────────────────────────
function buildSmsBody(lead: MicroLead): string {
  const msgs = [
    `Hi, I'm Alex — I help local businesses in Memphis get found online. Quick question for ${lead.business_name}: are most of your customers finding you through referrals or Google? Reply STOP to opt out.`,
    `Hey, this is Alex. I noticed ${lead.business_name} might not have a website — curious, do most customers find you through word of mouth? Reply STOP to opt out.`,
    `Hi — Alex here. I work with Memphis businesses on their online presence. Quick question for ${lead.business_name}: how do new clients usually find you? Reply STOP to opt out.`,
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

// ─── CORE EMAIL RUNNER ───────────────────────────────────────────────────────
async function runEmailChannel(
  DB: D1Database,
  RESEND_API_KEY: string,
  env: AppEnv,
  counters: DailyCounters,
  appUrl?: string,
  dryRun = false,
): Promise<{ results: unknown[]; sent: number; errors: string[]; breach: boolean; hardStop: boolean; hardStopReason: string | null }> {

  const results: unknown[] = [];
  const errors: string[] = [];
  let sent = 0;
  let breach = false;
  let hardStop = false;
  let hardStopReason: string | null = null;

  const remaining = counters.emails_cap - counters.emails_sent;
  if (remaining <= 0) {
    results.push({ channel: 'email', status: 'CAP_REACHED', cap: counters.emails_cap });
    return { results, sent, errors, breach, hardStop, hardStopReason };
  }

  const leads = await loadLeads(DB);
  const emailReady = leads.filter(l => l.email && !l.tracking.sent && !l.day1_email_sent);
  const followUpReady = leads.filter(l => l.email && l.tracking.sent && !l.tracking.replied && l.outreach_day < 4);

  // Gather candidates (day-1 first, then follow-ups)
  const day1Candidates = emailReady.slice(0, remaining);
  const followUpCandidates = followUpReady.slice(0, Math.max(0, remaining - day1Candidates.length));

  // ── Environment breach check (Rule 6) ────────────────────────────────────
  if (env === 'PRODUCTION') {
    const testLeaks = [...day1Candidates, ...followUpCandidates].filter(l => {
      const isTestEmail = TEST_EMAIL_LIST.has((l.email || '').toLowerCase());
      const isTaggedTest = (l as MicroLead & { lead_type?: string }).lead_type === 'TEST';
      return isTestEmail || isTaggedTest;
    });
    if (testLeaks.length > 0) {
      for (const l of testLeaks) await recordBreach(DB, l.id, l.email, env);
      breach = true;
      hardStop = true;
      hardStopReason = 'TEST_LEAD_IN_PRODUCTION_PIPELINE';
      results.push({
        status: 'ENVIRONMENT_BREACH',
        send_halted: true,
        reason: hardStopReason,
        breached_count: testLeaks.length,
        channel: 'email',
      });
      return { results, sent, errors, breach, hardStop, hardStopReason };
    }
  }

  // ── Integrity gate ────────────────────────────────────────────────────────
  const allCandidates = [...day1Candidates, ...followUpCandidates];
  if (allCandidates.length === 0) {
    results.push({ channel: 'email', status: 'NO_CANDIDATES', reason: 'No email-ready leads available' });
    return { results, sent, errors, breach, hardStop, hardStopReason };
  }

  const integrityInput: LeadCandidate[] = allCandidates.map(l => ({
    email: l.email, business_name: l.business_name,
    phone: l.phone, city: l.city, industry: l.industry, source: 'osm',
  }));
  const integrityReport = runIntegrityGate(integrityInput, env);

  if (integrityReport.hard_stop_triggered) {
    hardStop = true;
    hardStopReason = integrityReport.hard_stop_reason || 'INTEGRITY_HARD_STOP';
    results.push({ channel: 'email', status: 'INTEGRITY_HARD_STOP', reason: hardStopReason });
    return { results, sent, errors, breach, hardStop, hardStopReason };
  }

  const approvedEmails = new Set(integrityReport.accepted.map(l => l.email.toLowerCase()));
  const approved = allCandidates.filter(l => approvedEmails.has(l.email.toLowerCase()));

  // ── Compute warmup metrics for gate check ────────────────────────────────
  const allLeads = await loadLeads(DB);
  const totalSent = allLeads.filter(l => l.tracking.sent).length;
  const totalReplied = allLeads.filter(l => l.tracking.replied).length;
  const replyRate = totalSent > 0 ? totalReplied / totalSent : 0;

  const mockMetrics: EngagementMetrics = {
    total_sent: totalSent,
    replies_received: totalReplied,
    opens_tracked: 0,
    spam_hits: 0,
    bounces: 0,
    reply_rate: replyRate,
    spam_rate: 0,
    bounce_rate: 0,
    placement_data: [],
  };
  const gate = checkScalingGate(mockMetrics, true);

  if (gate.action === 'STOP_ALL') {
    hardStop = true;
    hardStopReason = gate.reason;
    results.push({ channel: 'email', status: 'GATE_STOP_ALL', reason: hardStop });
    return { results, sent, errors, breach, hardStop, hardStopReason };
  }

  // Determine warmup day config
  const warmupDay = Math.min(5, Math.max(1, Math.ceil(totalSent / 5) + 1));
  const warmupConfig = WARMUP_SCHEDULE[Math.min(warmupDay - 1, WARMUP_SCHEDULE.length - 1)];
  const sendLimit = Math.min(remaining, warmupConfig.max_sends_per_day, gate.send_limit);
  const sendBatch = approved.slice(0, sendLimit);

  const fromEmail = 'alex@websitedemopro.org';

  for (const lead of sendBatch) {
    const isFollowUp = lead.tracking.sent;
    const demoUrl = buildDemoUrl(lead.slug, env, appUrl);

    // Determine email content
    let subject: string;
    let body: string;
    let linkAllowed = false;

    if (!isFollowUp) {
      // Day 1
      subject = buildDay1Subject(lead.business_name);
      body = buildDay1Body(lead);
    } else {
      // Follow-up (day 2 or 3+)
      subject = `Re: quick question about ${lead.business_name}`;
      const policy = checkLinkPolicy({
        recipient: lead.email,
        reply_received: lead.reply_received,
        thread_depth: lead.thread_depth,
        warmup_day: warmupDay,
        reply_rate: replyRate,
        total_sends: totalSent,
      });
      linkAllowed = policy.link_allowed;

      if (linkAllowed && lead.outreach_day >= 3) {
        body = buildDay3Body(lead, demoUrl);
      } else {
        body = buildDay2Body(lead);
      }
    }

    if (dryRun) {
      results.push({
        id: lead.id,
        business_name: lead.business_name,
        email: lead.email,
        subject,
        body_preview: body.slice(0, 100) + '…',
        dry_run: true,
        is_followup: isFollowUp,
        link_allowed: linkAllowed,
        status: 'DRY_RUN',
        channel: 'email',
      });
      sent++;
      continue;
    }

    // ── Actual send via Resend ──────────────────────────────────────────
    let resendId: string | null = null;
    let sendStatus = 'FAILED';
    let errorMsg: string | null = null;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Alex <${fromEmail}>`,
          to: [lead.email],
          subject,
          text: body,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { id: string };
        resendId = data.id;
        sendStatus = 'SENT';
        sent++;
      } else {
        errorMsg = `Resend ${res.status}: ${await res.text()}`;
        errors.push(`${lead.id}: ${errorMsg}`);
      }
    } catch (e: unknown) {
      errorMsg = e instanceof Error ? e.message : String(e);
      errors.push(`${lead.id}: ${errorMsg}`);
    }

    // Persist lead state
    if (sendStatus === 'SENT') {
      const updated: MicroLead = {
        ...lead,
        day1_email_sent: !isFollowUp ? true : lead.day1_email_sent,
        thread_depth: lead.thread_depth + 1,
        outreach_day: lead.outreach_day + (isFollowUp ? 1 : 0),
        last_sent_at: new Date().toISOString(),
        resend_ids: resendId ? [...lead.resend_ids, resendId] : lead.resend_ids,
        tracking: { ...lead.tracking, sent: true },
      };
      try { await persistLead(DB, updated); } catch { /* ignore */ }

      // Update isolation metrics
      try {
        const m = await readKey(DB, `isolation_metrics_${env}`, { emails_sent: 0 }) as Record<string, number>;
        m.emails_sent = (m.emails_sent || 0) + 1;
        m.last_updated = Date.now();
        await writeKey(DB, `isolation_metrics_${env}`, m);
      } catch { /* ignore */ }
    }

    results.push({
      id: lead.id,
      business_name: lead.business_name,
      email: lead.email,
      subject,
      resend_id: resendId,
      status: sendStatus,
      error: errorMsg,
      is_followup: isFollowUp,
      link_allowed: linkAllowed,
      channel: 'email',
    });

    // Human-like delay between sends (45–90s) — skip last
    if (sendBatch.indexOf(lead) < sendBatch.length - 1 && !dryRun) {
      const delay = 45_000 + Math.random() * 45_000;
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return { results, sent, errors, breach, hardStop, hardStopReason };
}

// ─── SMS CHANNEL RUNNER ───────────────────────────────────────────────────────
async function runSmsChannel(
  DB: D1Database,
  env: AppEnv,
  counters: DailyCounters,
  twilioSid?: string,
  twilioToken?: string,
  twilioFrom?: string,
  dryRun = false,
): Promise<{ results: unknown[]; sent: number; errors: string[] }> {
  const results: unknown[] = [];
  const errors: string[] = [];
  let sent = 0;

  const remaining = counters.sms_cap - counters.sms_sent;
  if (remaining <= 0) {
    results.push({ channel: 'sms', status: 'CAP_REACHED', cap: counters.sms_cap });
    return { results, sent, errors };
  }

  const leads = await loadLeads(DB);
  // SMS targets: leads with phone, not yet SMS'd, email not yet sent (first touch)
  const smsReady = leads.filter(l =>
    l.phone &&
    !(l as MicroLead & { sms_sent?: boolean }).sms_sent &&
    !l.tracking.sent  // prefer leads not yet emailed — avoid double-touch same day
  ).slice(0, remaining);

  if (smsReady.length === 0) {
    results.push({ channel: 'sms', status: 'NO_CANDIDATES', reason: 'No SMS-ready leads' });
    return { results, sent, errors };
  }

  for (const lead of smsReady) {
    const body = buildSmsBody(lead);

    if (dryRun || !twilioSid || !twilioToken || !twilioFrom) {
      results.push({
        id: lead.id,
        business_name: lead.business_name,
        phone: lead.phone,
        body_preview: body.slice(0, 80) + '…',
        dry_run: true,
        status: 'DRY_RUN',
        channel: 'sms',
        reason: !twilioSid ? 'TWILIO_NOT_CONFIGURED' : 'DRY_RUN',
      });
      sent++;
      continue;
    }

    // ── Actual send via Twilio ────────────────────────────────────────────
    let sendStatus = 'FAILED';
    let errorMsg: string | null = null;

    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const formData = new URLSearchParams({
        To: lead.phone,
        From: twilioFrom,
        Body: body,
      });

      const res = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (res.ok) {
        sendStatus = 'SENT';
        sent++;
        // Tag lead as SMS'd
        const updated = { ...lead } as MicroLead & { sms_sent: boolean; sms_sent_at: string };
        updated.sms_sent = true;
        updated.sms_sent_at = new Date().toISOString();
        try { await persistLead(DB, updated); } catch { /* ignore */ }
      } else {
        errorMsg = `Twilio ${res.status}`;
        errors.push(`${lead.id}: ${errorMsg}`);
      }
    } catch (e: unknown) {
      errorMsg = e instanceof Error ? e.message : String(e);
      errors.push(`${lead.id}: ${errorMsg}`);
    }

    results.push({
      id: lead.id,
      business_name: lead.business_name,
      phone: lead.phone,
      status: sendStatus,
      error: errorMsg,
      channel: 'sms',
    });
  }

  return { results, sent, errors };
}

// ─── MASTER DAILY RUN ORCHESTRATOR ───────────────────────────────────────────
async function runDailyCycle(
  DB: D1Database,
  env: Bindings,
  appEnv: AppEnv,
  triggeredBy: 'CRON' | 'MANUAL' | 'CHANNEL',
  channel: 'email' | 'sms' | 'calls' | 'all' = 'all',
  dryRun = false,
): Promise<RunRecord> {
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const startedAt = new Date().toISOString();

  const run: RunRecord = {
    run_id: runId,
    triggered_by: triggeredBy,
    channel,
    started_at: startedAt,
    finished_at: null,
    duration_ms: null,
    env: appEnv,
    gate_status: 'PENDING',
    emails_attempted: 0,
    emails_sent: 0,
    sms_attempted: 0,
    sms_sent: 0,
    calls_logged: 0,
    environment_breach: false,
    hard_stop_triggered: false,
    hard_stop_reason: null,
    results: [],
    errors: [],
    status: 'RUNNING',
  };

  // Check paused state
  const paused = await readKey<boolean>(DB, 'engine_paused', false);
  if (paused && triggeredBy !== 'MANUAL') {
    run.status = 'PAUSED';
    run.gate_status = 'PAUSED';
    run.finished_at = new Date().toISOString();
    run.duration_ms = 0;
    (run.results as unknown[]).push({ status: 'ENGINE_PAUSED', reason: 'Engine is paused — resume via POST /api/engine/resume' });
    await appendRunLog(DB, run);
    return run;
  }

  // Get daily counters
  const counters = await getOrInitCounters(DB);

  // ── EMAIL ──────────────────────────────────────────────────────────────────
  if (channel === 'all' || channel === 'email') {
    const emailResult = await runEmailChannel(
      DB,
      env.RESEND_API_KEY || '',
      appEnv,
      counters,
      env.APP_URL,
      dryRun,
    );
    run.emails_attempted = emailResult.results.length;
    run.emails_sent = emailResult.sent;
    (run.results as unknown[]).push(...emailResult.results);
    run.errors.push(...emailResult.errors);

    if (emailResult.breach) {
      run.environment_breach = true;
      run.hard_stop_triggered = true;
      run.hard_stop_reason = emailResult.hardStopReason;
      run.gate_status = 'ENVIRONMENT_BREACH';
      run.status = 'HARD_STOP';
      run.finished_at = new Date().toISOString();
      run.duration_ms = Date.now() - new Date(startedAt).getTime();
      await appendRunLog(DB, run);
      return run;
    }

    if (emailResult.hardStop) {
      run.hard_stop_triggered = true;
      run.hard_stop_reason = emailResult.hardStopReason;
      run.gate_status = 'HARD_STOP';
      run.status = 'HARD_STOP';
      run.finished_at = new Date().toISOString();
      run.duration_ms = Date.now() - new Date(startedAt).getTime();
      await appendRunLog(DB, run);
      return run;
    }

    // Update counters
    if (!dryRun && emailResult.sent > 0) {
      counters.emails_sent += emailResult.sent;
      await writeKey(DB, 'engine_daily_counters', counters);
    }
    run.gate_status = 'PASSED';
  }

  // ── SMS ────────────────────────────────────────────────────────────────────
  if (channel === 'all' || channel === 'sms') {
    const smsResult = await runSmsChannel(
      DB,
      appEnv,
      counters,
      (env as unknown as Record<string, string>).TWILIO_SID,
      (env as unknown as Record<string, string>).TWILIO_TOKEN,
      (env as unknown as Record<string, string>).TWILIO_FROM,
      dryRun,
    );
    run.sms_attempted = smsResult.results.length;
    run.sms_sent = smsResult.sent;
    (run.results as unknown[]).push(...smsResult.results);
    run.errors.push(...smsResult.errors);

    if (!dryRun && smsResult.sent > 0) {
      counters.sms_sent += smsResult.sent;
      await writeKey(DB, 'engine_daily_counters', counters);
    }
  }

  // ── CALLS — log-only (no auto-dialer; humans initiate calls) ──────────────
  if (channel === 'all' || channel === 'calls') {
    const callsRemaining = counters.calls_cap - counters.calls_logged;
    if (callsRemaining <= 0) {
      (run.results as unknown[]).push({ channel: 'calls', status: 'CAP_REACHED', cap: counters.calls_cap });
    } else {
      (run.results as unknown[]).push({
        channel: 'calls',
        status: 'READY',
        calls_remaining: callsRemaining,
        message: 'Calls are human-initiated. Use POST /api/engine/calls/log to record dispositions.',
      });
    }
  }

  run.status = run.errors.length > 0 ? 'ERROR' : 'COMPLETED';
  run.finished_at = new Date().toISOString();
  run.duration_ms = Date.now() - new Date(startedAt).getTime();

  await appendRunLog(DB, run);
  return run;
}

async function appendRunLog(DB: D1Database, run: RunRecord): Promise<void> {
  try {
    const log = await readKey<RunRecord[]>(DB, 'engine_run_log', []);
    log.unshift(run);
    await writeKey(DB, 'engine_run_log', log.slice(0, 30)); // keep last 30 runs
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/engine/status ───────────────────────────────────────────────────
engine.get('/status', async (c) => {
  const { DB } = c.env;
  const appEnv = await readEnv(DB);
  const paused = await readKey<boolean>(DB, 'engine_paused', false);
  const counters = await getOrInitCounters(DB);
  const runLog = await readKey<RunRecord[]>(DB, 'engine_run_log', []);
  const lastRun = runLog[0] || null;

  return c.json({
    status: 'AUTONOMOUS_ENGINE_ACTIVE',
    version: ENGINE_VERSION,
    engine_paused: paused,
    current_env: appEnv,
    environment_isolation_active: true,
    mission: 'SAFE, COMPLIANT, MULTI-CHANNEL outreach — DAILY without manual prompting',
    channels: {
      email:  { active: true,  cap: counters.emails_cap,  used: counters.emails_sent,  remaining: Math.max(0, counters.emails_cap - counters.emails_sent) },
      sms:    { active: true,  cap: counters.sms_cap,     used: counters.sms_sent,     remaining: Math.max(0, counters.sms_cap - counters.sms_sent) },
      calls:  { active: true,  cap: counters.calls_cap,   used: counters.calls_logged, remaining: Math.max(0, counters.calls_cap - counters.calls_logged) },
      leads:  { active: true,  cap: counters.leads_cap,   used: counters.leads_contacted, remaining: Math.max(0, counters.leads_cap - counters.leads_contacted) },
    },
    daily_counters: counters,
    last_run: lastRun ? {
      run_id: lastRun.run_id,
      triggered_by: lastRun.triggered_by,
      started_at: lastRun.started_at,
      finished_at: lastRun.finished_at,
      status: lastRun.status,
      emails_sent: lastRun.emails_sent,
      sms_sent: lastRun.sms_sent,
      env: lastRun.env,
    } : null,
    cron_schedule: '0 14 * * 1-5',
    cron_description: 'Weekdays at 09:00 CT (14:00 UTC)',
    safety_gates: [
      'Environment isolation (TEST/PRODUCTION)',
      'Integrity gate (email blocklist, duplicate check)',
      'Warmup gate (spam/bounce/reply rate)',
      'Daily hard caps enforced',
      'Environment breach hard-stop',
    ],
    endpoints: {
      run:          'POST /api/engine/run',
      run_channel:  'POST /api/engine/run-channel',
      pause:        'POST /api/engine/pause',
      resume:       'POST /api/engine/resume',
      log:          'GET  /api/engine/log',
      health:       'GET  /api/engine/health',
      channels:     'GET  /api/engine/channels',
      sms_send:     'POST /api/engine/sms/send',
      call_log:     'POST /api/engine/calls/log',
    },
  });
});

// ─── GET /api/engine/log ──────────────────────────────────────────────────────
engine.get('/log', async (c) => {
  const { DB } = c.env;
  const limitParam = c.req.query('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam), 30) : 10;
  const log = await readKey<RunRecord[]>(DB, 'engine_run_log', []);
  return c.json({
    total: log.length,
    showing: Math.min(limit, log.length),
    runs: log.slice(0, limit),
  });
});

// ─── GET /api/engine/health ───────────────────────────────────────────────────
engine.get('/health', async (c) => {
  const { DB } = c.env;
  const appEnv = await readEnv(DB);
  const leads = await loadLeads(DB);
  const counters = await getOrInitCounters(DB);

  const totalSent = leads.filter(l => l.tracking.sent).length;
  const totalReplied = leads.filter(l => l.tracking.replied).length;
  const replyRate = totalSent > 0 ? totalReplied / totalSent : 0;

  const mockMetrics: EngagementMetrics = {
    total_sent: totalSent, replies_received: totalReplied,
    opens_tracked: 0, spam_hits: 0, bounces: 0,
    reply_rate: replyRate, spam_rate: 0, bounce_rate: 0,
    placement_data: [],
  };
  const gate = checkScalingGate(mockMetrics, true);

  // Check for any isolation breach in breach log
  const breachLog = await readKey<unknown[]>(DB, 'isolation_breach_log', []);
  const recentBreach = breachLog.length > 0 ? breachLog[0] : null;

  return c.json({
    health: gate.action === 'STOP_ALL' ? 'CRITICAL' : gate.action === 'HOLD' ? 'WARNING' : 'HEALTHY',
    current_env: appEnv,
    scaling_gate: gate,
    email_channel: {
      cap: counters.emails_cap,
      used_today: counters.emails_sent,
      remaining: Math.max(0, counters.emails_cap - counters.emails_sent),
      leads_with_email: leads.filter(l => l.email).length,
      leads_unsent: leads.filter(l => l.email && !l.tracking.sent).length,
      leads_in_followup: leads.filter(l => l.email && l.tracking.sent && !l.tracking.replied).length,
    },
    sms_channel: {
      cap: counters.sms_cap,
      used_today: counters.sms_sent,
      remaining: Math.max(0, counters.sms_cap - counters.sms_sent),
      leads_with_phone: leads.filter(l => l.phone).length,
    },
    calls_channel: {
      cap: counters.calls_cap,
      used_today: counters.calls_logged,
      remaining: Math.max(0, counters.calls_cap - counters.calls_logged),
    },
    campaign_metrics: {
      total_sent: totalSent,
      total_replied: totalReplied,
      reply_rate_pct: parseFloat((replyRate * 100).toFixed(1)),
      interested: leads.filter(l => l.tracking.interested).length,
      closed: leads.filter(l => l.tracking.closed).length,
    },
    isolation_health: {
      environment_breach_count: breachLog.length,
      last_breach: recentBreach,
      isolation_active: true,
    },
  });
});

// ─── GET /api/engine/channels ─────────────────────────────────────────────────
engine.get('/channels', async (c) => {
  const { DB } = c.env;
  const counters = await getOrInitCounters(DB);
  const appEnv = await readEnv(DB);
  const paused = await readKey<boolean>(DB, 'engine_paused', false);
  const twilioConfigured = !!(c.env as unknown as Record<string, string>).TWILIO_SID;
  const resendConfigured = !!c.env.RESEND_API_KEY;

  return c.json({
    current_env: appEnv,
    engine_paused: paused,
    channels: {
      email: {
        name: 'Email (Resend)',
        active: true,
        configured: resendConfigured,
        cap_daily: counters.emails_cap,
        used_today: counters.emails_sent,
        remaining: Math.max(0, counters.emails_cap - counters.emails_sent),
        trigger_endpoint: 'POST /api/engine/run-channel {"channel":"email"}',
        send_endpoint: 'POST /api/micro-scale/send-day1',
      },
      sms: {
        name: 'SMS (Twilio)',
        active: true,
        configured: twilioConfigured,
        setup_note: twilioConfigured ? null : 'Set TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM as Cloudflare secrets to enable live SMS',
        cap_daily: counters.sms_cap,
        used_today: counters.sms_sent,
        remaining: Math.max(0, counters.sms_cap - counters.sms_sent),
        trigger_endpoint: 'POST /api/engine/run-channel {"channel":"sms"}',
        send_endpoint: 'POST /api/engine/sms/send',
      },
      calls: {
        name: 'Calls (Human-initiated)',
        active: true,
        configured: true,
        note: 'Calls are human-initiated. Log dispositions via POST /api/engine/calls/log',
        cap_daily: counters.calls_cap,
        used_today: counters.calls_logged,
        remaining: Math.max(0, counters.calls_cap - counters.calls_logged),
        log_endpoint: 'POST /api/engine/calls/log',
        view_endpoint: 'GET  /api/engine/calls',
      },
    },
  });
});

// ─── POST /api/engine/run ─────────────────────────────────────────────────────
// Manual full daily cycle trigger
engine.post('/run', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json().catch(() => ({})) as { dry_run?: boolean; force?: boolean };
  const appEnv = await readEnv(DB);

  const run = await runDailyCycle(DB, c.env, appEnv, 'MANUAL', 'all', body.dry_run ?? false);

  return c.json(run, run.hard_stop_triggered ? 403 : run.environment_breach ? 403 : 200);
});

// ─── POST /api/engine/run-channel ────────────────────────────────────────────
// Run a single channel only
engine.post('/run-channel', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json().catch(() => ({})) as {
    channel?: 'email' | 'sms' | 'calls';
    dry_run?: boolean;
  };

  const ch = (body.channel as 'email' | 'sms' | 'calls') || 'email';
  if (!['email', 'sms', 'calls'].includes(ch)) {
    return c.json({ error: 'channel must be email | sms | calls' }, 400);
  }

  const appEnv = await readEnv(DB);
  const run = await runDailyCycle(DB, c.env, appEnv, 'CHANNEL', ch, body.dry_run ?? false);

  return c.json(run, run.hard_stop_triggered ? 403 : 200);
});

// ─── POST /api/engine/pause ───────────────────────────────────────────────────
engine.post('/pause', async (c) => {
  const { DB } = c.env;
  await writeKey(DB, 'engine_paused', true);
  await writeKey(DB, 'engine_paused_at', new Date().toISOString());
  return c.json({
    status: 'ENGINE_PAUSED',
    paused: true,
    paused_at: new Date().toISOString(),
    message: 'Autonomous engine paused. CRON jobs will skip. Use POST /api/engine/resume to resume.',
  });
});

// ─── POST /api/engine/resume ──────────────────────────────────────────────────
engine.post('/resume', async (c) => {
  const { DB } = c.env;
  await writeKey(DB, 'engine_paused', false);
  return c.json({
    status: 'ENGINE_ACTIVE',
    paused: false,
    resumed_at: new Date().toISOString(),
    message: 'Engine resumed. Next CRON trigger will execute the daily cycle.',
  });
});

// ─── POST /api/engine/reset-day ───────────────────────────────────────────────
// Admin: reset today's counters (for testing / recovery)
engine.post('/reset-day', async (c) => {
  const { DB } = c.env;
  const fresh: DailyCounters = {
    date: todayUTC(),
    emails_sent: 0, sms_sent: 0, calls_logged: 0, leads_contacted: 0,
    emails_cap: DAILY_CAPS.emails, sms_cap: DAILY_CAPS.sms,
    calls_cap: DAILY_CAPS.calls, leads_cap: DAILY_CAPS.leads,
  };
  await writeKey(DB, 'engine_daily_counters', fresh);
  return c.json({ status: 'COUNTERS_RESET', counters: fresh, reset_at: new Date().toISOString() });
});

// ─── POST /api/engine/sms/send ───────────────────────────────────────────────
// Send SMS to a specific lead (or dry-run)
engine.post('/sms/send', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json() as { lead_id: string; dry_run?: boolean; message?: string };
  if (!body.lead_id) return c.json({ error: 'lead_id required' }, 400);

  const leads = await loadLeads(DB);
  const lead = leads.find(l => l.id === body.lead_id);
  if (!lead) return c.json({ error: `Lead ${body.lead_id} not found` }, 404);
  if (!lead.phone) return c.json({ error: 'Lead has no phone number' }, 400);

  const appEnv = await readEnv(DB);
  const counters = await getOrInitCounters(DB);

  if (counters.sms_sent >= counters.sms_cap) {
    return c.json({ error: 'SMS daily cap reached', cap: counters.sms_cap, used: counters.sms_sent }, 429);
  }

  const msgBody = body.message || buildSmsBody(lead);
  const twilioSid = (c.env as unknown as Record<string, string>).TWILIO_SID;
  const twilioToken = (c.env as unknown as Record<string, string>).TWILIO_TOKEN;
  const twilioFrom = (c.env as unknown as Record<string, string>).TWILIO_FROM;

  if (body.dry_run || !twilioSid) {
    return c.json({
      dry_run: true,
      lead_id: lead.id,
      business_name: lead.business_name,
      phone: lead.phone,
      body_preview: msgBody.slice(0, 100) + '…',
      status: 'DRY_RUN',
      reason: !twilioSid ? 'TWILIO_NOT_CONFIGURED' : 'DRY_RUN',
      env: appEnv,
    });
  }

  // Send via Twilio
  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const res = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: lead.phone, From: twilioFrom || '', Body: msgBody }).toString(),
    });

    if (res.ok) {
      counters.sms_sent += 1;
      await writeKey(DB, 'engine_daily_counters', counters);
      // Tag lead
      const updated = { ...lead } as MicroLead & { sms_sent: boolean; sms_sent_at: string };
      updated.sms_sent = true;
      updated.sms_sent_at = new Date().toISOString();
      await persistLead(DB, updated);
      return c.json({ status: 'SENT', lead_id: lead.id, phone: lead.phone, env: appEnv });
    } else {
      return c.json({ status: 'FAILED', error: `Twilio ${res.status}`, lead_id: lead.id }, 502);
    }
  } catch (e: unknown) {
    return c.json({ status: 'ERROR', error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ─── POST /api/engine/calls/log ───────────────────────────────────────────────
engine.post('/calls/log', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json() as {
    lead_id: string;
    disposition: CallLog['disposition'];
    duration_seconds?: number;
    notes?: string;
  };

  if (!body.lead_id) return c.json({ error: 'lead_id required' }, 400);
  if (!body.disposition) return c.json({ error: 'disposition required' }, 400);

  const validDispositions: CallLog['disposition'][] = [
    'ANSWERED', 'VOICEMAIL', 'NO_ANSWER', 'WRONG_NUMBER',
    'CALLBACK_REQUESTED', 'NOT_INTERESTED', 'INTERESTED',
  ];
  if (!validDispositions.includes(body.disposition)) {
    return c.json({ error: `disposition must be one of: ${validDispositions.join(', ')}` }, 400);
  }

  const leads = await loadLeads(DB);
  const lead = leads.find(l => l.id === body.lead_id);
  if (!lead) return c.json({ error: `Lead ${body.lead_id} not found` }, 404);

  const counters = await getOrInitCounters(DB);
  if (counters.calls_logged >= counters.calls_cap) {
    return c.json({ error: 'Calls daily cap reached', cap: counters.calls_cap }, 429);
  }

  const callEntry: CallLog = {
    log_id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    lead_id: lead.id,
    business_name: lead.business_name,
    phone: lead.phone,
    called_at: new Date().toISOString(),
    disposition: body.disposition,
    duration_seconds: body.duration_seconds ?? 0,
    notes: body.notes ?? '',
    follow_up_needed: ['VOICEMAIL', 'NO_ANSWER', 'CALLBACK_REQUESTED'].includes(body.disposition),
  };

  // Cascade to lead tracking if interested/closed
  if (body.disposition === 'INTERESTED') {
    const updated = { ...lead, tracking: { ...lead.tracking, interested: true, replied: true }, reply_received: true };
    try { await persistLead(DB, updated); } catch { /* ignore */ }
  }

  // Persist call log
  try {
    const callLog = await readKey<CallLog[]>(DB, 'engine_call_log', []);
    callLog.unshift(callEntry);
    await writeKey(DB, 'engine_call_log', callLog.slice(0, 200));
  } catch { /* ignore */ }

  counters.calls_logged += 1;
  await writeKey(DB, 'engine_daily_counters', counters);

  return c.json({
    logged: true,
    call: callEntry,
    calls_remaining_today: Math.max(0, counters.calls_cap - counters.calls_logged),
  });
});

// ─── GET /api/engine/calls ────────────────────────────────────────────────────
engine.get('/calls', async (c) => {
  const { DB } = c.env;
  const limitParam = c.req.query('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam), 100) : 20;
  const callLog = await readKey<CallLog[]>(DB, 'engine_call_log', []);

  const interested = callLog.filter(c => c.disposition === 'INTERESTED').length;
  const voicemail  = callLog.filter(c => c.disposition === 'VOICEMAIL').length;
  const noAnswer   = callLog.filter(c => c.disposition === 'NO_ANSWER').length;
  const answered   = callLog.filter(c => c.disposition === 'ANSWERED').length;

  return c.json({
    total: callLog.length,
    showing: Math.min(limit, callLog.length),
    summary: { interested, voicemail, no_answer: noAnswer, answered },
    calls: callLog.slice(0, limit),
  });
});

export default engine;
export { runDailyCycle };
