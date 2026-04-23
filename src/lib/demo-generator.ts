// Demo Website HTML Generator
import type { DemoContent } from './ai';

const INDUSTRY_COLORS: Record<string, string> = {
  roofing: '#DC2626',
  landscaping: '#16A34A',
  barber: '#7C3AED',
  barbershop: '#7C3AED',
  'hair salon': '#EC4899',
  'auto repair': '#1D4ED8',
  mechanic: '#1D4ED8',
  cleaning: '#0EA5E9',
  hvac: '#0891B2',
  plumbing: '#0369A1',
  painting: '#F59E0B',
  electrical: '#D97706',
  'pest control': '#65A30D',
  'lawn care': '#16A34A',
  handyman: '#B45309',
  moving: '#6366F1',
  default: '#2563EB'
};

const INDUSTRY_ICONS: Record<string, string> = {
  roofing: '🏠',
  landscaping: '🌿',
  barber: '✂️',
  barbershop: '✂️',
  'hair salon': '💇',
  'auto repair': '🔧',
  cleaning: '🧹',
  hvac: '❄️',
  plumbing: '🔩',
  painting: '🎨',
  electrical: '⚡',
  'pest control': '🐛',
  'lawn care': '🌱',
  handyman: '🔨',
  moving: '📦',
  default: '⭐'
};

export function getIndustryColor(industry: string): string {
  const lower = industry.toLowerCase();
  for (const [key, color] of Object.entries(INDUSTRY_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return INDUSTRY_COLORS.default;
}

export function getIndustryIcon(industry: string): string {
  const lower = industry.toLowerCase();
  for (const [key, icon] of Object.entries(INDUSTRY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return INDUSTRY_ICONS.default;
}

export function generateDemoHTML(
  businessName: string,
  industry: string,
  city: string,
  state: string,
  phone: string | null,
  email: string | null,
  address: string | null,
  content: DemoContent,
  demoId: string,
  appUrl: string
): string {
  const color = getIndustryColor(industry);
  const icon = getIndustryIcon(industry);
  const trackingUrl = `${appUrl}/api/demos/${demoId}/track`;
  const paymentUrl = `${appUrl}/pay/${demoId}`;
  
  const servicesHTML = content.services.map(s => `
    <div class="service-card">
      <div class="service-icon">✓</div>
      <h3>${s.name}</h3>
      <p>${s.description}</p>
    </div>
  `).join('');

  const testimonialsHTML = content.testimonials.map(t => `
    <div class="testimonial-card">
      <div class="stars">${'★'.repeat(t.rating)}</div>
      <p>"${t.text}"</p>
      <strong>— ${t.name}</strong>
    </div>
  `).join('');

  const phoneLink = phone ? `<a href="tel:${phone.replace(/\D/g, '')}" class="btn btn-secondary">📞 Call Now: ${phone}</a>` : '';
  const mapEmbed = address ? `
    <div class="map-section">
      <h2>Find Us in ${city}</h2>
      <div class="map-container">
        <iframe
          width="100%"
          height="300"
          frameborder="0"
          style="border:0"
          src="https://maps.google.com/maps?q=${encodeURIComponent(address + ' ' + city + ' ' + state)}&output=embed"
          allowfullscreen>
        </iframe>
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${businessName} | ${city}, ${state}</title>
  <meta name="description" content="${content.meta_description}">
  <meta property="og:title" content="${businessName}">
  <meta property="og:description" content="${content.meta_description}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root { --primary: ${color}; --dark: #1a1a2e; --light: #f8fafc; --text: #334155; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: var(--text); }
    
    /* DEMO BANNER */
    .demo-banner {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      text-align: center;
      padding: 12px 20px;
      font-size: 14px;
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .demo-banner a {
      color: #fbbf24;
      font-weight: 700;
      text-decoration: none;
      padding: 6px 16px;
      background: rgba(251,191,36,0.2);
      border-radius: 20px;
      border: 1px solid #fbbf24;
      margin-left: 12px;
      transition: all 0.2s;
    }
    .demo-banner a:hover { background: #fbbf24; color: #1a1a2e; }

    /* HEADER */
    header {
      background: white;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      flex-wrap: wrap;
      gap: 12px;
    }
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo-icon { font-size: 32px; }
    .logo h1 { font-size: 22px; font-weight: 800; color: var(--primary); }
    .logo span { font-size: 13px; color: #64748b; }
    .header-cta { display: flex; gap: 12px; flex-wrap: wrap; }

    /* HERO */
    .hero {
      background: linear-gradient(135deg, var(--primary) 0%, #1e3a5f 100%);
      color: white;
      padding: 80px 24px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    }
    .hero-badge {
      display: inline-block;
      background: rgba(255,255,255,0.15);
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 13px;
      margin-bottom: 20px;
      backdrop-filter: blur(10px);
    }
    .hero h1 { font-size: clamp(28px, 5vw, 52px); font-weight: 900; margin-bottom: 16px; line-height: 1.2; }
    .hero p { font-size: clamp(16px, 2vw, 20px); opacity: 0.9; max-width: 600px; margin: 0 auto 32px; }
    .hero-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }

    /* BUTTONS */
    .btn {
      padding: 14px 28px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 15px;
      cursor: pointer;
      border: none;
      text-decoration: none;
      display: inline-block;
      transition: all 0.2s;
    }
    .btn-primary { background: white; color: var(--primary); }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
    .btn-secondary {
      background: transparent;
      color: white;
      border: 2px solid rgba(255,255,255,0.6);
    }
    .btn-secondary:hover { background: rgba(255,255,255,0.1); }
    .btn-cta {
      background: var(--primary);
      color: white;
      padding: 16px 36px;
      font-size: 17px;
    }
    .btn-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }

    /* TRUST BAR */
    .trust-bar {
      background: #f1f5f9;
      padding: 16px 24px;
      display: flex;
      justify-content: center;
      gap: 32px;
      flex-wrap: wrap;
      font-size: 14px;
      color: #64748b;
    }
    .trust-bar span { display: flex; align-items: center; gap: 6px; }

    /* SERVICES */
    .services { padding: 80px 24px; background: white; }
    .section-header { text-align: center; margin-bottom: 48px; }
    .section-header h2 { font-size: 36px; font-weight: 800; color: var(--dark); margin-bottom: 12px; }
    .section-header p { color: #64748b; font-size: 17px; max-width: 500px; margin: 0 auto; }
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
      max-width: 1100px;
      margin: 0 auto;
    }
    .service-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 32px 24px;
      transition: all 0.3s;
    }
    .service-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px rgba(0,0,0,0.1);
      border-color: var(--primary);
    }
    .service-icon {
      width: 48px;
      height: 48px;
      background: var(--primary);
      color: white;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 16px;
    }
    .service-card h3 { font-size: 18px; font-weight: 700; margin-bottom: 10px; color: var(--dark); }
    .service-card p { color: #64748b; line-height: 1.6; }

    /* SOCIAL PROOF */
    .social-proof { background: var(--primary); color: white; padding: 60px 24px; text-align: center; }
    .stats-grid { display: flex; justify-content: center; gap: 48px; flex-wrap: wrap; margin-top: 32px; }
    .stat { text-align: center; }
    .stat-number { font-size: 42px; font-weight: 900; }
    .stat-label { font-size: 14px; opacity: 0.85; margin-top: 4px; }

    /* TESTIMONIALS */
    .testimonials { padding: 80px 24px; background: #f8fafc; }
    .testimonials-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
      max-width: 1000px;
      margin: 0 auto;
    }
    .testimonial-card {
      background: white;
      border-radius: 16px;
      padding: 28px 24px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
    }
    .stars { color: #f59e0b; font-size: 20px; margin-bottom: 12px; }
    .testimonial-card p { color: #475569; line-height: 1.7; margin-bottom: 16px; font-style: italic; }
    .testimonial-card strong { color: var(--primary); }

    /* ABOUT */
    .about { padding: 80px 24px; background: white; }
    .about-inner {
      max-width: 800px;
      margin: 0 auto;
      text-align: center;
    }
    .about-inner h2 { font-size: 36px; font-weight: 800; margin-bottom: 24px; color: var(--dark); }
    .about-inner p { font-size: 17px; line-height: 1.8; color: #64748b; }

    /* MAP */
    .map-section { padding: 60px 24px; background: #f8fafc; }
    .map-section h2 { text-align: center; font-size: 28px; font-weight: 800; margin-bottom: 24px; }
    .map-container { max-width: 800px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }

    /* CONTACT */
    .contact { padding: 80px 24px; background: var(--dark); color: white; }
    .contact-inner { max-width: 700px; margin: 0 auto; text-align: center; }
    .contact-inner h2 { font-size: 36px; font-weight: 800; margin-bottom: 16px; }
    .contact-inner p { opacity: 0.8; margin-bottom: 32px; font-size: 17px; }
    .contact-info { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; margin-top: 32px; }
    .contact-item { display: flex; align-items: center; gap: 8px; opacity: 0.85; }

    /* FORM */
    .contact-form {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 32px;
      margin-top: 32px;
    }
    .form-group { margin-bottom: 16px; text-align: left; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 14px; opacity: 0.8; }
    .form-group input, .form-group textarea, .form-group select {
      width: 100%;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.1);
      color: white;
      font-size: 15px;
    }
    .form-group textarea { height: 100px; resize: vertical; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    /* FOOTER */
    footer {
      background: #0f172a;
      color: #64748b;
      padding: 24px;
      text-align: center;
      font-size: 13px;
    }
    footer strong { color: #94a3b8; }

    /* CTA SECTION */
    .cta-section { padding: 80px 24px; background: #f0f9ff; text-align: center; }
    .cta-section h2 { font-size: 36px; font-weight: 800; margin-bottom: 16px; color: var(--dark); }
    .cta-section p { color: #64748b; font-size: 17px; max-width: 500px; margin: 0 auto 32px; }

    @media (max-width: 640px) {
      .hero { padding: 60px 16px; }
      .services, .testimonials, .about, .contact { padding: 60px 16px; }
      .form-row { grid-template-columns: 1fr; }
      .stats-grid { gap: 24px; }
    }
  </style>
</head>
<body>
  <!-- Tracking pixel -->
  <img src="${trackingUrl}" width="1" height="1" style="display:none" alt="">

  <!-- DEMO BANNER -->
  <div class="demo-banner">
    ⚡ This is a <strong>FREE DEMO</strong> website we built for ${businessName}
    <a href="${paymentUrl}" onclick="window.open(this.href,'_blank');return false;">
      🚀 Claim This Website — $500
    </a>
  </div>

  <!-- HEADER -->
  <header>
    <div class="logo">
      <span class="logo-icon">${icon}</span>
      <div>
        <h1>${businessName}</h1>
        <span>${city}, ${state}</span>
      </div>
    </div>
    <div class="header-cta">
      ${phoneLink}
    </div>
  </header>

  <!-- HERO -->
  <section class="hero">
    <div class="hero-badge">⭐ Trusted ${industry} Professionals in ${city}</div>
    <h1>${content.headline}</h1>
    <p>${content.subheadline}</p>
    <div class="hero-btns">
      <a href="#contact" class="btn btn-primary">Get Free Quote →</a>
      ${phone ? `<a href="tel:${phone.replace(/\D/g, '')}" class="btn btn-secondary">📞 ${phone}</a>` : ''}
    </div>
  </section>

  <!-- TRUST BAR -->
  <div class="trust-bar">
    <span>✅ Licensed & Insured</span>
    <span>⭐ 5-Star Rated</span>
    <span>📍 Serving ${city} & Surrounding Areas</span>
    <span>⚡ Fast Response Times</span>
  </div>

  <!-- SERVICES -->
  <section class="services" id="services">
    <div class="section-header">
      <h2>Our Services in ${city}</h2>
      <p>Professional ${industry} services tailored for local customers</p>
    </div>
    <div class="services-grid">
      ${servicesHTML}
    </div>
  </section>

  <!-- SOCIAL PROOF -->
  <section class="social-proof">
    <h2>Why ${city} Trusts Us</h2>
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-number">500+</div>
        <div class="stat-label">Happy Customers</div>
      </div>
      <div class="stat">
        <div class="stat-number">10+</div>
        <div class="stat-label">Years Experience</div>
      </div>
      <div class="stat">
        <div class="stat-number">5★</div>
        <div class="stat-label">Average Rating</div>
      </div>
      <div class="stat">
        <div class="stat-number">100%</div>
        <div class="stat-label">Satisfaction Guaranteed</div>
      </div>
    </div>
  </section>

  <!-- TESTIMONIALS -->
  <section class="testimonials">
    <div class="section-header">
      <h2>What Our Customers Say</h2>
    </div>
    <div class="testimonials-grid">
      ${testimonialsHTML}
    </div>
  </section>

  <!-- ABOUT -->
  <section class="about" id="about">
    <div class="about-inner">
      <h2>About ${businessName}</h2>
      <p>${content.about_text}</p>
    </div>
  </section>

  <!-- MAP -->
  ${mapEmbed}

  <!-- CTA SECTION -->
  <section class="cta-section">
    <h2>Ready to Get Started?</h2>
    <p>Join hundreds of satisfied customers in ${city} who trust ${businessName}.</p>
    <a href="#contact" class="btn btn-cta">${content.cta_text}</a>
  </section>

  <!-- CONTACT -->
  <section class="contact" id="contact">
    <div class="contact-inner">
      <h2>Get Your Free Quote</h2>
      <p>Contact us today — fast response guaranteed for ${city} customers</p>
      
      <div class="contact-form">
        <div class="form-row">
          <div class="form-group">
            <label>Your Name</label>
            <input type="text" placeholder="John Smith">
          </div>
          <div class="form-group">
            <label>Phone Number</label>
            <input type="tel" placeholder="(555) 123-4567">
          </div>
        </div>
        <div class="form-group">
          <label>Service Needed</label>
          <select>
            ${content.services.map(s => `<option>${s.name}</option>`).join('')}
            <option>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Message</label>
          <textarea placeholder="Tell us about your project..."></textarea>
        </div>
        <button class="btn btn-primary" style="width:100%;background:white;color:var(--primary)">
          Send Request →
        </button>
      </div>

      <div class="contact-info">
        ${phone ? `<div class="contact-item">📞 ${phone}</div>` : ''}
        ${email ? `<div class="contact-item">✉️ ${email}</div>` : ''}
        ${address ? `<div class="contact-item">📍 ${address}, ${city}, ${state}</div>` : ''}
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer>
    <strong>${businessName}</strong> · ${city}, ${state} · Professional ${industry} Services
    <br><br>
    <small>© ${new Date().getFullYear()} ${businessName}. All rights reserved.</small>
  </footer>

  <script>
    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(a.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    });
    // Track view
    fetch('${trackingUrl}', { method: 'POST' }).catch(() => {});
  </script>
</body>
</html>`;
}
