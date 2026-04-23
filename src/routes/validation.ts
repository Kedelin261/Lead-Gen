/**
 * ═══════════════════════════════════════════════════════════════
 * VALIDATION MODE — API ROUTES
 * ═══════════════════════════════════════════════════════════════
 * All validation tests, state management, decision engine,
 * performance tracking, and 7-day plan execution.
 * ═══════════════════════════════════════════════════════════════
 */

import { Hono } from 'hono';
import type { Bindings } from '../types';
import {
  getValidationState,
  saveValidationState,
  addFlag,
  removeFlag,
  runOutreachGateChecks,
  checkLeadCreationLimit,
  checkCityNicheLock,
  evaluateScalingReadiness,
  checkAutoPauseTriggers,
  logValidationEvent,
  VALIDATION_LIMITS,
  type ValidationFlag,
} from '../lib/validation-engine';

const validation = new Hono<{ Bindings: Bindings }>();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/validation/state — current system state
// ─────────────────────────────────────────────────────────────────────────────
validation.get('/state', async (c) => {
  const { DB } = c.env;
  const state = await getValidationState(DB);

  // Also pull live daily counts
  const todayCounts = await DB.prepare(`
    SELECT
      SUM(CASE WHEN channel='email' THEN 1 ELSE 0 END) as emails,
      SUM(CASE WHEN channel='sms' THEN 1 ELSE 0 END) as sms,
      SUM(CASE WHEN channel='call' THEN 1 ELSE 0 END) as calls
    FROM outreach WHERE DATE(created_at) = DATE('now')
  `).first<{ emails: number; sms: number; calls: number }>();

  const todayLeads = await DB.prepare(
    `SELECT COUNT(*) as count FROM leads WHERE DATE(created_at) = DATE('now')`
  ).first<{ count: number }>();

  return c.json({
    system_mode: state.system_mode,
    scaling_allowed: state.scaling_allowed,
    validation_day: state.validation_day,
    active_flags: state.active_flags,
    tests_passed: state.tests_passed,
    locked_city: state.locked_city,
    locked_niche: state.locked_niche,
    limits: VALIDATION_LIMITS,
    live_counts: {
      leads_today: todayLeads?.count || 0,
      emails_today: todayCounts?.emails || 0,
      sms_today: todayCounts?.sms || 0,
      calls_today: todayCounts?.calls || 0,
    },
    capacity_remaining: {
      leads: Math.max(0, VALIDATION_LIMITS.MAX_LEADS_PER_DAY - (todayLeads?.count || 0)),
      emails: Math.max(0, VALIDATION_LIMITS.MAX_EMAILS_PER_DAY - (todayCounts?.emails || 0)),
      sms: Math.max(0, VALIDATION_LIMITS.MAX_SMS_PER_DAY - (todayCounts?.sms || 0)),
      calls: Math.max(0, VALIDATION_LIMITS.MAX_CALLS_PER_DAY - (todayCounts?.calls || 0)),
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/validation/gate-check — check if outreach is allowed
// ─────────────────────────────────────────────────────────────────────────────
validation.post('/gate-check', async (c) => {
  const { DB } = c.env;
  const { channel, city, niche } = await c.req.json() as {
    channel: 'email' | 'sms' | 'call';
    city?: string;
    niche?: string;
  };

  if (!channel) return c.json({ error: 'channel required (email|sms|call)' }, 400);

  const gateResult = await runOutreachGateChecks(DB, channel, {
    RESEND_API_KEY: c.env.RESEND_API_KEY,
    TWILIO_ACCOUNT_SID: c.env.TWILIO_ACCOUNT_SID,
    OPENAI_API_KEY: c.env.OPENAI_API_KEY,
  });

  // Also check city/niche lock if provided
  if (city && niche && gateResult.allowed) {
    const lockResult = await checkCityNicheLock(DB, city, niche);
    if (!lockResult.allowed) {
      gateResult.allowed = false;
      gateResult.errors.push(...lockResult.errors);
      gateResult.blocked_by = lockResult.blocked_by;
    }
    gateResult.warnings.push(...lockResult.warnings);
  }

  const status = gateResult.allowed ? 200 : 403;
  return c.json(gateResult, status);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/validation/scaling-decision — run decision engine
// ─────────────────────────────────────────────────────────────────────────────
validation.get('/scaling-decision', async (c) => {
  const { DB } = c.env;
  const decision = await evaluateScalingReadiness(DB);
  return c.json(decision);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/validation/auto-pause-check — run auto-pause triggers
// ─────────────────────────────────────────────────────────────────────────────
validation.post('/auto-pause-check', async (c) => {
  const { DB } = c.env;
  const result = await checkAutoPauseTriggers(DB);
  return c.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/validation/resume — manually resume from PAUSED state
// ─────────────────────────────────────────────────────────────────────────────
validation.post('/resume', async (c) => {
  const { DB } = c.env;
  const state = await getValidationState(DB);

  if (state.system_mode !== 'PAUSED') {
    return c.json({ error: `System is not paused (current mode: ${state.system_mode})` }, 400);
  }

  await saveValidationState(DB, { system_mode: 'VALIDATION' });
  await logValidationEvent(DB, 'MANUAL_RESUME', { previous_flags: state.active_flags });

  return c.json({
    message: 'System resumed — validation mode active',
    system_mode: 'VALIDATION',
    note: 'Active flags remain. Resolve root causes before continuing outreach.',
    active_flags: state.active_flags,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/validation/resolve-flag — manually resolve a flag
// ─────────────────────────────────────────────────────────────────────────────
validation.post('/resolve-flag', async (c) => {
  const { DB } = c.env;
  const { flag, resolution_notes } = await c.req.json() as {
    flag: ValidationFlag;
    resolution_notes?: string;
  };

  if (!flag) return c.json({ error: 'flag required' }, 400);

  await removeFlag(DB, flag);
  await logValidationEvent(DB, 'FLAG_RESOLVED', { flag, resolution_notes });

  return c.json({
    message: `Flag "${flag}" resolved`,
    resolution_notes,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/validation/advance-day — move to next validation day
// ─────────────────────────────────────────────────────────────────────────────
validation.post('/advance-day', async (c) => {
  const { DB } = c.env;
  const state = await getValidationState(DB);
  const newDay = Math.min(7, (state.validation_day || 1) + 1);

  await saveValidationState(DB, { validation_day: newDay });
  await logValidationEvent(DB, 'DAY_ADVANCED', { from: state.validation_day, to: newDay });

  return c.json({
    message: `Advanced to validation Day ${newDay}`,
    validation_day: newDay,
    day_plan: getValidationDayPlan(newDay),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/validation/day-plan — get 7-day plan details
// ─────────────────────────────────────────────────────────────────────────────
validation.get('/day-plan', async (c) => {
  const { DB } = c.env;
  const state = await getValidationState(DB);

  const plan = Array.from({ length: 7 }, (_, i) => ({
    day: i + 1,
    current: (i + 1) === state.validation_day,
    ...getValidationDayPlan(i + 1),
  }));

  return c.json({ validation_day: state.validation_day, plan });
});

function getValidationDayPlan(day: number) {
  const plans: Record<number, object> = {
    1: {
      title: 'Day 1 — Email Deliverability Test',
      tasks: [
        'Send 10 test emails to Gmail, Outlook, Yahoo accounts',
        'Check inbox placement (Primary vs Spam/Promotions)',
        'Verify unsubscribe links work correctly',
        'Test email rendering on mobile and desktop',
        'Record results in Test A tracker',
      ],
      pass_condition: '≥70% land in Primary inbox',
      if_fail: 'Pause email outreach, investigate domain reputation, warm up domain',
      test: 'TEST_A',
    },
    2: {
      title: 'Day 2 — SMS Delivery + Domain Fix',
      tasks: [
        'Send 10 SMS to real devices across different carriers',
        'Verify 100% delivery with no filtering',
        'Test reply capability and STOP opt-out flow',
        'Fix any email deliverability issues from Day 1',
        'Verify Resend domain authentication (SPF, DKIM, DMARC)',
      ],
      pass_condition: '100% SMS delivered, replies received',
      if_fail: 'Pause SMS system, check Twilio account status, verify phone number',
      test: 'TEST_B',
    },
    3: {
      title: 'Day 3 — 20-Lead Live Campaign Launch',
      tasks: [
        'Select 1 niche + 1 city for validation campaign',
        'Import 20 high-score leads (score ≥50)',
        'Generate demo sites for all 20 leads',
        'Score demo quality (Test C): ≥4/5 must look professional',
        'Launch Day-1 outreach sequence for all leads',
      ],
      pass_condition: '20 leads contacted, demos live, outreach logged',
      if_fail: 'Fix demo quality issues, delay campaign launch by 1 day',
      test: 'TEST_C + TEST_D_START',
    },
    4: {
      title: 'Day 4 — Monitor & Measure',
      tasks: [
        'Check email open rates (target: ≥20%)',
        'Track demo click-through rates',
        'Monitor for inbound SMS replies',
        'Watch for spam complaints or bounces',
        'Record all metrics in performance tracker',
      ],
      pass_condition: 'At least 1 response received, no spam flags',
      if_fail: 'Review messaging, adjust subject lines and SMS copy',
      test: 'TEST_D_MONITOR',
    },
    5: {
      title: 'Day 5 — Optimize & Adjust',
      tasks: [
        'Calculate response rate from 20-lead campaign',
        'Run Day-3 follow-up email sequence',
        'A/B compare: which headlines got more demo clicks?',
        'Adjust messaging for any non-responding leads',
        'Test demo page improvements if click rate < 10%',
      ],
      pass_condition: 'Response rate trending toward ≥5% target',
      if_fail: 'Rewrite email/SMS copy, regenerate underperforming demos',
      test: 'TEST_D_OPTIMIZE',
    },
    6: {
      title: 'Day 6 — Final Adjustments',
      tasks: [
        'Run Day-5 final SMS sequence for 20-lead batch',
        'Close any interested leads with payment links',
        'Calculate final response rate across all 20 leads',
        'Document what worked (industry, messaging, demos)',
        'Prepare scaling decision report',
      ],
      pass_condition: '≥1 lead at INTERESTED or CLOSED status',
      if_fail: 'Extend validation phase, investigate lead quality',
      test: 'TEST_D_FINAL',
    },
    7: {
      title: 'Day 7 — Scaling Decision',
      tasks: [
        'Run all validation tests through decision engine',
        'Generate final validation report',
        'If PASS: unlock scaling to 2nd city/niche',
        'If FAIL: document issues and restart optimization cycle',
        'Set system_mode to SCALE_READY or extend validation',
      ],
      pass_condition: 'All 4 tests pass, no active failure flags',
      if_fail: 'Extend validation 7 more days, fix identified issues',
      test: 'FINAL_EVALUATION',
    },
  };
  return plans[day] || { title: `Day ${day}`, tasks: [], pass_condition: '', if_fail: '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/validation/test-a — run/record Test A: Email Deliverability
// ─────────────────────────────────────────────────────────────────────────────
validation.post('/test-a', async (c) => {
  const { DB, RESEND_API_KEY } = c.env;
  const body = await c.req.json() as {
    test_emails?: { address: string; provider: string }[];
    // OR just record results manually
    manual_results?: {
      total_sent: number;
      inbox_count: number;
      spam_count: number;
      bounce_count: number;
      notes?: string;
    };
  };

  const state = await getValidationState(DB);

  // ── Option A: Record manual test results ──────────────────────────────────
  if (body.manual_results) {
    const r = body.manual_results;
    const inboxRate = r.total_sent > 0 ? r.inbox_count / r.total_sent : 0;
    const passed = inboxRate >= VALIDATION_LIMITS.MIN_EMAIL_INBOX_RATE;

    await DB.prepare(`
      INSERT INTO validation_tests (test_id, test_name, status, score, details, created_at)
      VALUES ('TEST_A', 'Email Deliverability', ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      passed ? 'PASS' : 'FAIL',
      Math.round(inboxRate * 100),
      JSON.stringify(r)
    ).run();

    if (passed) {
      await saveValidationState(DB, {
        tests_passed: { ...state.tests_passed, test_a_email: true }
      });
      await removeFlag(DB, 'EMAIL_DELIVERABILITY_FAILURE');
      await logValidationEvent(DB, 'TEST_A_PASS', { inbox_rate: inboxRate, results: r });
    } else {
      await addFlag(DB, 'EMAIL_DELIVERABILITY_FAILURE');
      await saveValidationState(DB, { system_mode: 'PAUSED' });
      await logValidationEvent(DB, 'TEST_A_FAIL', { inbox_rate: inboxRate, results: r });
    }

    return c.json({
      test: 'TEST_A — Email Deliverability',
      status: passed ? 'PASS' : 'FAIL',
      inbox_rate: `${(inboxRate * 100).toFixed(1)}%`,
      threshold: `${VALIDATION_LIMITS.MIN_EMAIL_INBOX_RATE * 100}%`,
      details: r,
      action: passed
        ? 'Email deliverability confirmed — Test A passed'
        : 'EMAIL_DELIVERABILITY_FAILURE flagged — email outreach paused. Fix domain reputation and re-test.',
      flag_added: !passed ? 'EMAIL_DELIVERABILITY_FAILURE' : null,
    }, passed ? 200 : 422);
  }

  // ── Option B: Send live test emails via Resend ────────────────────────────
  if (!RESEND_API_KEY) {
    return c.json({ error: 'RESEND_API_KEY not configured' }, 400);
  }

  const testEmails = body.test_emails || [];
  if (testEmails.length === 0) {
    return c.json({ error: 'Provide test_emails array or manual_results' }, 400);
  }

  const results: { address: string; provider: string; status: string; id?: string }[] = [];

  for (const te of testEmails) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Test <alex@websitedemopro.com>',
          to: [te.address],
          subject: '🔍 [DELIVERABILITY TEST] Website Demo Preview',
          text: `This is a deliverability test email sent at ${new Date().toISOString()}.\n\nPlease check: Did this land in your PRIMARY inbox or Spam/Promotions?\n\nReply "INBOX" or "SPAM" to help us track deliverability.\n\nUnsubscribe: Reply UNSUBSCRIBE`,
          html: `<p>Deliverability test — ${new Date().toISOString()}</p><p>Did this land in <strong>Primary inbox</strong> or Spam/Promotions?</p><p><small>To unsubscribe, reply UNSUBSCRIBE</small></p>`
        })
      });
      const data = await resp.json() as { id?: string; error?: string };
      results.push({ ...te, status: resp.ok ? 'SENT' : 'FAILED', id: data.id });
    } catch {
      results.push({ ...te, status: 'ERROR' });
    }
  }

  await logValidationEvent(DB, 'TEST_A_EMAILS_SENT', { count: results.length, results });

  return c.json({
    test: 'TEST_A — Email Deliverability',
    status: 'EMAILS_SENT',
    count: results.length,
    results,
    next_step: 'Wait 15 minutes, check inbox placement for each email, then POST to /api/validation/test-a with manual_results to record pass/fail',
    pass_condition: `≥${VALIDATION_LIMITS.MIN_EMAIL_INBOX_RATE * 100}% must land in Primary inbox`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/validation/test-b — run/record Test B: SMS Delivery
// ─────────────────────────────────────────────────────────────────────────────
validation.post('/test-b', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json() as {
    manual_results: {
      total_sent: number;
      delivered_count: number;
      filtered_count: number;
      reply_received: boolean;
      notes?: string;
    };
  };

  const state = await getValidationState(DB);

  if (!body.manual_results) {
    return c.json({
      test: 'TEST_B — SMS Delivery Quality',
      instructions: [
        '1. Send 10 SMS to real devices using Twilio (or simulate via /api/outreach/send-sms)',
        '2. Check that ALL messages are delivered (no filtering)',
        '3. Verify reply capability works (send a reply back)',
        '4. Test STOP opt-out flow',
        '5. POST manual_results here to record pass/fail',
      ],
      pass_condition: '100% delivered, no filtering, replies received',
      body_format: {
        manual_results: {
          total_sent: 10,
          delivered_count: 10,
          filtered_count: 0,
          reply_received: true,
          notes: 'Optional notes'
        }
      }
    });
  }

  const r = body.manual_results;
  const deliveryRate = r.total_sent > 0 ? r.delivered_count / r.total_sent : 0;
  const passed = deliveryRate >= VALIDATION_LIMITS.MIN_SMS_DELIVERY_RATE && r.reply_received;

  await DB.prepare(`
    INSERT INTO validation_tests (test_id, test_name, status, score, details, created_at)
    VALUES ('TEST_B', 'SMS Delivery Quality', ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    passed ? 'PASS' : 'FAIL',
    Math.round(deliveryRate * 100),
    JSON.stringify(r)
  ).run();

  if (passed) {
    await saveValidationState(DB, {
      tests_passed: { ...state.tests_passed, test_b_sms: true }
    });
    await removeFlag(DB, 'SMS_DELIVERY_FAILURE');
    await logValidationEvent(DB, 'TEST_B_PASS', { delivery_rate: deliveryRate, results: r });
  } else {
    await addFlag(DB, 'SMS_DELIVERY_FAILURE');
    await saveValidationState(DB, { system_mode: 'PAUSED' });
    await logValidationEvent(DB, 'TEST_B_FAIL', { delivery_rate: deliveryRate, results: r });
  }

  return c.json({
    test: 'TEST_B — SMS Delivery Quality',
    status: passed ? 'PASS' : 'FAIL',
    delivery_rate: `${(deliveryRate * 100).toFixed(1)}%`,
    reply_received: r.reply_received,
    threshold: '100% delivery + replies',
    details: r,
    action: passed
      ? 'SMS delivery confirmed — Test B passed'
      : 'SMS_DELIVERY_FAILURE flagged — SMS outreach paused. Check Twilio account and phone number status.',
    flag_added: !passed ? 'SMS_DELIVERY_FAILURE' : null,
  }, passed ? 200 : 422);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/validation/test-c — run/record Test C: Demo Quality
// ─────────────────────────────────────────────────────────────────────────────
validation.post('/test-c', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json() as {
    demo_scores?: { demo_id: number; looks_real: boolean; worth_500: boolean; notes?: string }[];
    // OR auto-generate and evaluate
    generate_for_leads?: number[];
  };

  const state = await getValidationState(DB);

  // ── Auto-evaluate existing demos ──────────────────────────────────────────
  if (body.demo_scores) {
    const scores = body.demo_scores;
    const passCount = scores.filter(s => s.looks_real && s.worth_500).length;
    const qualityScore = passCount; // out of scores.length
    const passed = qualityScore >= VALIDATION_LIMITS.MIN_DEMO_QUALITY_SCORE;

    await DB.prepare(`
      INSERT INTO validation_tests (test_id, test_name, status, score, details, created_at)
      VALUES ('TEST_C', 'Demo Quality', ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      passed ? 'PASS' : 'FAIL',
      qualityScore,
      JSON.stringify({ scores, pass_count: passCount, total: scores.length })
    ).run();

    if (passed) {
      await saveValidationState(DB, {
        tests_passed: { ...state.tests_passed, test_c_demo: true }
      });
      await removeFlag(DB, 'DEMO_QUALITY_FAILURE');
      await logValidationEvent(DB, 'TEST_C_PASS', { quality_score: qualityScore, scores });
    } else {
      await addFlag(DB, 'DEMO_QUALITY_FAILURE');
      await logValidationEvent(DB, 'TEST_C_FAIL', { quality_score: qualityScore, scores });
    }

    return c.json({
      test: 'TEST_C — Demo Quality',
      status: passed ? 'PASS' : 'FAIL',
      quality_score: `${passCount}/${scores.length}`,
      threshold: `≥${VALIDATION_LIMITS.MIN_DEMO_QUALITY_SCORE}/5`,
      details: scores,
      action: passed
        ? 'Demo quality confirmed — Test C passed'
        : 'DEMO_QUALITY_FAILURE flagged — Outreach blocked. Regenerate demos and improve content quality.',
      flag_added: !passed ? 'DEMO_QUALITY_FAILURE' : null,
    }, passed ? 200 : 422);
  }

  // ── Fetch latest 5 demos for manual review ────────────────────────────────
  const latestDemos = await DB.prepare(`
    SELECT d.id, d.demo_url, d.headline, d.subheadline, d.services, d.view_count,
           l.name as business_name, l.industry, l.city
    FROM demos d JOIN leads l ON l.id = d.lead_id
    WHERE d.status = 'ACTIVE'
    ORDER BY d.created_at DESC LIMIT 5
  `).all();

  return c.json({
    test: 'TEST_C — Demo Quality Evaluation',
    status: 'PENDING_MANUAL_REVIEW',
    instruction: 'Visit each demo URL below. Score each: does it look like a real business? Would you pay $500 for this?',
    demos: latestDemos.results,
    pass_condition: `≥${VALIDATION_LIMITS.MIN_DEMO_QUALITY_SCORE}/5 demos rated YES to both questions`,
    submit_scores_to: 'POST /api/validation/test-c with demo_scores array',
    demo_scores_format: {
      demo_scores: [
        { demo_id: 1, looks_real: true, worth_500: true, notes: 'Professional, clear CTA' },
        { demo_id: 2, looks_real: false, worth_500: false, notes: 'Missing services, generic content' },
      ]
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/validation/test-d — record Test D: Live Lead Campaign Results
// ─────────────────────────────────────────────────────────────────────────────
validation.post('/test-d', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json() as {
    // Auto-calculate from DB, or supply manual results
    use_db_data?: boolean;
    manual_results?: {
      total_leads: number;
      responses: number;
      demo_clicks: number;
      conversations_started: number;
      notes?: string;
    };
  };

  const state = await getValidationState(DB);

  // ── Auto-calculate from DB ─────────────────────────────────────────────────
  if (body.use_db_data) {
    const stats = await DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('RESPONDED','INTERESTED','CLOSED') THEN 1 ELSE 0 END) as responded,
        SUM(CASE WHEN status IN ('INTERESTED','CLOSED') THEN 1 ELSE 0 END) as interested
      FROM leads
      WHERE created_at >= DATE('now', '-7 days')
      AND status NOT IN ('NEW')
    `).first<{ total: number; responded: number; interested: number }>();

    const demoClicks = await DB.prepare(`
      SELECT COUNT(*) as count FROM demos WHERE viewed = 1 AND created_at >= DATE('now', '-7 days')
    `).first<{ count: number }>();

    const conversations = await DB.prepare(`
      SELECT COUNT(DISTINCT lead_id) as count FROM conversations
      WHERE direction = 'inbound' AND created_at >= DATE('now', '-7 days')
    `).first<{ count: number }>();

    const total = stats?.total || 0;
    const responded = stats?.responded || 0;
    const responseRate = total > 0 ? responded / total : 0;
    const passed = responseRate >= VALIDATION_LIMITS.MIN_RESPONSE_RATE && total >= 15;

    const results = {
      total_leads: total,
      responses: responded,
      response_rate: responseRate,
      demo_clicks: demoClicks?.count || 0,
      conversations_started: conversations?.count || 0,
      interested: stats?.interested || 0,
    };

    await DB.prepare(`
      INSERT INTO validation_tests (test_id, test_name, status, score, details, created_at)
      VALUES ('TEST_D', 'Live Lead Campaign', ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      passed ? 'PASS' : 'FAIL',
      Math.round(responseRate * 100),
      JSON.stringify(results)
    ).run();

    if (passed) {
      await saveValidationState(DB, {
        tests_passed: { ...state.tests_passed, test_d_leads: true }
      });
      await logValidationEvent(DB, 'TEST_D_PASS', results);
    } else {
      await addFlag(DB, 'LOW_RESPONSE_RATE');
      await logValidationEvent(DB, 'TEST_D_FAIL', results);
    }

    return c.json({
      test: 'TEST_D — Live Lead Campaign',
      status: passed ? 'PASS' : 'FAIL',
      response_rate: `${(responseRate * 100).toFixed(1)}%`,
      threshold: `≥${VALIDATION_LIMITS.MIN_RESPONSE_RATE * 100}%`,
      sufficient_sample: total >= 15 ? `YES (${total} leads)` : `NO (need ≥15 leads, have ${total})`,
      results,
      action: passed
        ? 'Response rate validated — Test D passed'
        : total < 15
          ? `Insufficient data — run campaign with more leads first (have ${total}, need ≥15)`
          : 'LOW_RESPONSE_RATE flagged — pause scaling, trigger optimization cycle',
    }, passed ? 200 : 422);
  }

  // Manual results
  if (body.manual_results) {
    const r = body.manual_results;
    const responseRate = r.total_leads > 0 ? r.responses / r.total_leads : 0;
    const passed = responseRate >= VALIDATION_LIMITS.MIN_RESPONSE_RATE && r.total_leads >= 15;

    await DB.prepare(`
      INSERT INTO validation_tests (test_id, test_name, status, score, details, created_at)
      VALUES ('TEST_D', 'Live Lead Campaign', ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(passed ? 'PASS' : 'FAIL', Math.round(responseRate * 100), JSON.stringify(r)).run();

    if (passed) {
      await saveValidationState(DB, {
        tests_passed: { ...state.tests_passed, test_d_leads: true }
      });
    } else {
      await addFlag(DB, 'LOW_RESPONSE_RATE');
    }

    return c.json({
      test: 'TEST_D — Live Lead Campaign (Manual)',
      status: passed ? 'PASS' : 'FAIL',
      response_rate: `${(responseRate * 100).toFixed(1)}%`,
      details: r,
    }, passed ? 200 : 422);
  }

  return c.json({ error: 'Provide use_db_data: true or manual_results object' }, 400);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/validation/performance — real-time performance metrics
// ─────────────────────────────────────────────────────────────────────────────
validation.get('/performance', async (c) => {
  const { DB } = c.env;

  // Email performance
  const emailStats = await DB.prepare(`
    SELECT
      COUNT(*) as sent,
      SUM(CASE WHEN status='OPENED' THEN 1 ELSE 0 END) as opened,
      SUM(CASE WHEN status='CLICKED' THEN 1 ELSE 0 END) as clicked,
      SUM(CASE WHEN status='REPLIED' THEN 1 ELSE 0 END) as replied,
      SUM(CASE WHEN status='BOUNCED' THEN 1 ELSE 0 END) as bounced,
      SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) as failed
    FROM outreach WHERE channel='email'
  `).first<{ sent: number; opened: number; clicked: number; replied: number; bounced: number; failed: number }>();

  // SMS performance
  const smsStats = await DB.prepare(`
    SELECT
      COUNT(*) as sent,
      SUM(CASE WHEN status='REPLIED' THEN 1 ELSE 0 END) as replied
    FROM outreach WHERE channel='sms'
  `).first<{ sent: number; replied: number }>();

  // Lead pipeline performance
  const leadStats = await DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='CONTACTED' THEN 1 ELSE 0 END) as contacted,
      SUM(CASE WHEN status='RESPONDED' THEN 1 ELSE 0 END) as responded,
      SUM(CASE WHEN status='INTERESTED' THEN 1 ELSE 0 END) as interested,
      SUM(CASE WHEN status='CLOSED' THEN 1 ELSE 0 END) as closed
    FROM leads WHERE status NOT IN ('LOST')
  `).first<{ total: number; contacted: number; responded: number; interested: number; closed: number }>();

  // Demo performance
  const demoStats = await DB.prepare(`
    SELECT COUNT(*) as total, SUM(viewed) as viewed, SUM(view_count) as total_views
    FROM demos WHERE status='ACTIVE'
  `).first<{ total: number; viewed: number; total_views: number }>();

  const emailSent = emailStats?.sent || 0;
  const leadTotal = leadStats?.total || 1;
  const demoTotal = demoStats?.total || 1;

  const metrics = {
    email: {
      sent: emailSent,
      open_rate: emailSent > 0 ? `${((emailStats?.opened || 0) / emailSent * 100).toFixed(1)}%` : 'N/A',
      click_rate: emailSent > 0 ? `${((emailStats?.clicked || 0) / emailSent * 100).toFixed(1)}%` : 'N/A',
      reply_rate: emailSent > 0 ? `${((emailStats?.replied || 0) / emailSent * 100).toFixed(1)}%` : 'N/A',
      bounce_rate: emailSent > 0 ? `${((emailStats?.bounced || 0) / emailSent * 100).toFixed(1)}%` : 'N/A',
      raw: emailStats,
    },
    sms: {
      sent: smsStats?.sent || 0,
      reply_rate: (smsStats?.sent || 0) > 0
        ? `${((smsStats?.replied || 0) / (smsStats?.sent || 1) * 100).toFixed(1)}%`
        : 'N/A',
      raw: smsStats,
    },
    leads: {
      total: leadStats?.total || 0,
      contact_rate: `${((leadStats?.contacted || 0) / leadTotal * 100).toFixed(1)}%`,
      response_rate: `${(((leadStats?.responded || 0) + (leadStats?.interested || 0) + (leadStats?.closed || 0)) / leadTotal * 100).toFixed(1)}%`,
      close_rate: `${((leadStats?.closed || 0) / leadTotal * 100).toFixed(1)}%`,
      raw: leadStats,
    },
    demos: {
      total: demoStats?.total || 0,
      view_rate: `${((demoStats?.viewed || 0) / demoTotal * 100).toFixed(1)}%`,
      total_views: demoStats?.total_views || 0,
      avg_views_per_demo: demoTotal > 0 ? ((demoStats?.total_views || 0) / demoTotal).toFixed(1) : '0',
    },
    validation_targets: {
      email_inbox_rate: `≥${VALIDATION_LIMITS.MIN_EMAIL_INBOX_RATE * 100}%`,
      sms_delivery: `${VALIDATION_LIMITS.MIN_SMS_DELIVERY_RATE * 100}%`,
      demo_quality: `≥${VALIDATION_LIMITS.MIN_DEMO_QUALITY_SCORE}/5`,
      response_rate: `≥${VALIDATION_LIMITS.MIN_RESPONSE_RATE * 100}%`,
    },
  };

  return c.json(metrics);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/validation/events — audit log of all validation events
// ─────────────────────────────────────────────────────────────────────────────
validation.get('/events', async (c) => {
  const { DB } = c.env;
  const { limit = '50' } = c.req.query();

  const events = await DB.prepare(`
    SELECT * FROM validation_events ORDER BY created_at DESC LIMIT ?
  `).bind(Number(limit)).all();

  return c.json({ events: events.results });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/validation/test-history — all test results
// ─────────────────────────────────────────────────────────────────────────────
validation.get('/test-history', async (c) => {
  const { DB } = c.env;

  const tests = await DB.prepare(`
    SELECT * FROM validation_tests ORDER BY created_at DESC
  `).all();

  return c.json({ tests: tests.results });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/validation/report — FINAL VALIDATION REPORT
// ─────────────────────────────────────────────────────────────────────────────
validation.get('/report', async (c) => {
  const { DB } = c.env;

  const [state, decision, performance] = await Promise.all([
    getValidationState(DB),
    evaluateScalingReadiness(DB),
    (async () => {
      const emailStats = await DB.prepare(`
        SELECT COUNT(*) as sent,
          SUM(CASE WHEN status='OPENED' THEN 1 ELSE 0 END) as opened,
          SUM(CASE WHEN status='BOUNCED' THEN 1 ELSE 0 END) as bounced
        FROM outreach WHERE channel='email'
      `).first<{ sent: number; opened: number; bounced: number }>();

      const leadStats = await DB.prepare(`
        SELECT COUNT(*) as total,
          SUM(CASE WHEN status IN ('RESPONDED','INTERESTED','CLOSED') THEN 1 ELSE 0 END) as responded,
          SUM(CASE WHEN status='CLOSED' THEN 1 ELSE 0 END) as closed
        FROM leads WHERE status NOT IN ('LOST','NEW')
      `).first<{ total: number; responded: number; closed: number }>();

      const demoStats = await DB.prepare(`
        SELECT COUNT(*) as total, SUM(viewed) as viewed FROM demos WHERE status='ACTIVE'
      `).first<{ total: number; viewed: number }>();

      return { emailStats, leadStats, demoStats };
    })()
  ]);

  const testHistory = await DB.prepare(
    `SELECT * FROM validation_tests ORDER BY created_at DESC`
  ).all();

  const latestTests: Record<string, { status: string; score: number; created_at: string }> = {};
  for (const t of (testHistory.results as { test_id: string; status: string; score: number; created_at: string }[])) {
    if (!latestTests[t.test_id]) latestTests[t.test_id] = t;
  }

  const emailSent = performance.emailStats?.sent || 0;
  const leadTotal = Math.max(performance.leadStats?.total || 0, 1);

  const report = {
    generated_at: new Date().toISOString(),
    validation_day: state.validation_day,
    system_mode: state.system_mode,

    deliverability_status: {
      test_a_email: state.tests_passed.test_a_email ? 'PASS' : 'NOT_YET_VALIDATED',
      test_b_sms: state.tests_passed.test_b_sms ? 'PASS' : 'NOT_YET_VALIDATED',
      inbox_rate: latestTests['TEST_A']
        ? `${latestTests['TEST_A'].score}% (${latestTests['TEST_A'].status})`
        : 'Pending Test A',
      sms_delivery: latestTests['TEST_B']
        ? `${latestTests['TEST_B'].score}% (${latestTests['TEST_B'].status})`
        : 'Pending Test B',
      email_bounce_rate: emailSent > 0
        ? `${((performance.emailStats?.bounced || 0) / emailSent * 100).toFixed(1)}%`
        : 'No data',
      domain_verified: state.active_flags.includes('DOMAIN_NOT_VERIFIED') ? 'NO' : 'YES',
      twilio_configured: state.active_flags.includes('TWILIO_NOT_CONFIGURED') ? 'NO' : 'YES',
    },

    demo_quality_score: {
      test_c: state.tests_passed.test_c_demo ? 'PASS' : 'NOT_YET_VALIDATED',
      score: latestTests['TEST_C']
        ? `${latestTests['TEST_C'].score}/5 (${latestTests['TEST_C'].status})`
        : 'Pending Test C',
      demos_live: performance.demoStats?.total || 0,
      demos_viewed: performance.demoStats?.viewed || 0,
      view_rate: performance.demoStats?.total
        ? `${((performance.demoStats.viewed / performance.demoStats.total) * 100).toFixed(1)}%`
        : '0%',
    },

    response_rate: {
      test_d: state.tests_passed.test_d_leads ? 'PASS' : 'NOT_YET_VALIDATED',
      rate: `${(((performance.leadStats?.responded || 0) / leadTotal) * 100).toFixed(1)}%`,
      threshold: `≥${VALIDATION_LIMITS.MIN_RESPONSE_RATE * 100}%`,
      leads_contacted: performance.leadStats?.total || 0,
      leads_responded: performance.leadStats?.responded || 0,
      leads_closed: performance.leadStats?.closed || 0,
      score: latestTests['TEST_D']
        ? `${latestTests['TEST_D'].score}% (${latestTests['TEST_D'].status})`
        : 'Pending Test D',
    },

    scaling_decision: {
      allowed: decision.scaling_allowed,
      verdict: decision.scaling_allowed ? '✅ SCALE_READY — All conditions met' : '🔒 SCALING BLOCKED — Conditions not yet met',
      passed_conditions: decision.passed_conditions,
      failed_conditions: decision.failed_conditions,
    },

    active_flags: state.active_flags,
    locked_to: { city: state.locked_city, niche: state.locked_niche },

    required_fixes: decision.recommendations,

    next_steps: decision.scaling_allowed
      ? [
          '🚀 SCALE_READY: Unlock second city/niche',
          'Increase daily limits: leads≤60, emails≤50, sms≤30, calls≤60',
          'Expand to similar niches in same city first',
          'Monitor metrics weekly and run validation cycle for each new market',
        ]
      : [
          ...decision.recommendations,
          'Complete all 4 validation tests before proceeding',
          'Resolve any active failure flags',
          'Re-run decision engine after each fix',
        ],

    safe_limits: {
      current_mode: 'VALIDATION',
      leads_per_day: VALIDATION_LIMITS.MAX_LEADS_PER_DAY,
      emails_per_day: VALIDATION_LIMITS.MAX_EMAILS_PER_DAY,
      sms_per_day: VALIDATION_LIMITS.MAX_SMS_PER_DAY,
      calls_per_day: VALIDATION_LIMITS.MAX_CALLS_PER_DAY,
      cities: 1,
      niches: 1,
    },
  };

  return c.json(report);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/validation/initialize — set up validation tables and initial state
// ─────────────────────────────────────────────────────────────────────────────
validation.post('/initialize', async (c) => {
  const { DB } = c.env;

  // Create validation_events table
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS validation_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Create validation_tests table
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS validation_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id TEXT NOT NULL,
      test_name TEXT NOT NULL,
      status TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Initialize default validation state
  await saveValidationState(DB, {
    system_mode: 'VALIDATION',
    scaling_allowed: false,
    active_flags: [],
    validation_day: 1,
    tests_passed: {
      test_a_email: false,
      test_b_sms: false,
      test_c_demo: false,
      test_d_leads: false,
    },
    daily_counts: { leads: 0, emails: 0, sms: 0, calls: 0 },
    locked_city: null,
    locked_niche: null,
  });

  await logValidationEvent(DB, 'SYSTEM_INITIALIZED', {
    mode: 'VALIDATION',
    limits: VALIDATION_LIMITS,
    timestamp: new Date().toISOString(),
  });

  return c.json({
    message: 'Validation mode initialized',
    system_mode: 'VALIDATION',
    scaling_allowed: false,
    limits: VALIDATION_LIMITS,
    next_steps: [
      '1. POST /api/validation/test-a — Run email deliverability test',
      '2. POST /api/validation/test-b — Run SMS delivery test',
      '3. POST /api/validation/test-c — Score demo quality',
      '4. POST /api/validation/test-d — Record live campaign results',
      '5. GET /api/validation/scaling-decision — Check if scaling is unlocked',
      '6. GET /api/validation/report — Generate final validation report',
    ],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/validation/pre-outreach-check — verify all systems ready before outreach
// ─────────────────────────────────────────────────────────────────────────────
validation.get('/pre-outreach-check', async (c) => {
  const { DB, RESEND_API_KEY, TWILIO_ACCOUNT_SID, OPENAI_API_KEY } = c.env as any;

  // Check 1: Email domain (Resend API key configured)
  const emailDomainOk = !!(RESEND_API_KEY && RESEND_API_KEY.length > 10);

  // Check 2: Twilio credentials
  const twilioOk = !!(TWILIO_ACCOUNT_SID);

  // Check 3: OpenAI capacity
  const openAiOk = !!(OPENAI_API_KEY && OPENAI_API_KEY.length > 10);

  // Check 4: Rate limits headroom
  const state = await getValidationState(DB);
  const limits = VALIDATION_LIMITS;
  const today = new Date().toISOString().split('T')[0];

  const emailsToday = await DB.prepare(
    `SELECT COUNT(*) as cnt FROM outreach WHERE channel='email' AND DATE(created_at)=?`
  ).bind(today).first<{cnt: number}>();
  const smsToday = await DB.prepare(
    `SELECT COUNT(*) as cnt FROM outreach WHERE channel='sms' AND DATE(created_at)=?`
  ).bind(today).first<{cnt: number}>();

  const emailsRemaining = limits.MAX_EMAILS_PER_DAY - (emailsToday?.cnt || 0);
  const smsRemaining = limits.MAX_SMS_PER_DAY - (smsToday?.cnt || 0);

  const checks = {
    email_domain: {
      ok: emailDomainOk,
      status: emailDomainOk ? '✅ Resend API key configured' : '❌ Resend API key missing',
      action: emailDomainOk ? null : 'Set RESEND_API_KEY secret and verify sending domain',
    },
    twilio: {
      ok: twilioOk,
      status: twilioOk ? '✅ Twilio credentials configured' : '⚠️ Twilio credentials missing',
      action: twilioOk ? null : 'Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN secrets',
    },
    openai: {
      ok: openAiOk,
      status: openAiOk ? '✅ OpenAI API key present (fallback active)' : '⚠️ OpenAI key missing — local fallback only',
      action: openAiOk ? null : 'Optional: Set OPENAI_API_KEY for AI-generated content',
    },
    rate_limits: {
      ok: emailsRemaining > 0 && smsRemaining > 0,
      status: `📊 ${emailsRemaining} emails and ${smsRemaining} SMS remaining today`,
      emails_remaining: emailsRemaining,
      sms_remaining: smsRemaining,
    },
    system_mode: {
      ok: state.system_mode !== 'PAUSED',
      status: state.system_mode === 'PAUSED' ? '❌ System PAUSED — resolve issues first' : `✅ System in ${state.system_mode} mode`,
    },
  };

  const allCriticalOk = checks.email_domain.ok && checks.rate_limits.ok && checks.system_mode.ok;

  return c.json({
    ready: allCriticalOk,
    checks,
    summary: allCriticalOk
      ? '✅ All pre-outreach checks passed — system ready to send'
      : '⚠️ Some checks failed — review before sending',
    recommendations: Object.values(checks)
      .filter((ch: any) => !ch.ok && ch.action)
      .map((ch: any) => ch.action),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/validation/raise-flag — manually raise a validation flag
// ─────────────────────────────────────────────────────────────────────────────
validation.post('/raise-flag', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json().catch(() => ({}));
  const { flag, severity = 'warning', details = '' } = body;

  if (!flag) return c.json({ error: 'flag is required' }, 400);

  const state = await getValidationState(DB);
  if (!state.active_flags.includes(flag)) {
    state.active_flags.push(flag);
  }
  await saveValidationState(DB, state);
  await logValidationEvent(DB, 'FLAG_RAISED', { flag, severity, details });

  return c.json({
    message: `Flag "${flag}" raised`,
    severity,
    active_flags: state.active_flags,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/validation/set-state — update validation state fields (admin/test use)
// ─────────────────────────────────────────────────────────────────────────────
validation.post('/set-state', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json().catch(() => ({}));

  const state = await getValidationState(DB);
  const updatedState = { ...state, ...body };
  await saveValidationState(DB, updatedState);

  return c.json({
    message: 'Validation state updated',
    state: updatedState,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/validation/check-scaling-restriction — check if action violates validation scope
// ─────────────────────────────────────────────────────────────────────────────
validation.post('/check-scaling-restriction', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json().catch(() => ({}));
  const { action, city, niche } = body;

  const state = await getValidationState(DB);

  // Lock city/niche on first use
  let cityViolation = false;
  let nicheViolation = false;

  if (city && state.locked_city && state.locked_city !== city) {
    cityViolation = true;
  }
  if (niche && state.locked_niche && state.locked_niche !== niche) {
    nicheViolation = true;
  }

  if (cityViolation || nicheViolation) {
    return c.json({
      allowed: false,
      blocked: true,
      reason: 'VALIDATION PHASE ACTIVE — SCALING BLOCKED',
      details: [
        cityViolation ? `Multi-city blocked: locked to ${state.locked_city}, got ${city}` : null,
        nicheViolation ? `Multi-niche blocked: locked to ${state.locked_niche}, got ${niche}` : null,
      ].filter(Boolean),
    }, 409);
  }

  // Lock on first use if not set
  let updated = false;
  if (city && !state.locked_city) {
    state.locked_city = city;
    updated = true;
  }
  if (niche && !state.locked_niche) {
    state.locked_niche = niche;
    updated = true;
  }
  if (updated) await saveValidationState(DB, state);

  return c.json({
    allowed: true,
    blocked: false,
    locked_city: state.locked_city,
    locked_niche: state.locked_niche,
  });
});

export default validation;
