// Prospect Demo Pages — slug-based, no DB required
// Each entry maps a URL slug → full business profile for demo rendering

export interface ProspectProfile {
  slug: string;
  business_name: string;
  industry: string;
  city: string;
  state: string;
  email: string;           // prospect's email (for tracking)
  phone: string;
  tagline: string;
  services: { name: string; description: string; icon: string }[];
  about: string;
  cta: string;
  color_primary: string;
  color_secondary: string;
  hero_bg: string;         // CSS gradient
  nav_logo_icon: string;
}

// ─── PROSPECT REGISTRY ────────────────────────────────────────────────────────
export const PROSPECT_DEMOS: Record<string, ProspectProfile> = {

  'sunrise-plumbing': {
    slug: 'sunrise-plumbing',
    business_name: 'Sunrise Plumbing',
    industry: 'plumbing',
    city: 'Sacramento',
    state: 'CA',
    email: 'kedelin261@gmail.com',
    phone: '(916) 555-0142',
    tagline: 'Fast, Reliable Plumbing Service in Sacramento',
    services: [
      { name: 'Emergency Repairs',       description: '24/7 response for burst pipes, leaks, and urgent plumbing failures.',          icon: '🚨' },
      { name: 'Drain Cleaning',          description: 'Professional hydro-jetting and snaking for slow or blocked drains.',            icon: '🔩' },
      { name: 'Water Heater Services',   description: 'Installation, repair, and replacement of all water heater types.',             icon: '🔥' },
      { name: 'Pipe Replacement',        description: 'Full repiping solutions for aging or damaged pipe systems.',                    icon: '🔧' },
      { name: 'Fixture Installation',    description: 'Expert installation of sinks, faucets, toilets, and showerheads.',             icon: '🚿' },
      { name: 'Sewer Line Services',     description: 'Camera inspection, cleaning, and repair of sewer lines.',                      icon: '📷' },
    ],
    about: 'Sunrise Plumbing has served Sacramento homeowners and businesses since 2009. Our licensed plumbers arrive on time, diagnose fast, and fix it right the first time. We stand behind every job with a 100% satisfaction guarantee.',
    cta: 'Get a Free Estimate',
    color_primary: '#0369A1',
    color_secondary: '#0EA5E9',
    hero_bg: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)',
    nav_logo_icon: '🔧',
  },

  'barclay-inspection-services': {
    slug: 'barclay-inspection-services',
    business_name: 'Barclay Inspection Services',
    industry: 'home inspection',
    city: 'Portland',
    state: 'OR',
    email: 'jkbarclay261@gmail.com',
    phone: '(503) 555-0187',
    tagline: 'Thorough Home Inspections — Portland Buyers Trust',
    services: [
      { name: 'Buyer\'s Inspection',      description: 'Complete pre-purchase inspection covering structure, systems, and safety.',   icon: '🏠' },
      { name: 'Pre-Listing Inspection',   description: 'Identify issues before listing so sellers can price with confidence.',        icon: '📋' },
      { name: 'Roof Inspection',          description: 'Detailed assessment of roofing materials, flashing, and drainage.',           icon: '🏗️' },
      { name: 'Sewer Scope',              description: 'Camera-based sewer line inspection to detect blockages and damage.',          icon: '📷' },
      { name: 'Radon Testing',            description: 'Certified radon measurement with fast turnaround reports.',                   icon: '🔬' },
      { name: 'New Construction',         description: 'Phase inspections for new builds to catch issues before closing.',            icon: '🏗️' },
    ],
    about: 'Barclay Inspection Services has completed over 3,200 inspections across the Portland metro area. Our certified inspectors deliver same-day digital reports with photos, clear findings, and actionable recommendations — so you can make decisions with confidence.',
    cta: 'Schedule Your Inspection',
    color_primary: '#1E3A5F',
    color_secondary: '#2E6DA4',
    hero_bg: 'linear-gradient(135deg, #1E3A5F 0%, #2E6DA4 100%)',
    nav_logo_icon: '🏠',
  },

  'brown-family-dental': {
    slug: 'brown-family-dental',
    business_name: 'Brown Family Dental',
    industry: 'dental',
    city: 'Columbus',
    state: 'OH',
    email: 'mkbrown261@gmail.com',
    phone: '(614) 555-0231',
    tagline: 'Comfortable, Caring Dental Care for the Whole Family',
    services: [
      { name: 'Preventive Care',          description: 'Cleanings, exams, and X-rays to keep your family\'s smiles healthy.',        icon: '😁' },
      { name: 'Teeth Whitening',          description: 'Professional in-office whitening for fast, noticeable results.',              icon: '✨' },
      { name: 'Dental Implants',          description: 'Natural-looking permanent tooth replacement by experienced specialists.',      icon: '🦷' },
      { name: 'Invisalign®',              description: 'Clear aligner therapy for straighter teeth without traditional braces.',      icon: '📐' },
      { name: 'Emergency Dentistry',      description: 'Same-day appointments available for toothaches, chips, and urgent care.',     icon: '🚨' },
      { name: 'Children\'s Dentistry',    description: 'Gentle, kid-friendly care that builds healthy habits from the start.',        icon: '👶' },
    ],
    about: 'Brown Family Dental has been a trusted part of the Columbus community for over 15 years. Dr. Brown and the team take time to listen, explain every step, and ensure patients of all ages feel comfortable and cared for. We accept most major insurances.',
    cta: 'Book an Appointment',
    color_primary: '#0D7377',
    color_secondary: '#14BDAC',
    hero_bg: 'linear-gradient(135deg, #0D7377 0%, #14BDAC 100%)',
    nav_logo_icon: '🦷',
  },

  'edelin-property-group': {
    slug: 'edelin-property-group',
    business_name: 'Edelin Property Group',
    industry: 'property management',
    city: 'Charlotte',
    state: 'NC',
    email: 'edelinken@gmail.com',
    phone: '(704) 555-0316',
    tagline: 'Stress-Free Property Management Across Charlotte',
    services: [
      { name: 'Tenant Placement',         description: 'Thorough screening, background checks, and lease execution.',                 icon: '🔑' },
      { name: 'Rent Collection',          description: 'Automated online payments with consistent on-time disbursements to owners.',  icon: '💳' },
      { name: 'Maintenance Coordination', description: '24/7 maintenance request handling with vetted vendor network.',               icon: '🔧' },
      { name: 'Property Marketing',       description: 'Professional photos, listings on 50+ platforms, and rapid vacancy fill.',     icon: '📸' },
      { name: 'Financial Reporting',      description: 'Monthly owner statements and annual reports — clear, accessible records.',    icon: '📊' },
      { name: 'Lease Management',         description: 'Renewal negotiation, lease enforcement, and legal compliance oversight.',     icon: '📄' },
    ],
    about: 'Edelin Property Group manages residential and commercial properties throughout the Charlotte metro. Our team handles everything — from marketing vacancies to maintenance coordination — so property owners can enjoy passive income without the headaches.',
    cta: 'Get a Free Management Quote',
    color_primary: '#5B21B6',
    color_secondary: '#8B5CF6',
    hero_bg: 'linear-gradient(135deg, #5B21B6 0%, #8B5CF6 100%)',
    nav_logo_icon: '🏢',
  },

  'kc-legal-associates': {
    slug: 'kc-legal-associates',
    business_name: 'KC Legal Associates',
    industry: 'law',
    city: 'Atlanta',
    state: 'GA',
    email: 'kceesq@gmail.com',
    phone: '(404) 555-0408',
    tagline: 'Experienced Legal Representation in Atlanta',
    services: [
      { name: 'Business Law',             description: 'Entity formation, contracts, partnerships, and corporate governance.',        icon: '🏢' },
      { name: 'Real Estate Law',          description: 'Residential and commercial transactions, disputes, and title review.',        icon: '🏠' },
      { name: 'Employment Law',           description: 'Employer compliance, wrongful termination, and workplace disputes.',          icon: '⚖️' },
      { name: 'Contract Review',          description: 'Careful review and negotiation of business and personal agreements.',         icon: '📋' },
      { name: 'Dispute Resolution',       description: 'Mediation, arbitration, and litigation support for commercial disputes.',     icon: '🤝' },
      { name: 'Estate Planning',          description: 'Wills, trusts, powers of attorney, and probate guidance.',                   icon: '📜' },
    ],
    about: 'KC Legal Associates brings over 20 years of combined legal experience to clients across Atlanta and the surrounding metro area. We focus on practical, results-oriented counsel — helping individuals and businesses navigate complex legal matters with clarity and confidence.',
    cta: 'Schedule a Consultation',
    color_primary: '#1A1A2E',
    color_secondary: '#C41E3A',
    hero_bg: 'linear-gradient(135deg, #1A1A2E 0%, #C41E3A 100%)',
    nav_logo_icon: '⚖️',
  },

};

// ─── SLUG LOOKUP HELPER ───────────────────────────────────────────────────────
export function getProspectBySlug(slug: string): ProspectProfile | null {
  return PROSPECT_DEMOS[slug] ?? null;
}

// ─── HTML RENDERER ─────────────────────────────────────────────────────────────
export function renderProspectDemoHTML(p: ProspectProfile, appUrl: string): string {
  const servicesHTML = p.services.map(s => `
    <div class="service-card">
      <div class="service-icon">${s.icon}</div>
      <h3>${s.name}</h3>
      <p>${s.description}</p>
    </div>`).join('');

  const reviewers = [
    { name: 'James R.', text: `${p.business_name} exceeded my expectations. Professional, fast, and worth every penny.` },
    { name: 'Maria T.', text: `Best experience I've had with a ${p.industry} company in ${p.city}. Highly recommend!` },
    { name: 'David K.', text: `Called on a Tuesday, issue resolved by Wednesday. ${p.business_name} is who I call every time.` },
  ];

  const reviewsHTML = reviewers.map(r => `
    <div class="review-card">
      <div class="stars">★★★★★</div>
      <p>"${r.text}"</p>
      <strong>— ${r.name}</strong>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${p.business_name} — ${p.city}, ${p.state}</title>
  <meta name="description" content="${p.tagline}. Serving ${p.city}, ${p.state}.">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a1a; }

    /* NAV */
    nav {
      background: #fff;
      border-bottom: 3px solid ${p.color_primary};
      padding: 0 5%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 68px;
      position: sticky; top: 0; z-index: 100;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
    }
    .nav-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
    .nav-brand .icon { font-size: 1.6rem; }
    .nav-brand .name { font-size: 1.1rem; font-weight: 700; color: ${p.color_primary}; }
    .nav-phone { font-weight: 600; color: ${p.color_primary}; text-decoration: none; font-size: .95rem; }
    .nav-cta {
      background: ${p.color_primary}; color: #fff;
      padding: 9px 20px; border-radius: 6px;
      text-decoration: none; font-weight: 600; font-size: .9rem;
      transition: opacity .2s;
    }
    .nav-cta:hover { opacity: .88; }

    /* HERO */
    .hero {
      background: ${p.hero_bg};
      color: #fff;
      padding: 90px 5% 80px;
      text-align: center;
    }
    .hero-badge {
      display: inline-block;
      background: rgba(255,255,255,.18);
      border: 1px solid rgba(255,255,255,.35);
      border-radius: 20px;
      padding: 5px 16px;
      font-size: .82rem;
      letter-spacing: .04em;
      text-transform: uppercase;
      margin-bottom: 22px;
    }
    .hero h1 { font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 800; line-height: 1.15; margin-bottom: 18px; }
    .hero p  { font-size: 1.18rem; opacity: .9; max-width: 600px; margin: 0 auto 36px; }
    .hero-btns { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
    .btn-primary {
      background: #fff; color: ${p.color_primary};
      padding: 14px 32px; border-radius: 8px;
      font-weight: 700; font-size: 1rem; text-decoration: none;
      transition: transform .15s, box-shadow .15s;
      box-shadow: 0 4px 14px rgba(0,0,0,.15);
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.2); }
    .btn-outline {
      border: 2px solid rgba(255,255,255,.7); color: #fff;
      padding: 13px 28px; border-radius: 8px;
      font-weight: 600; font-size: 1rem; text-decoration: none;
      transition: background .2s;
    }
    .btn-outline:hover { background: rgba(255,255,255,.15); }

    /* TRUST BAR */
    .trust-bar {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 18px 5%;
      display: flex; gap: 36px; justify-content: center; flex-wrap: wrap;
    }
    .trust-item { display: flex; align-items: center; gap: 8px; font-size: .9rem; color: #475569; }
    .trust-icon { font-size: 1.1rem; }

    /* SECTION SHARED */
    section { padding: 72px 5%; }
    .section-label { font-size: .8rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: ${p.color_primary}; margin-bottom: 10px; }
    h2.section-title { font-size: clamp(1.6rem, 3vw, 2.4rem); font-weight: 800; margin-bottom: 14px; }
    .section-sub { font-size: 1.05rem; color: #64748b; max-width: 560px; }

    /* SERVICES */
    .services-section { background: #fff; }
    .services-header { text-align: center; margin-bottom: 48px; }
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 24px;
      max-width: 1100px; margin: 0 auto;
    }
    .service-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 28px;
      transition: box-shadow .2s, transform .2s;
    }
    .service-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,.1); transform: translateY(-3px); }
    .service-icon { font-size: 2rem; margin-bottom: 14px; }
    .service-card h3 { font-size: 1.05rem; font-weight: 700; margin-bottom: 8px; color: #1e293b; }
    .service-card p  { font-size: .92rem; color: #64748b; line-height: 1.55; }

    /* ABOUT */
    .about-section {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    }
    .about-inner {
      max-width: 900px; margin: 0 auto;
      display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center;
    }
    @media (max-width: 640px) { .about-inner { grid-template-columns: 1fr; } }
    .about-text p { font-size: 1.05rem; color: #334155; line-height: 1.7; margin-bottom: 24px; }
    .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .stat-box {
      background: #fff; border-radius: 10px; padding: 20px;
      text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,.06);
    }
    .stat-num { font-size: 2rem; font-weight: 800; color: ${p.color_primary}; }
    .stat-lbl { font-size: .8rem; color: #64748b; margin-top: 4px; }

    /* REVIEWS */
    .reviews-section { background: #fff; }
    .reviews-header { text-align: center; margin-bottom: 44px; }
    .reviews-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 24px; max-width: 900px; margin: 0 auto;
    }
    .review-card {
      background: #f8fafc; border-radius: 12px; padding: 26px;
      border-left: 4px solid ${p.color_primary};
    }
    .stars { color: #f59e0b; font-size: 1.1rem; margin-bottom: 12px; letter-spacing: 2px; }
    .review-card p { font-size: .95rem; color: #475569; line-height: 1.6; margin-bottom: 14px; font-style: italic; }
    .review-card strong { font-size: .9rem; color: #1e293b; }

    /* CONTACT FORM */
    .contact-section { background: ${p.color_primary}; color: #fff; text-align: center; }
    .contact-section h2 { font-size: clamp(1.6rem, 3vw, 2.2rem); font-weight: 800; margin-bottom: 12px; }
    .contact-section p { font-size: 1.05rem; opacity: .85; margin-bottom: 36px; }
    .contact-form {
      max-width: 540px; margin: 0 auto;
      display: grid; gap: 14px;
    }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 500px) { .form-row { grid-template-columns: 1fr; } }
    .contact-form input,
    .contact-form select,
    .contact-form textarea {
      width: 100%; padding: 13px 16px;
      border: none; border-radius: 8px;
      font-size: .95rem; font-family: inherit;
      background: rgba(255,255,255,.95);
      color: #1a1a1a;
    }
    .contact-form textarea { height: 100px; resize: vertical; }
    .submit-btn {
      width: 100%; padding: 15px;
      background: #fff; color: ${p.color_primary};
      border: none; border-radius: 8px;
      font-size: 1rem; font-weight: 700; cursor: pointer;
      transition: opacity .2s, transform .15s;
    }
    .submit-btn:hover { opacity: .9; transform: translateY(-1px); }

    /* FOOTER */
    footer {
      background: #0f172a; color: #94a3b8;
      padding: 28px 5%; text-align: center; font-size: .88rem;
    }
    footer strong { color: #e2e8f0; }

    /* DEMO BANNER */
    .demo-banner {
      background: #fef9c3;
      border-bottom: 2px solid #f59e0b;
      text-align: center;
      padding: 10px;
      font-size: .88rem;
      color: #78350f;
    }
    .demo-banner strong { color: #92400e; }
  </style>
</head>
<body>

<!-- Demo indicator strip -->
<div class="demo-banner">
  <strong>Preview:</strong> This is a personalised demo website for <strong>${p.business_name}</strong> — created by WebsiteDemoPro.
</div>

<!-- NAV -->
<nav>
  <a href="#" class="nav-brand">
    <span class="icon">${p.nav_logo_icon}</span>
    <span class="name">${p.business_name}</span>
  </a>
  <a href="tel:${p.phone.replace(/\D/g,'')}" class="nav-phone">${p.phone}</a>
  <a href="#contact" class="nav-cta">${p.cta}</a>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-badge">📍 Serving ${p.city}, ${p.state}</div>
  <h1>${p.tagline}</h1>
  <p>Trusted by homeowners and businesses throughout ${p.city}. Fast response, transparent pricing, quality guaranteed.</p>
  <div class="hero-btns">
    <a href="#contact" class="btn-primary">${p.cta}</a>
    <a href="tel:${p.phone.replace(/\D/g,'')}" class="btn-outline">📞 ${p.phone}</a>
  </div>
</section>

<!-- TRUST BAR -->
<div class="trust-bar">
  <div class="trust-item"><span class="trust-icon">✅</span> Licensed &amp; Insured</div>
  <div class="trust-item"><span class="trust-icon">⭐</span> 4.9 Star Rating</div>
  <div class="trust-item"><span class="trust-icon">📅</span> Same-Day Available</div>
  <div class="trust-item"><span class="trust-icon">💬</span> 500+ Happy Clients</div>
  <div class="trust-item"><span class="trust-icon">🔒</span> Satisfaction Guaranteed</div>
</div>

<!-- SERVICES -->
<section class="services-section">
  <div class="services-header">
    <div class="section-label">What We Do</div>
    <h2 class="section-title">Our Services</h2>
    <p class="section-sub">Everything you need from a trusted ${p.industry} professional in ${p.city}.</p>
  </div>
  <div class="services-grid">${servicesHTML}</div>
</section>

<!-- ABOUT -->
<section class="about-section">
  <div class="about-inner">
    <div class="about-text">
      <div class="section-label">About Us</div>
      <h2 class="section-title">${p.business_name}</h2>
      <p>${p.about}</p>
      <a href="#contact" class="btn-primary" style="display:inline-block;">${p.cta}</a>
    </div>
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-num">500+</div><div class="stat-lbl">Jobs Completed</div></div>
      <div class="stat-box"><div class="stat-num">4.9★</div><div class="stat-lbl">Average Rating</div></div>
      <div class="stat-box"><div class="stat-num">15+</div><div class="stat-lbl">Years in Business</div></div>
      <div class="stat-box"><div class="stat-num">100%</div><div class="stat-lbl">Satisfaction Rate</div></div>
    </div>
  </div>
</section>

<!-- REVIEWS -->
<section class="reviews-section">
  <div class="reviews-header">
    <div class="section-label">Customer Reviews</div>
    <h2 class="section-title">What Our Clients Say</h2>
  </div>
  <div class="reviews-grid">${reviewsHTML}</div>
</section>

<!-- CONTACT FORM -->
<section class="contact-section" id="contact">
  <h2>${p.cta}</h2>
  <p>Tell us about your needs and we'll be in touch within a few hours.</p>
  <form class="contact-form" onsubmit="handleSubmit(event)">
    <div class="form-row">
      <input type="text"  name="name"    placeholder="Your Name"         required>
      <input type="tel"   name="phone"   placeholder="Phone Number"      required>
    </div>
    <input   type="email" name="email"   placeholder="Email Address"     required>
    <select  name="service">
      ${p.services.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
    </select>
    <textarea name="message" placeholder="Tell us a bit about what you need…"></textarea>
    <button type="submit" class="submit-btn">${p.cta} →</button>
  </form>
</section>

<!-- FOOTER -->
<footer>
  <p><strong>${p.business_name}</strong> · ${p.city}, ${p.state} · <a href="tel:${p.phone.replace(/\D/g,'')}" style="color:#94a3b8">${p.phone}</a></p>
  <p style="margin-top:8px;font-size:.8rem">© 2024 ${p.business_name}. All rights reserved.</p>
</footer>

<script>
function handleSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('.submit-btn');
  btn.textContent = '✅ Request Received!';
  btn.style.background = '#22c55e';
  btn.style.color = '#fff';
  btn.disabled = true;
  // Track form submission
  fetch('${appUrl}/api/demos/track-prospect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: '${p.slug}',
      event: 'form_submit',
      business: '${p.business_name}'
    })
  }).catch(() => {});
}
// Track page view
fetch('${appUrl}/api/demos/track-prospect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug: '${p.slug}', event: 'page_view', business: '${p.business_name}' })
}).catch(() => {});
</script>

</body>
</html>`;
}
