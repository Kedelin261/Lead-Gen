import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Bindings } from './types'
import leadsRoute from './routes/leads'
import demosRoute from './routes/demos'
import outreachRoute from './routes/outreach'
import paymentsRoute from './routes/payments'
import dashboardRoute from './routes/dashboard'
import conversationsRoute from './routes/conversations'
import settingsRoute from './routes/settings'
import validationRoute from './routes/validation'
import warmupRoute from './routes/warmup'
import microScaleRoute from './routes/micro-scale'
import integrityRoute from './routes/integrity'
import isolationRoute from './routes/isolation'
import engineRoute, { handleScheduledEvent } from './routes/engine'
import systemRoute, { handleSystemScheduled } from './routes/system'
import { getProspectBySlug, renderProspectDemoHTML } from './lib/prospect-demos'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())
app.use('*', logger())

// === API ROUTES ===
app.route('/api/leads', leadsRoute)
app.route('/api/demos', demosRoute)
app.route('/api/outreach', outreachRoute)
app.route('/api/payments', paymentsRoute)
app.route('/api/dashboard', dashboardRoute)
app.route('/api/conversations', conversationsRoute)
app.route('/api/settings', settingsRoute)
app.route('/api/validation', validationRoute)
app.route('/api/warmup', warmupRoute)
app.route('/api/micro-scale', microScaleRoute)
app.route('/api/integrity', integrityRoute)
app.route('/api/isolation', isolationRoute)
app.route('/api/engine', engineRoute)
app.route('/api/system', systemRoute)

// === DEMO VIEWER (public) ===
// Priority 1: Slug-based prospect demo pages (no DB required)
app.get('/demo/:slug', async (c) => {
  const slug = c.req.param('slug')
  const { APP_URL } = c.env

  // Check prospect demo registry first
  const prospect = getProspectBySlug(slug)
  if (prospect) {
    const appUrl = APP_URL || 'https://websitedemopro.org'
    return c.html(renderProspectDemoHTML(prospect, appUrl))
  }

  // Fallback: DB-backed demo (existing lead demos via numeric ID suffix)
  return demosRoute.fetch(
    new Request(c.req.url.replace('/demo/', '/view/')),
    c.env as Record<string, unknown>
  )
})

// === PROSPECT DEMO TRACKING ===
app.post('/api/demos/track-prospect', async (c) => {
  try {
    const { slug, event, business } = await c.req.json()
    // Log to console (Cloudflare Workers logging)
    console.log(`[PROSPECT_TRACK] slug=${slug} event=${event} business=${business} ts=${new Date().toISOString()}`)
    return c.json({ tracked: true, slug, event })
  } catch {
    return c.json({ tracked: false }, 400)
  }
})

// === PAYMENT SUCCESS/CANCEL PAGES ===
app.get('/payment-success', (c) => {
  return c.html(paymentSuccessHTML())
})

app.get('/payment-cancel', (c) => {
  return c.html(paymentCancelHTML())
})

// === PAY PAGE ===
app.get('/pay/:demo_id', async (c) => {
  const { DB } = c.env
  const demoId = c.req.param('demo_id')
  const demo = await DB.prepare(`
    SELECT d.*, l.name as business_name, l.city, l.email
    FROM demos d JOIN leads l ON l.id = d.lead_id
    WHERE d.id = ?
  `).bind(demoId).first<{ business_name: string; city: string; lead_id: number }>()

  if (!demo) return c.notFound()

  // Create payment link
  const payResponse = await fetch(`${c.env.APP_URL}/api/payments/create-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lead_id: demo.lead_id })
  })
  const payData = await payResponse.json() as { payment_link?: string }
  if (payData.payment_link) {
    return c.redirect(payData.payment_link)
  }
  return c.html(`<html><body><p>Payment setup in progress. Please contact us directly.</p></body></html>`)
})

// === MAIN DASHBOARD SPA ===
app.get('/', (c) => c.html(dashboardHTML()))
app.get('/leads', (c) => c.html(dashboardHTML()))
app.get('/demos', (c) => c.html(dashboardHTML()))
app.get('/outreach', (c) => c.html(dashboardHTML()))
app.get('/pipeline', (c) => c.html(dashboardHTML()))
app.get('/conversations', (c) => c.html(dashboardHTML()))
app.get('/payments', (c) => c.html(dashboardHTML()))
app.get('/analytics', (c) => c.html(dashboardHTML()))
app.get('/settings', (c) => c.html(dashboardHTML()))
app.get('/validation', (c) => c.html(dashboardHTML()))
app.get('/micro-scale', (c) => c.html(dashboardHTML()))
app.get('/isolation', (c) => c.html(dashboardHTML()))
app.get('/engine', (c) => c.html(dashboardHTML()))
app.get('/system', (c) => c.html(dashboardHTML()))

export default app

// === CLOUDFLARE CRON TRIGGER ===
// §2 Schedule: 0 10 * * *  → 10:00 AM UTC daily
// Also fires legacy engine cycle at same time
export const scheduled = async (_event: unknown, env: Bindings, _ctx: ExecutionContext) => {
  // System orchestrator (new unified pipeline — Section 1-14)
  await handleSystemScheduled(env)
  // Legacy engine cycle (email warmup + per-channel)
  await handleScheduledEvent(env)
}

function paymentSuccessHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payment Successful!</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
<div class="text-center p-8 bg-white rounded-2xl shadow-lg max-w-md">
  <div class="text-6xl mb-4">🎉</div>
  <h1 class="text-3xl font-bold text-green-600 mb-3">Payment Successful!</h1>
  <p class="text-gray-600 mb-6">Thank you for your order. We'll begin building your website immediately and have it live within 48 hours.</p>
  <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-left mb-6">
    <p class="text-green-800 font-semibold">✅ What happens next:</p>
    <ul class="text-green-700 text-sm mt-2 space-y-1">
      <li>• We'll contact you within 2 hours</li>
      <li>• Your website will be live in 48 hours</li>
      <li>• We'll set up your custom domain</li>
      <li>• Free SSL certificate included</li>
    </ul>
  </div>
  <p class="text-sm text-gray-400">Questions? Reply to your email or call us directly.</p>
</div>
</body></html>`
}

function paymentCancelHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payment Cancelled</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
<div class="text-center p-8 bg-white rounded-2xl shadow-lg max-w-md">
  <div class="text-5xl mb-4">💭</div>
  <h1 class="text-2xl font-bold text-gray-700 mb-3">No worries!</h1>
  <p class="text-gray-500 mb-6">Your payment was cancelled. Your demo site is still available if you change your mind.</p>
  <p class="text-sm text-gray-400">Questions? Reply to the email we sent you and we'll be happy to help.</p>
</div>
</body></html>`
}

function dashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LeadGen Pro — B2B Sales Engine</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; }
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #1e293b; } ::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
    .sidebar { width: 240px; min-height: 100vh; background: #1e293b; border-right: 1px solid #334155; position: fixed; top: 0; left: 0; z-index: 50; transition: transform 0.3s; }
    .main-content { margin-left: 240px; min-height: 100vh; }
    .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 16px; color: #94a3b8; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-size: 14px; margin: 2px 8px; text-decoration: none; }
    .nav-item:hover, .nav-item.active { background: #334155; color: #f1f5f9; }
    .nav-item.active { border-left: 3px solid #3b82f6; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; }
    .kpi-card { background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid #334155; border-radius: 12px; padding: 20px; transition: all 0.2s; }
    .kpi-card:hover { border-color: #3b82f6; transform: translateY(-1px); }
    .btn { padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-success { background: #10b981; color: white; }
    .btn-success:hover { background: #059669; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-danger:hover { background: #dc2626; }
    .btn-ghost { background: transparent; color: #94a3b8; border: 1px solid #334155; }
    .btn-ghost:hover { background: #334155; color: #f1f5f9; }
    .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
    .badge-new { background: #1e3a5f; color: #60a5fa; }
    .badge-contacted { background: #1c3a4a; color: #38bdf8; }
    .badge-responded { background: #1a3a2a; color: #34d399; }
    .badge-interested { background: #3a2a1a; color: #fb923c; }
    .badge-closed { background: #1a3a1a; color: #4ade80; }
    .badge-lost { background: #3a1a1a; color: #f87171; }
    .table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .table th { text-align: left; padding: 12px 16px; color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #334155; }
    .table td { padding: 12px 16px; border-bottom: 1px solid #1e293b; }
    .table tr:hover td { background: #1e293b; }
    .input { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 8px 12px; border-radius: 8px; font-size: 14px; }
    .input:focus { outline: none; border-color: #3b82f6; }
    .select { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 8px 12px; border-radius: 8px; font-size: 14px; }
    .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; align-items: center; justify-content: center; }
    .modal.open { display: flex; }
    .modal-box { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 28px; max-width: 560px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .score-bar { height: 6px; border-radius: 3px; background: #334155; }
    .score-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
    .alert-success { background: #052e16; border: 1px solid #166534; color: #4ade80; padding: 12px 16px; border-radius: 8px; }
    .alert-warning { background: #431407; border: 1px solid #92400e; color: #fbbf24; padding: 12px 16px; border-radius: 8px; }
    .alert-error { background: #450a0a; border: 1px solid #991b1b; color: #f87171; padding: 12px 16px; border-radius: 8px; }
    .alert-info { background: #0c1a3a; border: 1px solid #1e40af; color: #93c5fd; padding: 12px 16px; border-radius: 8px; }
    .kanban { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; overflow-x: auto; padding-bottom: 16px; }
    .kanban-col { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 12px; min-height: 400px; }
    .kanban-card { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; }
    .kanban-card:hover { border-color: #3b82f6; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { animation: spin 1s linear infinite; display: inline-block; }
    @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
    .pulse { animation: pulse 2s ease-in-out infinite; }
    .tab-btn { padding: 8px 16px; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; border: none; background: transparent; color: #64748b; transition: all 0.2s; }
    .tab-btn.active { background: #3b82f6; color: white; }
    @media (max-width: 768px) { .sidebar { transform: translateX(-100%); } .main-content { margin-left: 0; } .sidebar.open { transform: translateX(0); } .kanban { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>

<!-- SIDEBAR -->
<aside class="sidebar" id="sidebar">
  <div style="padding: 20px 16px; border-bottom: 1px solid #334155;">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="background:#3b82f6;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">⚡</div>
      <div>
        <div style="font-weight:800;font-size:16px;color:#f1f5f9;">LeadGen Pro</div>
        <div style="font-size:11px;color:#64748b;">B2B Sales Engine</div>
      </div>
    </div>
  </div>
  <nav style="padding: 12px 0;">
    <div style="padding: 4px 16px 8px; font-size: 11px; color: #475569; text-transform: uppercase; font-weight: 700;">Main</div>
    <a class="nav-item active" href="#" data-page="dashboard" onclick="navigate('dashboard',this)"><i class="fas fa-chart-line" style="width:18px"></i> Dashboard</a>
    <a class="nav-item" href="#" data-page="leads" onclick="navigate('leads',this)"><i class="fas fa-users" style="width:18px"></i> Leads <span id="nav-leads-count" style="margin-left:auto;background:#334155;padding:2px 7px;border-radius:9999px;font-size:11px;"></span></a>
    <a class="nav-item" href="#" data-page="demos" onclick="navigate('demos',this)"><i class="fas fa-desktop" style="width:18px"></i> Demo Sites</a>
    <a class="nav-item" href="#" data-page="outreach" onclick="navigate('outreach',this)"><i class="fas fa-paper-plane" style="width:18px"></i> Outreach</a>
    <div style="padding: 12px 16px 4px; font-size: 11px; color: #475569; text-transform: uppercase; font-weight: 700;">Sales</div>
    <a class="nav-item" href="#" data-page="pipeline" onclick="navigate('pipeline',this)"><i class="fas fa-funnel-dollar" style="width:18px"></i> CRM Pipeline</a>
    <a class="nav-item" href="#" data-page="conversations" onclick="navigate('conversations',this)"><i class="fas fa-comments" style="width:18px"></i> Conversations <span id="nav-unread-count" style="margin-left:auto;background:#ef4444;padding:2px 7px;border-radius:9999px;font-size:11px;display:none"></span></a>
    <a class="nav-item" href="#" data-page="payments" onclick="navigate('payments',this)"><i class="fas fa-credit-card" style="width:18px"></i> Payments</a>
    <div style="padding: 12px 16px 4px; font-size: 11px; color: #475569; text-transform: uppercase; font-weight: 700;">System</div>
    <a class="nav-item" href="#" data-page="analytics" onclick="navigate('analytics',this)"><i class="fas fa-chart-bar" style="width:18px"></i> Analytics</a>
    <a class="nav-item" href="#" data-page="validation" id="nav-validation" onclick="navigate('validation',this)" style="border-left:3px solid #f59e0b;"><i class="fas fa-shield-alt" style="width:18px;color:#f59e0b"></i> <span style="color:#f59e0b;font-weight:700;">Validation</span> <span id="nav-val-badge" style="margin-left:auto;background:#f59e0b22;color:#f59e0b;padding:2px 6px;border-radius:9999px;font-size:10px;">MODE</span></a>
    <a class="nav-item" href="#" data-page="micro-scale" id="nav-micro-scale" onclick="navigate('micro-scale',this)" style="border-left:3px solid #10b981;"><i class="fas fa-rocket" style="width:18px;color:#10b981"></i> <span style="color:#10b981;font-weight:700;">Micro-Scale</span> <span id="nav-micro-badge" style="margin-left:auto;background:#10b98122;color:#10b981;padding:2px 6px;border-radius:9999px;font-size:10px;">LIVE</span></a>
    <a class="nav-item" href="#" data-page="isolation" id="nav-isolation" onclick="navigate('isolation',this)" style="border-left:3px solid #a855f7;"><i class="fas fa-shield-virus" style="width:18px;color:#a855f7"></i> <span style="color:#a855f7;font-weight:700;">Env Isolation</span> <span id="nav-isolation-badge" style="margin-left:auto;background:#a855f722;color:#a855f7;padding:2px 6px;border-radius:9999px;font-size:10px;">ACTIVE</span></a>
    <a class="nav-item" href="#" data-page="engine" id="nav-engine" onclick="navigate('engine',this)" style="border-left:3px solid #f97316;"><i class="fas fa-robot" style="width:18px;color:#f97316"></i> <span style="color:#f97316;font-weight:700;">Auto Engine</span> <span id="nav-engine-badge" style="margin-left:auto;background:#f9731622;color:#f97316;padding:2px 6px;border-radius:9999px;font-size:10px;">DAILY</span></a>
    <a class="nav-item" href="#" data-page="system" id="nav-system" onclick="navigate('system',this)" style="border-left:3px solid #22d3ee;"><i class="fas fa-bolt" style="width:18px;color:#22d3ee"></i> <span style="color:#22d3ee;font-weight:700;">System</span> <span style="margin-left:auto;background:#22d3ee22;color:#22d3ee;padding:2px 6px;border-radius:9999px;font-size:10px;">10AM</span></a>
    <a class="nav-item" href="#" data-page="settings" onclick="navigate('settings',this)"><i class="fas fa-cog" style="width:18px"></i> Settings</a>
  </nav>
  <div style="position:absolute;bottom:0;left:0;right:0;padding:16px;border-top:1px solid #334155;">
    <div id="campaign-status" style="display:flex;align-items:center;justify-content:space-between;font-size:13px;">
      <span style="color:#94a3b8;">Campaign</span>
      <button id="toggle-campaign" onclick="toggleCampaign()" class="btn btn-success" style="padding:4px 12px;font-size:12px;">Active</button>
    </div>
  </div>
</aside>

<!-- TOP BAR -->
<div class="main-content">
<div style="background:#1e293b;border-bottom:1px solid #334155;padding:12px 24px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;position:sticky;top:0;z-index:40;">
  <button onclick="document.getElementById('sidebar').classList.toggle('open')" style="display:none;background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer;" id="menu-btn"><i class="fas fa-bars"></i></button>
  <div style="flex:1;font-weight:700;font-size:18px;color:#f1f5f9;" id="page-title">Dashboard</div>
  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
    <div style="text-center;font-size:13px;">
      <div style="color:#64748b;font-size:11px;">Revenue Today</div>
      <div style="color:#4ade80;font-weight:700;" id="top-revenue">$0</div>
    </div>
    <div style="text-center;font-size:13px;">
      <div style="color:#64748b;font-size:11px;">Leads Today</div>
      <div style="color:#60a5fa;font-weight:700;" id="top-leads">0</div>
    </div>
    <div style="text-center;font-size:13px;">
      <div style="color:#64748b;font-size:11px;">Conv. Rate</div>
      <div style="color:#a78bfa;font-weight:700;" id="top-conv">0%</div>
    </div>
    <div id="top-alerts" style="display:none" class="badge badge-new pulse">⚠️ Alert</div>
  </div>
</div>

<!-- PAGE CONTENT -->
<div id="page-content" style="padding: 24px;">
  <!-- Content rendered by JS -->
  <div style="text-align:center;padding:80px;color:#475569;">
    <div class="spinner" style="font-size:32px;">⚡</div>
    <div style="margin-top:16px;">Loading LeadGen Pro...</div>
  </div>
</div>
</div>

<!-- ADD LEAD MODAL -->
<div class="modal" id="add-lead-modal">
  <div class="modal-box">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h3 style="font-size:18px;font-weight:700;">Add New Lead</h3>
      <button onclick="closeModal('add-lead-modal')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px;">×</button>
    </div>
    <form id="add-lead-form" onsubmit="submitLead(event)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div><label style="font-size:12px;color:#94a3b8;">Business Name *</label><input class="input" id="lead-name" placeholder="ABC Roofing" required style="width:100%;margin-top:4px;"></div>
        <div><label style="font-size:12px;color:#94a3b8;">Industry *</label>
          <select class="select" id="lead-industry" style="width:100%;margin-top:4px;">
            <option value="">Select Industry</option>
            <option>Roofing</option><option>Landscaping</option><option>Barbershop</option>
            <option>Hair Salon</option><option>Auto Repair</option><option>Cleaning</option>
            <option>HVAC</option><option>Plumbing</option><option>Painting</option>
            <option>Electrical</option><option>Pest Control</option><option>Lawn Care</option>
            <option>Handyman</option><option>Moving</option><option>Pressure Washing</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div><label style="font-size:12px;color:#94a3b8;">Phone</label><input class="input" id="lead-phone" placeholder="(555) 123-4567" style="width:100%;margin-top:4px;"></div>
        <div><label style="font-size:12px;color:#94a3b8;">Email</label><input class="input" id="lead-email" placeholder="owner@business.com" type="email" style="width:100%;margin-top:4px;"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div><label style="font-size:12px;color:#94a3b8;">City</label><input class="input" id="lead-city" placeholder="New York" style="width:100%;margin-top:4px;"></div>
        <div><label style="font-size:12px;color:#94a3b8;">State</label><input class="input" id="lead-state" placeholder="NY" style="width:100%;margin-top:4px;"></div>
      </div>
      <div style="margin-bottom:12px;"><label style="font-size:12px;color:#94a3b8;">Website (if any)</label><input class="input" id="lead-website" placeholder="facebook.com/business or leave blank" style="width:100%;margin-top:4px;"></div>
      <div style="margin-bottom:12px;"><label style="font-size:12px;color:#94a3b8;">Address</label><input class="input" id="lead-address" placeholder="123 Main St" style="width:100%;margin-top:4px;"></div>
      <div style="margin-bottom:20px;"><label style="font-size:12px;color:#94a3b8;">Notes</label><textarea class="input" id="lead-notes" placeholder="Additional notes..." style="width:100%;margin-top:4px;height:80px;resize:vertical;"></textarea></div>
      <div style="display:flex;gap:12px;">
        <button type="submit" class="btn btn-primary" style="flex:1;">Add Lead</button>
        <button type="button" onclick="closeModal('add-lead-modal')" class="btn btn-ghost">Cancel</button>
      </div>
    </form>
  </div>
</div>

<!-- LEAD DETAIL MODAL -->
<div class="modal" id="lead-detail-modal">
  <div class="modal-box" style="max-width:700px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h3 style="font-size:18px;font-weight:700;" id="lead-detail-title">Lead Details</h3>
      <button onclick="closeModal('lead-detail-modal')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px;">×</button>
    </div>
    <div id="lead-detail-content"></div>
  </div>
</div>

<!-- TOAST NOTIFICATIONS -->
<div id="toast-container" style="position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:360px;"></div>

<script src="/static/app.js"></script>
</body>
</html>`
}
