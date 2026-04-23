import { Hono } from 'hono';
import type { Bindings } from '../types';

const settings = new Hono<{ Bindings: Bindings }>();

// GET /api/settings - Get all settings
settings.get('/', async (c) => {
  const { DB } = c.env;
  const result = await DB.prepare(`SELECT key, value FROM settings`).all();
  const settingsMap: Record<string, string> = {};
  for (const row of (result.results as { key: string; value: string }[])) {
    settingsMap[row.key] = row.value;
  }
  return c.json({ settings: settingsMap });
});

// PATCH /api/settings - Update settings
settings.patch('/', async (c) => {
  const { DB } = c.env;
  const updates = await c.req.json() as Record<string, string>;

  for (const [key, value] of Object.entries(updates)) {
    await DB.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).bind(key, String(value)).run();
  }

  return c.json({ message: 'Settings updated', updated: Object.keys(updates) });
});

// GET /api/settings/industries - Get target industries
settings.get('/industries', async (c) => {
  const { DB } = c.env;
  const result = await DB.prepare(`SELECT value FROM settings WHERE key='target_industries'`).first<{ value: string }>();
  try {
    return c.json({ industries: JSON.parse(result?.value || '[]') });
  } catch {
    return c.json({ industries: [] });
  }
});

export default settings;
