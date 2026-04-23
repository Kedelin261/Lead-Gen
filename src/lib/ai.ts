// AI Content Generation for Demo Sites
export interface DemoContent {
  headline: string;
  subheadline: string;
  services: { name: string; description: string }[];
  about_text: string;
  cta_text: string;
  testimonials: { name: string; text: string; rating: number }[];
  meta_description: string;
}

// Industry-specific local fallback content templates
const INDUSTRY_TEMPLATES: Record<string, {
  services: string[][];
  cta: string;
}> = {
  plumbing: {
    services: [
      ['Emergency Plumbing Repair', 'Fast 24/7 emergency service for burst pipes, leaks, and drain emergencies.'],
      ['Drain Cleaning & Unclogging', 'Professional hydro-jetting and snake services to clear stubborn blockages.'],
      ['Water Heater Installation', 'Expert installation and repair of tank and tankless water heaters.'],
      ['Pipe Replacement', 'Full and partial pipe replacement using modern, durable materials.'],
      ['Fixture Installation', 'Professional installation of faucets, toilets, and bathroom fixtures.'],
    ],
    cta: 'Get a Free Estimate Today'
  },
  hvac: {
    services: [
      ['AC Installation & Replacement', 'High-efficiency air conditioning systems installed by certified technicians.'],
      ['Heating System Repair', 'Expert furnace and heat pump repair to keep your home comfortable year-round.'],
      ['HVAC Maintenance Tune-Up', 'Annual maintenance plans to maximize system efficiency and longevity.'],
      ['Air Quality Solutions', 'Advanced filtration and humidity control for healthier indoor air.'],
      ['Emergency HVAC Service', '24/7 emergency repairs when your system fails at the worst time.'],
    ],
    cta: 'Schedule Free System Check'
  },
  roofing: {
    services: [
      ['Roof Replacement', 'Full roof replacements using premium materials backed by manufacturer warranties.'],
      ['Roof Repair', 'Fast, reliable repairs for leaks, missing shingles, and storm damage.'],
      ['Storm Damage Assessment', 'Free inspections and insurance claim assistance after storm damage.'],
      ['Gutter Installation', 'Professional gutter systems to protect your home from water damage.'],
      ['Roof Inspection', 'Comprehensive inspections with detailed reports and photo documentation.'],
    ],
    cta: 'Get Your Free Roof Inspection'
  },
  landscaping: {
    services: [
      ['Lawn Maintenance', 'Regular mowing, edging, and trimming to keep your lawn looking pristine.'],
      ['Landscape Design', 'Custom landscape designs that transform your outdoor space.'],
      ['Tree & Shrub Care', 'Expert pruning, trimming, and health treatments for trees and shrubs.'],
      ['Irrigation Systems', 'Smart irrigation installation and repair to save water and money.'],
      ['Seasonal Cleanup', 'Spring and fall cleanup services to prepare your property for every season.'],
    ],
    cta: 'Schedule a Free Estimate'
  },
  cleaning: {
    services: [
      ['Residential Cleaning', 'Thorough home cleaning services tailored to your schedule and needs.'],
      ['Deep Cleaning', 'Intensive cleaning for move-ins, move-outs, or spring cleaning projects.'],
      ['Commercial Cleaning', 'Professional office and commercial space cleaning on your schedule.'],
      ['Post-Construction Cleanup', 'Specialized cleaning after renovations or new construction.'],
      ['Recurring Maid Service', 'Weekly, bi-weekly, or monthly cleaning subscriptions available.'],
    ],
    cta: 'Book Your First Cleaning'
  },
  painting: {
    services: [
      ['Interior Painting', 'Professional interior painting with premium paints and meticulous prep work.'],
      ['Exterior Painting', 'Weather-resistant exterior coatings applied by experienced painting crews.'],
      ['Cabinet Refinishing', 'Transform your kitchen cabinets without the cost of full replacement.'],
      ['Commercial Painting', 'Minimal-disruption commercial painting for offices and businesses.'],
      ['Color Consultation', 'Free color consultation to help you choose the perfect palette.'],
    ],
    cta: 'Get a Free Color Consultation'
  },
  electrical: {
    services: [
      ['Electrical Panel Upgrades', 'Safe, code-compliant panel upgrades for modern power demands.'],
      ['Outlet & Switch Installation', 'Professional installation of outlets, switches, and smart home devices.'],
      ['Lighting Installation', 'Interior and exterior lighting design and installation services.'],
      ['EV Charger Installation', 'Level 2 home EV charging station installation by certified electricians.'],
      ['Safety Inspections', 'Comprehensive electrical inspections with detailed safety reports.'],
    ],
    cta: 'Schedule Free Safety Inspection'
  },
  'pest control': {
    services: [
      ['General Pest Control', 'Comprehensive treatments targeting ants, spiders, roaches, and more.'],
      ['Termite Treatment', 'Advanced termite detection and treatment to protect your property.'],
      ['Rodent Control', 'Humane and effective rodent exclusion and removal services.'],
      ['Bed Bug Elimination', 'Guaranteed bed bug treatments with heat and chemical options.'],
      ['Mosquito Control', 'Seasonal mosquito reduction programs for outdoor enjoyment.'],
    ],
    cta: 'Get a Free Pest Inspection'
  },
  'lawn care': {
    services: [
      ['Lawn Fertilization', 'Customized fertilization programs for a lush, green lawn all season.'],
      ['Weed Control', 'Pre- and post-emergent weed control to keep your lawn weed-free.'],
      ['Lawn Aeration', 'Core aeration to improve water absorption and root growth.'],
      ['Overseeding', 'Thick up thin lawns with professional overseeding services.'],
      ['Lawn Mowing', 'Regular mowing and edging to maintain a perfectly manicured lawn.'],
    ],
    cta: 'Start Your Lawn Program Today'
  },
  'auto repair': {
    services: [
      ['Oil Change & Maintenance', 'Quick, professional oil changes and multi-point safety inspections.'],
      ['Brake Repair & Replacement', 'Comprehensive brake system service for safe stopping every time.'],
      ['Engine Diagnostics', 'Advanced computer diagnostics to pinpoint engine issues fast.'],
      ['Transmission Service', 'Expert transmission repair and fluid service to extend vehicle life.'],
      ['Tire Services', 'Tire rotation, balancing, and replacement for smooth, safe rides.'],
    ],
    cta: 'Book Your Service Appointment'
  },
  moving: {
    services: [
      ['Local Moving', 'Efficient, careful local moves completed on schedule every time.'],
      ['Long-Distance Moving', 'Full-service long-distance moves with tracking and insurance.'],
      ['Packing Services', 'Professional packing using quality materials to protect your belongings.'],
      ['Furniture Assembly', 'Expert disassembly and reassembly of all furniture types.'],
      ['Storage Solutions', 'Secure, climate-controlled storage available for short or long term.'],
    ],
    cta: 'Get a Free Moving Quote'
  },
  default: {
    services: [
      ['Professional Services', 'High-quality professional services delivered by experienced specialists.'],
      ['Consultation & Assessment', 'Free initial consultation to assess your needs and provide solutions.'],
      ['Emergency Response', 'Fast response times for urgent situations — available 24/7.'],
      ['Maintenance Programs', 'Affordable ongoing maintenance plans to protect your investment.'],
      ['Quality Guarantee', '100% satisfaction guaranteed or we will make it right, no questions asked.'],
    ],
    cta: 'Contact Us for a Free Quote'
  }
};

function getIndustryTemplate(industry: string): typeof INDUSTRY_TEMPLATES['default'] {
  const lower = industry.toLowerCase();
  for (const [key, tmpl] of Object.entries(INDUSTRY_TEMPLATES)) {
    if (lower.includes(key)) return tmpl;
  }
  return INDUSTRY_TEMPLATES.default;
}

function generateLocalDemoContent(
  businessName: string,
  industry: string,
  city: string,
  state: string
): DemoContent {
  const tmpl = getIndustryTemplate(industry);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const ind = cap(industry);

  // Pick 3 random services
  const shuffled = tmpl.services.sort(() => Math.random() - 0.5).slice(0, 3);

  return {
    headline: `Expert ${ind} Services in ${city} You Can Trust`,
    subheadline: `${businessName} delivers professional ${industry.toLowerCase()} solutions to homeowners and businesses across ${city}, ${state}.`,
    services: shuffled.map(([name, description]) => ({ name, description })),
    about_text: `${businessName} has been proudly serving the ${city} community with professional ${industry.toLowerCase()} services. Our team of skilled technicians is committed to delivering exceptional results on every job. We understand that our customers trust us with their most important investments, which is why we never cut corners. Call us today and discover why ${city} residents consistently choose ${businessName}.`,
    cta_text: tmpl.cta,
    testimonials: [
      { name: 'John M.', text: `Best ${industry.toLowerCase()} service in ${city}! Fast, professional, and great value. Highly recommend ${businessName}!`, rating: 5 },
      { name: 'Sarah K.', text: `I called ${businessName} for an emergency and they were at my door within the hour. Outstanding service every step of the way.`, rating: 5 },
      { name: 'Mike T.', text: `Used them twice now — consistently excellent work. The whole crew in ${city} is top notch and very professional.`, rating: 5 }
    ],
    meta_description: `${businessName} — Professional ${industry} services in ${city}, ${state}. Fast response, licensed & insured. Call today for a free estimate.`
  };
}

export async function generateDemoContent(
  businessName: string,
  industry: string,
  city: string,
  state: string,
  apiKey: string
): Promise<DemoContent> {
  // Try OpenAI first if key is available
  if (apiKey) {
    try {
      const prompt = `You are creating a high-converting demo website for a local business. Generate realistic, professional content.\n\nBusiness: ${businessName}\nIndustry: ${industry}\nLocation: ${city}, ${state}\n\nGenerate JSON with this EXACT structure (no markdown, pure JSON):\n{\n  "headline": "Compelling headline about their primary service outcome (max 10 words)",\n  "subheadline": "Trust-building subheadline mentioning city and specialty (max 20 words)",\n  "services": [\n    {"name": "Service 1 Name", "description": "Industry and location specific description (2 sentences)"},\n    {"name": "Service 2 Name", "description": "Industry and location specific description (2 sentences)"},\n    {"name": "Service 3 Name", "description": "Industry and location specific description (2 sentences)"}\n  ],\n  "about_text": "Professional about section referencing industry, city, and customer outcomes. 3-4 sentences.",\n  "cta_text": "Action-oriented CTA text (max 6 words)",\n  "testimonials": [\n    {"name": "John M.", "text": "Industry-specific testimonial mentioning city", "rating": 5},\n    {"name": "Sarah K.", "text": "Industry-specific testimonial about specific service", "rating": 5},\n    {"name": "Mike T.", "text": "Industry-specific testimonial mentioning great results", "rating": 5}\n  ],\n  "meta_description": "SEO meta description (max 160 chars)"\n}\n\nRULES: Always mention ${city}. Reference ${industry} naturally. Sound like a real local business.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (response.ok) {
        const data = await response.json() as { choices: { message: { content: string } }[] };
        const content = data.choices[0].message.content.trim();
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanContent) as DemoContent;
        // Validate required fields
        if (parsed.headline && parsed.services && parsed.services.length > 0) {
          return parsed;
        }
      }
      // If rate limited or error, fall through to local generation
    } catch {
      // Fall through to local generation
    }
  }

  // Fallback: generate locally without OpenAI
  return generateLocalDemoContent(businessName, industry, city, state);
}

export async function generateOutreachMessage(
  type: 'email_subject' | 'email_body' | 'sms',
  attempt: number,
  businessName: string,
  industry: string,
  city: string,
  demoUrl: string,
  apiKey: string
): Promise<string> {
  const templates: Record<string, Record<number, string>> = {
    email_subject: {
      1: `Quick idea for ${businessName}`,
      2: `Did you see this? (${businessName})`,
      3: `Should I take this down?`
    },
    email_body: {
      1: `Hey,\n\nI came across ${businessName} and noticed you don't have a strong website presence. So I took 20 minutes and built a quick demo of what your ${industry} business could look like online in ${city}.\n\nHere it is: ${demoUrl}\n\nIf you like it, I can launch it fully for you for $500. Let me know what you think.\n\nBest,\nAlex\n\n---\nTo unsubscribe, reply with "UNSUBSCRIBE". This email concerns your business's online presence.`,
      2: `Hey,\n\nJust wanted to follow up — I made that demo site for your ${industry} business in ${city}.\n\nHere it is again: ${demoUrl}\n\nWorth a quick look — this is exactly how customers would see you online. Let me know your thoughts.\n\nBest,\nAlex\n\n---\nTo unsubscribe, reply with "UNSUBSCRIBE".`,
      3: `Hey,\n\nI haven't heard back, so I wasn't sure if you saw the demo I made for ${businessName}: ${demoUrl}\n\nIf it's not something you need, no worries — I'll take it down. If you do want it live in ${city}, I can have it up and running for you fast for just $500.\n\nBest,\nAlex\n\n---\nTo unsubscribe, reply with "UNSUBSCRIBE".`
    },
    sms: {
      1: `Hey, I made a free demo website for ${businessName} in ${city}. Want the link? Reply STOP to opt out`,
      2: `Just checking — want me to send that demo site I made for your ${industry} business in ${city}? Reply STOP to opt out`,
      3: `Here's the demo I made for ${businessName}: ${demoUrl} — can launch it for $500 if you like it. Reply STOP to opt out`
    }
  };

  return templates[type]?.[attempt] || templates[type]?.[1] || '';
}

export async function generateCallScript(
  businessName: string,
  industry: string,
  city: string,
  ownerName: string = 'there',
  apiKey: string
): Promise<string> {
  return `STEP 1 - PATTERN INTERRUPT:
"Hey, is this the owner of ${businessName}?" [WAIT]
"Perfect — I'll be quick. I actually built something for your business and wanted your quick opinion."

STEP 2 - HOOK:
"I noticed your ${industry} business in ${city} doesn't have a strong website, so I went ahead and created a quick demo for you — completely free."

STEP 3 - PROBLEM AGITATION:
"Right now, customers are searching for ${industry} services in ${city} online — and if you're not showing up properly, they're going straight to your competitors."

STEP 4 - DEMO PRESENTATION:
"I made you a live demo so you can actually see what your business should look like online."

STEP 5 - MICRO-COMMITMENT:
"Can I text or email it to you real quick?" [PRIMARY GOAL]

STEP 6 - CLOSE (IF INTERESTED):
"If you like what you see, we can launch it fully for you for just $500 — done-for-you, no headaches, up in 48 hours."

OBJECTIONS:
"I'm not interested" → "Totally fair. Let me just send it over — if it's not useful you can ignore it."
"I already have a website" → "Got it — quick question, is it actually bringing you consistent customers or just sitting there?"
"I'm busy" → "Understood — this will take 10 seconds. I'll send it over so you can look whenever you have time."`;
}
