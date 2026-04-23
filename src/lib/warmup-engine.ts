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
  MAX_SPAM_RATE: 0.10,          // 10%  → STOP_ALL
  MAX_BOUNCE_RATE: 0.05,        // 5%   → STOP_ALL
  MIN_REPLY_RATE: 0.20,         // 20%  → need to PROCEED
  MIN_REPLY_RATE_SCALE: 0.40,   // 40%  → required to scale
  THROTTLE_THRESHOLD: 25,       // total_sends before THROTTLE → HOLD
  PRIMARY_PLACEMENT_OVERRIDE: 0.60, // ≥60% primary → allow sending even with 0 reply_rate
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
  reason: string;
  action: 'PROCEED' | 'THROTTLE' | 'HOLD' | 'STOP_ALL';
  status: 'PROCEED' | 'THROTTLE' | 'HOLD' | 'STOP_ALL';
  send_limit: number;
  link_policy: 'NO_LINKS' | 'ONE_LINK_ALLOWED';
  next_action: string;
}

/**
 * State machine rules (in priority order):
 *
 * STOP_ALL  — SPF/DKIM/DMARC fail, spam_rate > 10 %, or bounce_rate > 5 %
 * HOLD      — reply_rate == 0 AND total_sends >= 25  → pause, manual review
 * THROTTLE  — reply_rate < 20 % AND total_sends < 25  → max 5/day, no links, keep warming
 * PROCEED   — reply_rate >= 20 % AND spam < 10 % AND bounce < 5 %
 *
 * Primary-placement override:
 *   If primary_placement_rate >= 60 % → allow sending even when reply_rate == 0
 *   (overrides THROTTLE/HOLD but NOT STOP_ALL)
 *
 * Follow-up policy:
 *   Allow follow-ups when initial email delivered and
 *   placement == PRIMARY or PROMOTIONS, regardless of missing replies.
 */
export function checkScalingGate(
  metrics: EngagementMetrics,
  authPassed: boolean = true,
): GateResult {
  // ── 1. Hard STOP_ALL conditions ────────────────────────────
  if (!authPassed) {
    return {
      can_send: false, can_scale: false,
      action: 'STOP_ALL', status: 'STOP_ALL',
      reason: 'SPF/DKIM/DMARC authentication failed — do not send',
      send_limit: 0, link_policy: 'NO_LINKS',
      next_action: 'Fix DNS authentication records before resuming',
    };
  }
  if (metrics.spam_rate > FAIL_THRESHOLDS.MAX_SPAM_RATE) {
    return {
      can_send: false, can_scale: false,
      action: 'STOP_ALL', status: 'STOP_ALL',
      reason: `SPAM_RATE_EXCEEDED: ${(metrics.spam_rate * 100).toFixed(1)}% (max 10%)`,
      send_limit: 0, link_policy: 'NO_LINKS',
      next_action: 'Investigate spam complaints before resuming outreach',
    };
  }
  if (metrics.bounce_rate > FAIL_THRESHOLDS.MAX_BOUNCE_RATE) {
    return {
      can_send: false, can_scale: false,
      action: 'STOP_ALL', status: 'STOP_ALL',
      reason: `BOUNCE_RATE_EXCEEDED: ${(metrics.bounce_rate * 100).toFixed(1)}% (max 5%)`,
      send_limit: 0, link_policy: 'NO_LINKS',
      next_action: 'Clean recipient list, remove invalid addresses',
    };
  }

  // ── 2. Primary-placement override ─────────────────────────
  const primaryPlacements = metrics.placement_data.filter(p => p.placement === 'PRIMARY').length;
  const totalPlacements   = metrics.placement_data.length;
  const primaryRate = totalPlacements > 0 ? primaryPlacements / totalPlacements : 0;
  const placementOverride = primaryRate >= FAIL_THRESHOLDS.PRIMARY_PLACEMENT_OVERRIDE;

  // ── 3. Zero reply-rate branching ──────────────────────────
  if (metrics.reply_rate === 0) {
    // Override: primary placement ≥ 60% → allow despite 0 replies
    if (placementOverride) {
      return {
        can_send: true, can_scale: false,
        action: 'THROTTLE', status: 'THROTTLE',
        reason: `Reply rate 0% but primary placement ${(primaryRate * 100).toFixed(0)}% ≥ 60% — placement override active`,
        send_limit: 5, link_policy: 'ONE_LINK_ALLOWED',
        next_action: 'Continue sending (placement override). Encourage replies to unlock scaling.',
      };
    }

    // HOLD: no replies AND meaningful volume reached
    if (metrics.total_sent >= FAIL_THRESHOLDS.THROTTLE_THRESHOLD) {
      return {
        can_send: false, can_scale: false,
        action: 'HOLD', status: 'HOLD',
        reason: `Reply rate 0% after ${metrics.total_sent} sends — manual review required`,
        send_limit: 0, link_policy: 'NO_LINKS',
        next_action: 'Pause outbound. Check inboxes for placement, review content, verify recipients.',
      };
    }

    // THROTTLE: no replies yet, still in early stage
    return {
      can_send: true, can_scale: false,
      action: 'THROTTLE', status: 'THROTTLE',
      reason: `Reply rate 0% — early stage (${metrics.total_sent}/${FAIL_THRESHOLDS.THROTTLE_THRESHOLD} sends). Throttling volume.`,
      send_limit: 5, link_policy: 'NO_LINKS',
      next_action: 'Send max 5/day, no links, plain-text humanized copy. Collect reply data.',
    };
  }

  // ── 4. Low reply-rate (> 0 but < 20%) ─────────────────────
  if (metrics.reply_rate < FAIL_THRESHOLDS.MIN_REPLY_RATE) {
    if (metrics.total_sent >= FAIL_THRESHOLDS.THROTTLE_THRESHOLD) {
      return {
        can_send: false, can_scale: false,
        action: 'HOLD', status: 'HOLD',
        reason: `Reply rate ${(metrics.reply_rate * 100).toFixed(1)}% < 20% after ${metrics.total_sent} sends`,
        send_limit: 0, link_policy: 'NO_LINKS',
        next_action: 'Pause and review content. Reply rate must reach 20% before scaling.',
      };
    }
    return {
      can_send: true, can_scale: false,
      action: 'THROTTLE', status: 'THROTTLE',
      reason: `Reply rate ${(metrics.reply_rate * 100).toFixed(1)}% < 20% — throttling`,
      send_limit: 5, link_policy: 'NO_LINKS',
      next_action: 'Prioritize reply-driving plain-text messages. Do not introduce links yet.',
    };
  }

  // ── 5. PROCEED (reply_rate ≥ 20%) ─────────────────────────
  const canScale = metrics.reply_rate >= FAIL_THRESHOLDS.MIN_REPLY_RATE_SCALE;
  return {
    can_send: true,
    can_scale: canScale,
    action: 'PROCEED', status: 'PROCEED',
    reason: canScale
      ? `Reply rate ${(metrics.reply_rate * 100).toFixed(1)}% ≥ 40% — scaling permitted`
      : `Reply rate ${(metrics.reply_rate * 100).toFixed(1)}% ≥ 20% — sending allowed, scale at 40%`,
    send_limit: canScale ? 12 : 8,
    link_policy: 'ONE_LINK_ALLOWED',
    next_action: canScale
      ? 'Scale volume to 12/day. Personalized links allowed.'
      : 'Increase to 8/day. Introduce personalized demo links in follow-ups.',
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
