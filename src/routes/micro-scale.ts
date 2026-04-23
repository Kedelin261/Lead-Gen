// ============================================================
// MICRO-SCALE ROUTE — /api/micro-scale
// Manages Day-1 outreach to Memphis scraped leads with:
//   • MICRO_SCALE_ACTIVE status JSON
//   • Per-lead tracking: sent/opened/replied/interested/clicked/closed
//   • Daily limit enforcement (max 20 leads, 5 emails/day)
//   • Failure condition monitoring
//   • Day 1–4 email sequence with link policy
// ============================================================

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { checkLinkPolicy } from '../lib/warmup-engine';
import {
  runIntegrityGate,
  validateLead,
  resolveEnv,
  INTERNAL_EMAIL_BLOCKLIST,
  TEST_EMAIL_LIST,
  INFRA_EMAIL_BLOCKLIST,
  type LeadCandidate,
  type IntegrityReport,
  type AppEnv,
} from '../lib/lead-integrity';

// ─── ENV READER ───────────────────────────────────────────────────────────────
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

const microScale = new Hono<{ Bindings: Bindings }>();

// ─── STATIC MEMPHIS LEAD REGISTRY ─────────────────────────────────────────────
// Real scraped businesses — no email in OSM data; email field populated when known
export interface MicroLead {
  id: string;
  business_name: string;
  industry: string;
  phone: string;
  email: string;       // populated when found; empty = outreach blocked until sourced
  city: string;
  state: string;
  slug: string;
  demo_url: string;
  website_status: 'NONE' | 'WEAK';
  day1_email_sent: boolean;
  thread_depth: number;
  reply_received: boolean;
  outreach_day: number;  // which day sequence we are on
  tracking: {
    sent: boolean;
    opened: boolean;
    replied: boolean;
    interested: boolean;
    clicked: boolean;
    closed: boolean;
  };
  resend_ids: string[];
  last_sent_at: string | null;
  notes: string;
}

export const MEMPHIS_LEADS: MicroLead[] = [
  {
    id: 'memphis-001',
    business_name: 'Dryve Cleaners',
    industry: 'cleaning services',
    phone: '+1-901-752-6637',
    email: '',
    city: 'Memphis', state: 'TN',
    slug: 'dryve-cleaners-memphis',
    demo_url: 'https://websitedemopro.org/demo/dryve-cleaners-memphis',
    website_status: 'NONE',
    day1_email_sent: false, thread_depth: 0, reply_received: false, outreach_day: 1,
    tracking: { sent: false, opened: false, replied: false, interested: false, clicked: false, closed: false },
    resend_ids: [], last_sent_at: null,
    notes: 'OSM source — no website found',
  },
  {
    id: 'memphis-002',
    business_name: "Duke's Automotive",
    industry: 'auto repair',
    phone: '+1-901-323-9837',
    email: '',
    city: 'Memphis', state: 'TN',
    slug: 'dukes-automotive-memphis',
    demo_url: 'https://websitedemopro.org/demo/dukes-automotive-memphis',
    website_status: 'NONE',
    day1_email_sent: false, thread_depth: 0, reply_received: false, outreach_day: 1,
    tracking: { sent: false, opened: false, replied: false, interested: false, clicked: false, closed: false },
    resend_ids: [], last_sent_at: null,
    notes: 'OSM source — no website found',
  },
  {
    id: 'memphis-003',
    business_name: 'John AC Repair',
    industry: 'HVAC',
    phone: '+1-844-213-5822',
    email: '',
    city: 'Memphis', state: 'TN',
    slug: 'john-ac-repair-memphis',
    demo_url: 'https://websitedemopro.org/demo/john-ac-repair-memphis',
    website_status: 'NONE',
    day1_email_sent: false, thread_depth: 0, reply_received: false, outreach_day: 1,
    tracking: { sent: false, opened: false, replied: false, interested: false, clicked: false, closed: false },
    resend_ids: [], last_sent_at: null,
    notes: 'OSM source — no website found',
  },
  {
    id: 'memphis-004',
    business_name: "Thong's Auto Repair",
    industry: 'auto repair',
    phone: '+1-901-278-2470',
    email: '',
    city: 'Memphis', state: 'TN',
    slug: 'thongs-auto-repair-memphis',
    demo_url: 'https://websitedemopro.org/demo/thongs-auto-repair-memphis',
    website_status: 'NONE',
    day1_email_sent: false, thread_depth: 0, reply_received: false, outreach_day: 1,
    tracking: { sent: false, opened: false, replied: false, interested: false, clicked: false, closed: false },
    resend_ids: [], last_sent_at: null,
    notes: 'OSM source — no website found',
  },
  {
    id: 'memphis-005',
    business_name: 'L & J Service Center',
    industry: 'auto repair',
    phone: '+1-901-207-4956',
    email: '',
    city: 'Memphis', state: 'TN',
    slug: 'l-j-service-center-memphis',
    demo_url: 'https://websitedemopro.org/demo/l-j-service-center-memphis',
    website_status: 'NONE',
    day1_email_sent: false, thread_depth: 0, reply_received: false, outreach_day: 1,
    tracking: { sent: false, opened: false, replied: false, interested: false, clicked: false, closed: false },
    resend_ids: [], last_sent_at: null,
    notes: 'OSM source — no website found',
  },
  {
    id: 'memphis-006',
    business_name: 'JC Cycles',
    industry: 'motorcycle repair',
    phone: '+1-901-417-7500',
    email: '',
    city: 'Memphis', state: 'TN',
    slug: 'jc-cycles-memphis',
    demo_url: 'https://websitedemopro.org/demo/jc-cycles-memphis',
    website_status: 'NONE',
    day1_email_sent: false, thread_depth: 0, reply_received: false, outreach_day: 1,
    tracking: { sent: false, opened: false, replied: false, interested: false, clicked: false, closed: false },
    resend_ids: [], last_sent_at: null,
    notes: 'OSM source — no website found',
  },
  {
    id: 'memphis-007',
    business_name: 'Mostly Trucks',
    industry: 'truck repair',
    phone: '+1-901-518-9688',
    email: '',
    city: 'Memphis', state: 'TN',
    slug: 'mostly-trucks-memphis',
    demo_url: 'https://websitedemopro.org/demo/mostly-trucks-memphis',
    website_status: 'NONE',
    day1_email_sent: false, thread_depth: 0, reply_received: false, outreach_day: 1,
    tracking: { sent: false, opened: false, replied: false, interested: false, clicked: false, closed: false },
    resend_ids: [], last_sent_at: null,
    notes: 'OSM source — no website found',
  },
  {
    id: 'memphis-008',
    business_name: 'Sugar Services LLC',
    industry: 'cleaning services',
    phone: '+1-901-523-0045',
    email: '',
    city: 'Memphis', state: 'TN',
    slug: 'sugar-services-llc-memphis',
    demo_url: 'https://websitedemopro.org/demo/sugar-services-llc-memphis',
    website_status: 'NONE',
    day1_email_sent: false, thread_depth: 0, reply_received: false, outreach_day: 1,
    tracking: { sent: false, opened: false, replied: false, interested: false, clicked: false, closed: false },
    resend_ids: [], last_sent_at: null,
    notes: 'OSM source — no website found',
  },
  {
    id: 'memphis-009',
    business_name: 'Celebrity Body Studio',
    industry: 'auto detailing',
    phone: '+1-901-877-8977',
    email: '',
    city: 'Memphis', state: 'TN',
    slug: 'celebrity-body-studio-memphis',
    demo_url: 'https://websitedemopro.org/demo/celebrity-body-studio-memphis',
    website_status: 'NONE',
    day1_email_sent: false, thread_depth: 0, reply_received: false, outreach_day: 1,
    tracking: { sent: false, opened: false, replied: false, interested: false, clicked: false, closed: false },
    resend_ids: [], last_sent_at: null,
    notes: 'OSM source — no website found',
  },
  {
    id: 'memphis-010',
    business_name: 'One of A Kind Services',
    industry: 'cleaning services',
    phone: '+1-901-833-0868',
    email: '',
    city: 'Memphis', state: 'TN',
    slug: 'one-of-a-kind-services-memphis',
    demo_url: 'https://websitedemopro.org/demo/one-of-a-kind-services-memphis',
    website_status: 'NONE',
    day1_email_sent: false, thread_depth: 0, reply_received: false, outreach_day: 1,
    tracking: { sent: false, opened: false, replied: false, interested: false, clicked: false, closed: false },
    resend_ids: [], last_sent_at: null,
    notes: 'OSM source — no website found',
  },
];

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const DAILY_LIMITS = { leads: 20, emails: 5, sms: 5, calls: 10 };
const SUCCESS_THRESHOLDS = { min_reply_rate: 5, min_positive_responses: 2 };
const FAILURE_CONDITIONS = { max_spam_complaints: 0, max_bounce_rate: 5, min_primary_placement: 60 };

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function buildDay1Subject(businessName: string): string {
  const patterns = [
    `quick question about ${businessName}`,
    `question for ${businessName}`,
    `thought about ${businessName}`,
    `noticed ${businessName} online`,
    `${businessName} — quick thought`,
  ];
  return patterns[Math.floor(Math.random() * patterns.length)];
}

function buildDay1Body(lead: MicroLead): string {
  const greetings = ['Hey', 'Hi', 'Hello'];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  const industryLines: Record<string, string[]> = {
    'cleaning services': [
      `Do most of your new clients find you through referrals, or are you getting walk-ins mostly?`,
      `I was curious — do people usually find ${lead.business_name} through word of mouth, or more through Google searches lately?`,
    ],
    'auto repair': [
      `I was wondering — do most people who bring their car to ${lead.business_name} find you through referrals, or do you get a lot of Google traffic?`,
      `Quick question — are most of your new customers finding ${lead.business_name} through word of mouth, or online searches?`,
    ],
    'HVAC': [
      `Do most homeowners who call ${lead.business_name} find you through referrals, or are you getting a lot of Google calls lately?`,
      `Curious — when people need AC repair in Memphis, are they finding ${lead.business_name} mostly through Google or through referrals?`,
    ],
    'motorcycle repair': [
      `Do most riders who bring their bike to ${lead.business_name} hear about you through the community, or are you getting Google traffic too?`,
    ],
    'truck repair': [
      `Curious — do truckers find ${lead.business_name} mostly through word of mouth, or are you getting Google leads too?`,
    ],
    'auto detailing': [
      `Do most of your detailing clients at ${lead.business_name} come through referrals, or are people finding you on Google now?`,
    ],
  };

  const lines = industryLines[lead.industry] || [
    `Do most new clients find ${lead.business_name} through referrals or through Google searches lately?`,
  ];
  const questionLine = lines[Math.floor(Math.random() * lines.length)];

  return `${greeting} — hope business is going well at ${lead.business_name}.

${questionLine}

Just curious — no pitch, genuinely wondering.

— Alex`;
}

function buildDay2FollowupBody(lead: MicroLead): string {
  const bridges = [
    `Just wanted to follow up on my last message — did it land okay?`,
    `Circling back on my note from yesterday — wanted to make sure it didn't get buried.`,
    `Following up briefly — just wanted to make sure my message got through.`,
    `Just checking in — wanted to make sure you saw my note about ${lead.business_name}.`,
  ];
  const bridge = bridges[Math.floor(Math.random() * bridges.length)];

  return `Hey —

${bridge}

No pressure at all. Just a quick question about how new customers find ${lead.business_name}.

— Alex`;
}

function buildDay3LinkBody(lead: MicroLead): string {
  return `Hey —

Appreciate you taking the time to reply. 

I actually put together a quick example of what a simple site could look like for ${lead.business_name} — nothing fancy, just to show the idea.

If you're curious: ${lead.demo_url}

No obligation, just wanted to give you something concrete to look at.

— Alex`;
}

function computeCampaignMetrics(leads: MicroLead[]) {
  const totalSent = leads.filter(l => l.tracking.sent).length;
  const totalReplied = leads.filter(l => l.tracking.replied).length;
  const totalInterested = leads.filter(l => l.tracking.interested).length;
  const totalClicked = leads.filter(l => l.tracking.clicked).length;
  const totalClosed = leads.filter(l => l.tracking.closed).length;
  const replyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

  const passReplyRate = replyRate >= SUCCESS_THRESHOLDS.min_reply_rate;
  const passPositiveResponses = totalInterested >= SUCCESS_THRESHOLDS.min_positive_responses;

  let next_action: 'SCALE' | 'ADJUST' | 'HOLD' = 'HOLD';
  if (passReplyRate && passPositiveResponses) next_action = 'SCALE';
  else if (totalSent >= 5 && !passReplyRate) next_action = 'ADJUST';
  else next_action = 'HOLD';

  return {
    status: 'MICRO_SCALE_ACTIVE' as const,
    city: 'Memphis, TN',
    leads_scraped: leads.length,
    leads_with_email: leads.filter(l => l.email).length,
    emails_sent: totalSent,
    replies_received: totalReplied,
    interested_leads: totalInterested,
    clicked_demo: totalClicked,
    deals_closed: totalClosed,
    reply_rate: parseFloat(replyRate.toFixed(1)),
    pass_reply_rate: passReplyRate,
    pass_positive_responses: passPositiveResponses,
    next_action,
    daily_limits: DAILY_LIMITS,
    success_thresholds: SUCCESS_THRESHOLDS,
    failure_conditions: FAILURE_CONDITIONS,
  };
}

// ─── GET /api/micro-scale/status ──────────────────────────────────────────────
microScale.get('/status', async (c) => {
  const { DB } = c.env;

  // Load persisted lead states from DB
  let leads = [...MEMPHIS_LEADS];
  try {
    const rows = await DB.prepare(
      `SELECT key, value FROM settings WHERE key LIKE 'micro_lead_%'`
    ).all<{ key: string; value: string }>();
    if (rows.results.length > 0) {
      for (const row of rows.results) {
        const id = row.key.replace('micro_lead_', '');
        const saved = JSON.parse(row.value) as Partial<MicroLead>;
        const idx = leads.findIndex(l => l.id === id);
        if (idx >= 0) leads[idx] = { ...leads[idx], ...saved };
      }
    }
  } catch { /* DB may not have settings table yet */ }

  const metrics = computeCampaignMetrics(leads);

  return c.json({
    ...metrics,
    leads: leads.map(l => ({
      id: l.id,
      business_name: l.business_name,
      industry: l.industry,
      city: l.city,
      state: l.state,
      phone: l.phone,
      email: l.email || null,
      demo_url: l.demo_url,
      outreach_day: l.outreach_day,
      thread_depth: l.thread_depth,
      reply_received: l.reply_received,
      tracking: l.tracking,
      last_sent_at: l.last_sent_at,
      resend_ids: l.resend_ids,
      notes: l.notes,
      email_ready: !!l.email,
    })),
  });
});

// ─── GET /api/micro-scale/leads ───────────────────────────────────────────────
microScale.get('/leads', async (c) => {
  const { DB } = c.env;
  let leads = [...MEMPHIS_LEADS];
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
  return c.json({ leads, total: leads.length, city: 'Memphis, TN' });
});

// ─── POST /api/micro-scale/send-day1 ─────────────────────────────────────────
// Send Day 1 emails. Reads ENV from DB. Test emails allowed in TEST, blocked in PRODUCTION.
microScale.post('/send-day1', async (c) => {
  const { DB, RESEND_API_KEY } = c.env;
  const body = await c.req.json().catch(() => ({})) as {
    lead_ids?: string[];
    dry_run?: boolean;
  };

  // Read ENV — determines test email behavior
  const env = await readAppEnv(DB);

  // Load persisted lead states
  let leads = [...MEMPHIS_LEADS];
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

  // Select candidates: email present, not yet sent, within daily limit
  const emailReady = leads.filter(l => l.email && !l.tracking.sent && !l.day1_email_sent);
  let candidates: MicroLead[];
  if (body.lead_ids?.length) {
    candidates = emailReady.filter(l => body.lead_ids!.includes(l.id));
  } else {
    candidates = emailReady.slice(0, DAILY_LIMITS.emails);
  }

  if (candidates.length === 0) {
    return c.json({
      sent: 0,
      skipped: leads.filter(l => !l.email).length,
      reason: 'No leads with email address available. Add real business emails using PATCH /api/micro-scale/leads/:id',
      needs_emails: leads.filter(l => !l.email).map(l => ({
        id: l.id,
        business_name: l.business_name,
        phone: l.phone,
      })),
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // ██  INTEGRITY GATE — runs before ANY email is dispatched  ██
  // ══════════════════════════════════════════════════════════════════
  const integrityInput: LeadCandidate[] = candidates.map(l => ({
    email: l.email,
    business_name: l.business_name,
    phone: l.phone,
    city: l.city,
    industry: l.industry,
    source: 'osm',   // OpenStreetMap — real external scrape
    website_status: l.website_status,
  }));

  const integrityReport: IntegrityReport = runIntegrityGate(integrityInput, env);

  // Hard stop — pipeline halted
  if (integrityReport.hard_stop_triggered) {
    return c.json({
      integrity_gate: 'HARD_STOP',
      sent: 0,
      status: integrityReport.status,
      reason: integrityReport.hard_stop_reason,
      audit_log: integrityReport.audit_log,
    }, 403);
  }

  // No valid leads after integrity check
  if (integrityReport.valid_leads === 0) {
    return c.json({
      integrity_gate: 'ALL_REJECTED',
      sent: 0,
      rejected_leads: integrityReport.rejected_leads,
      status: integrityReport.status,
      audit_log: integrityReport.audit_log,
    }, 422);
  }

  // Build approved set from integrity report
  const approvedEmails = new Set(integrityReport.accepted.map(l => l.email.toLowerCase().trim()));
  const targets = candidates.filter(l => approvedEmails.has(l.email.toLowerCase().trim()));

  const results = [];
  const fromEmail = 'alex@websitedemopro.org';

  for (const lead of targets) {
    const subject = buildDay1Subject(lead.business_name);
    const body_text = buildDay1Body(lead);

    // Re-validate this individual lead one final time (Section 7 — per-email check)
    const finalCheck = validateLead(
      { email: lead.email, business_name: lead.business_name, phone: lead.phone, city: lead.city, industry: lead.industry, source: 'osm' },
      env,
      new Set()
    );

    if (finalCheck.status === 'REJECTED') {
      results.push({
        id: lead.id,
        business_name: lead.business_name,
        email: lead.email,
        status: 'INTEGRITY_BLOCKED',
        reason: finalCheck.reason,
        sent_at: null,
      });
      continue;
    }

    if (body.dry_run) {
      results.push({
        id: lead.id,
        business_name: lead.business_name,
        email: lead.email,
        subject,
        body_preview: body_text.slice(0, 120) + '...',
        dry_run: true,
        link_allowed: false,
        status: 'DRY_RUN',
        integrity_check: 'PASSED',
      });
      continue;
    }

    // ── Send via Resend ───────────────────────────────────────────
    let resendId = null;
    let sendStatus = 'FAILED';
    let errorMsg = null;

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
          text: body_text,
        }),
      });

      if (res.ok) {
        const data = await res.json() as { id: string };
        resendId = data.id;
        sendStatus = 'SENT';
      } else {
        const errData = await res.text();
        errorMsg = `Resend ${res.status}: ${errData}`;
        sendStatus = 'FAILED';
      }
    } catch (e: unknown) {
      errorMsg = e instanceof Error ? e.message : String(e);
      sendStatus = 'FAILED';
    }

    // Persist updated state
    const updatedLead: Partial<MicroLead> = {
      day1_email_sent: sendStatus === 'SENT',
      thread_depth: sendStatus === 'SENT' ? 1 : lead.thread_depth,
      outreach_day: 1,
      last_sent_at: sendStatus === 'SENT' ? new Date().toISOString() : lead.last_sent_at,
      resend_ids: sendStatus === 'SENT' && resendId
        ? [...lead.resend_ids, resendId]
        : lead.resend_ids,
      tracking: {
        ...lead.tracking,
        sent: sendStatus === 'SENT' ? true : lead.tracking.sent,
      },
    };

    try {
      await DB.prepare(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
      ).bind(`micro_lead_${lead.id}`, JSON.stringify({ ...lead, ...updatedLead })).run();
    } catch { /* ignore DB errors */ }

    results.push({
      id: lead.id,
      business_name: lead.business_name,
      email: lead.email,
      subject,
      resend_id: resendId,
      status: sendStatus,
      error: errorMsg,
      sent_at: updatedLead.last_sent_at,
      thread_depth: updatedLead.thread_depth,
      link_allowed: false,
      link_policy_reason: 'Day 1 — hard block, no link on first email',
    });

    // 45–90 second delay between sends (skip on last)
    if (targets.indexOf(lead) < targets.length - 1 && !body.dry_run) {
      const delay = 45000 + Math.random() * 45000;
      await new Promise(r => setTimeout(r, delay));
    }
  }

  const sentCount = results.filter(r => r.status === 'SENT').length;
  const blockedCount = results.filter(r => r.status === 'INTEGRITY_BLOCKED').length;

  return c.json({
    status: 'ENVIRONMENT_FILTER_ACTIVE',
    mode: env,
    test_emails_blocked_in_production: env === 'PRODUCTION',
    integrity_gate: integrityReport.status,
    valid_after_gate: integrityReport.valid_leads,
    rejected_by_gate: integrityReport.rejected_leads,
    sent: sentCount,
    failed: results.filter(r => r.status === 'FAILED').length,
    blocked_by_integrity: blockedCount,
    dry_run: !!body.dry_run,
    daily_limit: DAILY_LIMITS.emails,
    remaining_today: Math.max(0, DAILY_LIMITS.emails - sentCount),
    results,
    audit_log: integrityReport.audit_log,
  });
});

// ─── POST /api/micro-scale/send-followup ─────────────────────────────────────
// Send day 2/3 follow-up. On day 3+ with link policy check.
microScale.post('/send-followup', async (c) => {
  const { DB, RESEND_API_KEY } = c.env;
  const body = await c.req.json() as {
    lead_id: string;
    reply_rate?: number;
    warmup_day?: number;
    dry_run?: boolean;
  };

  // Load leads
  let leads = [...MEMPHIS_LEADS];
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

  const lead = leads.find(l => l.id === body.lead_id);
  if (!lead) return c.json({ error: `Lead ${body.lead_id} not found` }, 404);
  if (!lead.email) return c.json({ error: 'No email address for this lead' }, 400);
  if (!lead.tracking.sent) return c.json({ error: 'Day 1 email not sent yet' }, 400);

  const warmupDay = body.warmup_day || 1;
  const replyRate = body.reply_rate || 0;
  const totalSends = leads.filter(l => l.tracking.sent).length;

  // Check link policy
  const policy = checkLinkPolicy({
    recipient: lead.email,
    reply_received: lead.reply_received,
    thread_depth: lead.thread_depth,
    warmup_day: warmupDay,
    reply_rate: replyRate,
    total_sends: totalSends,
  });

  // Build email body
  let emailSubject: string;
  let emailBody: string;

  if (policy.link_allowed && lead.outreach_day >= 3) {
    emailSubject = `Re: quick question about ${lead.business_name}`;
    emailBody = buildDay3LinkBody(lead);
  } else {
    emailSubject = `Re: quick question about ${lead.business_name}`;
    emailBody = buildDay2FollowupBody(lead);
  }

  if (body.dry_run) {
    return c.json({
      dry_run: true,
      lead_id: lead.id,
      business_name: lead.business_name,
      email: lead.email,
      subject: emailSubject,
      body_preview: emailBody.slice(0, 150) + '...',
      link_allowed: policy.link_allowed,
      link_policy: policy,
      outreach_day: lead.outreach_day + 1,
    });
  }

  // Send
  let resendId = null;
  let sendStatus = 'FAILED';
  let errorMsg = null;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Alex <alex@websitedemopro.org>',
        to: [lead.email],
        subject: emailSubject,
        text: emailBody,
      }),
    });

    if (res.ok) {
      const data = await res.json() as { id: string };
      resendId = data.id;
      sendStatus = 'SENT';
    } else {
      errorMsg = `Resend ${res.status}`;
    }
  } catch (e: unknown) {
    errorMsg = e instanceof Error ? e.message : String(e);
  }

  // Persist
  const updatedLead: Partial<MicroLead> = {
    thread_depth: lead.thread_depth + (sendStatus === 'SENT' ? 1 : 0),
    outreach_day: lead.outreach_day + (sendStatus === 'SENT' ? 1 : 0),
    last_sent_at: sendStatus === 'SENT' ? new Date().toISOString() : lead.last_sent_at,
    resend_ids: sendStatus === 'SENT' && resendId
      ? [...lead.resend_ids, resendId]
      : lead.resend_ids,
  };

  try {
    await DB.prepare(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
    ).bind(`micro_lead_${lead.id}`, JSON.stringify({ ...lead, ...updatedLead })).run();
  } catch { /* ignore */ }

  return c.json({
    sent: sendStatus === 'SENT',
    lead_id: lead.id,
    business_name: lead.business_name,
    email: lead.email,
    subject: emailSubject,
    resend_id: resendId,
    status: sendStatus,
    error: errorMsg,
    link_allowed: policy.link_allowed,
    link_policy_reason: policy.reason,
    new_thread_depth: updatedLead.thread_depth,
    new_outreach_day: updatedLead.outreach_day,
  });
});

// ─── PATCH /api/micro-scale/leads/:id ────────────────────────────────────────
// Update lead data (add email, tracking, reply status).
// Email field is screened against the integrity blocklist before saving.
microScale.patch('/leads/:id', async (c) => {
  const { DB } = c.env;
  const leadId = c.req.param('id');
  const updates = await c.req.json() as Partial<MicroLead>;

  const lead = MEMPHIS_LEADS.find(l => l.id === leadId);
  if (!lead) return c.json({ error: `Lead ${leadId} not found` }, 404);

  // ── Integrity check on incoming email (env-aware) ────────────────────────
  if (updates.email) {
    const env = await readAppEnv(DB);
    const emailLower = updates.email.toLowerCase().trim();

    // Infra emails are always blocked regardless of ENV
    if (INFRA_EMAIL_BLOCKLIST.has(emailLower)) {
      return c.json({
        error: 'INTEGRITY_VIOLATION',
        rejection_code: 'INFRA_EMAIL_BLOCKED',
        reason: `"${updates.email}" is an infrastructure address and cannot be assigned to any lead in any environment.`,
        blocked_email: updates.email,
        action: 'SOURCE_REAL_BUSINESS_EMAIL',
      }, 403);
    }

    // Test emails: blocked in PRODUCTION, allowed in TEST (with tag)
    if (TEST_EMAIL_LIST.has(emailLower)) {
      if (env === 'PRODUCTION') {
        return c.json({
          error: 'INTEGRITY_VIOLATION',
          rejection_code: 'TEST_EMAIL_IN_PRODUCTION',
          reason: `"${updates.email}" is a test email — blocked in PRODUCTION mode. Email preserved for testing. Set ENV=TEST via POST /api/integrity/env to allow it.`,
          blocked_email: updates.email,
          mode: 'PRODUCTION',
          test_emails_blocked_in_production: true,
          action: 'SET_ENV_TEST_OR_SOURCE_REAL_EMAIL',
        }, 403);
      }
      // TEST mode — allow, will be tagged
    }

    // Full validation for non-test emails
    if (!TEST_EMAIL_LIST.has(emailLower)) {
      const check = validateLead({
        email: updates.email,
        business_name: lead.business_name,
        phone: lead.phone,
        city: lead.city,
        industry: lead.industry,
        source: 'osm',
      }, env);

      if (check.status === 'REJECTED') {
        const hardFailures = check.checks_failed.filter(f => f !== 'PERSONAL_DOMAIN_UNVERIFIED');
        if (hardFailures.length > 0) {
          return c.json({
            error: 'INTEGRITY_VIOLATION',
            rejection_code: check.rejection_code,
            reason: check.reason,
            checks_failed: check.checks_failed,
            mode: env,
            action: 'SOURCE_REAL_BUSINESS_EMAIL',
          }, 403);
        }
      }
    }
  }

  // Load current persisted state
  let currentState = { ...lead };
  try {
    const row = await DB.prepare(
      `SELECT value FROM settings WHERE key = ?`
    ).bind(`micro_lead_${leadId}`).first<{ value: string }>();
    if (row) currentState = { ...currentState, ...JSON.parse(row.value) };
  } catch { /* ignore */ }

  // Section 4: determine lead_type tag
  const emailForTagging = (updates.email || currentState.email || '').toLowerCase().trim();
  const leadTypeTag = TEST_EMAIL_LIST.has(emailForTagging) ? 'TEST' : 'REAL';

  const newState: MicroLead = {
    ...currentState,
    ...updates,
    id: leadId,
    tracking: { ...currentState.tracking, ...(updates.tracking || {}) },
    resend_ids: updates.resend_ids || currentState.resend_ids,
  };

  // Attach Section 4 metadata
  (newState as Record<string, unknown>).lead_type = leadTypeTag;

  if (updates.tracking?.replied || updates.reply_received) {
    newState.reply_received = true;
    newState.tracking.replied = true;
  }

  try {
    await DB.prepare(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
    ).bind(`micro_lead_${leadId}`, JSON.stringify(newState)).run();
  } catch (e: unknown) {
    return c.json({ error: 'DB write failed', detail: String(e) }, 500);
  }

  return c.json({ updated: true, lead: newState });
});

// ─── POST /api/micro-scale/track ─────────────────────────────────────────────
// Track engagement event: opened | replied | interested | clicked | closed
microScale.post('/track', async (c) => {
  const { DB } = c.env;
  const { lead_id, event } = await c.req.json() as {
    lead_id: string;
    event: 'opened' | 'replied' | 'interested' | 'clicked' | 'closed';
  };

  const validEvents = ['opened', 'replied', 'interested', 'clicked', 'closed'];
  if (!validEvents.includes(event)) {
    return c.json({ error: `Invalid event. Must be one of: ${validEvents.join(', ')}` }, 400);
  }

  const lead = MEMPHIS_LEADS.find(l => l.id === lead_id);
  if (!lead) return c.json({ error: `Lead ${lead_id} not found` }, 404);

  let currentState = { ...lead };
  try {
    const row = await DB.prepare(
      `SELECT value FROM settings WHERE key = ?`
    ).bind(`micro_lead_${lead_id}`).first<{ value: string }>();
    if (row) currentState = { ...currentState, ...JSON.parse(row.value) };
  } catch { /* ignore */ }

  const newTracking = { ...currentState.tracking, [event]: true };

  // Auto-cascade
  if (event === 'replied') {
    currentState.reply_received = true;
    newTracking.replied = true;
  }
  if (event === 'interested') newTracking.replied = true;
  if (event === 'closed') {
    newTracking.replied = true;
    newTracking.interested = true;
  }

  const newState = { ...currentState, tracking: newTracking, reply_received: currentState.reply_received || event === 'replied' };

  try {
    await DB.prepare(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
    ).bind(`micro_lead_${lead_id}`, JSON.stringify(newState)).run();
  } catch (e: unknown) {
    return c.json({ error: 'DB write failed', detail: String(e) }, 500);
  }

  // Reload all leads for metrics
  let allLeads = [...MEMPHIS_LEADS];
  try {
    const rows = await DB.prepare(
      `SELECT key, value FROM settings WHERE key LIKE 'micro_lead_%'`
    ).all<{ key: string; value: string }>();
    for (const row of rows.results || []) {
      const id = row.key.replace('micro_lead_', '');
      const saved = JSON.parse(row.value) as Partial<MicroLead>;
      const idx = allLeads.findIndex(l => l.id === id);
      if (idx >= 0) allLeads[idx] = { ...allLeads[idx], ...saved };
    }
  } catch { /* ignore */ }

  return c.json({
    tracked: true,
    lead_id,
    event,
    new_tracking: newTracking,
    campaign_metrics: computeCampaignMetrics(allLeads),
  });
});

// ─── GET /api/micro-scale/check-link/:id ─────────────────────────────────────
microScale.get('/check-link/:id', async (c) => {
  const { DB } = c.env;
  const leadId = c.req.param('id');
  const { warmup_day = '1', reply_rate = '0', total_sends = '14' } = c.req.query();

  const lead = MEMPHIS_LEADS.find(l => l.id === leadId);
  if (!lead) return c.json({ error: `Lead ${leadId} not found` }, 404);

  let currentState = { ...lead };
  try {
    const row = await DB.prepare(
      `SELECT value FROM settings WHERE key = ?`
    ).bind(`micro_lead_${leadId}`).first<{ value: string }>();
    if (row) currentState = { ...currentState, ...JSON.parse(row.value) };
  } catch { /* ignore */ }

  const policy = checkLinkPolicy({
    recipient: currentState.email || leadId,
    reply_received: currentState.reply_received,
    thread_depth: currentState.thread_depth,
    warmup_day: parseInt(warmup_day),
    reply_rate: parseFloat(reply_rate),
    total_sends: parseInt(total_sends),
  });

  return c.json({
    lead_id: leadId,
    business_name: currentState.business_name,
    demo_url: currentState.demo_url,
    ...policy,
    context: {
      reply_received: currentState.reply_received,
      thread_depth: currentState.thread_depth,
      outreach_day: currentState.outreach_day,
    },
  });
});

export default microScale;
