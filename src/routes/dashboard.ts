import { Hono } from 'hono';
import type { Bindings } from '../types';

const dashboard = new Hono<{ Bindings: Bindings }>();

// GET /api/dashboard/stats - Main dashboard statistics
dashboard.get('/stats', async (c) => {
  const { DB } = c.env;

  const today = new Date().toISOString().split('T')[0];

  const [leadsToday, demosToday, callsToday, emailsToday, smsToday, dealsClosed, revenue, totalLeads, campaignActive] = await Promise.all([
    DB.prepare(`SELECT COUNT(*) as count FROM leads WHERE DATE(created_at) = DATE('now')`).first<{ count: number }>(),
    DB.prepare(`SELECT COUNT(*) as count FROM demos WHERE DATE(created_at) = DATE('now')`).first<{ count: number }>(),
    DB.prepare(`SELECT COUNT(*) as count FROM outreach WHERE channel='call' AND DATE(created_at) = DATE('now')`).first<{ count: number }>(),
    DB.prepare(`SELECT COUNT(*) as count FROM outreach WHERE channel='email' AND DATE(created_at) = DATE('now')`).first<{ count: number }>(),
    DB.prepare(`SELECT COUNT(*) as count FROM outreach WHERE channel='sms' AND DATE(created_at) = DATE('now')`).first<{ count: number }>(),
    DB.prepare(`SELECT COUNT(*) as count FROM leads WHERE status='CLOSED'`).first<{ count: number }>(),
    DB.prepare(`SELECT SUM(amount)/100.0 as total FROM payments WHERE status='PAID' AND DATE(paid_at) = DATE('now')`).first<{ total: number }>(),
    DB.prepare(`SELECT COUNT(*) as count FROM leads`).first<{ count: number }>(),
    DB.prepare(`SELECT value FROM settings WHERE key='campaign_active'`).first<{ value: string }>()
  ]);

  const totalContacted = await DB.prepare(`SELECT COUNT(*) as count FROM leads WHERE status != 'NEW'`).first<{ count: number }>();
  const totalClosed = await DB.prepare(`SELECT COUNT(*) as count FROM leads WHERE status='CLOSED'`).first<{ count: number }>();
  const conversionRate = totalLeads?.count ? ((totalClosed?.count || 0) / totalLeads.count * 100) : 0;

  return c.json({
    leads_today: leadsToday?.count || 0,
    demos_today: demosToday?.count || 0,
    calls_today: callsToday?.count || 0,
    emails_today: emailsToday?.count || 0,
    sms_today: smsToday?.count || 0,
    deals_closed: dealsClosed?.count || 0,
    revenue_today: revenue?.total || 0,
    total_leads: totalLeads?.count || 0,
    total_contacted: totalContacted?.count || 0,
    total_closed: totalClosed?.count || 0,
    conversion_rate: Math.round(conversionRate * 10) / 10,
    campaign_active: campaignActive?.value === 'true'
  });
});

// GET /api/dashboard/funnel - Conversion funnel data
dashboard.get('/funnel', async (c) => {
  const { DB } = c.env;

  const result = await DB.prepare(`
    SELECT status, COUNT(*) as count FROM leads GROUP BY status ORDER BY
    CASE status
      WHEN 'NEW' THEN 1
      WHEN 'CONTACTED' THEN 2
      WHEN 'RESPONDED' THEN 3
      WHEN 'INTERESTED' THEN 4
      WHEN 'CLOSED' THEN 5
      WHEN 'LOST' THEN 6
      ELSE 7
    END
  `).all();

  return c.json({ funnel: result.results });
});

// GET /api/dashboard/charts - Chart data for revenue/outreach over time
dashboard.get('/charts', async (c) => {
  const { DB } = c.env;

  const outreachChart = await DB.prepare(`
    SELECT DATE(created_at) as date,
      SUM(CASE WHEN channel='call' THEN 1 ELSE 0 END) as calls,
      SUM(CASE WHEN channel='email' THEN 1 ELSE 0 END) as emails,
      SUM(CASE WHEN channel='sms' THEN 1 ELSE 0 END) as sms
    FROM outreach
    WHERE created_at >= DATE('now', '-14 days')
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `).all();

  const revenueChart = await DB.prepare(`
    SELECT DATE(paid_at) as date, SUM(amount)/100.0 as revenue, COUNT(*) as deals
    FROM payments
    WHERE status='PAID' AND paid_at >= DATE('now', '-30 days')
    GROUP BY DATE(paid_at)
    ORDER BY date ASC
  `).all();

  const leadsChart = await DB.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as leads
    FROM leads
    WHERE created_at >= DATE('now', '-14 days')
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `).all();

  return c.json({
    outreach: outreachChart.results,
    revenue: revenueChart.results,
    leads: leadsChart.results
  });
});

// GET /api/dashboard/insights - AI-generated insights
dashboard.get('/insights', async (c) => {
  const { DB } = c.env;

  const insights: { type: string; message: string; severity: 'info' | 'warning' | 'error' | 'success' }[] = [];

  // Check open rates
  const emailStats = await DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='OPENED' THEN 1 ELSE 0 END) as opened
    FROM outreach WHERE channel='email' AND created_at >= DATE('now', '-7 days')
  `).first<{ total: number; opened: number }>();

  if (emailStats && emailStats.total > 10) {
    const openRate = (emailStats.opened / emailStats.total) * 100;
    if (openRate < 20) {
      insights.push({ type: 'email', message: `Low email open rate (${Math.round(openRate)}%) — consider A/B testing subject lines`, severity: 'warning' });
    } else if (openRate > 40) {
      insights.push({ type: 'email', message: `Great email open rate (${Math.round(openRate)}%) — keep using current subject lines`, severity: 'success' });
    }
  }

  // Check demo views
  const demoStats = await DB.prepare(`
    SELECT COUNT(*) as total, SUM(CASE WHEN viewed=1 THEN 1 ELSE 0 END) as viewed
    FROM demos WHERE created_at >= DATE('now', '-7 days')
  `).first<{ total: number; viewed: number }>();

  if (demoStats && demoStats.total > 5) {
    const viewRate = (demoStats.viewed / demoStats.total) * 100;
    if (viewRate < 10) {
      insights.push({ type: 'demo', message: `Demo view rate is low (${Math.round(viewRate)}%) — improve outreach messaging`, severity: 'warning' });
    }
  }

  // Check best industry
  const topIndustry = await DB.prepare(`
    SELECT industry, COUNT(*) as count FROM leads
    WHERE status='CLOSED' GROUP BY industry ORDER BY count DESC LIMIT 1
  `).first<{ industry: string; count: number }>();

  if (topIndustry) {
    insights.push({ type: 'performance', message: `Best performing niche: ${topIndustry.industry} (${topIndustry.count} closes)`, severity: 'info' });
  }

  // Check unconverted leads
  const staleLeads = await DB.prepare(`
    SELECT COUNT(*) as count FROM leads WHERE status='INTERESTED' AND updated_at < DATE('now', '-3 days')
  `).first<{ count: number }>();

  if ((staleLeads?.count || 0) > 0) {
    insights.push({ type: 'pipeline', message: `${staleLeads?.count} interested leads need follow-up (3+ days inactive)`, severity: 'warning' });
  }

  // Unread conversations
  const unread = await DB.prepare(`SELECT COUNT(*) as count FROM conversations WHERE read=0 AND direction='inbound'`).first<{ count: number }>();
  if ((unread?.count || 0) > 0) {
    insights.push({ type: 'inbox', message: `${unread?.count} unread messages require your attention`, severity: 'warning' });
  }

  if (insights.length === 0) {
    insights.push({ type: 'system', message: 'System running normally. Start adding leads to begin outreach.', severity: 'info' });
  }

  return c.json({ insights });
});

// GET /api/dashboard/analytics - Deep analytics
dashboard.get('/analytics', async (c) => {
  const { DB } = c.env;

  const channelPerformance = await DB.prepare(`
    SELECT channel,
      COUNT(*) as sent,
      SUM(CASE WHEN status='OPENED' THEN 1 ELSE 0 END) as opened,
      SUM(CASE WHEN status='CLICKED' THEN 1 ELSE 0 END) as clicked,
      SUM(CASE WHEN status='REPLIED' THEN 1 ELSE 0 END) as replied
    FROM outreach GROUP BY channel
  `).all();

  const industryPerformance = await DB.prepare(`
    SELECT industry,
      COUNT(*) as total_leads,
      SUM(CASE WHEN status='CLOSED' THEN 1 ELSE 0 END) as closed,
      SUM(CASE WHEN status='INTERESTED' THEN 1 ELSE 0 END) as interested
    FROM leads
    WHERE industry IS NOT NULL
    GROUP BY industry ORDER BY closed DESC LIMIT 10
  `).all();

  const cityPerformance = await DB.prepare(`
    SELECT city,
      COUNT(*) as total_leads,
      SUM(CASE WHEN status='CLOSED' THEN 1 ELSE 0 END) as closed
    FROM leads WHERE city IS NOT NULL
    GROUP BY city ORDER BY closed DESC LIMIT 10
  `).all();

  const avgTimeToClose = await DB.prepare(`
    SELECT AVG(julianday(updated_at) - julianday(created_at)) * 24 as avg_hours
    FROM leads WHERE status='CLOSED'
  `).first<{ avg_hours: number }>();

  const totalRevenue = await DB.prepare(`
    SELECT SUM(amount)/100.0 as total FROM payments WHERE status='PAID'
  `).first<{ total: number }>();

  return c.json({
    channel_performance: channelPerformance.results,
    industry_performance: industryPerformance.results,
    city_performance: cityPerformance.results,
    avg_hours_to_close: Math.round(avgTimeToClose?.avg_hours || 0),
    total_revenue: totalRevenue?.total || 0
  });
});

// GET /api/dashboard/alerts - System alerts
dashboard.get('/alerts', async (c) => {
  const { DB } = c.env;
  const alerts: { id: string; message: string; type: string; severity: string }[] = [];

  const emailBounces = await DB.prepare(`
    SELECT COUNT(*) as count FROM outreach WHERE status='BOUNCED' AND DATE(created_at) = DATE('now')
  `).first<{ count: number }>();
  if ((emailBounces?.count || 0) > 5) {
    alerts.push({ id: 'bounce', message: `High bounce rate: ${emailBounces?.count} bounces today`, type: 'email', severity: 'error' });
  }

  const failedPayments = await DB.prepare(`
    SELECT COUNT(*) as count FROM payments WHERE status='FAILED'
  `).first<{ count: number }>();
  if ((failedPayments?.count || 0) > 0) {
    alerts.push({ id: 'payment', message: `${failedPayments?.count} failed payments need attention`, type: 'payment', severity: 'error' });
  }

  return c.json({ alerts });
});

// POST /api/dashboard/toggle-campaign - Toggle campaign status
dashboard.post('/toggle-campaign', async (c) => {
  const { DB } = c.env;
  const current = await DB.prepare(`SELECT value FROM settings WHERE key='campaign_active'`).first<{ value: string }>();
  const newValue = current?.value === 'true' ? 'false' : 'true';
  await DB.prepare(`UPDATE settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key='campaign_active'`).bind(newValue).run();
  return c.json({ campaign_active: newValue === 'true' });
});

export default dashboard;
