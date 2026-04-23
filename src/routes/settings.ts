import { Hono } from 'hono';
import type { Bindings } from '../types';

const settings = new Hono<{ Bindings: Bindings }>();

// ─── DOMAIN VERIFICATION HELPERS ─────────────────────────────────────────────

const SENDING_DOMAIN = 'websitedemopro.com';
const SENDING_EMAIL  = 'alex@websitedemopro.com';
const DKIM_SELECTOR  = 'resend';  // Resend uses "resend._domainkey"

/** Required DNS records for full email authentication */
function getRequiredDnsRecords(domain: string) {
  return [
    {
      type: 'TXT',
      name: domain,
      value: 'v=spf1 include:amazonses.com ~all',
      purpose: 'SPF — authorises Resend/SES to send on your behalf',
      ttl: 3600,
    },
    {
      type: 'CNAME',
      name: `${DKIM_SELECTOR}._domainkey.${domain}`,
      value: `${DKIM_SELECTOR}.dkim.resend.com`,
      purpose: 'DKIM — cryptographic signature for every outbound email',
      ttl: 3600,
    },
    {
      type: 'TXT',
      name: `_dmarc.${domain}`,
      value: 'v=DMARC1; p=none; rua=mailto:dmarc@websitedemopro.com; aspf=r; adkim=r',
      purpose: 'DMARC — reporting policy (p=none = monitor only, safe to start)',
      ttl: 3600,
    },
  ];
}

/**
 * Verify a single DNS record using Cloudflare DNS-over-HTTPS (1.1.1.1).
 * Works inside Cloudflare Workers — no Node DNS module needed.
 */
async function checkDnsRecord(type: string, name: string, expected: string): Promise<{
  found: boolean; actual: string[]; match: boolean;
}> {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
    const resp = await fetch(url, { headers: { Accept: 'application/dns-json' } });
    if (!resp.ok) return { found: false, actual: [], match: false };
    const data = await resp.json() as { Answer?: { data: string }[] };
    const answers = (data.Answer || []).map(a => a.data.replace(/^"|"$/g, '').toLowerCase());
    const normalised = expected.toLowerCase();
    const match = answers.some(a => a === normalised || a.includes(normalised) || normalised.includes(a));
    return { found: answers.length > 0, actual: answers, match };
  } catch {
    return { found: false, actual: [], match: false };
  }
}

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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/email-domain — Return required DNS records + current status
// ─────────────────────────────────────────────────────────────────────────────
settings.get('/email-domain', async (c) => {
  const { DB } = c.env;

  const verified = await DB.prepare(
    `SELECT value FROM settings WHERE key='email_domain_verified'`
  ).first<{ value: string }>();

  const records = getRequiredDnsRecords(SENDING_DOMAIN);

  return c.json({
    domain: SENDING_DOMAIN,
    sending_email: SENDING_EMAIL,
    verified: verified?.value === 'true',
    required_dns_records: records,
    instructions: [
      `1. Log in to your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.)`,
      `2. Add each record below to ${SENDING_DOMAIN}`,
      `3. Wait 5–30 minutes for DNS propagation`,
      `4. Call POST /api/settings/email-domain/verify to confirm`,
      `5. Once verified, email outreach will be unblocked automatically`,
    ],
    note: 'Resend API key is send-only — domain records must be added manually in your DNS provider.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/email-domain/verify — Check DNS & mark domain verified
// ─────────────────────────────────────────────────────────────────────────────
settings.post('/email-domain/verify', async (c) => {
  const { DB } = c.env;
  const records = getRequiredDnsRecords(SENDING_DOMAIN);

  const checks = await Promise.all(
    records.map(async (rec) => {
      const result = await checkDnsRecord(rec.type, rec.name, rec.value);
      return {
        type: rec.type,
        name: rec.name,
        expected: rec.value,
        purpose: rec.purpose,
        found: result.found,
        match: result.match,
        actual: result.actual,
        status: result.match ? 'VERIFIED' : result.found ? 'WRONG_VALUE' : 'MISSING',
      };
    })
  );

  const allVerified = checks.every(c => c.match);
  const anyFound    = checks.some(c => c.found);

  // Mark domain verified in DB if all records pass
  if (allVerified) {
    await DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('email_domain_verified','true',CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value='true', updated_at=CURRENT_TIMESTAMP`
    ).run();
    await DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('email_domain_name',?,CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
    ).bind(SENDING_DOMAIN).run();

    // Remove DOMAIN_NOT_VERIFIED flag if present
    await DB.prepare(
      `DELETE FROM validation_flags WHERE flag='DOMAIN_NOT_VERIFIED'`
    ).run().catch(() => null);
  }

  const missing  = checks.filter(c => c.status === 'MISSING').map(c => c.type + ' ' + c.name);
  const wrong    = checks.filter(c => c.status === 'WRONG_VALUE').map(c => c.type + ' ' + c.name);

  return c.json({
    domain: SENDING_DOMAIN,
    verified: allVerified,
    status: allVerified ? 'VERIFIED' : anyFound ? 'PARTIAL' : 'NOT_CONFIGURED',
    checks,
    missing_records: missing,
    wrong_records: wrong,
    message: allVerified
      ? `✅ Domain ${SENDING_DOMAIN} fully verified — email outreach unblocked`
      : `❌ ${missing.length + wrong.length} record(s) not yet correct. Add DNS records then retry.`,
    next_step: allVerified
      ? 'Email outreach is now active. Monitor inbox placement with Test A.'
      : `Add the DNS records below to ${SENDING_DOMAIN} then call this endpoint again.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/email-domain/override — Force-verify for testing / manual confirmation
//   Body: { confirmed: true, reason: "DNS verified via provider UI" }
// ─────────────────────────────────────────────────────────────────────────────
settings.post('/email-domain/override', async (c) => {
  const { DB } = c.env;
  const { confirmed, reason } = await c.req.json() as { confirmed?: boolean; reason?: string };

  if (!confirmed) {
    return c.json({ error: 'Must pass confirmed:true to override domain verification' }, 400);
  }

  await DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES ('email_domain_verified','true',CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value='true', updated_at=CURRENT_TIMESTAMP`
  ).run();
  await DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES ('email_domain_name',?,CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
  ).bind(SENDING_DOMAIN).run();
  await DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES ('email_domain_override_reason',?,CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
  ).bind(reason || 'Manual override').run();
  await DB.prepare(
    `DELETE FROM validation_flags WHERE flag='DOMAIN_NOT_VERIFIED'`
  ).run().catch(() => null);

  return c.json({
    domain: SENDING_DOMAIN,
    verified: true,
    override: true,
    reason: reason || 'Manual override',
    message: `✅ Domain ${SENDING_DOMAIN} marked as verified (manual override). Email outreach unblocked.`,
    warning: 'Ensure DNS records are actually in place before sending live outreach.',
  });
});

// GET /api/settings/infrastructure — Full infrastructure health check
settings.get('/infrastructure', async (c) => {
  const { DB, RESEND_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
          STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, OPENAI_API_KEY } = c.env;

  const domainVerified = await DB.prepare(
    `SELECT value FROM settings WHERE key='email_domain_verified'`
  ).first<{ value: string }>();

  const checks = {
    openai_api_key:        { present: !!OPENAI_API_KEY,        value: OPENAI_API_KEY ? `${OPENAI_API_KEY.slice(0,8)}...` : 'MISSING' },
    resend_api_key:        { present: !!RESEND_API_KEY,        value: RESEND_API_KEY ? `${RESEND_API_KEY.slice(0,8)}...` : 'MISSING' },
    email_domain_verified: { present: domainVerified?.value === 'true', value: domainVerified?.value || 'false' },
    twilio_account_sid:    { present: !!TWILIO_ACCOUNT_SID,    value: TWILIO_ACCOUNT_SID ? `${TWILIO_ACCOUNT_SID.slice(0,6)}...` : 'MISSING' },
    twilio_auth_token:     { present: !!TWILIO_AUTH_TOKEN,     value: TWILIO_AUTH_TOKEN ? '***configured***' : 'MISSING' },
    stripe_secret_key:     { present: !!STRIPE_SECRET_KEY,     value: STRIPE_SECRET_KEY ? `${STRIPE_SECRET_KEY.slice(0,8)}...` : 'MISSING' },
    stripe_webhook_secret: { present: !!STRIPE_WEBHOOK_SECRET, value: STRIPE_WEBHOOK_SECRET ? `${STRIPE_WEBHOOK_SECRET.slice(0,10)}...` : 'MISSING' },
  };

  const allPresent = Object.values(checks).every(c => c.present);
  const missing = Object.entries(checks).filter(([, v]) => !v.present).map(([k]) => k);
  const blockers = [];
  if (!checks.email_domain_verified.present) blockers.push('EMAIL_DOMAIN_NOT_VERIFIED — email outreach blocked');
  if (!checks.stripe_webhook_secret.present) blockers.push('STRIPE_WEBHOOK_SECRET missing — payment processing unsafe');
  if (!checks.twilio_account_sid.present)    blockers.push('TWILIO not configured — SMS/call outreach blocked');

  return c.json({
    production_ready: allPresent && blockers.length === 0,
    all_secrets_present: allPresent,
    checks,
    missing_secrets: missing,
    blocking_issues: blockers,
    timestamp: new Date().toISOString(),
  });
});

export default settings;
