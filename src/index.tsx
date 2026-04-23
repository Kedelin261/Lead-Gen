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

// === DEMO VIEWER (public) ===
app.get('/demo/:slug', async (c) => {
  return demosRoute.fetch(
    new Request(c.req.url.replace('/demo/', '/view/')),
    c.env as Record<string, unknown>
  )
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

export default app

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

<script>
// ============= STATE =============
const state = {
  currentPage: 'dashboard',
  leads: [],
  demos: [],
  stats: {},
  settings: {},
  charts: {},
  chartInstances: {}
};

// ============= NAVIGATION =============
function navigate(page, el) {
  if (el) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
  }
  state.currentPage = page;
  const titles = {
    dashboard: 'Dashboard Overview',
    leads: 'Leads Management',
    demos: 'Demo Sites',
    outreach: 'Outreach Activity',
    pipeline: 'CRM Pipeline',
    conversations: 'Conversations',
    payments: 'Payments',
    analytics: 'Analytics',
    settings: 'Settings'
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  renderPage(page);
}

// ============= API HELPERS =============
async function api(method, path, data) {
  try {
    const config = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) config.data = data;
    const response = method === 'GET'
      ? await axios.get('/api' + path)
      : await axios[method.toLowerCase()]('/api' + path, data);
    return response.data;
  } catch (e) {
    console.error('API Error:', e);
    showToast(e.response?.data?.error || 'API Error', 'error');
    return null;
  }
}

// ============= TOAST =============
function showToast(msg, type = 'info') {
  const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.style.cssText = \`background:#1e293b;border:1px solid \${colors[type]};color:#f1f5f9;padding:12px 16px;border-radius:8px;font-size:14px;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,0.4);\`;
  toast.innerHTML = \`<span>\${icons[type]}</span><span>\${msg}</span>\`;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ============= MODAL HELPERS =============
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ============= RENDER PAGES =============
async function renderPage(page) {
  const content = document.getElementById('page-content');
  content.innerHTML = \`<div style="text-align:center;padding:40px;color:#475569;"><div class="spinner" style="font-size:24px;">⚡</div></div>\`;

  switch(page) {
    case 'dashboard': await renderDashboard(); break;
    case 'leads': await renderLeads(); break;
    case 'demos': await renderDemos(); break;
    case 'outreach': await renderOutreach(); break;
    case 'pipeline': await renderPipeline(); break;
    case 'conversations': await renderConversations(); break;
    case 'payments': await renderPayments(); break;
    case 'analytics': await renderAnalytics(); break;
    case 'settings': await renderSettings(); break;
  }
}

// ============= DASHBOARD =============
async function renderDashboard() {
  const [statsData, funnelData, chartsData, insightsData] = await Promise.all([
    api('GET', '/dashboard/stats'),
    api('GET', '/dashboard/funnel'),
    api('GET', '/dashboard/charts'),
    api('GET', '/dashboard/insights')
  ]);

  if (!statsData) return;
  const s = statsData;
  state.stats = s;

  // Update topbar
  document.getElementById('top-revenue').textContent = \`\$\${(s.revenue_today || 0).toLocaleString()}\`;
  document.getElementById('top-leads').textContent = s.leads_today || 0;
  document.getElementById('top-conv').textContent = \`\${s.conversion_rate || 0}%\`;

  const funnelItems = funnelData?.funnel || [];
  const funnelHTML = funnelItems.map(f => \`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #334155;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="badge badge-\${f.status.toLowerCase()}">\${f.status}</span>
      </div>
      <span style="font-weight:700;color:#f1f5f9;">\${f.count}</span>
    </div>
  \`).join('');

  const insightsHTML = (insightsData?.insights || []).map(i => \`
    <div class="alert-\${i.severity}" style="margin-bottom:8px;font-size:13px;">
      \${i.message}
    </div>
  \`).join('');

  document.getElementById('page-content').innerHTML = \`
    <!-- KPI CARDS -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px;">
      \${renderKPICard('Leads Today', s.leads_today, 'fas fa-users', '#60a5fa', '+scraped')}
      \${renderKPICard('Demos Created', s.demos_today, 'fas fa-desktop', '#a78bfa', 'today')}
      \${renderKPICard('Calls Made', s.calls_today, 'fas fa-phone', '#34d399', 'today')}
      \${renderKPICard('Emails Sent', s.emails_today, 'fas fa-envelope', '#fb923c', 'today')}
      \${renderKPICard('SMS Sent', s.sms_today, 'fas fa-comment-sms', '#f472b6', 'today')}
      \${renderKPICard('Deals Closed', s.deals_closed, 'fas fa-handshake', '#4ade80', 'total')}
      \${renderKPICard('Revenue Today', '\$' + (s.revenue_today || 0).toLocaleString(), 'fas fa-dollar-sign', '#fbbf24', 'earned')}
      \${renderKPICard('Conv. Rate', s.conversion_rate + '%', 'fas fa-percentage', '#2dd4bf', 'overall')}
    </div>

    <!-- CHARTS + FUNNEL -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;margin-bottom:24px;">
      <div class="card">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:#f1f5f9;">📈 Outreach Activity (14 days)</h3>
        <canvas id="outreachChart" height="120"></canvas>
      </div>
      <div class="card">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:#f1f5f9;">🔄 Pipeline Funnel</h3>
        \${funnelHTML || '<div style="color:#64748b;text-align:center;padding:20px;">No leads yet</div>'}
      </div>
    </div>

    <!-- INSIGHTS + QUICK ACTIONS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <div class="card">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:#f1f5f9;">💡 System Insights</h3>
        \${insightsHTML || '<div style="color:#64748b;">No insights available yet</div>'}
      </div>
      <div class="card">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:#f1f5f9;">⚡ Quick Actions</h3>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button class="btn btn-primary" onclick="openModal('add-lead-modal')">➕ Add New Lead</button>
          <button class="btn btn-success" onclick="navigate('leads', document.querySelector('[data-page=leads]'))">👥 View All Leads</button>
          <button class="btn" style="background:#7c3aed;color:white;" onclick="navigate('pipeline', document.querySelector('[data-page=pipeline]'))">📊 Open Pipeline</button>
          <button class="btn btn-ghost" onclick="navigate('analytics', document.querySelector('[data-page=analytics]'))">📈 Deep Analytics</button>
        </div>
      </div>
    </div>
  \`;

  // Render outreach chart
  const chartData = chartsData?.outreach || [];
  const labels = chartData.map(d => d.date ? d.date.slice(5) : '');
  renderChart('outreachChart', 'line', labels,
    [
      { label: 'Calls', data: chartData.map(d => d.calls || 0), borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', fill: true, tension: 0.4 },
      { label: 'Emails', data: chartData.map(d => d.emails || 0), borderColor: '#fb923c', backgroundColor: 'rgba(251,146,60,0.1)', fill: true, tension: 0.4 },
      { label: 'SMS', data: chartData.map(d => d.sms || 0), borderColor: '#f472b6', backgroundColor: 'rgba(244,114,182,0.1)', fill: true, tension: 0.4 }
    ]
  );
}

function renderKPICard(title, value, icon, color, sub) {
  return \`<div class="kpi-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <span style="font-size:12px;color:#64748b;font-weight:600;">\${title.toUpperCase()}</span>
      <i class="\${icon}" style="color:\${color};"></i>
    </div>
    <div style="font-size:28px;font-weight:900;color:\${color};">\${value}</div>
    <div style="font-size:11px;color:#475569;margin-top:4px;">\${sub}</div>
  </div>\`;
}

// ============= LEADS PAGE =============
async function renderLeads() {
  const data = await api('GET', '/leads?limit=100');
  if (!data) return;
  const leads = data.leads || [];
  state.leads = leads;
  document.getElementById('nav-leads-count').textContent = data.total || 0;

  document.getElementById('page-content').innerHTML = \`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <input class="input" id="leads-search" placeholder="🔍 Search leads..." style="width:200px;" oninput="filterLeads()">
        <select class="select" id="leads-status-filter" onchange="filterLeads()">
          <option value="">All Statuses</option>
          <option value="NEW">New</option><option value="CONTACTED">Contacted</option>
          <option value="RESPONDED">Responded</option><option value="INTERESTED">Interested</option>
          <option value="CLOSED">Closed</option><option value="LOST">Lost</option>
        </select>
        <select class="select" id="leads-industry-filter" onchange="filterLeads()">
          <option value="">All Industries</option>
          <option>Roofing</option><option>Landscaping</option><option>Barbershop</option>
          <option>Auto Repair</option><option>Cleaning</option><option>HVAC</option>
          <option>Plumbing</option><option>Painting</option><option>Electrical</option>
        </select>
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-ghost" onclick="importLeads()"><i class="fas fa-upload"></i> Import CSV</button>
        <button class="btn btn-primary" onclick="openModal('add-lead-modal')"><i class="fas fa-plus"></i> Add Lead</button>
      </div>
    </div>

    <div class="card" style="overflow:auto;">
      <table class="table" id="leads-table">
        <thead>
          <tr>
            <th>Business</th><th>Industry</th><th>City</th><th>Phone</th>
            <th>Score</th><th>Status</th><th>Website</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="leads-tbody">
          \${renderLeadsRows(leads)}
        </tbody>
      </table>
      \${leads.length === 0 ? '<div style="text-align:center;padding:40px;color:#475569;">No leads yet. Add your first lead to get started.</div>' : ''}
    </div>
  \`;
}

function renderLeadsRows(leads) {
  return leads.map(l => {
    const scoreColor = l.lead_score >= 80 ? '#4ade80' : l.lead_score >= 60 ? '#fbbf24' : '#f87171';
    return \`<tr>
      <td>
        <div style="font-weight:600;color:#f1f5f9;">\${l.name}</div>
        \${l.email ? '<div style="font-size:12px;color:#64748b;">'+l.email+'</div>' : ''}
      </td>
      <td style="color:#94a3b8;">\${l.industry || '—'}</td>
      <td style="color:#94a3b8;">\${l.city || '—'}\${l.state ? ', '+l.state : ''}</td>
      <td style="color:#94a3b8;">\${l.phone || '—'}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="score-bar" style="width:60px;"><div class="score-fill" style="width:\${l.lead_score}%;background:\${scoreColor};"></div></div>
          <span style="color:\${scoreColor};font-weight:700;font-size:13px;">\${l.lead_score}</span>
        </div>
      </td>
      <td><span class="badge badge-\${l.status.toLowerCase()}">\${l.status}</span></td>
      <td><span style="font-size:12px;color:\${l.website_status==='NONE'?'#4ade80':'#fbbf24'};">\${l.website_status}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost" style="padding:4px 8px;font-size:12px;" onclick="viewLead(\${l.id})" title="View">👁️</button>
          <button class="btn btn-primary" style="padding:4px 8px;font-size:12px;" onclick="generateDemo(\${l.id})" title="Generate Demo">🌐</button>
          <button class="btn btn-success" style="padding:4px 8px;font-size:12px;" onclick="runOutreach(\${l.id})" title="Start Outreach">📤</button>
          <button class="btn btn-ghost" style="padding:4px 8px;font-size:12px;" onclick="createPaymentLink(\${l.id})" title="Payment Link">💳</button>
        </div>
      </td>
    </tr>\`;
  }).join('');
}

function filterLeads() {
  const search = document.getElementById('leads-search')?.value.toLowerCase() || '';
  const status = document.getElementById('leads-status-filter')?.value || '';
  const industry = document.getElementById('leads-industry-filter')?.value || '';
  const filtered = state.leads.filter(l => {
    const matchSearch = !search || l.name?.toLowerCase().includes(search) || l.phone?.includes(search) || l.email?.toLowerCase().includes(search);
    const matchStatus = !status || l.status === status;
    const matchIndustry = !industry || l.industry?.toLowerCase().includes(industry.toLowerCase());
    return matchSearch && matchStatus && matchIndustry;
  });
  const tbody = document.getElementById('leads-tbody');
  if (tbody) tbody.innerHTML = renderLeadsRows(filtered);
}

// ============= DEMOS PAGE =============
async function renderDemos() {
  const data = await api('GET', '/demos?limit=100');
  if (!data) return;
  const demos = data.demos || [];

  document.getElementById('page-content').innerHTML = \`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:15px;color:#94a3b8;">\${demos.length} demo sites generated</h2>
      <button class="btn btn-primary" onclick="navigate('leads',document.querySelector('[data-page=leads]'))">+ Generate from Leads</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
      \${demos.map(d => \`
        <div class="card" style="position:relative;">
          <div style="background:#0f172a;border-radius:8px;height:120px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;border:1px solid #334155;overflow:hidden;font-size:32px;">\${getIndustryEmoji(d.industry)}</div>
          <div style="font-weight:700;color:#f1f5f9;margin-bottom:4px;">\${d.business_name}</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:8px;">\${d.industry || 'General'} · \${d.city || 'Unknown'}</div>
          \${d.headline ? '<div style="font-size:12px;color:#94a3b8;margin-bottom:12px;font-style:italic;">"'+d.headline.slice(0,60)+'..."</div>' : ''}
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <span class="badge \${d.viewed ? 'badge-responded' : 'badge-new'}">\${d.viewed ? '👁️ Viewed '+d.view_count+'x' : '⏳ Not viewed'}</span>
            <span style="font-size:11px;color:#475569;">\${new Date(d.created_at).toLocaleDateString()}</span>
          </div>
          <div style="display:flex;gap:8px;">
            \${d.demo_url ? \`<a href="\${d.demo_url}" target="_blank" class="btn btn-primary" style="flex:1;text-align:center;font-size:13px;">Open Demo</a>\` : '<span class="btn btn-ghost" style="flex:1;text-align:center;font-size:13px;cursor:not-allowed;">No URL</span>'}
            <button class="btn btn-ghost" style="font-size:13px;" onclick="regenerateDemo(\${d.id})">🔄</button>
            <button class="btn btn-danger" style="font-size:13px;" onclick="deleteDemo(\${d.id})">🗑️</button>
          </div>
        </div>
      \`).join('') || '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#475569;">No demos yet. Generate demos from the Leads page.</div>'}
    </div>
  \`;
}

// ============= OUTREACH PAGE =============
async function renderOutreach() {
  const data = await api('GET', '/outreach/stats');
  const recentData = await api('GET', '/outreach?limit=50');
  const today = data?.today || {};
  const recent = recentData?.outreach || [];

  document.getElementById('page-content').innerHTML = \`
    <!-- METRICS -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px;">
      \${renderKPICard('Calls Today', today.calls || 0, 'fas fa-phone', '#34d399', 'made')}
      \${renderKPICard('Emails Today', today.emails || 0, 'fas fa-envelope', '#fb923c', 'sent')}
      \${renderKPICard('SMS Today', today.sms || 0, 'fas fa-comment-sms', '#f472b6', 'sent')}
      \${renderKPICard('Opened', today.opened || 0, 'fas fa-envelope-open', '#60a5fa', 'emails')}
      \${renderKPICard('Clicked', today.clicked || 0, 'fas fa-mouse-pointer', '#a78bfa', 'links')}
      \${renderKPICard('Replied', today.replied || 0, 'fas fa-reply', '#fbbf24', 'responses')}
    </div>

    <!-- RECENT ACTIVITY -->
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:700;color:#f1f5f9;">📡 Recent Outreach Activity</h3>
        <div style="display:flex;gap:8px;">
          <button class="tab-btn active" onclick="filterOutreach('all',this)">All</button>
          <button class="tab-btn" onclick="filterOutreach('call',this)">Calls</button>
          <button class="tab-btn" onclick="filterOutreach('email',this)">Emails</button>
          <button class="tab-btn" onclick="filterOutreach('sms',this)">SMS</button>
        </div>
      </div>
      <div id="outreach-feed">
        \${recent.map(o => \`
          <div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #334155;font-size:13px;" data-channel="\${o.channel}">
            <span style="font-size:18px;">\${o.channel==='call'?'📞':o.channel==='email'?'✉️':'💬'}</span>
            <div style="flex:1;">
              <div style="color:#f1f5f9;font-weight:600;">\${o.business_name || 'Lead #'+o.lead_id}</div>
              <div style="color:#64748b;">\${o.subject || o.body?.slice(0,60) || '—'}...</div>
            </div>
            <div style="text-align:right;">
              <span class="badge badge-\${o.status.toLowerCase()}">\${o.status}</span>
              <div style="font-size:11px;color:#475569;margin-top:4px;">\${o.sent_at ? new Date(o.sent_at).toLocaleString() : '—'}</div>
            </div>
          </div>
        \`).join('') || '<div style="text-align:center;padding:40px;color:#475569;">No outreach activity yet</div>'}
      </div>
    </div>
  \`;
}

function filterOutreach(channel, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const items = document.querySelectorAll('#outreach-feed > div[data-channel]');
  items.forEach(item => {
    item.style.display = channel === 'all' || item.dataset.channel === channel ? '' : 'none';
  });
}

// ============= PIPELINE (KANBAN) =============
async function renderPipeline() {
  const data = await api('GET', '/leads?limit=200');
  const leads = data?.leads || [];

  const stages = ['NEW','CONTACTED','RESPONDED','INTERESTED','CLOSED','LOST'];
  const stageColors = { NEW:'#3b82f6',CONTACTED:'#06b6d4',RESPONDED:'#10b981',INTERESTED:'#f59e0b',CLOSED:'#22c55e',LOST:'#ef4444' };

  const byStage = {};
  stages.forEach(s => byStage[s] = leads.filter(l => l.status === s));

  document.getElementById('page-content').innerHTML = \`
    <div class="kanban">
      \${stages.map(stage => \`
        <div class="kanban-col">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <span style="font-weight:700;font-size:13px;color:\${stageColors[stage]};">\${stage}</span>
            <span style="background:#334155;padding:2px 8px;border-radius:9999px;font-size:12px;">\${byStage[stage].length}</span>
          </div>
          \${byStage[stage].map(l => \`
            <div class="kanban-card" onclick="viewLead(\${l.id})">
              <div style="font-weight:600;font-size:13px;color:#f1f5f9;margin-bottom:4px;">\${l.name}</div>
              <div style="font-size:11px;color:#64748b;">\${l.industry || ''} · \${l.city || ''}</div>
              <div style="font-size:11px;color:#475569;margin-top:6px;">Score: <span style="color:#fbbf24;">\${l.lead_score}</span></div>
              \${l.demo_url ? '<div style="font-size:10px;color:#4ade80;margin-top:4px;">✅ Demo ready</div>' : ''}
            </div>
          \`).join('')}
          \${stage === 'NEW' ? \`<button class="btn btn-ghost" style="width:100%;margin-top:8px;font-size:12px;" onclick="openModal('add-lead-modal')">+ Add Lead</button>\` : ''}
        </div>
      \`).join('')}
    </div>
  \`;
}

// ============= CONVERSATIONS =============
async function renderConversations() {
  const data = await api('GET', '/conversations');
  const threads = data?.threads || [];
  const unread = data?.unread_count || 0;

  document.getElementById('page-content').innerHTML = \`
    <div style="display:flex;gap:20px;height:600px;">
      <!-- Thread list -->
      <div class="card" style="width:300px;overflow-y:auto;padding:0;">
        <div style="padding:16px;border-bottom:1px solid #334155;font-weight:700;color:#f1f5f9;">
          Inbox \${unread > 0 ? '<span class="badge badge-new" style="margin-left:8px;">'+unread+' unread</span>' : ''}
        </div>
        \${threads.map(t => \`
          <div style="padding:12px 16px;border-bottom:1px solid #1e293b;cursor:pointer;transition:background 0.2s;" 
               onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background=''"
               onclick="openThread(\${t.lead.id})">
            <div style="font-weight:600;font-size:13px;color:#f1f5f9;">\${t.lead.name}</div>
            <div style="font-size:11px;color:#64748b;">\${t.messages[0]?.message?.slice(0,40) || '—'}...</div>
            <div style="font-size:10px;color:#475569;margin-top:4px;">\${t.messages.length} messages</div>
          </div>
        \`).join('') || '<div style="padding:40px;text-align:center;color:#475569;">No conversations yet</div>'}
      </div>
      <!-- Message view -->
      <div class="card" style="flex:1;display:flex;flex-direction:column;">
        <div style="flex:1;display:flex;align-items:center;justify-content:center;color:#475569;" id="msg-area">
          <div style="text-align:center;">
            <div style="font-size:40px;margin-bottom:12px;">💬</div>
            <div>Select a conversation to view messages</div>
          </div>
        </div>
        <div style="border-top:1px solid #334155;padding:16px;display:flex;gap:12px;" id="reply-area" style="display:none;">
          <input class="input" id="reply-input" placeholder="Type a reply..." style="flex:1;" onkeydown="if(event.key==='Enter')sendReply()">
          <button class="btn btn-primary" onclick="sendReply()">Send</button>
        </div>
      </div>
    </div>
  \`;
}

// ============= PAYMENTS PAGE =============
async function renderPayments() {
  const data = await api('GET', '/payments');
  const payments = data?.payments || [];
  const stats = data?.stats || {};

  document.getElementById('page-content').innerHTML = \`
    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px;">
      \${renderKPICard('Total Revenue', '\$'+(stats.total_revenue||0).toLocaleString(), 'fas fa-dollar-sign', '#4ade80', 'all time')}
      \${renderKPICard('Revenue Today', '\$'+(stats.today_revenue||0).toLocaleString(), 'fas fa-calendar-day', '#fbbf24', 'earned')}
      \${renderKPICard('Paid Orders', stats.total_paid||0, 'fas fa-check-circle', '#34d399', 'completed')}
      \${renderKPICard('Pending', stats.total_pending||0, 'fas fa-clock', '#f87171', 'awaiting')}
    </div>

    <div class="card" style="overflow:auto;">
      <table class="table">
        <thead><tr><th>Business</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          \${payments.map(p => \`
            <tr>
              <td><div style="font-weight:600;color:#f1f5f9;">\${p.business_name}</div><div style="font-size:12px;color:#64748b;">\${p.city||'—'}</div></td>
              <td style="color:#4ade80;font-weight:700;">\$\${(p.amount/100).toFixed(2)}</td>
              <td><span class="badge \${p.status==='PAID'?'badge-closed':p.status==='PENDING'?'badge-new':'badge-lost'}">\${p.status}</span></td>
              <td style="color:#64748b;font-size:13px;">\${p.paid_at ? new Date(p.paid_at).toLocaleDateString() : new Date(p.created_at).toLocaleDateString()}</td>
              <td>
                \${p.payment_link ? \`<a href="\${p.payment_link}" target="_blank" class="btn btn-ghost" style="font-size:12px;padding:4px 8px;">🔗 Link</a>\` : '—'}
                \${p.status==='PENDING' ? \`<button class="btn btn-primary" style="font-size:12px;padding:4px 8px;margin-left:6px;" onclick="resendPayment(\${p.id})">📧 Resend</button>\` : ''}
              </td>
            </tr>
          \`).join('') || '<tr><td colspan="5" style="text-align:center;padding:40px;color:#475569;">No payments yet</td></tr>'}
        </tbody>
      </table>
    </div>
  \`;
}

// ============= ANALYTICS =============
async function renderAnalytics() {
  const data = await api('GET', '/dashboard/analytics');
  if (!data) return;

  document.getElementById('page-content').innerHTML = \`
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
      \${renderKPICard('Total Revenue', '\$'+(data.total_revenue||0).toLocaleString(), 'fas fa-dollar-sign', '#4ade80', 'all time')}
      \${renderKPICard('Avg Time to Close', (data.avg_hours_to_close||0)+' hrs', 'fas fa-clock', '#fbbf24', 'average')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
      <!-- Channel Performance -->
      <div class="card">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:#f1f5f9;">📡 Channel Performance</h3>
        \${(data.channel_performance||[]).map(c => \`
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #334155;">
            <span style="font-size:20px;">\${c.channel==='call'?'📞':c.channel==='email'?'✉️':'💬'}</span>
            <div style="flex:1;">
              <div style="font-weight:600;color:#f1f5f9;text-transform:capitalize;">\${c.channel}</div>
              <div style="font-size:12px;color:#64748b;">\${c.sent} sent · \${c.opened||0} opened · \${c.replied||0} replied</div>
            </div>
            <span style="color:#fbbf24;font-weight:700;">\${c.sent > 0 ? Math.round((c.replied||0)/c.sent*100) : 0}%</span>
          </div>
        \`).join('') || '<div style="color:#64748b;">No data yet</div>'}
      </div>
      <!-- Industry Performance -->
      <div class="card">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:#f1f5f9;">🏭 Industry Performance</h3>
        \${(data.industry_performance||[]).map(i => \`
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #334155;">
            <span style="font-size:16px;">\${getIndustryEmoji(i.industry)}</span>
            <div style="flex:1;">
              <div style="font-weight:600;color:#f1f5f9;">\${i.industry}</div>
              <div style="font-size:12px;color:#64748b;">\${i.total_leads} leads · \${i.closed} closed</div>
            </div>
            <span style="color:#4ade80;font-weight:700;">\${i.total_leads > 0 ? Math.round(i.closed/i.total_leads*100) : 0}%</span>
          </div>
        \`).join('') || '<div style="color:#64748b;">No data yet</div>'}
      </div>
    </div>
    <!-- City Performance -->
    <div class="card">
      <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:#f1f5f9;">📍 City Performance</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
        \${(data.city_performance||[]).map(c => \`
          <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;">
            <div style="font-weight:700;color:#f1f5f9;">\${c.city}</div>
            <div style="font-size:12px;color:#64748b;">\${c.total_leads} leads · \${c.closed} closed</div>
            <div class="score-bar" style="margin-top:8px;"><div class="score-fill" style="width:\${c.total_leads > 0 ? Math.round(c.closed/c.total_leads*100) : 0}%;background:#4ade80;"></div></div>
          </div>
        \`).join('') || '<div style="color:#64748b;">No data yet</div>'}
      </div>
    </div>
  \`;
}

// ============= SETTINGS =============
async function renderSettings() {
  const data = await api('GET', '/settings');
  const s = data?.settings || {};

  document.getElementById('page-content').innerHTML = \`
    <div style="max-width:720px;">
      <div class="card" style="margin-bottom:20px;">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:#f1f5f9;">🎯 Campaign Settings</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div><label style="font-size:12px;color:#94a3b8;">Target City</label>
            <input class="input" id="set-city" value="\${s.target_city||''}" style="width:100%;margin-top:4px;"></div>
          <div><label style="font-size:12px;color:#94a3b8;">Target State</label>
            <input class="input" id="set-state" value="\${s.target_state||''}" style="width:100%;margin-top:4px;"></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:#f1f5f9;">⚡ Rate Limits (Safety Controls)</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div><label style="font-size:12px;color:#94a3b8;">Max Emails/Day</label>
            <input class="input" id="set-emails" type="number" value="\${s.max_emails_per_day||50}" style="width:100%;margin-top:4px;"></div>
          <div><label style="font-size:12px;color:#94a3b8;">Max SMS/Day</label>
            <input class="input" id="set-sms" type="number" value="\${s.max_sms_per_day||30}" style="width:100%;margin-top:4px;"></div>
          <div><label style="font-size:12px;color:#94a3b8;">Max Calls/Day</label>
            <input class="input" id="set-calls" type="number" value="\${s.max_calls_per_day||100}" style="width:100%;margin-top:4px;"></div>
        </div>
        <div style="margin-top:12px;">
          <label style="font-size:12px;color:#94a3b8;">Min Lead Score (0-100)</label>
          <input class="input" id="set-minscore" type="number" value="\${s.min_lead_score||60}" style="width:120px;margin-top:4px;">
          <span style="font-size:12px;color:#64748b;margin-left:8px;">Only outreach leads with score ≥ this value</span>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:#f1f5f9;">🔑 API Configuration</h3>
        <div style="display:grid;gap:12px;">
          <div>
            <label style="font-size:12px;color:#94a3b8;">Stripe Publishable Key</label>
            <input class="input" value="pk_live_****" disabled style="width:100%;margin-top:4px;opacity:0.5;">
            <span style="font-size:11px;color:#4ade80;">✅ Configured via environment</span>
          </div>
          <div>
            <label style="font-size:12px;color:#94a3b8;">Resend API Key</label>
            <input class="input" value="re_****" disabled style="width:100%;margin-top:4px;opacity:0.5;">
            <span style="font-size:11px;color:#4ade80;">✅ Configured via environment</span>
          </div>
          <div>
            <label style="font-size:12px;color:#94a3b8;">OpenAI API Key</label>
            <input class="input" value="sk-proj-****" disabled style="width:100%;margin-top:4px;opacity:0.5;">
            <span style="font-size:11px;color:#4ade80;">✅ Configured via environment</span>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:#f1f5f9;">📜 Compliance</h3>
        <div style="font-size:13px;color:#94a3b8;line-height:1.8;">
          <p>✅ TCPA Compliance: SMS includes opt-out ("Reply STOP to opt out")</p>
          <p>✅ CAN-SPAM: All emails include unsubscribe link</p>
          <p>✅ Rate limiting: Enforced per channel per day</p>
          <p>✅ DNC handling: STOP replies auto-update lead to LOST</p>
          <p>✅ Business hours: Outreach respects timezone rules</p>
          <p>✅ Max 3 contact attempts per lead</p>
        </div>
      </div>

      <button class="btn btn-primary" onclick="saveSettings()" style="padding:12px 32px;font-size:15px;">💾 Save Settings</button>
    </div>
  \`;
}

// ============= ACTIONS =============
async function generateDemo(leadId) {
  showToast('Generating demo with AI...', 'info');
  const data = await api('POST', '/demos/generate', { lead_id: leadId });
  if (data?.demo?.demo_url) {
    showToast('Demo generated! Opening...', 'success');
    window.open(data.demo.demo_url, '_blank');
  } else if (data?.message?.includes('already exists') && data?.demo?.demo_url) {
    window.open(data.demo.demo_url, '_blank');
  }
}

async function runOutreach(leadId) {
  showToast('Running Day 1 outreach sequence...', 'info');
  const data = await api('POST', '/outreach/sequence', { lead_id: leadId, day: 1 });
  if (data) showToast('Outreach sequence started! Check Outreach page.', 'success');
}

async function createPaymentLink(leadId) {
  showToast('Creating payment link...', 'info');
  const data = await api('POST', '/payments/create-link', { lead_id: leadId });
  if (data?.payment_link) {
    showToast('Payment link created!', 'success');
    navigator.clipboard?.writeText(data.payment_link).then(() => showToast('Link copied to clipboard!', 'success'));
    window.open(data.payment_link, '_blank');
  }
}

async function submitLead(e) {
  e.preventDefault();
  const leadData = {
    name: document.getElementById('lead-name').value,
    industry: document.getElementById('lead-industry').value,
    phone: document.getElementById('lead-phone').value,
    email: document.getElementById('lead-email').value,
    city: document.getElementById('lead-city').value,
    state: document.getElementById('lead-state').value,
    website: document.getElementById('lead-website').value,
    address: document.getElementById('lead-address').value,
    notes: document.getElementById('lead-notes').value,
  };
  const data = await api('POST', '/leads', leadData);
  if (data?.lead) {
    showToast('Lead added successfully!', 'success');
    closeModal('add-lead-modal');
    document.getElementById('add-lead-form').reset();
    if (state.currentPage === 'leads') renderLeads();
    else if (state.currentPage === 'pipeline') renderPipeline();
    else if (state.currentPage === 'dashboard') renderDashboard();
  }
}

async function viewLead(leadId) {
  const data = await api('GET', '/leads/' + leadId);
  if (!data) return;
  const l = data.lead;
  openModal('lead-detail-modal');
  document.getElementById('lead-detail-title').textContent = l.name;
  document.getElementById('lead-detail-content').innerHTML = \`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div>
        <div style="font-size:12px;color:#64748b;">Industry</div>
        <div style="color:#f1f5f9;font-weight:600;">\${l.industry || '—'}</div>
      </div>
      <div>
        <div style="font-size:12px;color:#64748b;">Location</div>
        <div style="color:#f1f5f9;font-weight:600;">\${l.city || '—'}\${l.state ? ', '+l.state : ''}</div>
      </div>
      <div>
        <div style="font-size:12px;color:#64748b;">Phone</div>
        <div style="color:#f1f5f9;">\${l.phone || '—'}</div>
      </div>
      <div>
        <div style="font-size:12px;color:#64748b;">Email</div>
        <div style="color:#f1f5f9;">\${l.email || '—'}</div>
      </div>
      <div>
        <div style="font-size:12px;color:#64748b;">Lead Score</div>
        <div style="color:#fbbf24;font-weight:700;font-size:20px;">\${l.lead_score}/100</div>
      </div>
      <div>
        <div style="font-size:12px;color:#64748b;">Status</div>
        <span class="badge badge-\${l.status.toLowerCase()}">\${l.status}</span>
      </div>
    </div>

    \${l.demo_url ? \`<div style="margin-bottom:16px;padding:12px;background:#0f172a;border-radius:8px;border:1px solid #334155;">
      <div style="font-size:12px;color:#64748b;margin-bottom:4px;">Demo URL</div>
      <a href="\${l.demo_url}" target="_blank" style="color:#3b82f6;font-size:13px;">\${l.demo_url}</a>
    </div>\` : ''}

    <!-- Status change -->
    <div style="margin-bottom:16px;">
      <label style="font-size:12px;color:#94a3b8;">Update Status</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
        \${['NEW','CONTACTED','RESPONDED','INTERESTED','CLOSED','LOST'].map(s => \`
          <button onclick="updateLeadStatus(\${l.id},'\${s}')" class="btn \${l.status===s?'btn-primary':'btn-ghost'}" style="font-size:12px;padding:4px 10px;">\${s}</button>
        \`).join('')}
      </div>
    </div>

    <!-- Outreach history -->
    <div>
      <div style="font-size:12px;color:#64748b;margin-bottom:8px;font-weight:600;">OUTREACH HISTORY (\${data.outreach?.length || 0})</div>
      \${(data.outreach||[]).slice(0,5).map(o => \`
        <div style="padding:8px 0;border-bottom:1px solid #334155;font-size:12px;display:flex;gap:8px;align-items:center;">
          <span>\${o.channel==='call'?'📞':o.channel==='email'?'✉️':'💬'}</span>
          <span style="color:#94a3b8;">\${o.channel} #\${o.attempt_number}</span>
          <span class="badge badge-\${o.status.toLowerCase()}">\${o.status}</span>
          <span style="color:#475569;">\${o.sent_at ? new Date(o.sent_at).toLocaleDateString() : '—'}</span>
        </div>
      \`).join('') || '<div style="color:#475569;font-size:12px;">No outreach yet</div>'}
    </div>

    <!-- Actions -->
    <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="generateDemo(\${l.id});closeModal('lead-detail-modal')">🌐 Generate Demo</button>
      <button class="btn btn-success" onclick="runOutreach(\${l.id});closeModal('lead-detail-modal')">📤 Start Outreach</button>
      <button class="btn btn-ghost" onclick="createPaymentLink(\${l.id});closeModal('lead-detail-modal')">💳 Payment Link</button>
    </div>
  \`;
}

async function updateLeadStatus(leadId, status) {
  await api('PATCH', '/leads/' + leadId, { status });
  showToast('Status updated to ' + status, 'success');
  viewLead(leadId); // refresh
}

async function regenerateDemo(demoId) {
  showToast('Regenerating demo...', 'info');
  const data = await api('POST', '/demos/' + demoId + '/regenerate');
  if (data) { showToast('Demo regenerated!', 'success'); renderDemos(); }
}

async function deleteDemo(demoId) {
  if (!confirm('Delete this demo?')) return;
  await api('DELETE', '/demos/' + demoId);
  showToast('Demo deleted', 'info');
  renderDemos();
}

async function resendPayment(paymentId) {
  showToast('Resending payment link...', 'info');
  await api('POST', '/payments/' + paymentId + '/resend');
  showToast('Payment link resent!', 'success');
}

async function saveSettings() {
  const data = {
    target_city: document.getElementById('set-city').value,
    target_state: document.getElementById('set-state').value,
    max_emails_per_day: document.getElementById('set-emails').value,
    max_sms_per_day: document.getElementById('set-sms').value,
    max_calls_per_day: document.getElementById('set-calls').value,
    min_lead_score: document.getElementById('set-minscore').value,
  };
  await api('PATCH', '/settings', data);
  showToast('Settings saved!', 'success');
}

async function toggleCampaign() {
  const data = await api('POST', '/dashboard/toggle-campaign');
  if (data) {
    const btn = document.getElementById('toggle-campaign');
    btn.textContent = data.campaign_active ? 'Active' : 'Paused';
    btn.className = data.campaign_active ? 'btn btn-success' : 'btn btn-danger';
    btn.style.padding = '4px 12px';
    btn.style.fontSize = '12px';
    showToast('Campaign ' + (data.campaign_active ? 'activated' : 'paused'), data.campaign_active ? 'success' : 'warning');
  }
}

function importLeads() {
  showToast('CSV import: Use /api/leads/bulk with JSON array of leads', 'info');
}

async function openThread(leadId) {
  const data = await api('GET', '/conversations?lead_id=' + leadId);
  const msgs = data?.conversations || [];
  await api('POST', '/conversations/' + leadId + '/mark-read');
  document.getElementById('msg-area').innerHTML = \`
    <div style="width:100%;height:100%;overflow-y:auto;padding:16px;" id="thread-messages">
      \${msgs.map(m => \`
        <div style="display:flex;\${m.direction==='outbound'?'justify-content:flex-end':'justify-content:flex-start'};margin-bottom:12px;">
          <div style="max-width:70%;background:\${m.direction==='outbound'?'#2563eb':'#334155'};padding:10px 14px;border-radius:12px;font-size:13px;color:#f1f5f9;">
            <div>\${m.message || '—'}</div>
            <div style="font-size:10px;opacity:0.6;margin-top:4px;">\${m.channel.toUpperCase()} · \${new Date(m.created_at).toLocaleString()}</div>
          </div>
        </div>
      \`).join('') || '<div style="text-align:center;color:#475569;padding:20px;">No messages yet</div>'}
    </div>
  \`;
  const replyArea = document.getElementById('reply-area');
  replyArea.style.display = 'flex';
  replyArea.dataset.leadId = leadId;
}

async function sendReply() {
  const input = document.getElementById('reply-input');
  const leadId = document.getElementById('reply-area')?.dataset.leadId;
  if (!input?.value || !leadId) return;
  await api('POST', '/conversations', { lead_id: leadId, channel: 'sms', direction: 'outbound', message: input.value });
  showToast('Reply logged', 'success');
  input.value = '';
  openThread(leadId);
}

// ============= CHART HELPER =============
function renderChart(canvasId, type, labels, datasets) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (state.chartInstances[canvasId]) state.chartInstances[canvasId].destroy();
  state.chartInstances[canvasId] = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 12, font: { size: 12 } } } },
      scales: {
        x: { grid: { color: '#334155' }, ticks: { color: '#64748b' } },
        y: { grid: { color: '#334155' }, ticks: { color: '#64748b' } }
      }
    }
  });
}

// ============= HELPERS =============
function getIndustryEmoji(industry) {
  if (!industry) return '🏢';
  const lower = industry.toLowerCase();
  if (lower.includes('roof')) return '🏠';
  if (lower.includes('landscape') || lower.includes('lawn')) return '🌿';
  if (lower.includes('barber') || lower.includes('hair')) return '✂️';
  if (lower.includes('auto') || lower.includes('mechanic')) return '🔧';
  if (lower.includes('clean')) return '🧹';
  if (lower.includes('hvac')) return '❄️';
  if (lower.includes('plumb')) return '🔩';
  if (lower.includes('paint')) return '🎨';
  if (lower.includes('electric')) return '⚡';
  if (lower.includes('pest')) return '🐛';
  if (lower.includes('mov')) return '📦';
  return '🏢';
}

// ============= INIT =============
async function init() {
  // Load campaign status
  const stats = await api('GET', '/dashboard/stats');
  if (stats) {
    const btn = document.getElementById('toggle-campaign');
    btn.textContent = stats.campaign_active ? 'Active' : 'Paused';
    btn.className = 'btn ' + (stats.campaign_active ? 'btn-success' : 'btn-danger');
    btn.style.padding = '4px 12px';
    btn.style.fontSize = '12px';
  }

  // Check unread
  const unreadData = await api('GET', '/conversations/unread-count');
  if ((unreadData?.count || 0) > 0) {
    const badge = document.getElementById('nav-unread-count');
    badge.textContent = unreadData.count;
    badge.style.display = 'inline';
  }

  // Load leads count
  const leadsData = await api('GET', '/leads?limit=1');
  if (leadsData) document.getElementById('nav-leads-count').textContent = leadsData.total || 0;

  // Render initial page
  renderPage('dashboard');

  // Auto-refresh every 30 seconds
  setInterval(async () => {
    if (state.currentPage === 'dashboard') {
      const s = await api('GET', '/dashboard/stats');
      if (s) {
        document.getElementById('top-revenue').textContent = '\$' + (s.revenue_today || 0).toLocaleString();
        document.getElementById('top-leads').textContent = s.leads_today || 0;
        document.getElementById('top-conv').textContent = s.conversion_rate + '%';
      }
    }
  }, 30000);
}

// Mobile menu
if (window.innerWidth < 768) {
  document.getElementById('menu-btn').style.display = 'block';
}

init();
</script>
</body>
</html>`
}
