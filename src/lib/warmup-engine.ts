// ============================================================
// WARMUP ENGINE — inbox placement optimization
// Controls send cadence, content rules, volume limits,
// engagement tracking, and fail-safe gates.
// ============================================================

export interface WarmupConfig {
  day: number;
  max_sends_per_day: number;
  links_allowed: boolean;
  require_prior_reply: boolean;
  min_delay_seconds: number;
  max_delay_seconds: number;
  content_rules: ContentRules;
}

export interface ContentRules {
  max_links: number;
  allow_pricing: boolean;
  allow_images: boolean;
  allow_heavy_formatting: boolean;
  forbidden_words: string[];
  required_style: 'conversational' | 'humanized' | 'full';
}

export interface SendRecord {
  recipient: string;
  resend_id: string;
  sent_at: string;
  round: number;
  has_link: boolean;
  has_pricing: boolean;
  subject: string;
  demo_slug?: string;
}

export interface EngagementMetrics {
  total_sent: number;
  replies_received: number;
  opens_tracked: number;
  spam_hits: number;
  bounces: number;
  reply_rate: number;
  spam_rate: number;
  bounce_rate: number;
  placement_data: PlacementRecord[];
}

export interface PlacementRecord {
  recipient: string;
  placement: 'PRIMARY' | 'PROMOTIONS' | 'SPAM' | 'NOT_RECEIVED' | 'UNKNOWN';
  checked_at: string;
}

// ─── WARMUP SCHEDULE ───────────────────────────────────────
export const WARMUP_SCHEDULE: WarmupConfig[] = [
  {
    day: 1,
    max_sends_per_day: 5,
    links_allowed: false,
    require_prior_reply: false,
    min_delay_seconds: 45,
    max_delay_seconds: 90,
    content_rules: {
      max_links: 0,
      allow_pricing: false,
      allow_images: false,
      allow_heavy_formatting: false,
      forbidden_words: ['offer', 'free', 'deal', 'price', 'cost', 'sale', 'discount', 'click here', 'limited time', 'act now'],
      required_style: 'conversational',
    },
  },
  {
    day: 2,
    max_sends_per_day: 5,
    links_allowed: false,
    require_prior_reply: false,
    min_delay_seconds: 45,
    max_delay_seconds: 90,
    content_rules: {
      max_links: 0,
      allow_pricing: false,
      allow_images: false,
      allow_heavy_formatting: false,
      forbidden_words: ['offer', 'free', 'deal', 'price', 'cost', 'sale', 'discount'],
      required_style: 'conversational',
    },
  },
  {
    day: 3,
    max_sends_per_day: 8,
    links_allowed: true,          // 1 link MAX, only after warmup established
    require_prior_reply: false,
    min_delay_seconds: 60,
    max_delay_seconds: 120,
    content_rules: {
      max_links: 1,
      allow_pricing: false,
      allow_images: false,
      allow_heavy_formatting: false,
      forbidden_words: ['offer', 'free', 'deal', 'discount', 'limited time'],
      required_style: 'humanized',
    },
  },
  {
    day: 4,
    max_sends_per_day: 8,
    links_allowed: true,
    require_prior_reply: false,
    min_delay_seconds: 60,
    max_delay_seconds: 120,
    content_rules: {
      max_links: 1,
      allow_pricing: false,
      allow_images: false,
      allow_heavy_formatting: false,
      forbidden_words: ['offer', 'free', 'deal', 'discount'],
      required_style: 'humanized',
    },
  },
  {
    day: 5,
    max_sends_per_day: 12,
    links_allowed: true,
    require_prior_reply: false,
    min_delay_seconds: 30,
    max_delay_seconds: 90,
    content_rules: {
      max_links: 1,
      allow_pricing: false,
      allow_images: true,
      allow_heavy_formatting: false,
      forbidden_words: ['free', 'deal', 'discount'],
      required_style: 'humanized',
    },
  },
];

// ─── FAIL CONDITIONS ───────────────────────────────────────
export const FAIL_THRESHOLDS = {
  MAX_SPAM_RATE: 0.10,      // 10%
  MAX_BOUNCE_RATE: 0.05,    // 5%
  MIN_REPLY_RATE: 0.20,     // 20% (hard stop)
  MIN_REPLY_RATE_SCALE: 0.40, // 40% (required to scale)
};

// ─── CONTENT VALIDATOR ─────────────────────────────────────
export interface ValidationResult {
  valid: boolean;
  issues: string[];
  link_count: number;
  has_forbidden_words: string[];
}

export function validateEmailContent(
  subject: string,
  htmlBody: string,
  config: WarmupConfig
): ValidationResult {
  const issues: string[] = [];
  const body = htmlBody.toLowerCase();
  const subj = subject.toLowerCase();

  // Count links
  const linkMatches = htmlBody.match(/https?:\/\//g) || [];
  const linkCount = linkMatches.length;

  if (linkCount > config.content_rules.max_links) {
    issues.push(`TOO_MANY_LINKS: found ${linkCount}, max ${config.content_rules.max_links}`);
  }

  // Forbidden words
  const foundForbidden: string[] = [];
  for (const word of config.content_rules.forbidden_words) {
    if (body.includes(word.toLowerCase()) || subj.includes(word.toLowerCase())) {
      foundForbidden.push(word);
    }
  }
  if (foundForbidden.length > 0) {
    issues.push(`FORBIDDEN_WORDS: ${foundForbidden.join(', ')}`);
  }

  // Pricing check
  if (!config.content_rules.allow_pricing) {
    const pricingPatterns = /\$\d+|\d+\s*USD|per month|monthly fee|one.time fee/i;
    if (pricingPatterns.test(htmlBody)) {
      issues.push('PRICING_DETECTED');
    }
  }

  // Image check
  if (!config.content_rules.allow_images) {
    if (/<img/i.test(htmlBody)) {
      issues.push('IMAGES_NOT_ALLOWED');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    link_count: linkCount,
    has_forbidden_words: foundForbidden,
  };
}

// ─── ENGAGEMENT CALCULATOR ─────────────────────────────────
export function calculateMetrics(
  sends: SendRecord[],
  replies: number,
  spamHits: number,
  bounces: number,
  placements: PlacementRecord[]
): EngagementMetrics {
  const total = sends.length;
  const replyRate = total > 0 ? replies / total : 0;
  const spamRate = total > 0 ? spamHits / total : 0;
  const bounceRate = total > 0 ? bounces / total : 0;

  return {
    total_sent: total,
    replies_received: replies,
    opens_tracked: 0, // requires pixel tracking
    spam_hits: spamHits,
    bounces,
    reply_rate: replyRate,
    spam_rate: spamRate,
    bounce_rate: bounceRate,
    placement_data: placements,
  };
}

// ─── GATE CHECKER ──────────────────────────────────────────
export interface GateResult {
  can_send: boolean;
  can_scale: boolean;
  reason?: string;
  action: 'PROCEED' | 'HOLD' | 'STOP_ALL';
}

export function checkScalingGate(metrics: EngagementMetrics): GateResult {
  // Hard stops
  if (metrics.spam_rate > FAIL_THRESHOLDS.MAX_SPAM_RATE) {
    return { can_send: false, can_scale: false, action: 'STOP_ALL', reason: `SPAM_RATE_EXCEEDED: ${(metrics.spam_rate * 100).toFixed(1)}%` };
  }
  if (metrics.bounce_rate > FAIL_THRESHOLDS.MAX_BOUNCE_RATE) {
    return { can_send: false, can_scale: false, action: 'STOP_ALL', reason: `BOUNCE_RATE_EXCEEDED: ${(metrics.bounce_rate * 100).toFixed(1)}%` };
  }
  if (metrics.total_sent >= 10 && metrics.reply_rate < FAIL_THRESHOLDS.MIN_REPLY_RATE) {
    return { can_send: false, can_scale: false, action: 'STOP_ALL', reason: `REPLY_RATE_TOO_LOW: ${(metrics.reply_rate * 100).toFixed(1)}% (min 20%)` };
  }

  // Scaling gate
  const canScale = metrics.reply_rate >= FAIL_THRESHOLDS.MIN_REPLY_RATE_SCALE;

  return {
    can_send: true,
    can_scale: canScale,
    action: 'PROCEED',
    reason: canScale ? undefined : `Reply rate ${(metrics.reply_rate * 100).toFixed(1)}% — need 40% to scale`,
  };
}

// ─── DELAY RANDOMIZER ──────────────────────────────────────
export function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── SUBJECT LINE RANDOMIZER ───────────────────────────────
export function humanizeSubject(businessName: string, industry: string, city: string): string {
  const patterns = [
    `quick question about ${businessName}`,
    `${businessName} — quick question`,
    `question for ${businessName}`,
    `${city} ${industry} — quick question`,
    `hey — about ${businessName}`,
    `${businessName} — had a question`,
  ];
  return patterns[Math.floor(Math.random() * patterns.length)];
}

// ─── THREAD CONTINUATION COPY ──────────────────────────────
export const FOLLOWUP_BRIDGES = [
  "hey — just wanted to follow up on my last message.",
  "hi — circling back on what I sent earlier.",
  "hey — wanted to share something quick since I had your attention.",
  "hi — one more thing I wanted to share.",
  "hey — didn't want to leave you hanging after my last note.",
];

export function getFollowupBridge(): string {
  return FOLLOWUP_BRIDGES[Math.floor(Math.random() * FOLLOWUP_BRIDGES.length)];
}
