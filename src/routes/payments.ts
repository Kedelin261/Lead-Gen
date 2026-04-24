import { Hono } from 'hono';
import type { Bindings } from '../types';

const payments = new Hono<{ Bindings: Bindings }>();

// GET /api/payments - List payments
payments.get('/', async (c) => {
  const { DB } = c.env;

  const result = await DB.prepare(`
    SELECT p.*, l.name as business_name, l.city, l.industry
    FROM payments p
    JOIN leads l ON l.id = p.lead_id
    ORDER BY p.created_at DESC
    LIMIT 100
  `).all();

  const stats = await DB.prepare(`
    SELECT
      SUM(CASE WHEN status='PAID' THEN amount ELSE 0 END) / 100.0 as total_revenue,
      SUM(CASE WHEN status='PAID' AND DATE(paid_at) = DATE('now') THEN amount ELSE 0 END) / 100.0 as today_revenue,
      COUNT(CASE WHEN status='PAID' THEN 1 END) as total_paid,
      COUNT(CASE WHEN status='PENDING' THEN 1 END) as total_pending
    FROM payments
  `).first();

  const statsNormalized = stats ? {
    total_revenue: (stats as Record<string, unknown>).total_revenue as number ?? 0,
    today_revenue: (stats as Record<string, unknown>).today_revenue as number ?? 0,
    total_paid: (stats as Record<string, unknown>).total_paid as number ?? 0,
    total_pending: (stats as Record<string, unknown>).total_pending as number ?? 0,
  } : { total_revenue: 0, today_revenue: 0, total_paid: 0, total_pending: 0 };

  return c.json({ payments: result.results, stats: statsNormalized });
});

// POST /api/payments/create-link - Create Stripe payment link
payments.post('/create-link', async (c) => {
  const { DB, STRIPE_SECRET_KEY, APP_URL } = c.env;
  const { lead_id, amount = 500 } = await c.req.json();

  if (!lead_id) return c.json({ error: 'lead_id required' }, 400);

  const lead = await DB.prepare(`
    SELECT l.*, d.demo_url FROM leads l
    LEFT JOIN demos d ON d.lead_id = l.id AND d.status = 'ACTIVE'
    WHERE l.id = ?
  `).bind(lead_id).first<{
    id: number; name: string; email: string; industry: string; city: string; demo_url: string;
  }>();

  if (!lead) return c.json({ error: 'Lead not found' }, 404);

  try {
    // Create Stripe checkout session
    const params = new URLSearchParams({
      'payment_method_types[0]': 'card',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': `Professional Website - ${lead.name}`,
      'line_items[0][price_data][product_data][description]': `Custom professional website for ${lead.name} in ${lead.city}. Includes domain setup, hosting for 1 year, mobile-optimized design, and SEO optimization.`,
      'line_items[0][price_data][unit_amount]': String(amount * 100),
      'line_items[0][quantity]': '1',
      'mode': 'payment',
      'success_url': `${APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}&lead_id=${lead_id}`,
      'cancel_url': `${APP_URL}/payment-cancel?lead_id=${lead_id}`,
      'metadata[lead_id]': String(lead_id),
      'metadata[business_name]': lead.name,
      'metadata[city]': lead.city || '',
    });

    if (lead.email) params.set('customer_email', lead.email);

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const session = await stripeResponse.json() as { id?: string; url?: string; error?: { message: string } };

    if (!stripeResponse.ok) {
      return c.json({ error: session.error?.message || 'Stripe error' }, 500);
    }

    // Save payment record
    const existing = await DB.prepare(`SELECT id FROM payments WHERE lead_id = ? AND status = 'PENDING'`).bind(lead_id).first();
    if (existing) {
      await DB.prepare(`UPDATE payments SET stripe_session_id=?, payment_link=? WHERE lead_id=? AND status='PENDING'`)
        .bind(session.id, session.url, lead_id).run();
    } else {
      await DB.prepare(`
        INSERT INTO payments (lead_id, stripe_session_id, amount, payment_link)
        VALUES (?, ?, ?, ?)
      `).bind(lead_id, session.id, amount * 100, session.url).run();
    }

    return c.json({ payment_link: session.url, session_id: session.id, amount });
  } catch (error) {
    return c.json({ error: `Payment creation failed: ${error}` }, 500);
  }
});

// ── Stripe HMAC-SHA256 signature verifier (Web Crypto API — no Node.js needed) ──
async function verifyStripeSignature(
  payload: string,
  sigHeader: string | undefined,
  secret: string
): Promise<{ valid: boolean; error?: string }> {
  if (!secret) return { valid: false, error: 'STRIPE_WEBHOOK_SECRET not configured' };
  if (!sigHeader) return { valid: false, error: 'Missing stripe-signature header' };

  // Parse t=timestamp,v1=signature pairs
  const parts: Record<string, string> = {};
  for (const part of sigHeader.split(',')) {
    const [k, v] = part.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  }

  const timestamp = parts['t'];
  const expectedSig = parts['v1'];
  if (!timestamp || !expectedSig) {
    return { valid: false, error: 'Malformed stripe-signature header' };
  }

  // Reject if timestamp is > 5 minutes old (replay attack protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return { valid: false, error: 'Webhook timestamp too old — possible replay attack' };
  }

  // Compute HMAC-SHA256(secret, "timestamp.payload")
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signed = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`));
  const computedSig = Array.from(new Uint8Array(signed))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  // Constant-time comparison
  if (computedSig.length !== expectedSig.length) {
    return { valid: false, error: 'Signature mismatch' };
  }
  let diff = 0;
  for (let i = 0; i < computedSig.length; i++) {
    diff |= computedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return diff === 0 ? { valid: true } : { valid: false, error: 'Signature mismatch' };
}

// POST /api/payments/webhook - Stripe webhook handler (signature verified)
payments.post('/webhook', async (c) => {
  const { DB, STRIPE_WEBHOOK_SECRET } = c.env;
  const body = await c.req.text();
  const signature = c.req.header('stripe-signature');

  // ── SECURITY GATE: Reject if webhook secret not configured ────────────────
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET not set — payments unsafe');
    return c.json({
      error: 'STRIPE WEBHOOK NOT CONFIGURED — PAYMENTS UNSAFE',
      code: 'WEBHOOK_SECRET_MISSING'
    }, 500);
  }

  // ── SIGNATURE VERIFICATION ─────────────────────────────────────────────────
  const verification = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
  if (!verification.valid) {
    console.error('[WEBHOOK] Signature verification FAILED:', verification.error);
    return c.json({
      error: 'Webhook signature verification failed',
      detail: verification.error,
      code: 'INVALID_SIGNATURE'
    }, 400);
  }

  try {
    const event = JSON.parse(body) as {
      type: string;
      data: { object: {
        id: string;
        payment_intent?: string;
        metadata?: { lead_id?: string };
        amount_total?: number;
      }};
    };

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const leadId = session.metadata?.lead_id;

      if (leadId) {
        // IDEMPOTENCY CHECK: Only process if payment not already marked PAID
        const existingPayment = await DB.prepare(
          `SELECT id, status FROM payments WHERE stripe_session_id = ?`
        ).bind(session.id).first<{ id: number; status: string }>();

        if (existingPayment && existingPayment.status === 'PAID') {
          // Already processed — return success without duplicate action
          return c.json({ received: true, status: 'already_processed' });
        }

        await DB.prepare(`
          UPDATE payments SET status='PAID', paid_at=CURRENT_TIMESTAMP,
          stripe_payment_intent=? WHERE stripe_session_id=?
        `).bind(session.payment_intent || null, session.id).run();

        await DB.prepare(`
          UPDATE leads SET status='CLOSED', updated_at=CURRENT_TIMESTAMP WHERE id=?
        `).bind(leadId).run();

        // Log conversion (only on first processing)
        await DB.prepare(`
          INSERT INTO conversations (lead_id, channel, direction, message)
          VALUES (?, 'system', 'inbound', 'PAYMENT RECEIVED - Website order confirmed')
        `).bind(leadId).run();
      }
    }

    return c.json({ received: true });
  } catch (error) {
    return c.json({ error: 'Webhook processing failed' }, 400);
  }
});

// GET /api/payments/:id - Get payment details
payments.get('/:id', async (c) => {
  const { DB, STRIPE_SECRET_KEY } = c.env;
  const id = c.req.param('id');

  const payment = await DB.prepare(`
    SELECT p.*, l.name as business_name FROM payments p
    JOIN leads l ON l.id = p.lead_id
    WHERE p.id = ?
  `).bind(id).first();

  return c.json({ payment });
});

// POST /api/payments/:id/resend - Resend payment link
payments.post('/:id/resend', async (c) => {
  const { DB, RESEND_API_KEY } = c.env;
  const id = c.req.param('id');

  const payment = await DB.prepare(`
    SELECT p.*, l.name as business_name, l.email FROM payments p
    JOIN leads l ON l.id = p.lead_id
    WHERE p.id = ?
  `).bind(id).first<{
    business_name: string; email: string; payment_link: string; amount: number;
  }>();

  if (!payment) return c.json({ error: 'Payment not found' }, 404);
  if (!payment.email) return c.json({ error: 'No email on file' }, 400);

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Alex <alex@websitedemopro.org>',
      to: [payment.email],
      subject: `Your website is ready — payment link inside`,
      html: `
        <h2>Your Website is Ready!</h2>
        <p>Hi there,</p>
        <p>Your professional website for <strong>${payment.business_name}</strong> is ready to go live!</p>
        <p>Complete your payment of <strong>$${(payment.amount / 100).toFixed(2)}</strong> to launch it:</p>
        <p><a href="${payment.payment_link}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Pay Now & Go Live →</a></p>
        <p><small>This is a one-time payment. Includes hosting, domain setup, and mobile-optimized design.</small></p>
      `
    })
  });

  return c.json({ message: 'Payment link resent' });
});

export default payments;
