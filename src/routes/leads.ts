import { Hono } from 'hono';
import type { Bindings } from '../types';
import { calculateLeadScore, classifyWebsiteStatus } from '../lib/scoring';
import { checkLeadCreationLimit, checkCityNicheLock } from '../lib/validation-engine';

const leads = new Hono<{ Bindings: Bindings }>();

// GET /api/leads - List leads with filters
leads.get('/', async (c) => {
  const { DB } = c.env;
  const { status, industry, city, search, limit = '50', offset = '0', min_score } = c.req.query();

  let query = `SELECT l.*, d.demo_url, d.id as demo_id,
    (SELECT sent_at FROM outreach WHERE lead_id = l.id ORDER BY sent_at DESC LIMIT 1) as last_contacted
    FROM leads l
    LEFT JOIN demos d ON d.lead_id = l.id AND d.status = 'ACTIVE'
    WHERE 1=1`;
  const params: (string | number)[] = [];

  if (status) { query += ` AND l.status = ?`; params.push(status); }
  if (industry) { query += ` AND l.industry LIKE ?`; params.push(`%${industry}%`); }
  if (city) { query += ` AND l.city LIKE ?`; params.push(`%${city}%`); }
  if (search) { query += ` AND (l.name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (min_score) { query += ` AND l.lead_score >= ?`; params.push(Number(min_score)); }

  query += ` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const result = await DB.prepare(query).bind(...params).all();
  
  // Total count
  let countQuery = `SELECT COUNT(*) as total FROM leads l WHERE 1=1`;
  const countParams: (string | number)[] = [];
  if (status) { countQuery += ` AND l.status = ?`; countParams.push(status); }
  if (industry) { countQuery += ` AND l.industry LIKE ?`; countParams.push(`%${industry}%`); }
  if (city) { countQuery += ` AND l.city LIKE ?`; countParams.push(`%${city}%`); }
  if (search) { countQuery += ` AND (l.name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)`; countParams.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (min_score) { countQuery += ` AND l.lead_score >= ?`; countParams.push(Number(min_score)); }
  
  const countResult = await DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();

  return c.json({ leads: result.results, total: countResult?.total || 0 });
});

// GET /api/leads/:id - Get single lead with full details
leads.get('/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');

  const lead = await DB.prepare(`
    SELECT l.*, d.demo_url, d.id as demo_id, d.viewed, d.view_count, d.headline
    FROM leads l
    LEFT JOIN demos d ON d.lead_id = l.id AND d.status = 'ACTIVE'
    WHERE l.id = ?
  `).bind(id).first();

  if (!lead) return c.json({ error: 'Lead not found' }, 404);

  const outreachHistory = await DB.prepare(
    `SELECT * FROM outreach WHERE lead_id = ? ORDER BY created_at DESC`
  ).bind(id).all();

  const conversations = await DB.prepare(
    `SELECT * FROM conversations WHERE lead_id = ? ORDER BY created_at DESC LIMIT 20`
  ).bind(id).all();

  const payment = await DB.prepare(
    `SELECT * FROM payments WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(id).first();

  return c.json({ lead, outreach: outreachHistory.results, conversations: conversations.results, payment });
});

// POST /api/leads - Create new lead
leads.post('/', async (c) => {
  const { DB } = c.env;
  const body = await c.req.json();
  const { name, phone, email, address, industry, city, state, website, source = 'manual', notes } = body;

  if (!name) return c.json({ error: 'Name is required' }, 400);

  // ── VALIDATION MODE: Daily lead cap ──────────────────────────────────────
  const leadLimit = await checkLeadCreationLimit(DB);
  if (!leadLimit.allowed) {
    return c.json({
      error: leadLimit.errors[0] || 'Lead creation blocked by validation mode',
      blocked_by: leadLimit.blocked_by,
    }, 403);
  }

  // ── VALIDATION MODE: City/niche lock ─────────────────────────────────────
  if (city && industry) {
    const lockCheck = await checkCityNicheLock(DB, city, industry);
    if (!lockCheck.allowed) {
      return c.json({
        error: lockCheck.errors[0] || 'Multi-city/niche blocked in validation mode',
        blocked_by: lockCheck.blocked_by,
        errors: lockCheck.errors,
      }, 403);
    }
  }

  // DUPLICATE PREVENTION: check by phone OR email
  if (phone || email) {
    let dupQuery = `SELECT id, name, status FROM leads WHERE `;
    const dupParams: string[] = [];
    const dupClauses: string[] = [];
    if (phone) { dupClauses.push(`phone = ?`); dupParams.push(phone); }
    if (email) { dupClauses.push(`email = ?`); dupParams.push(email); }
    dupQuery += dupClauses.join(' OR ') + ' LIMIT 1';
    const existing = await DB.prepare(dupQuery).bind(...dupParams).first<{ id: number; name: string; status: string }>();
    if (existing) {
      return c.json({
        error: 'Duplicate lead detected',
        existing_lead: existing,
        message: `A lead with this phone/email already exists (ID=${existing.id}, Status=${existing.status})`
      }, 409);
    }
  }

  const websiteStatus = classifyWebsiteStatus(website);
  const score = calculateLeadScore({
    website_status: websiteStatus,
    has_phone: !!phone,
    has_email: !!email,
    is_active: true,
    industry: industry || '',
    is_facebook_only: website?.toLowerCase().includes('facebook')
  });

  const result = await DB.prepare(`
    INSERT INTO leads (name, phone, email, address, industry, city, state, website, website_status, lead_score, source, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(name, phone || null, email || null, address || null, industry || null, city || null, state || null, website || null, websiteStatus, score, source, notes || null).run();

  const lead = await DB.prepare(`SELECT * FROM leads WHERE id = ?`).bind(result.meta.last_row_id).first();
  return c.json({ lead, message: 'Lead created successfully' }, 201);
});

// PATCH /api/leads/:id - Update lead
leads.patch('/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  const body = await c.req.json();

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  const allowed = ['name','phone','email','address','industry','city','state','website','status','notes','lead_score'];
  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  await DB.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  const lead = await DB.prepare(`SELECT * FROM leads WHERE id = ?`).bind(id).first();

  return c.json({ lead });
});

// DELETE /api/leads/:id
leads.delete('/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  await DB.prepare(`UPDATE leads SET status = 'LOST' WHERE id = ?`).bind(id).run();
  return c.json({ message: 'Lead removed from pipeline' });
});

// POST /api/leads/bulk - Bulk import leads
leads.post('/bulk', async (c) => {
  const { DB } = c.env;
  const { leads: leadsData } = await c.req.json();

  if (!Array.isArray(leadsData)) return c.json({ error: 'Expected array of leads' }, 400);

  let created = 0;
  let skipped = 0;

  for (const lead of leadsData.slice(0, 200)) {
    const { name, phone, email, address, industry, city, state, website } = lead;
    if (!name || (!phone && !email)) { skipped++; continue; }

    const websiteStatus = classifyWebsiteStatus(website);
    const score = calculateLeadScore({
      website_status: websiteStatus,
      has_phone: !!phone,
      has_email: !!email,
      is_active: true,
      industry: industry || '',
      is_facebook_only: website?.toLowerCase().includes('facebook')
    });

    if (score < 60) { skipped++; continue; }

    try {
      await DB.prepare(`
        INSERT OR IGNORE INTO leads (name, phone, email, address, industry, city, state, website, website_status, lead_score, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bulk_import')
      `).bind(name, phone || null, email || null, address || null, industry || null, city || null, state || null, website || null, websiteStatus, score).run();
      created++;
    } catch {
      skipped++;
    }
  }

  return c.json({ created, skipped, message: `Imported ${created} leads` });
});

// GET /api/leads/stats/pipeline
leads.get('/stats/pipeline', async (c) => {
  const { DB } = c.env;
  const result = await DB.prepare(`
    SELECT status, COUNT(*) as count FROM leads GROUP BY status
  `).all();
  return c.json({ pipeline: result.results });
});

export default leads;
