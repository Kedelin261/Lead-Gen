-- LeadGen Pro - Initial Schema
-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  industry TEXT,
  city TEXT,
  state TEXT,
  website TEXT,
  website_status TEXT DEFAULT 'NONE',
  lead_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'NEW',
  source TEXT DEFAULT 'manual',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Demo sites table
CREATE TABLE IF NOT EXISTS demos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  demo_url TEXT,
  screenshot_url TEXT,
  headline TEXT,
  subheadline TEXT,
  services TEXT,
  about_text TEXT,
  cta_text TEXT,
  primary_color TEXT DEFAULT '#2563EB',
  viewed INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  last_viewed DATETIME,
  status TEXT DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Outreach table
CREATE TABLE IF NOT EXISTS outreach (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  subject TEXT,
  body TEXT,
  sent_at DATETIME,
  opened_at DATETIME,
  clicked_at DATETIME,
  replied_at DATETIME,
  attempt_number INTEGER DEFAULT 1,
  external_id TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL,
  message TEXT,
  from_number TEXT,
  to_number TEXT,
  ai_suggested_reply TEXT,
  read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  amount INTEGER DEFAULT 50000,
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'PENDING',
  payment_link TEXT,
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  industry TEXT,
  status TEXT DEFAULT 'ACTIVE',
  leads_total INTEGER DEFAULT 0,
  leads_contacted INTEGER DEFAULT 0,
  leads_responded INTEGER DEFAULT 0,
  leads_closed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('campaign_active', 'true'),
  ('max_emails_per_day', '50'),
  ('max_sms_per_day', '30'),
  ('max_calls_per_day', '100'),
  ('target_city', 'New York'),
  ('target_state', 'NY'),
  ('target_industries', '["roofing","landscaping","barber","auto repair","cleaning","HVAC","plumbing","painting","electrical","pest control"]'),
  ('outreach_sequence', '{"day1":["call","sms","email"],"day3":["email"],"day5":["sms"]}'),
  ('min_lead_score', '60'),
  ('openai_model', 'gpt-4o-mini'),
  ('stripe_price', '50000');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(lead_score);
CREATE INDEX IF NOT EXISTS idx_outreach_lead_id ON outreach(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_channel ON outreach(channel);
CREATE INDEX IF NOT EXISTS idx_demos_lead_id ON demos(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON payments(lead_id);
