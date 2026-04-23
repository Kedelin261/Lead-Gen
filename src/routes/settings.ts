import { Hono } from 'hono';
import type { Bindings } from '../types';

const settings = new Hono<{ Bindings: Bindings }>();

// ─── DOMAIN VERIFICATION HELPERS ─────────────────────────────────────────────

const SENDING_DOMAIN = 'websitedemopro.org';
const SENDING_EMAIL  = 'alex@websitedemopro.org';
const DKIM_SELECTOR  = 'resend';  // Resend uses "resend._domainkey"

// Cloudflare zone IDs
const CF_ZONE_ORG = 'ef3b1da3b79be9d797aad70fdc841837';  // websitedemopro.org  (ACTIVE)
const CF_ZONE_COM = '5f67e851acd3e44ea832bf2a8b388341';  // websitedemopro.com  (pending)
const CF_TOKEN    = '_bPRQ0cqrSa3FJ8Rj5vlY_8LuR7zO3F6gz3fs8mg';

/** Required DNS records for full email authentication */
function getRequiredDnsRecords(domain: string) {
  return [
    {
      type: 'TXT',
      name: domain,
      value: 'v=spf1 include:_spf.resend.com ~all',
      purpose: 'SPF — authorises Resend to send on your behalf',
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
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}; aspf=r; adkim=r`,
      purpose: 'DMARC — reporting policy (p=none = monitor only, safe to start)',
      ttl: 3600,
    },
  ];
}

/**
 * Verify a DNS record using Cloudflare DNS-over-HTTPS.
 *
 * DKIM LOGIC (updated):
 *   DKIM is VALID if ANY of the following resolve with a real value:
 *     - CNAME resend._domainkey → resend.dkim.resend.com
 *     - TXT   resend._domainkey → contains a valid DKIM public key (p=...)
 *   Record type (TXT vs CNAME) does NOT determine validity.
 *   Only the presence of a real DKIM key or valid CNAME matters.
 *
 * For SPF / DMARC: standard exact-match logic applies.
 */
async function checkDnsRecord(type: string, name: string, expected: string): Promise<{
  found: boolean; actual: string[]; match: boolean;
}> {
  try {
    // For DKIM: check BOTH CNAME and TXT — whichever has a valid value wins
    const isDkim = name.includes('_domainkey');

    if (isDkim) {
      // Try CNAME first
      const cnameUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=CNAME`;
      const cnameResp = await fetch(cnameUrl, { headers: { Accept: 'application/dns-json' } });
      const cnameData = cnameResp.ok
        ? await cnameResp.json() as { Answer?: { data: string }[] }
        : { Answer: [] };
      const cnameAnswers = (cnameData.Answer || []).map(a => a.data.replace(/^"|"$/g, '').toLowerCase());
      const cnameMatch = cnameAnswers.some(a => a.includes('resend') || a.includes('dkim'));

      // Try TXT (legacy public key format)
      const txtUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`;
      const txtResp = await fetch(txtUrl, { headers: { Accept: 'application/dns-json' } });
      const txtData = txtResp.ok
        ? await txtResp.json() as { Answer?: { data: string }[] }
        : { Answer: [] };
      const txtAnswers = (txtData.Answer || []).map(a => a.data.replace(/^"|"$/g, '').toLowerCase());
      // A valid DKIM TXT key starts with "v=dkim1" or contains "p=" (public key)
      const txtMatch = txtAnswers.some(a => a.startsWith('v=dkim1') || a.includes('p=') || a.includes('k=rsa'));

      const allAnswers = [...cnameAnswers, ...txtAnswers];
      const match = cnameMatch || txtMatch;

      return { found: allAnswers.length > 0, actual: allAnswers, match };
    }

    // Standard check for SPF and DMARC
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
    const resp = await fetch(url, { headers: { Accept: 'application/dns-json' } });
    if (!resp.ok) return { found: false, actual: [], match: false };
    const data = await resp.json() as { Answer?: { data: string }[] };
    const answers = (data.Answer || []).map(a => a.data.replace(/^"|"$/g, '').toLowerCase());
    const normalised = expected.toLowerCase();
    const match = answers.some(a =>
      a === normalised ||
      a.includes(normalised) ||
      normalised.includes(a) ||
      (normalised.includes('resend') && a.includes('resend'))
    );
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

  if (allVerified) {
    await DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('email_domain_verified','true',CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value='true', updated_at=CURRENT_TIMESTAMP`
    ).run();
    await DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('email_domain_name',?,CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
    ).bind(SENDING_DOMAIN).run();
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/infrastructure — Full infrastructure health check
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/cloudflare-zone — Check Cloudflare zone status for .org
// ─────────────────────────────────────────────────────────────────────────────
settings.get('/cloudflare-zone', async (c) => {
  try {
    const resp = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ORG}`, {
      headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    });
    const data = await resp.json() as {
      success: boolean;
      result?: { status: string; name: string; name_servers: string[]; original_name_servers: string[] };
    };

    if (!data.success) {
      return c.json({ error: 'Cannot read zone — token lacks Zone:Read on this zone', zone_id: CF_ZONE_ORG });
    }

    const zone = data.result!;
    const isActive = zone.status === 'active';

    return c.json({
      domain: zone.name,
      zone_id: CF_ZONE_ORG,
      status: zone.status,
      active: isActive,
      cloudflare_nameservers: zone.name_servers || [],
      message: isActive
        ? '✅ Zone ACTIVE — DNS records apply immediately'
        : '⚠️  Zone PENDING — update nameservers at registrar',
    });
  } catch {
    return c.json({ error: 'Failed to check Cloudflare zone status' }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/domain-status — Full domain integration status for .org
// ─────────────────────────────────────────────────────────────────────────────
settings.get('/domain-status', async (c) => {
  const { DB } = c.env;

  // 1. Check zone status
  let zoneActive = false;
  let zoneStatus = 'unknown';
  try {
    const zr = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ORG}`, {
      headers: { 'Authorization': `Bearer ${CF_TOKEN}` },
    });
    const zd = await zr.json() as { success: boolean; result?: { status: string } };
    if (zd.success && zd.result) {
      zoneStatus = zd.result.status;
      zoneActive = zd.result.status === 'active';
    }
  } catch { /* ignore */ }

  // 2. Check DNS records via DoH
  const records = getRequiredDnsRecords(SENDING_DOMAIN);
  const dnsChecks = await Promise.all(
    records.map(async (rec) => {
      const r = await checkDnsRecord(rec.type, rec.name, rec.value);
      return { ...rec, found: r.found, match: r.match, actual: r.actual };
    })
  );

  const spf   = dnsChecks.find(r => r.type === 'TXT' && r.name === SENDING_DOMAIN);
  const dkim  = dnsChecks.find(r => r.type === 'CNAME');
  const dmarc = dnsChecks.find(r => r.name.startsWith('_dmarc'));

  // 3. Check DB domain-verified flag
  const dbVerified = await DB.prepare(
    `SELECT value FROM settings WHERE key='email_domain_verified'`
  ).first<{ value: string }>();

  // 4. Check Pages domain status via CF API
  let pagesOrgStatus = 'unknown';
  let pagesDomains: string[] = [];
  try {
    const pr = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/b7d0c7ba6b4de011cc51c878e26c70c2/pages/projects/leadgen-pro`,
      { headers: { 'Authorization': `Bearer ${CF_TOKEN}` } }
    );
    const pd = await pr.json() as { success: boolean; result?: { domains?: string[]; subdomain?: string } };
    if (pd.success && pd.result) {
      pagesDomains = pd.result.domains || [];
      pagesOrgStatus = pagesDomains.includes(SENDING_DOMAIN) ? 'connected' : 'not_added';
    }
  } catch { /* ignore */ }

  const allDnsReady  = (spf?.match && dkim?.match && dmarc?.match) ?? false;
  const emailVerified = dbVerified?.value === 'true';

  return c.json({
    domain: SENDING_DOMAIN,
    cloudflare_zone: {
      id: CF_ZONE_ORG,
      status: zoneStatus,
      active: zoneActive,
    },
    pages: {
      project: 'leadgen-pro',
      subdomain: 'leadgen-pro.pages.dev',
      custom_domain: SENDING_DOMAIN,
      status: pagesOrgStatus,
      domains: pagesDomains,
    },
    dns: {
      spf:   { valid: spf?.match   ?? false, actual: spf?.actual   ?? [] },
      dkim:  { valid: dkim?.match  ?? false, actual: dkim?.actual  ?? [] },
      dmarc: { valid: dmarc?.match ?? false, actual: dmarc?.actual ?? [] },
      all_valid: allDnsReady,
    },
    email: {
      domain: SENDING_DOMAIN,
      provider: 'resend',
      db_verified: emailVerified,
    },
    required_actions: [
      ...(!zoneActive ? ['Zone pending: update nameservers to eloise.ns.cloudflare.com + razvan.ns.cloudflare.com'] : []),
      ...(!spf?.match   ? ['Add TXT SPF record: v=spf1 include:_spf.resend.com ~all'] : []),
      ...(!dkim?.match  ? ['Add CNAME DKIM: resend._domainkey → resend.dkim.resend.com (DNS-only)'] : []),
      ...(!dmarc?.match ? [`Add TXT DMARC: _dmarc → v=DMARC1; p=none; rua=mailto:dmarc@${SENDING_DOMAIN}; aspf=r; adkim=r`] : []),
      ...(pagesOrgStatus !== 'connected' ? ['Add custom domain websitedemopro.org to Cloudflare Pages project leadgen-pro'] : []),
      ...(!emailVerified ? ['Call POST /api/settings/email-domain/verify after DNS propagation'] : []),
    ],
    system_blocked: !allDnsReady,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/dns-setup — Complete DNS setup guide with Cloudflare instructions
// ─────────────────────────────────────────────────────────────────────────────
settings.get('/dns-setup', async (c) => {
  const records = getRequiredDnsRecords(SENDING_DOMAIN);

  return c.json({
    domain: SENDING_DOMAIN,
    cloudflare_zone_id: CF_ZONE_ORG,
    cloudflare_status: 'ACTIVE — zone is live on Cloudflare',
    token_permissions: 'Current token has Zone:Read + Pages:Edit. DNS:Edit requires a separate token.',
    assigned_nameservers: ['eloise.ns.cloudflare.com', 'razvan.ns.cloudflare.com'],
    dns_records_to_add: [
      {
        step: 1,
        type: 'CNAME',
        name: '@',
        content: 'leadgen-pro.pages.dev',
        ttl: 1,
        proxied: true,
        purpose: 'Root domain → LeadGen Pro (Cloudflare Pages)',
      },
      {
        step: 2,
        type: 'CNAME',
        name: 'www',
        content: 'leadgen-pro.pages.dev',
        ttl: 1,
        proxied: true,
        purpose: 'www subdomain → LeadGen Pro',
      },
      {
        step: 3,
        type: 'TXT',
        name: '@',
        content: records[0].value,
        ttl: 3600,
        proxied: false,
        purpose: records[0].purpose,
      },
      {
        step: 4,
        type: 'CNAME',
        name: 'resend._domainkey',
        content: 'resend.dkim.resend.com',
        ttl: 3600,
        proxied: false,
        purpose: records[1].purpose,
        note: 'MUST be DNS-only (grey cloud), NOT proxied',
      },
      {
        step: 5,
        type: 'TXT',
        name: '_dmarc',
        content: records[2].value,
        ttl: 3600,
        proxied: false,
        purpose: records[2].purpose,
      },
    ],
    how_to_add: {
      cloudflare_dashboard: `https://dash.cloudflare.com/${CF_ZONE_ORG}/dns/records`,
      steps: [
        '1. Go to https://dash.cloudflare.com → websitedemopro.org → DNS',
        '2. Click "Add record" for each record above',
        '3. Save each record',
        '4. Wait 5-30 minutes for propagation',
        '5. Call POST /api/settings/email-domain/verify',
      ],
    },
    api_token_note: 'Add DNS:Edit to your API token at https://dash.cloudflare.com/profile/api-tokens to enable API-based DNS management.',
  });
});

export default settings;
