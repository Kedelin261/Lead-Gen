import { Hono } from 'hono';
import type { Bindings } from '../types';
import { generateDemoContent } from '../lib/ai';
import { generateDemoHTML } from '../lib/demo-generator';

const demos = new Hono<{ Bindings: Bindings }>();

// GET /api/demos - List all demos
demos.get('/', async (c) => {
  const { DB } = c.env;
  const { limit = '50', offset = '0' } = c.req.query();

  const result = await DB.prepare(`
    SELECT d.*, l.name as business_name, l.industry, l.city, l.state, l.phone, l.email
    FROM demos d
    JOIN leads l ON l.id = d.lead_id
    ORDER BY d.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(Number(limit), Number(offset)).all();

  const total = await DB.prepare(`SELECT COUNT(*) as total FROM demos`).first<{ total: number }>();
  return c.json({ demos: result.results, total: total?.total || 0 });
});

// GET /api/demos/:id - Get demo
demos.get('/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');

  const demo = await DB.prepare(`
    SELECT d.*, l.name as business_name, l.industry, l.city, l.state, l.phone, l.email, l.address
    FROM demos d
    JOIN leads l ON l.id = d.lead_id
    WHERE d.id = ?
  `).bind(id).first();

  if (!demo) return c.json({ error: 'Demo not found' }, 404);
  return c.json({ demo });
});

// POST /api/demos/generate - Generate demo for a lead
demos.post('/generate', async (c) => {
  const { DB, OPENAI_API_KEY, APP_URL } = c.env;
  const { lead_id } = await c.req.json();

  if (!lead_id) return c.json({ error: 'lead_id required' }, 400);

  const lead = await DB.prepare(`SELECT * FROM leads WHERE id = ?`).bind(lead_id).first<{
    id: number; name: string; industry: string; city: string; state: string;
    phone: string; email: string; address: string;
  }>();
  if (!lead) return c.json({ error: 'Lead not found' }, 404);

  // Check for existing demo
  const existing = await DB.prepare(`SELECT * FROM demos WHERE lead_id = ? AND status = 'ACTIVE'`).bind(lead_id).first<{
    id: number; headline: string; subheadline: string; services: string;
    about_text: string; cta_text: string; demo_url: string; status: string;
  }>();
  if (existing) {
    return c.json({
      demo: existing,
      demo_id: existing.id,
      headline: existing.headline,
      message: 'Demo already exists',
      status: 'existing'
    }, 200);
  }

  try {
    const content = await generateDemoContent(
      lead.name,
      lead.industry || 'local services',
      lead.city || 'your city',
      lead.state || '',
      OPENAI_API_KEY
    );

    // Insert demo record first
    const demoResult = await DB.prepare(`
      INSERT INTO demos (lead_id, headline, subheadline, services, about_text, cta_text, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).bind(
      lead_id,
      content.headline,
      content.subheadline,
      JSON.stringify(content.services),
      content.about_text,
      content.cta_text
    ).run();

    const demoId = demoResult.meta.last_row_id;
    const slug = `${lead.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(lead.city || 'city').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const demoUrl = `${APP_URL}/demo/${slug}-${demoId}`;

    // Update with URL
    await DB.prepare(`UPDATE demos SET demo_url = ? WHERE id = ?`).bind(demoUrl, demoId).run();

    const demo = await DB.prepare(`SELECT * FROM demos WHERE id = ?`).bind(demoId).first();
    return c.json({ demo, content, message: 'Demo generated successfully' }, 201);
  } catch (error) {
    // Log the error and insert a failed demo record for retry tracking
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Demo Generation Error] lead_id=${lead_id}: ${errorMsg}`);

    // Insert a FAILED record so the system can retry
    try {
      await DB.prepare(`
        INSERT INTO demos (lead_id, headline, subheadline, services, about_text, cta_text, status)
        VALUES (?, 'GENERATION_FAILED', '', '[]', ?, '', 'FAILED')
      `).bind(
        lead_id,
        `Error: ${errorMsg.substring(0, 200)}`
      ).run();
    } catch { /* ignore insert error */ }

    return c.json({
      error: 'Demo generation failed',
      details: errorMsg,
      lead_id,
      retry_available: true,
      message: 'Error logged. Use /api/demos/:id/regenerate to retry after resolving the underlying issue.'
    }, 500);
  }
});

// GET /demo/:slug - Serve demo website (public)
demos.get('/view/:slug', async (c) => {
  const { DB, APP_URL } = c.env;
  const slug = c.req.param('slug');

  // Extract ID from slug (last part after last -)
  const parts = slug.split('-');
  const id = parts[parts.length - 1];

  const demo = await DB.prepare(`
    SELECT d.*, l.name as business_name, l.industry, l.city, l.state, l.phone, l.email, l.address
    FROM demos d
    JOIN leads l ON l.id = d.lead_id
    WHERE d.id = ?
  `).bind(id).first<{
    id: number; lead_id: number; headline: string; subheadline: string;
    services: string; about_text: string; cta_text: string;
    business_name: string; industry: string; city: string; state: string;
    phone: string; email: string; address: string;
  }>();

  if (!demo) return c.notFound();

  // Track view
  await DB.prepare(`
    UPDATE demos SET view_count = view_count + 1, viewed = 1, last_viewed = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(demo.id).run();

  let services: { name: string; description: string }[] = [];
  try { services = JSON.parse(demo.services || '[]'); } catch { /* ignore */ }

  const content = {
    headline: demo.headline || `Professional ${demo.industry} Services`,
    subheadline: demo.subheadline || `Trusted by customers in ${demo.city}`,
    services,
    about_text: demo.about_text || `${demo.business_name} provides professional services in ${demo.city}.`,
    cta_text: demo.cta_text || 'Get a Free Quote Today',
    testimonials: [
      { name: 'John M.', text: `Best ${demo.industry} service in ${demo.city}!`, rating: 5 },
      { name: 'Sarah K.', text: 'Professional, on-time, and great quality work.', rating: 5 },
      { name: 'Mike T.', text: 'Highly recommend to anyone in the area!', rating: 5 }
    ],
    meta_description: `${demo.business_name} - Professional ${demo.industry} services in ${demo.city}, ${demo.state}`
  };

  const html = generateDemoHTML(
    demo.business_name, demo.industry || 'services', demo.city || '', demo.state || '',
    demo.phone, demo.email, demo.address, content, String(demo.id), APP_URL
  );

  return c.html(html);
});

// POST /api/demos/:id/track - Track demo view
demos.post('/:id/track', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  await DB.prepare(`
    UPDATE demos SET view_count = view_count + 1, viewed = 1, last_viewed = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(id).run();

  // Update lead status if first view
  const demo = await DB.prepare(`SELECT lead_id FROM demos WHERE id = ?`).bind(id).first<{ lead_id: number }>();
  if (demo) {
    await DB.prepare(`
      UPDATE leads SET status = 'RESPONDED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status IN ('NEW', 'CONTACTED')
    `).bind(demo.lead_id).run();
  }

  return c.json({ tracked: true });
});

// GET /api/demos/:id/track - Tracking pixel
demos.get('/:id/track', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  await DB.prepare(`
    UPDATE demos SET view_count = view_count + 1, viewed = 1, last_viewed = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(id).run();

  // Return 1x1 transparent GIF
  const gif = new Uint8Array([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,1,68,0,59]);
  return new Response(gif, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-cache' } });
});

// DELETE /api/demos/:id
demos.delete('/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  await DB.prepare(`UPDATE demos SET status = 'DELETED' WHERE id = ?`).bind(id).run();
  return c.json({ message: 'Demo deleted' });
});

// POST /api/demos/:id/regenerate
demos.post('/:id/regenerate', async (c) => {
  const { DB, OPENAI_API_KEY, APP_URL } = c.env;
  const id = c.req.param('id');

  const demo = await DB.prepare(`
    SELECT d.*, l.name as business_name, l.industry, l.city, l.state
    FROM demos d JOIN leads l ON l.id = d.lead_id
    WHERE d.id = ?
  `).bind(id).first<{
    lead_id: number; business_name: string; industry: string; city: string; state: string;
  }>();
  if (!demo) return c.json({ error: 'Demo not found' }, 404);

  try {
    const content = await generateDemoContent(
      demo.business_name, demo.industry || 'services', demo.city || '', demo.state || '', OPENAI_API_KEY
    );

    await DB.prepare(`
      UPDATE demos SET headline=?, subheadline=?, services=?, about_text=?, cta_text=? WHERE id=?
    `).bind(content.headline, content.subheadline, JSON.stringify(content.services), content.about_text, content.cta_text, id).run();

    return c.json({ message: 'Demo regenerated', content });
  } catch (error) {
    return c.json({ error: `Regeneration failed: ${error}` }, 500);
  }
});

export default demos;
