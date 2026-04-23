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

export async function generateDemoContent(
  businessName: string,
  industry: string,
  city: string,
  state: string,
  apiKey: string
): Promise<DemoContent> {
  const prompt = `You are creating a high-converting demo website for a local business. Generate realistic, professional content.

Business: ${businessName}
Industry: ${industry}
Location: ${city}, ${state}

Generate JSON with this EXACT structure (no markdown, pure JSON):
{
  "headline": "Compelling headline about their primary service outcome (max 10 words)",
  "subheadline": "Trust-building subheadline mentioning city and specialty (max 20 words)",
  "services": [
    {"name": "Service 1 Name", "description": "Industry and location specific description (2 sentences)"},
    {"name": "Service 2 Name", "description": "Industry and location specific description (2 sentences)"},
    {"name": "Service 3 Name", "description": "Industry and location specific description (2 sentences)"}
  ],
  "about_text": "Professional about section referencing industry, city, and customer outcomes. 3-4 sentences. Sound like a real local business.",
  "cta_text": "Action-oriented CTA text (max 6 words)",
  "testimonials": [
    {"name": "John M.", "text": "Industry-specific testimonial mentioning city or local context", "rating": 5},
    {"name": "Sarah K.", "text": "Industry-specific testimonial about specific service", "rating": 5},
    {"name": "Mike T.", "text": "Industry-specific testimonial mentioning great results", "rating": 5}
  ],
  "meta_description": "SEO meta description for this business (max 160 chars)"
}

RULES:
- Never use generic text like "We provide great services"
- Always mention ${city} specifically
- Reference ${industry} naturally
- Sound like a real, established local business
- Headlines should focus on customer outcomes`;

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

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  const content = data.choices[0].message.content.trim();
  
  // Strip markdown code blocks if present
  const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleanContent) as DemoContent;
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
      1: `Hey,\n\nI came across ${businessName} and noticed you don't have a strong website presence. So I took 20 minutes and built a quick demo of what your ${industry} business could look like online in ${city}.\n\nHere it is: ${demoUrl}\n\nIf you like it, I can launch it fully for you for $500. Let me know what you think.\n\nBest,\nAlex`,
      2: `Hey,\n\nJust wanted to follow up — I made that demo site for your ${industry} business in ${city}.\n\nHere it is again: ${demoUrl}\n\nWorth a quick look — this is exactly how customers would see you online. Let me know your thoughts.\n\nBest,\nAlex`,
      3: `Hey,\n\nI haven't heard back, so I wasn't sure if you saw the demo I made for ${businessName}: ${demoUrl}\n\nIf it's not something you need, no worries — I'll take it down. If you do want it live in ${city}, I can have it up and running for you fast for just $500.\n\nBest,\nAlex`
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
