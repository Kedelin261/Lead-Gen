import { Hono } from 'hono';
import type { Bindings } from '../types';

const conversations = new Hono<{ Bindings: Bindings }>();

// GET /api/conversations - Unified inbox
conversations.get('/', async (c) => {
  const { DB } = c.env;
  const { lead_id, unread_only, channel } = c.req.query();

  let query = `
    SELECT c.*, l.name as business_name, l.phone, l.email, l.status as lead_status
    FROM conversations c
    JOIN leads l ON l.id = c.lead_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (lead_id) { query += ` AND c.lead_id = ?`; params.push(lead_id); }
  if (unread_only === 'true') { query += ` AND c.read = 0`; }
  if (channel) { query += ` AND c.channel = ?`; params.push(channel); }

  query += ` ORDER BY c.created_at DESC LIMIT 100`;

  const result = await DB.prepare(query).bind(...params).all();

  // Group by lead
  const byLead: Record<number, { lead: Record<string, unknown>; messages: unknown[] }> = {};
  for (const msg of (result.results as Record<string, unknown>[])) {
    const leadId = msg.lead_id as number;
    if (!byLead[leadId]) {
      byLead[leadId] = {
        lead: {
          id: leadId,
          name: msg.business_name,
          phone: msg.phone,
          email: msg.email,
          status: msg.lead_status
        },
        messages: []
      };
    }
    byLead[leadId].messages.push(msg);
  }

  const unreadCount = await DB.prepare(`SELECT COUNT(*) as count FROM conversations WHERE read=0 AND direction='inbound'`).first<{ count: number }>();

  return c.json({
    conversations: result.results,
    threads: Object.values(byLead),
    unread_count: unreadCount?.count || 0
  });
});

// POST /api/conversations - Add message
conversations.post('/', async (c) => {
  const { DB } = c.env;
  const { lead_id, channel, direction, message, from_number, to_number } = await c.req.json();

  if (!lead_id || !message) return c.json({ error: 'lead_id and message required' }, 400);

  await DB.prepare(`
    INSERT INTO conversations (lead_id, channel, direction, message, from_number, to_number)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(lead_id, channel || 'sms', direction || 'inbound', message, from_number || null, to_number || null).run();

  // Mark lead as responded if inbound
  if (direction === 'inbound') {
    await DB.prepare(`UPDATE leads SET status='RESPONDED', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('NEW','CONTACTED')`).bind(lead_id).run();
  }

  return c.json({ message: 'Conversation logged' }, 201);
});

// POST /api/conversations/:lead_id/mark-read
conversations.post('/:lead_id/mark-read', async (c) => {
  const { DB } = c.env;
  const leadId = c.req.param('lead_id');
  await DB.prepare(`UPDATE conversations SET read=1 WHERE lead_id=?`).bind(leadId).run();
  return c.json({ marked: true });
});

// POST /api/conversations/webhook/sms - Twilio SMS webhook
conversations.post('/webhook/sms', async (c) => {
  const { DB } = c.env;
  const body = await c.req.parseBody();
  const from = body.From as string;
  const to = body.To as string;
  const msgBody = body.Body as string;

  if (!from || !msgBody) return c.text('', 200);

  // Normalize phone: strip all non-digits for DB comparison
  const normalizePhone = (p: string) => p.replace(/\D/g, '');
  const fromDigits = normalizePhone(from);

  // Handle OPT-OUT
  if (msgBody.trim().toUpperCase() === 'STOP') {
    // Match by normalized digits (last 10 digits)
    const last10 = fromDigits.slice(-10);
    await DB.prepare(`
      UPDATE leads SET status='LOST', notes='Opted out via SMS'
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'(',''),')',''),'+','') LIKE ?
    `).bind(`%${last10}`).run();
    return c.text('<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been unsubscribed. Reply START to resubscribe.</Message></Response>', 200, { 'Content-Type': 'text/xml' });
  }

  // Find lead by phone (normalized match — last 10 digits)
  const last10 = fromDigits.slice(-10);
  const lead = await DB.prepare(`
    SELECT * FROM leads
    WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'(',''),')',''),'+','') LIKE ?
    LIMIT 1
  `).bind(`%${last10}`).first<{ id: number }>();

  if (lead) {
    await DB.prepare(`
      INSERT INTO conversations (lead_id, channel, direction, message, from_number, to_number)
      VALUES (?, 'sms', 'inbound', ?, ?, ?)
    `).bind(lead.id, msgBody, from, to).run();

    await DB.prepare(`UPDATE leads SET status='RESPONDED', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('NEW','CONTACTED')`).bind(lead.id).run();
  }

  return c.text('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, { 'Content-Type': 'text/xml' });
});

// GET /api/conversations/unread-count
conversations.get('/unread-count', async (c) => {
  const { DB } = c.env;
  const count = await DB.prepare(`SELECT COUNT(*) as count FROM conversations WHERE read=0 AND direction='inbound'`).first<{ count: number }>();
  return c.json({ count: count?.count || 0 });
});

export default conversations;
