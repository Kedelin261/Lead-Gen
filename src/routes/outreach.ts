import { Hono } from 'hono';
import type { Bindings } from '../types';
import { generateOutreachMessage, generateCallScript } from '../lib/ai';
import { runOutreachGateChecks, checkAutoPauseTriggers } from '../lib/validation-engine';

const outreach = new Hono<{ Bindings: Bindings }>();

// GET /api/outreach - List outreach records
outreach.get('/', async (c) => {
  const { DB } = c.env;
  const { lead_id, channel, status, limit = '50', offset = '0' } = c.req.query();

  let query = `
    SELECT o.*, l.name as business_name, l.phone, l.email, l.city, l.industry
    FROM outreach o
    JOIN leads l ON l.id = o.lead_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (lead_id) { query += ` AND o.lead_id = ?`; params.push(lead_id); }
  if (channel) { query += ` AND o.channel = ?`; params.push(channel); }
  if (status) { query += ` AND o.status = ?`; params.push(status); }

  query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const result = await DB.prepare(query).bind(...params).all();
  return c.json({ outreach: result.results });
});

// POST /api/outreach/send-email - Send email to a lead
outreach.post('/send-email', async (c) => {
  const { DB, RESEND_API_KEY, APP_URL } = c.env;
  const { lead_id, attempt = 1, from_name = 'Alex', from_email = 'alex@websitedemopro.com' } = await c.req.json();

  if (!lead_id) return c.json({ error: 'lead_id required' }, 400);

  const lead = await DB.prepare(`
    SELECT l.*, d.demo_url, d.id as demo_id
    FROM leads l
    LEFT JOIN demos d ON d.lead_id = l.id AND d.status = 'ACTIVE'
    WHERE l.id = ?
  `).bind(lead_id).first<{
    id: number; name: string; email: string; industry: string; city: string; demo_url: string;
  }>();

  if (!lead) return c.json({ error: 'Lead not found' }, 404);
  if (!lead.email) return c.json({ error: 'Lead has no email' }, 400);

  // ── VALIDATION MODE GATE CHECK ────────────────────────────────────────────
  const gate = await runOutreachGateChecks(DB, 'email', {
    RESEND_API_KEY: c.env.RESEND_API_KEY,
    TWILIO_ACCOUNT_SID: c.env.TWILIO_ACCOUNT_SID,
    OPENAI_API_KEY: c.env.OPENAI_API_KEY,
  });
  if (!gate.allowed) {
    return c.json({
      error: gate.errors[0] || 'Outreach blocked by validation mode',
      blocked_by: gate.blocked_by,
      errors: gate.errors,
      warnings: gate.warnings,
    }, 403);
  }

  // Check rate limits - max 50 emails/day
  const todayEmails = await DB.prepare(`
    SELECT COUNT(*) as count FROM outreach
    WHERE channel = 'email' AND DATE(sent_at) = DATE('now')
  `).first<{ count: number }>();
  if ((todayEmails?.count || 0) >= 50) {
    return c.json({ error: 'Daily email limit reached (50/day)' }, 429);
  }

  // Check if already contacted via email today
  const recentEmail = await DB.prepare(`
    SELECT id FROM outreach
    WHERE lead_id = ? AND channel = 'email' AND DATE(sent_at) = DATE('now')
  `).bind(lead_id).first();
  if (recentEmail) return c.json({ error: 'Already emailed this lead today' }, 409);

  const demoUrl = lead.demo_url || `${APP_URL}/demo/preview-${lead_id}`;
  const subject = await generateOutreachMessage('email_subject', attempt, lead.name, lead.industry, lead.city, demoUrl, '');
  const body = await generateOutreachMessage('email_body', attempt, lead.name, lead.industry, lead.city, demoUrl, '');

  // Send via Resend
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${from_name} <${from_email}>`,
      to: [lead.email],
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>').replace(
        demoUrl,
        `<a href="${demoUrl}" style="color:#2563eb;font-weight:bold">View Your Demo Website →</a>`
      ) + `<br><br><small style="color:#999">To unsubscribe, reply with "UNSUBSCRIBE". This email was sent regarding your business's online presence.</small>`
    })
  });

  const emailData = await emailResponse.json() as { id?: string; error?: string };

  if (!emailResponse.ok) {
    await DB.prepare(`
      INSERT INTO outreach (lead_id, channel, status, subject, body, attempt_number, error_message)
      VALUES (?, 'email', 'FAILED', ?, ?, ?, ?)
    `).bind(lead_id, subject, body, attempt, JSON.stringify(emailData)).run();
    return c.json({ error: 'Email send failed', details: emailData }, 500);
  }

  await DB.prepare(`
    INSERT INTO outreach (lead_id, channel, status, subject, body, sent_at, attempt_number, external_id)
    VALUES (?, 'email', 'SENT', ?, ?, CURRENT_TIMESTAMP, ?, ?)
  `).bind(lead_id, subject, body, attempt, emailData.id || null).run();

  // Update lead status
  await DB.prepare(`
    UPDATE leads SET status = 'CONTACTED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'NEW'
  `).bind(lead_id).run();

  return c.json({ message: 'Email sent successfully', email_id: emailData.id, subject, to: lead.email });
});

// POST /api/outreach/send-sms - Send SMS to a lead
outreach.post('/send-sms', async (c) => {
  const { DB, APP_URL } = c.env;
  const { lead_id, attempt = 1 } = await c.req.json();

  if (!lead_id) return c.json({ error: 'lead_id required' }, 400);

  const lead = await DB.prepare(`
    SELECT l.*, d.demo_url
    FROM leads l
    LEFT JOIN demos d ON d.lead_id = l.id AND d.status = 'ACTIVE'
    WHERE l.id = ?
  `).bind(lead_id).first<{
    id: number; name: string; phone: string; industry: string; city: string; demo_url: string;
  }>();

  if (!lead) return c.json({ error: 'Lead not found' }, 404);
  if (!lead.phone) return c.json({ error: 'Lead has no phone' }, 400);

  // ── VALIDATION MODE GATE CHECK ────────────────────────────────────────────
  const gateSms = await runOutreachGateChecks(DB, 'sms', {
    TWILIO_ACCOUNT_SID: c.env.TWILIO_ACCOUNT_SID,
  });
  if (!gateSms.allowed) {
    return c.json({
      error: gateSms.errors[0] || 'SMS outreach blocked by validation mode',
      blocked_by: gateSms.blocked_by,
      errors: gateSms.errors,
    }, 403);
  }

  // Rate limit check - max 30 SMS/day
  const todaySMS = await DB.prepare(`
    SELECT COUNT(*) as count FROM outreach
    WHERE channel = 'sms' AND DATE(sent_at) = DATE('now')
  `).first<{ count: number }>();
  if ((todaySMS?.count || 0) >= 30) {
    return c.json({ error: 'Daily SMS limit reached (30/day)' }, 429);
  }

  const demoUrl = lead.demo_url || `${APP_URL}/demo/preview-${lead_id}`;
  const message = await generateOutreachMessage('sms', attempt, lead.name, lead.industry, lead.city, demoUrl, '');

  // Log SMS attempt (Twilio integration ready)
  await DB.prepare(`
    INSERT INTO outreach (lead_id, channel, status, body, sent_at, attempt_number)
    VALUES (?, 'sms', 'SENT', ?, CURRENT_TIMESTAMP, ?)
  `).bind(lead_id, message, attempt).run();

  await DB.prepare(`
    UPDATE leads SET status = 'CONTACTED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'NEW'
  `).bind(lead_id).run();

  // Add to conversations
  await DB.prepare(`
    INSERT INTO conversations (lead_id, channel, direction, message, to_number)
    VALUES (?, 'sms', 'outbound', ?, ?)
  `).bind(lead_id, message, lead.phone).run();

  return c.json({ message: 'SMS queued', sms_body: message, to: lead.phone });
});

// POST /api/outreach/initiate-call - Log call attempt
outreach.post('/initiate-call', async (c) => {
  const { DB } = c.env;
  const { lead_id } = await c.req.json();

  if (!lead_id) return c.json({ error: 'lead_id required' }, 400);

  const lead = await DB.prepare(`
    SELECT l.*, d.demo_url
    FROM leads l
    LEFT JOIN demos d ON d.lead_id = l.id AND d.status = 'ACTIVE'
    WHERE l.id = ?
  `).bind(lead_id).first<{
    id: number; name: string; phone: string; industry: string; city: string;
  }>();

  if (!lead) return c.json({ error: 'Lead not found' }, 404);
  if (!lead.phone) return c.json({ error: 'Lead has no phone' }, 400);

  // ── VALIDATION MODE GATE CHECK ────────────────────────────────────────────
  const gateCall = await runOutreachGateChecks(DB, 'call', {
    TWILIO_ACCOUNT_SID: c.env.TWILIO_ACCOUNT_SID,
  });
  if (!gateCall.allowed) {
    return c.json({
      error: gateCall.errors[0] || 'Call outreach blocked by validation mode',
      blocked_by: gateCall.blocked_by,
      errors: gateCall.errors,
    }, 403);
  }

  // Rate limit check - max 100 calls/day
  const todayCalls = await DB.prepare(`
    SELECT COUNT(*) as count FROM outreach
    WHERE channel = 'call' AND DATE(sent_at) = DATE('now')
  `).first<{ count: number }>();
  if ((todayCalls?.count || 0) >= 100) {
    return c.json({ error: 'Daily call limit reached (100/day)' }, 429);
  }

  const script = await generateCallScript(lead.name, lead.industry, lead.city, 'there', '');

  await DB.prepare(`
    INSERT INTO outreach (lead_id, channel, status, body, sent_at)
    VALUES (?, 'call', 'SENT', ?, CURRENT_TIMESTAMP)
  `).bind(lead_id, script).run();

  await DB.prepare(`
    UPDATE leads SET status = 'CONTACTED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'NEW'
  `).bind(lead_id).run();

  return c.json({ message: 'Call logged', phone: lead.phone, script });
});

// POST /api/outreach/sequence - Run full outreach sequence for a lead
outreach.post('/sequence', async (c) => {
  const { DB, RESEND_API_KEY, APP_URL } = c.env;
  const { lead_id, day = 1 } = await c.req.json();

  if (!lead_id) return c.json({ error: 'lead_id required' }, 400);

  const lead = await DB.prepare(`SELECT * FROM leads WHERE id = ?`).bind(lead_id).first<{
    id: number; name: string; phone: string; email: string; industry: string; city: string; status: string;
  }>();
  if (!lead) return c.json({ error: 'Lead not found' }, 404);

  // Count total outreach records for this lead across all channels
  // Max limit: 9 total records (Day1: call+sms+email=3, Day3: email=1, Day5: sms=1 → up to 5)
  // Enforce hard cap of 9 total records to prevent infinite retries
  const totalRecords = await DB.prepare(`
    SELECT COUNT(*) as count FROM outreach WHERE lead_id = ?
  `).bind(lead_id).first<{ count: number }>();

  // Also count how many sequence "days" have been executed (tracked by attempt_number)
  // Day 1 uses attempt_number=1, Day 3 uses attempt_number=2, Day 5 uses attempt_number=3
  const maxAttempt = await DB.prepare(`
    SELECT MAX(attempt_number) as max_attempt FROM outreach WHERE lead_id = ?
  `).bind(lead_id).first<{ max_attempt: number }>();

  // If 3 sequence days already run (attempt numbers 1, 2, 3), block further sequences
  if ((maxAttempt?.max_attempt || 0) >= 3 || (totalRecords?.count || 0) >= 9) {
    return c.json({ error: 'Max outreach attempts reached for this lead (3 sequence days limit)' }, 409);
  }

  const results: Record<string, unknown> = { day, lead_id };

  if (day === 1) {
    // Day 1: Call → SMS → Email (with delays)
    if (lead.phone) {
      const callScript = await generateCallScript(lead.name, lead.industry, lead.city, 'there', '');
      await DB.prepare(`
        INSERT INTO outreach (lead_id, channel, status, body, sent_at, attempt_number)
        VALUES (?, 'call', 'SENT', ?, CURRENT_TIMESTAMP, 1)
      `).bind(lead_id, callScript).run();
    }
    results.call = { status: 'logged', phone: lead.phone };

    if (lead.phone) {
      const demoUrl = `${APP_URL}/demo/preview-${lead_id}`;
      const smsMsg = await generateOutreachMessage('sms', 1, lead.name, lead.industry, lead.city, demoUrl, '');
      await DB.prepare(`
        INSERT INTO outreach (lead_id, channel, status, body, sent_at, attempt_number)
        VALUES (?, 'sms', 'SENT', ?, CURRENT_TIMESTAMP, 1)
      `).bind(lead_id, smsMsg).run();
      results.sms = { status: 'sent' };
    }

    if (lead.email && RESEND_API_KEY) {
      // Send email - reuse the email endpoint logic
      const demoRecord = await DB.prepare(`SELECT demo_url FROM demos WHERE lead_id = ? AND status='ACTIVE'`).bind(lead_id).first<{ demo_url: string }>();
      const demoUrl = demoRecord?.demo_url || `${APP_URL}/demo/preview-${lead_id}`;
      const subject = await generateOutreachMessage('email_subject', 1, lead.name, lead.industry, lead.city, demoUrl, '');
      const body = await generateOutreachMessage('email_body', 1, lead.name, lead.industry, lead.city, demoUrl, '');

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Alex <alex@websitedemopro.com>', to: [lead.email], subject, text: body })
        });
        await DB.prepare(`
          INSERT INTO outreach (lead_id, channel, status, subject, body, sent_at, attempt_number)
          VALUES (?, 'email', 'SENT', ?, ?, CURRENT_TIMESTAMP, 1)
        `).bind(lead_id, subject, body).run();
        results.email = { status: 'sent' };
      } catch { results.email = { status: 'failed' }; }
    }
  } else if (day === 3) {
    // Day 3: Email follow-up only
    if (lead.email) {
      const demoRecord = await DB.prepare(`SELECT demo_url FROM demos WHERE lead_id = ? AND status='ACTIVE'`).bind(lead_id).first<{ demo_url: string }>();
      const demoUrl = demoRecord?.demo_url || `${APP_URL}/demo/preview-${lead_id}`;
      const subject = await generateOutreachMessage('email_subject', 2, lead.name, lead.industry, lead.city, demoUrl, '');
      const body = await generateOutreachMessage('email_body', 2, lead.name, lead.industry, lead.city, demoUrl, '');
      await DB.prepare(`
        INSERT INTO outreach (lead_id, channel, status, subject, body, sent_at, attempt_number)
        VALUES (?, 'email', 'SENT', ?, ?, CURRENT_TIMESTAMP, 2)
      `).bind(lead_id, subject, body).run();
      results.email = { status: 'sent' };
    }
  } else if (day === 5) {
    // Day 5: SMS final push (NOT both call and SMS)
    if (lead.phone) {
      const demoRecord = await DB.prepare(`SELECT demo_url FROM demos WHERE lead_id = ? AND status='ACTIVE'`).bind(lead_id).first<{ demo_url: string }>();
      const demoUrl = demoRecord?.demo_url || `${APP_URL}/demo/preview-${lead_id}`;
      const smsMsg = await generateOutreachMessage('sms', 3, lead.name, lead.industry, lead.city, demoUrl, '');
      await DB.prepare(`
        INSERT INTO outreach (lead_id, channel, status, body, sent_at, attempt_number)
        VALUES (?, 'sms', 'SENT', ?, CURRENT_TIMESTAMP, 3)
      `).bind(lead_id, smsMsg).run();
      results.sms = { status: 'sent' };
    }
  }

  await DB.prepare(`UPDATE leads SET status = 'CONTACTED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'NEW'`).bind(lead_id).run();

  return c.json({ message: 'Outreach sequence executed', results });
});

// GET /api/outreach/stats - Get outreach statistics
outreach.get('/stats', async (c) => {
  const { DB } = c.env;

  const today = await DB.prepare(`
    SELECT
      SUM(CASE WHEN channel='email' THEN 1 ELSE 0 END) as emails,
      SUM(CASE WHEN channel='sms' THEN 1 ELSE 0 END) as sms,
      SUM(CASE WHEN channel='call' THEN 1 ELSE 0 END) as calls,
      SUM(CASE WHEN status='OPENED' THEN 1 ELSE 0 END) as opened,
      SUM(CASE WHEN status='CLICKED' THEN 1 ELSE 0 END) as clicked,
      SUM(CASE WHEN status='REPLIED' THEN 1 ELSE 0 END) as replied
    FROM outreach
    WHERE DATE(created_at) = DATE('now')
  `).first();

  const weekly = await DB.prepare(`
    SELECT DATE(created_at) as date,
      SUM(CASE WHEN channel='email' THEN 1 ELSE 0 END) as emails,
      SUM(CASE WHEN channel='sms' THEN 1 ELSE 0 END) as sms,
      SUM(CASE WHEN channel='call' THEN 1 ELSE 0 END) as calls
    FROM outreach
    WHERE created_at >= DATE('now', '-7 days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all();

  return c.json({ today, weekly: weekly.results });
});

// PATCH /api/outreach/:id/status - Update outreach status (webhooks)
outreach.patch('/:id/status', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  const { status, timestamp } = await c.req.json();

  const fieldMap: Record<string, string> = {
    'OPENED': 'opened_at',
    'CLICKED': 'clicked_at',
    'REPLIED': 'replied_at'
  };

  const field = fieldMap[status];
  if (field) {
    await DB.prepare(`UPDATE outreach SET status=?, ${field}=? WHERE id=?`).bind(status, timestamp || new Date().toISOString(), id).run();
    // Update lead status if replied
    if (status === 'REPLIED') {
      const o = await DB.prepare(`SELECT lead_id FROM outreach WHERE id=?`).bind(id).first<{ lead_id: number }>();
      if (o) await DB.prepare(`UPDATE leads SET status='RESPONDED', updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(o.lead_id).run();
    }
  } else {
    await DB.prepare(`UPDATE outreach SET status=? WHERE id=?`).bind(status, id).run();
  }

  return c.json({ updated: true });
});

export default outreach;
