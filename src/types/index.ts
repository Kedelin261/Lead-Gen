export type Bindings = {
  DB: D1Database;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  RESEND_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PUBLISHABLE_KEY: string;
  JWT_SECRET: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
  APP_URL: string;
};

export interface Lead {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  website_status: 'NONE' | 'WEAK' | 'EXISTS';
  lead_score: number;
  status: 'NEW' | 'CONTACTED' | 'RESPONDED' | 'INTERESTED' | 'CLOSED' | 'LOST';
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Demo {
  id: number;
  lead_id: number;
  demo_url: string | null;
  screenshot_url: string | null;
  headline: string | null;
  subheadline: string | null;
  services: string | null;
  about_text: string | null;
  cta_text: string | null;
  primary_color: string;
  viewed: number;
  view_count: number;
  last_viewed: string | null;
  status: string;
  created_at: string;
}

export interface Outreach {
  id: number;
  lead_id: number;
  channel: 'email' | 'sms' | 'call';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'REPLIED' | 'FAILED' | 'BOUNCED';
  subject: string | null;
  body: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  attempt_number: number;
  external_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Payment {
  id: number;
  lead_id: number;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  payment_link: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: number;
  lead_id: number;
  channel: string;
  direction: 'inbound' | 'outbound';
  message: string | null;
  from_number: string | null;
  to_number: string | null;
  ai_suggested_reply: string | null;
  read: number;
  created_at: string;
}

export interface DashboardStats {
  leads_today: number;
  demos_today: number;
  calls_today: number;
  emails_today: number;
  sms_today: number;
  deals_closed: number;
  revenue_today: number;
  total_leads: number;
  total_demos: number;
  conversion_rate: number;
  campaign_active: boolean;
}
