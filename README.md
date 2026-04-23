# LeadGen Pro — B2B Sales Engine

## 🚀 Project Overview
**LeadGen Pro** is a fully autonomous B2B lead generation, demo creation, and sales execution engine. It identifies local businesses with no/weak web presence, generates personalized demo websites, and executes a 3-channel outreach system to close $500 website deals.

## 🌐 URLs
- **Production**: https://leadgen-pro.pages.dev
- **Dashboard**: https://leadgen-pro.pages.dev/
- **API Health**: https://leadgen-pro.pages.dev/api/dashboard/stats
- **Demo Viewer**: https://leadgen-pro.pages.dev/demo/{slug}

## ✅ Completed Features
1. **Dashboard Overview** — KPI cards, charts, funnel, real-time stats
2. **Lead Management** — Add, search, filter, score, bulk import leads
3. **AI Lead Scoring** — Auto-calculates quality score (0-100) per lead
4. **Demo Generator** — GPT-4o-mini powered custom website per business
5. **Demo Viewer** — Public landing page with tracking pixel
6. **Outreach Engine** — Email (Resend), SMS, Call sequences with rate limiting
7. **CRM Pipeline** — Kanban board with 6 stages (NEW → CLOSED)
8. **Conversations** — Unified inbox for all channel replies
9. **Payments** — Stripe checkout link generation ($500)
10. **Analytics** — Channel, industry, city performance breakdowns
11. **Settings** — Rate limits, campaign toggle, compliance rules
12. **TCPA/CAN-SPAM Compliance** — Opt-out handling, unsubscribe links

## 🏗️ Architecture
- **Backend**: Hono (TypeScript) on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite) — `leadgen-pro-production`
- **Frontend**: Vanilla JS SPA with Chart.js + Tailwind CSS
- **AI**: OpenAI GPT-4o-mini for demo content + outreach personalization
- **Email**: Resend API with personalized 3-sequence campaigns
- **Payments**: Stripe Checkout Sessions
- **Platform**: Cloudflare Pages (edge-deployed globally)

## 📊 Data Models
- **Leads** — Business info, score (0-100), status, website_status
- **Demos** — AI-generated website content, tracking, view count
- **Outreach** — Per-channel log with status tracking (SENT/OPENED/CLICKED)
- **Conversations** — Unified SMS/Email/Call reply inbox
- **Payments** — Stripe session tracking, revenue reporting

## ⚡ Lead Scoring Logic
| Signal | Score |
|--------|-------|
| No website | +40 |
| Facebook-only | +25 |
| Has phone | +15 |
| Has email | +10 |
| Active business | +10 |
| **Min to outreach** | **60+** |

## 📤 Outreach Sequence
- **Day 1**: Call → SMS (10 min gap) → Email
- **Day 3**: Email follow-up only
- **Day 5**: Final SMS push
- **Max**: 3 attempts per lead. Never all channels at once.

## 🔒 Compliance
- TCPA: SMS includes "Reply STOP to opt out"
- CAN-SPAM: Emails include unsubscribe link
- Rate limiting: 50 emails/day, 30 SMS/day, 100 calls/day
- DNC: STOP replies auto-mark lead as LOST

## 💳 Payment Flow
1. Generate payment link ($500 Stripe checkout)
2. On success: Lead → CLOSED, trigger production build
3. Payment link can be resent via email

## 🚀 Deployment
- **Platform**: Cloudflare Pages
- **D1 Database ID**: 98615fbb-0b49-4f24-a835-91e4ef7f8ee9
- **Status**: ✅ Live
- **Last Updated**: 2026-04-23

## 🗂️ API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard/stats` | GET | KPI metrics |
| `/api/dashboard/funnel` | GET | Pipeline funnel |
| `/api/dashboard/charts` | GET | Chart data |
| `/api/leads` | GET/POST | Lead management |
| `/api/leads/:id` | GET/PATCH | Lead detail |
| `/api/leads/bulk` | POST | Bulk import |
| `/api/demos/generate` | POST | AI demo generation |
| `/api/demos/view/:slug` | GET | Public demo viewer |
| `/api/outreach/send-email` | POST | Send email |
| `/api/outreach/send-sms` | POST | Send SMS |
| `/api/outreach/sequence` | POST | Full sequence |
| `/api/payments/create-link` | POST | Stripe link |
| `/api/payments/webhook` | POST | Stripe webhook |
| `/api/conversations` | GET/POST | Inbox |
| `/api/settings` | GET/PATCH | Config |

## 📝 Next Steps
1. Integrate Twilio for real SMS/Call delivery
2. Add Google Maps / Yelp scraper for auto lead discovery
3. Add screenshot service for demo previews
4. Add Twilio AI voice calling (ElevenLabs)
5. Add email warm-up sequence automation
6. Add production website builder (post-payment)
7. Add multi-domain email rotation
