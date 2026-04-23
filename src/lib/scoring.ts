// Lead Quality Scoring Engine
export interface LeadScoreInput {
  website_status: 'NONE' | 'WEAK' | 'EXISTS';
  has_phone: boolean;
  has_email: boolean;
  is_active: boolean;
  industry: string;
  is_facebook_only?: boolean;
}

export function calculateLeadScore(input: LeadScoreInput): number {
  let score = 0;

  // Website status
  if (input.website_status === 'NONE') score += 40;
  else if (input.website_status === 'WEAK') score += 25;
  else score += 0; // Has good website - skip

  // Facebook only presence
  if (input.is_facebook_only) score += 25;

  // Contact info
  if (input.has_phone) score += 15;
  if (input.has_email) score += 10;

  // Active business
  if (input.is_active) score += 10;

  return Math.min(score, 100);
}

export const TARGET_INDUSTRIES = [
  'roofing',
  'landscaping',
  'barber',
  'barbershop',
  'hair salon',
  'auto repair',
  'mechanic',
  'cleaning',
  'house cleaning',
  'maid service',
  'hvac',
  'plumbing',
  'plumber',
  'painting',
  'painter',
  'electrical',
  'electrician',
  'pest control',
  'lawn care',
  'tree service',
  'pressure washing',
  'handyman',
  'moving',
  'locksmith',
  'flooring',
  'tile',
  'masonry',
  'concrete',
  'fence',
  'garage door',
  'appliance repair',
  'pool service',
  'carpet cleaning'
];

export function isTargetIndustry(industry: string): boolean {
  const lower = industry.toLowerCase();
  return TARGET_INDUSTRIES.some(t => lower.includes(t));
}

export function classifyWebsiteStatus(website: string | null): 'NONE' | 'WEAK' | 'EXISTS' {
  if (!website) return 'NONE';
  const lower = website.toLowerCase();
  
  // Facebook-only or social media
  if (lower.includes('facebook.com') || lower.includes('yelp.com') || 
      lower.includes('instagram.com') || lower.includes('google.com')) {
    return 'WEAK';
  }
  
  return 'EXISTS';
}
