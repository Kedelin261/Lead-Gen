// ============================================================
// WARMUP ROUTE — /api/warmup
// Drives inbox placement optimization via controlled sends,
// engagement tracking, scaling gates, and status reporting.
// ============================================================

import { Hono } from 'hono';
import type { Bindings } from '../types';
import {
  WARMUP_SCHEDULE,
  FAIL_THRESHOLDS,
  validateEmailContent,
  calculateMetrics,
  checkScalingGate,
  randomDelay,
  getFollowupBridge,
  type PlacementRecord,
  type SendRecord,
} from '../lib/warmup-engine';
import { PROSPECT_DEMOS } from '../lib/prospect-demos';

const warmup = new Hono<{ Bindings: Bindings }>();

// ─── STATIC SEND HISTORY (session-persistent, in-memory registry) ───────────
// All confirmed sends from this session — used for metric calculations
const SESSION_SENDS: SendRecord[] = [
  // Round 1 — initial with link+pricing
  { recipient: 'kedelin261@gmail.com',    resend_id: '9619046d-db33-45ad-95a0-8b65207eb0a2', sent_at: '2026-04-23T18:48:27Z', round: 1, has_link: true,  has_pricing: true,  subject: 'Quick idea for Riverside Roofing' },
  { recipient: 'jkbarclay261@gmail.com',  resend_id: '593ffde3-115b-42b0-b2be-177edc0b9d43', sent_at: '2026-04-23T18:50:03Z', round: 1, has_link: true,  has_pricing: true,  subject: 'Something I put together for Barclay Home Inspections' },
  { recipient: 'mkbrown261@gmail.com',    resend_id: 'fd52bcec-2525-4e8c-a400-79e7211a9828', sent_at: '2026-04-23T18:50:51Z', round: 1, has_link: true,  has_pricing: true,  subject: 'Quick website idea for Brown Family Dental' },
  { recipient: 'edelinken@gmail.com',     resend_id: 'f9c61124-bcda-40a7-bdec-0c6016ba11d8', sent_at: '2026-04-23T18:51:47Z', round: 1, has_link: true,  has_pricing: true,  subject: 'Edelin Landscaping — here is what I built for you' },
  { recipient: 'kceesq@gmail.com',        resend_id: '75559243-f5c5-4a49-a344-d1aedd2f7d2e', sent_at: '2026-04-23T18:52:50Z', round: 1, has_link: true,  has_pricing: true,  subject: 'Built a site concept for KC Premier Law Group' },
  // Round 2 — warmup, no-link
  { recipient: 'kedelin261@gmail.com',    resend_id: 'e38f8ecc-e458-4b90-956a-0d28030ebcb4', sent_at: '2026-04-23T18:58:47Z', round: 2, has_link: false, has_pricing: false, subject: 'quick question about Sunrise Plumbing' },
  { recipient: 'jkbarclay261@gmail.com',  resend_id: '8924a118-4a27-4f2d-b0ca-f9331b9c65e0', sent_at: '2026-04-23T18:59:52Z', round: 2, has_link: false, has_pricing: false, subject: 'Barclay Inspection Services — quick question' },
  { recipient: 'mkbrown261@gmail.com',    resend_id: '231f4ff5-6807-4c23-99c9-fc2328dccca4', sent_at: '2026-04-23T19:01:11Z', round: 2, has_link: false, has_pricing: false, subject: 'question for Brown Family Dental' },
  { recipient: 'edelinken@gmail.com',     resend_id: '3dcf6ebd-e016-48da-b501-113c2528edd7', sent_at: '2026-04-23T19:02:09Z', round: 2, has_link: false, has_pricing: false, subject: 'quick question — Edelin Property Group' },
  { recipient: 'kceesq@gmail.com',        resend_id: 'a76a6322-d035-414e-93b8-1bca51d130b1', sent_at: '2026-04-23T19:03:41Z', round: 2, has_link: false, has_pricing: false, subject: 'question about KC Legal Associates' },
  // Round 3 — follow-up generic link
  { recipient: 'kedelin261@gmail.com',    resend_id: 'd6bd448c-1362-42ef-8ee0-852f7db9b551', sent_at: '2026-04-23T19:09:26Z', round: 3, has_link: true,  has_pricing: false, subject: 'Re: quick question about Sunrise Plumbing' },
  { recipient: 'jkbarclay261@gmail.com',  resend_id: '1932de8a-87d5-4e1a-9e90-907d291e640c', sent_at: '2026-04-23T19:12:44Z', round: 3, has_link: true,  has_pricing: false, subject: 'Re: Barclay Inspection Services — quick question' },
  // Round 4 — personalized demo links
  { recipient: 'kedelin261@gmail.com',    resend_id: '120dc65a-8241-4af2-80ee-14aa05248679', sent_at: '2026-04-23T19:20:01Z', round: 4, has_link: true,  has_pricing: false, subject: 'Re: quick question about Sunrise Plumbing',    demo_slug: 'sunrise-plumbing' },
  { recipient: 'mkbrown261@gmail.com',    resend_id: 'e4cb0eef-7c49-464d-8b5d-1fe86cb79ab4', sent_at: '2026-04-23T19:23:54Z', round: 4, has_link: true,  has_pricing: false, subject: 'Re: question for Brown Family Dental',          demo_slug: 'brown-family-dental' },
];

// ─── GET /api/warmup/status ────────────────────────────────
warmup.get('/status', async (c) => {
  const { APP_URL } = c.env;

  // Current engagement (awaiting user placement data)
  // replies/spam/bounces entered via POST /api/warmup/engagement
  const db = c.env.DB;
  let engagementRow: { replies: number; spam: number; bounces: number } | null = null;
  try {
    engagementRow = await db.prepare(
      `SELECT value FROM settings WHERE key = 'warmup_engagement'`
    ).first<{ value: string }>().then(r => r ? JSON.parse(r.value) : null);
  } catch { /* table may not have key yet */ }

  const replies  = engagementRow?.replies  ?? 0;
  const spam     = engagementRow?.spam     ?? 0;
  const bounces  = engagementRow?.bounces  ?? 0;

  const placements: PlacementRecord[] = [];
  let placementRow: { value: string } | null = null;
  try {
    placementRow = await db.prepare(
      `SELECT value FROM settings WHERE key = 'warmup_placements'`
    ).first<{ value: string }>();
  } catch { /* ignore */ }
  if (placementRow) {
    try {
      const parsed = JSON.parse(placementRow.value);
      placements.push(...parsed);
    } catch { /* ignore */ }
  }

  const metrics = calculateMetrics(SESSION_SENDS, replies, spam, bounces, placements);
  const gate    = checkScalingGate(metrics);

  // Day estimation (sends started today)
  const warmupDay = 1; // Day 1 — escalate as days progress
  const schedule  = WARMUP_SCHEDULE[Math.min(warmupDay - 1, WARMUP_SCHEDULE.length - 1)];

  // Per-recipient status
  const recipientMap: Record<string, { sends: number; rounds: number[]; last_sent: string; has_personalized_link: boolean; placement: string }> = {};
  for (const s of SESSION_SENDS) {
    if (!recipientMap[s.recipient]) {
      recipientMap[s.recipient] = { sends: 0, rounds: [], last_sent: '', has_personalized_link: false, placement: 'UNKNOWN' };
    }
    recipientMap[s.recipient].sends++;
    recipientMap[s.recipient].rounds.push(s.round);
    recipientMap[s.recipient].last_sent = s.sent_at;
    if (s.demo_slug) recipientMap[s.recipient].has_personalized_link = true;
  }
  // Attach placement data to recipients
  for (const p of placements) {
    if (recipientMap[p.recipient]) {
      recipientMap[p.recipient].placement = p.placement;
    }
  }

  // Pending personalized follow-ups
  // Follow-up policy: allow when initial delivered AND placement = PRIMARY or PROMOTIONS
  const allSlugs = Object.keys(PROSPECT_DEMOS);
  const sentSlugs = SESSION_SENDS.filter(s => s.demo_slug).map(s => s.demo_slug!);
  const pendingFollowups = allSlugs
    .filter(slug => !sentSlugs.includes(slug))
    .map(slug => {
      const p = PROSPECT_DEMOS[slug];
      const recipientStatus = recipientMap[p.email];
      const placement = recipientStatus?.placement ?? 'UNKNOWN';
      const followupAllowed = gate.can_send ||
        placement === 'PRIMARY' ||
        placement === 'PROMOTIONS';
      return {
        slug,
        business_name: p.business_name,
        email: p.email,
        demo_url: `${APP_URL || 'https://websitedemopro.org'}/demo/${slug}`,
        placement,
        followup_allowed: followupAllowed,
        followup_blocked_reason: followupAllowed ? null : 'Placement unknown or SPAM — confirm delivery before following up',
      };
    });

  const placementSummary = buildPlacementSummary(placements);
  const primaryRate = placementSummary.total > 0
    ? (placementSummary.primary / placementSummary.total * 100).toFixed(0) + '%'
    : 'no_data';

  return c.json({
    status: gate.status,          // THROTTLE | PROCEED | HOLD | STOP_ALL
    warmup_day: warmupDay,
    schedule: {
      max_sends_today: gate.send_limit > 0 ? gate.send_limit : schedule.max_sends_per_day,
      links_allowed: gate.link_policy === 'ONE_LINK_ALLOWED',
      link_policy: gate.link_policy,
      min_delay_s: schedule.min_delay_seconds,
      max_delay_s: schedule.max_delay_seconds,
    },
    metrics: {
      total_sent: metrics.total_sent,
      replies_received: metrics.replies_received,
      spam_hits: metrics.spam_hits,
      bounces: metrics.bounces,
      reply_rate: `${(metrics.reply_rate * 100).toFixed(1)}%`,
      spam_rate: `${(metrics.spam_rate * 100).toFixed(1)}%`,
      bounce_rate: `${(metrics.bounce_rate * 100).toFixed(1)}%`,
      primary_placement_rate: primaryRate,
    },
    gate: {
      can_send: gate.can_send,
      can_scale: gate.can_scale,
      action: gate.action,
      status: gate.status,
      reason: gate.reason,
      send_limit: gate.send_limit,
      link_policy: gate.link_policy,
      next_action: gate.next_action,
    },
    placement_summary: placementSummary,
    recipients: recipientMap,
    pending_personalized_followups: pendingFollowups,
    thresholds: {
      throttle_threshold_sends: 25,
      min_reply_rate_to_proceed: '20%',
      min_reply_rate_to_scale: '40%',
      primary_placement_override: '60%',
      max_spam_rate: '10%',
      max_bounce_rate: '5%',
    },
  });
});

// ─── POST /api/warmup/engagement ──────────────────────────
// User posts: { replies, spam, bounces }
warmup.post('/engagement', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json();
  const { replies = 0, spam = 0, bounces = 0 } = body;

  const value = JSON.stringify({ replies, spam, bounces, updated_at: new Date().toISOString() });
  await DB.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('warmup_engagement', ?)`
  ).bind(value).run();

  const metrics = calculateMetrics(SESSION_SENDS, replies, spam, bounces, []);
  const gate    = checkScalingGate(metrics);

  return c.json({
    recorded: true,
    metrics: {
      total_sent: metrics.total_sent,
      reply_rate: `${(metrics.reply_rate * 100).toFixed(1)}%`,
      spam_rate: `${(metrics.spam_rate * 100).toFixed(1)}%`,
      bounce_rate: `${(metrics.bounce_rate * 100).toFixed(1)}%`,
    },
    gate: {
      status: gate.status,
      action: gate.action,
      can_send: gate.can_send,
      can_scale: gate.can_scale,
      send_limit: gate.send_limit,
      link_policy: gate.link_policy,
      reason: gate.reason,
      next_action: gate.next_action,
    },
    scaling_allowed: gate.can_scale,
  });
});

// ─── POST /api/warmup/placements ──────────────────────────
// User posts inbox placement results
warmup.post('/placements', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json();
  const { placements } = body;

  if (!Array.isArray(placements)) {
    return c.json({ error: 'placements must be array' }, 400);
  }

  const value = JSON.stringify(placements);
  await DB.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('warmup_placements', ?)`
  ).bind(value).run();

  const summary = buildPlacementSummary(placements);
  const primaryRate = summary.total > 0 ? (summary.primary / summary.total) * 100 : 0;
  const spamRate    = summary.total > 0 ? (summary.spam    / summary.total) * 100 : 0;

  const passed = primaryRate >= 70 && spamRate <= 10;

  return c.json({
    recorded: true,
    summary,
    primary_rate: `${primaryRate.toFixed(1)}%`,
    spam_rate: `${spamRate.toFixed(1)}%`,
    threshold_met: passed,
    result: passed ? 'DELIVERABILITY_PASS' : 'DELIVERABILITY_FAIL',
    next_step: passed
      ? 'Inbox rate ≥70% — ready to scale outreach volume'
      : 'Inbox rate <70% — continue warmup, do not scale',
  });
});

// ─── POST /api/warmup/validate-content ────────────────────
warmup.post('/validate-content', async (c) => {
  const { subject, html, warmup_day = 1 } = await c.req.json();
  const scheduleIdx = Math.min(Number(warmup_day) - 1, WARMUP_SCHEDULE.length - 1);
  const config = WARMUP_SCHEDULE[scheduleIdx];

  const result = validateEmailContent(subject, html, config);
  return c.json({
    valid: result.valid,
    issues: result.issues,
    link_count: result.link_count,
    forbidden_words_found: result.has_forbidden_words,
    warmup_day,
    config: {
      max_links: config.content_rules.max_links,
      links_allowed: config.links_allowed,
      forbidden_words: config.content_rules.forbidden_words,
    },
  });
});

// ─── GET /api/warmup/schedule ─────────────────────────────
warmup.get('/schedule', (c) => {
  return c.json({
    schedule: WARMUP_SCHEDULE.map(s => ({
      day: s.day,
      max_sends: s.max_sends_per_day,
      links_allowed: s.links_allowed,
      delay_range: `${s.min_delay_seconds}–${s.max_delay_seconds}s`,
      max_links: s.content_rules.max_links,
    })),
    fail_thresholds: FAIL_THRESHOLDS,
    current_day: 1,
    next_milestone: 'Day 3 — links permitted (1 max), volume increases to 8/day',
  });
});

// ─── HELPER ───────────────────────────────────────────────
function buildPlacementSummary(placements: PlacementRecord[]): {
  total: number; primary: number; promotions: number; spam: number; not_received: number; unknown: number;
} {
  const summary = { total: placements.length, primary: 0, promotions: 0, spam: 0, not_received: 0, unknown: 0 };
  for (const p of placements) {
    if (p.placement === 'PRIMARY')      summary.primary++;
    else if (p.placement === 'PROMOTIONS') summary.promotions++;
    else if (p.placement === 'SPAM')    summary.spam++;
    else if (p.placement === 'NOT_RECEIVED') summary.not_received++;
    else summary.unknown++;
  }
  return summary;
}

export default warmup;
