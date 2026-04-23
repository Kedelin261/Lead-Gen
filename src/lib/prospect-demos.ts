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


  // ─── MEMPHIS MICRO-SCALE BATCH (scraped 2026-04-23) ─────────────────────────

  'dryve-cleaners-memphis': {
    slug: 'dryve-cleaners-memphis',
    business_name: 'Dryve Cleaners',
    industry: 'cleaning services',
    city: 'Memphis',
    state: 'TN',
    email: '',
    phone: '(901) 752-6637',
    tagline: 'Professional Dry Cleaning & Laundry in Memphis',
    services: [
      { name: 'Dry Cleaning',          description: 'Expert dry cleaning for suits, dresses, and delicate fabrics with fast turnaround.',   icon: '👔' },
      { name: 'Wash & Fold',           description: 'Convenient wash-and-fold laundry service — drop off and pick up fresh, folded clothes.', icon: '🧺' },
      { name: 'Alterations',           description: 'Professional alterations and tailoring for the perfect fit on any garment.',            icon: '✂️' },
      { name: 'Wedding Gown Care',     description: 'Specialized cleaning and preservation for wedding gowns and formalwear.',               icon: '👗' },
      { name: 'Comforter Cleaning',    description: 'Large-item cleaning for comforters, duvets, and household linens.',                     icon: '🛏️' },
      { name: 'Express Service',       description: 'Same-day and next-day turnaround available for urgent cleaning needs.',                 icon: '⚡' },
    ],
    about: 'Dryve Cleaners has been serving Memphis families and professionals with top-quality dry cleaning and laundry services. Our experienced team handles every garment with care, using eco-friendly cleaning solutions that protect fabrics and the environment.',
    cta: 'Drop Off Today',
    color_primary: '#0F4C75',
    color_secondary: '#1B6CA8',
    hero_bg: 'linear-gradient(135deg, #0F4C75 0%, #1B6CA8 100%)',
    nav_logo_icon: '👔',
  },

  'dukes-automotive-memphis': {
    slug: 'dukes-automotive-memphis',
    business_name: "Duke's Automotive",
    industry: 'auto repair',
    city: 'Memphis',
    state: 'TN',
    email: '',
    phone: '(901) 323-9837',
    tagline: "Memphis Drivers Trust Duke's for Honest Auto Repair",
    services: [
      { name: 'Oil Change & Tune-Up',  description: 'Full synthetic and conventional oil changes plus multi-point inspection.',             icon: '🔧' },
      { name: 'Brake Service',         description: 'Brake pad replacement, rotor resurfacing, and complete brake system inspection.',       icon: '🛑' },
      { name: 'Engine Diagnostics',    description: 'Computer diagnostics to identify check-engine lights and performance issues fast.',     icon: '💻' },
      { name: 'Transmission Repair',   description: 'Automatic and manual transmission service, fluid flush, and rebuild.',                  icon: '⚙️' },
      { name: 'AC & Heat Repair',      description: 'Air conditioning recharge, leak detection, and heater core service.',                  icon: '❄️' },
      { name: 'Tire Rotation & Alignment', description: 'Extend tire life with regular rotation and precision wheel alignment.',            icon: '🔄' },
    ],
    about: "Duke's Automotive has served the Memphis community with honest, affordable auto repair for years. We believe in transparent pricing, quality parts, and getting you back on the road fast. No surprises — just reliable work from experienced mechanics.",
    cta: 'Schedule a Service',
    color_primary: '#B91C1C',
    color_secondary: '#DC2626',
    hero_bg: 'linear-gradient(135deg, #7F1D1D 0%, #B91C1C 100%)',
    nav_logo_icon: '🔧',
  },

  'john-ac-repair-memphis': {
    slug: 'john-ac-repair-memphis',
    business_name: 'John AC Repair',
    industry: 'HVAC',
    city: 'Memphis',
    state: 'TN',
    email: '',
    phone: '(901) 213-5822',
    tagline: 'Fast, Reliable HVAC Repair for Memphis Homes',
    services: [
      { name: 'AC Repair',             description: 'Same-day diagnosis and repair for all makes of central air conditioning systems.',     icon: '❄️' },
      { name: 'Heating Repair',        description: 'Furnace, heat pump, and gas heater repair to keep you warm when it matters.',          icon: '🔥' },
      { name: 'AC Installation',       description: 'Professional installation of new AC systems with energy-efficiency guidance.',          icon: '🏠' },
      { name: 'Maintenance Plans',     description: 'Seasonal tune-ups and maintenance to prevent costly breakdowns.',                      icon: '📅' },
      { name: 'Duct Cleaning',         description: 'Improve air quality and efficiency with professional air duct cleaning service.',      icon: '💨' },
      { name: 'Emergency Service',     description: '24/7 emergency HVAC repairs — no overtime charges on weekends.',                      icon: '🚨' },
    ],
    about: 'John AC Repair is a locally owned HVAC company serving Memphis and surrounding areas. We provide fast, honest service with upfront pricing. Whether your AC goes out in the summer heat or your heater fails in winter, our certified technicians are ready to help.',
    cta: 'Call for Service',
    color_primary: '#0369A1',
    color_secondary: '#38BDF8',
    hero_bg: 'linear-gradient(135deg, #0C4A6E 0%, #0369A1 100%)',
    nav_logo_icon: '❄️',
  },

  'thongs-auto-repair-memphis': {
    slug: 'thongs-auto-repair-memphis',
    business_name: "Thong's Auto Repair",
    industry: 'auto repair',
    city: 'Memphis',
    state: 'TN',
    email: '',
    phone: '(901) 278-2470',
    tagline: 'Trusted Auto Repair Near Midtown Memphis',
    services: [
      { name: 'General Repairs',       description: 'Full-service auto repair for domestic and import vehicles — all makes and models.',    icon: '🔧' },
      { name: 'Oil & Filter Change',   description: 'Quick oil changes using quality oil and OEM-spec filters.',                            icon: '🛢️' },
      { name: 'Suspension & Steering', description: 'Shocks, struts, tie rods, and steering component repair and replacement.',             icon: '🚗' },
      { name: 'Electrical Repair',     description: 'Battery, alternator, starter, and electrical system diagnostics and repair.',          icon: '⚡' },
      { name: 'Exhaust Systems',       description: 'Muffler, catalytic converter, and exhaust pipe replacement.',                         icon: '💨' },
      { name: 'Pre-Purchase Inspection', description: 'Thorough inspection before buying a used vehicle — know what you are getting.',     icon: '🔍' },
    ],
    about: "Thong's Auto Repair has been a trusted name in Midtown Memphis for quality auto service at fair prices. Our experienced technicians treat every vehicle like their own — diagnosing problems accurately and fixing them right the first time.",
    cta: 'Get a Free Estimate',
    color_primary: '#1D4ED8',
    color_secondary: '#3B82F6',
    hero_bg: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)',
    nav_logo_icon: '🚗',
  },

  'l-j-service-center-memphis': {
    slug: 'l-j-service-center-memphis',
    business_name: 'L & J Service Center',
    industry: 'auto repair',
    city: 'Memphis',
    state: 'TN',
    email: '',
    phone: '(901) 207-4956',
    tagline: 'Full-Service Auto Care You Can Count On in Memphis',
    services: [
      { name: 'Complete Auto Repair',  description: 'Engine, transmission, brakes, and more — one shop for all your vehicle needs.',       icon: '🔧' },
      { name: 'State Inspection',      description: 'Tennessee state vehicle safety inspections with fast turnaround.',                     icon: '📋' },
      { name: 'Fluid Services',        description: 'Oil, coolant, brake fluid, power steering, and transmission fluid service.',           icon: '💧' },
      { name: 'Battery & Charging',    description: 'Battery testing, replacement, and alternator service.',                               icon: '🔋' },
      { name: 'Tire Services',         description: 'Flat repair, balancing, rotation, and new tire installation.',                        icon: '🔄' },
      { name: 'AC Service',            description: 'Air conditioning recharge and leak repair to keep you cool.',                         icon: '❄️' },
    ],
    about: 'L & J Service Center is a family-run auto shop serving Memphis drivers with honest, reliable vehicle care. We have built our reputation on fair pricing and quality workmanship — keeping Memphis families safely on the road for years.',
    cta: 'Book an Appointment',
    color_primary: '#065F46',
    color_secondary: '#059669',
    hero_bg: 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)',
    nav_logo_icon: '🔧',
  },

  'jc-cycles-memphis': {
    slug: 'jc-cycles-memphis',
    business_name: 'JC Cycles',
    industry: 'auto repair',
    city: 'Memphis',
    state: 'TN',
    email: '',
    phone: '(901) 417-7500',
    tagline: 'Memphis Motorcycle Repair & Service Experts',
    services: [
      { name: 'Motorcycle Repair',     description: 'Expert repair for all motorcycle makes and models — cruisers, sport bikes, and more.', icon: '🏍️' },
      { name: 'Engine Service',        description: 'Engine tune-ups, oil changes, and complete engine rebuild for motorcycles.',            icon: '⚙️' },
      { name: 'Brake & Tire Service',  description: 'Motorcycle brake inspection, pad replacement, and tire mounting and balancing.',       icon: '🔧' },
      { name: 'Electrical Diagnostics','description': 'Battery, charging system, and wiring diagnosis for motorcycles and scooters.',       icon: '⚡' },
      { name: 'Custom Builds',         description: 'Custom motorcycle builds, modifications, and accessory installation.',                 icon: '🛠️' },
      { name: 'Pre-Season Checkup',    description: 'Spring tune-up service to get your bike ready for riding season.',                    icon: '🌱' },
    ],
    about: 'JC Cycles is Memphis\'s go-to shop for motorcycle repair, service, and custom work. Our passionate team of riders and mechanics understands motorcycles inside and out. From routine maintenance to full custom builds, we treat every bike with the respect it deserves.',
    cta: 'Bring Your Bike In',
    color_primary: '#7C3AED',
    color_secondary: '#8B5CF6',
    hero_bg: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)',
    nav_logo_icon: '🏍️',
  },

  'mostly-trucks-memphis': {
    slug: 'mostly-trucks-memphis',
    business_name: 'Mostly Trucks',
    industry: 'auto repair',
    city: 'Memphis',
    state: 'TN',
    email: '',
    phone: '(901) 518-9688',
    tagline: 'Truck Specialists Serving Memphis & the Mid-South',
    services: [
      { name: 'Truck Engine Repair',   description: 'Gas and diesel engine repair for pickups, work trucks, and fleet vehicles.',          icon: '🔧' },
      { name: 'Lift Kits & Leveling',  description: 'Professional lift kit installation and leveling for 4x4 and truck builds.',           icon: '⬆️' },
      { name: 'Towing Equipment',      description: 'Trailer hitch installation, brake controller, and towing system setup.',              icon: '🚛' },
      { name: 'Diesel Service',        description: 'Diesel engine tune-ups, injector service, and DEF system repair.',                    icon: '⛽' },
      { name: 'Fleet Maintenance',     description: 'Scheduled fleet maintenance programs for businesses with multiple work trucks.',       icon: '📋' },
      { name: 'Custom Accessories',    description: 'Bed liners, running boards, toolboxes, and truck accessory installation.',            icon: '🛠️' },
    ],
    about: "Mostly Trucks is Memphis's dedicated truck repair and customization shop. We specialize in pickups, work trucks, and fleet vehicles — giving truck owners the expert service their rigs deserve. Whether it's daily maintenance or a custom build, we've got you covered.",
    cta: 'Schedule Truck Service',
    color_primary: '#92400E',
    color_secondary: '#D97706',
    hero_bg: 'linear-gradient(135deg, #78350F 0%, #92400E 100%)',
    nav_logo_icon: '🚛',
  },

  'sugar-services-llc-memphis': {
    slug: 'sugar-services-llc-memphis',
    business_name: 'Sugar Services LLC',
    industry: 'cleaning services',
    city: 'Memphis',
    state: 'TN',
    email: '',
    phone: '(901) 523-0045',
    tagline: 'Professional Cleaning Services for Memphis Homes & Offices',
    services: [
      { name: 'Residential Cleaning',  description: 'Regular home cleaning services — weekly, bi-weekly, or monthly schedules.',           icon: '🏠' },
      { name: 'Deep Cleaning',         description: 'Thorough deep-clean service for move-ins, move-outs, and seasonal refreshes.',        icon: '✨' },
      { name: 'Office Cleaning',       description: 'Professional office and commercial cleaning on your schedule.',                       icon: '🏢' },
      { name: 'Post-Construction',     description: 'Construction cleanup removing dust, debris, and residue from new builds or remodels.', icon: '🏗️' },
      { name: 'Airbnb Turnover',       description: 'Fast, reliable Airbnb and short-term rental turnover cleaning.',                     icon: '🔑' },
      { name: 'Window Cleaning',       description: 'Interior and exterior window cleaning for homes and commercial buildings.',            icon: '🪟' },
    ],
    about: 'Sugar Services LLC delivers reliable, detail-oriented cleaning for homes and businesses across Memphis. Our bonded and insured team shows up on time, uses professional-grade products, and leaves every space spotless. We take pride in the spaces we clean.',
    cta: 'Get a Free Quote',
    color_primary: '#BE185D',
    color_secondary: '#EC4899',
    hero_bg: 'linear-gradient(135deg, #9D174D 0%, #BE185D 100%)',
    nav_logo_icon: '✨',
  },

  'celebrity-body-studio-memphis': {
    slug: 'celebrity-body-studio-memphis',
    business_name: 'Celebrity Body Studio',
    industry: 'cleaning services',
    city: 'Memphis',
    state: 'TN',
    email: '',
    phone: '(901) 877-8977',
    tagline: 'Premium Body & Detail Services in Memphis',
    services: [
      { name: 'Auto Detailing',        description: 'Full interior and exterior detailing — showroom-quality results every time.',          icon: '🚗' },
      { name: 'Paint Correction',      description: 'Swirl removal, scratch correction, and paint enhancement for a flawless finish.',     icon: '✨' },
      { name: 'Ceramic Coating',       description: 'Long-lasting ceramic protection that repels water, dirt, and UV damage.',             icon: '🛡️' },
      { name: 'Interior Detailing',    description: 'Deep interior clean including seats, carpet, dashboard, and odor elimination.',       icon: '🪑' },
      { name: 'Headlight Restoration', description: 'Restore cloudy, yellowed headlights for better visibility and appearance.',           icon: '💡' },
      { name: 'Mobile Detailing',      description: 'We come to you — professional detailing at your home or office.',                    icon: '📍' },
    ],
    about: 'Celebrity Body Studio is Memphis\'s premier auto detailing and paint care studio. We treat every vehicle like a celebrity — with the care, precision, and attention to detail it deserves. Our packages are designed to protect your investment and keep your ride looking its best.',
    cta: 'Book Your Detail',
    color_primary: '#1A1A2E',
    color_secondary: '#E94560',
    hero_bg: 'linear-gradient(135deg, #16213E 0%, #1A1A2E 100%)',
    nav_logo_icon: '🚗',
  },

  'one-of-a-kind-services-memphis': {
    slug: 'one-of-a-kind-services-memphis',
    business_name: 'One of A Kind Services',
    industry: 'cleaning services',
    city: 'Memphis',
    state: 'TN',
    email: '',
    phone: '(901) 833-0868',
    tagline: 'Unique, Personalized Cleaning & Home Services in Memphis',
    services: [
      { name: 'Home Cleaning',         description: 'Personalized residential cleaning tailored to your home and your preferences.',       icon: '🏠' },
      { name: 'Move-In/Move-Out',      description: 'Complete cleaning packages for renters and homeowners transitioning spaces.',         icon: '📦' },
      { name: 'Organizing Services',   description: 'Professional home organization — closets, kitchens, garages, and more.',              icon: '🗂️' },
      { name: 'Laundry Service',       description: 'In-home laundry service — wash, dry, fold, and put away.',                           icon: '🧺' },
      { name: 'Errand Running',        description: 'Grocery shopping, pickups, and local errands handled for busy Memphis families.',     icon: '🛒' },
      { name: 'Event Cleanup',         description: 'Before and after event cleaning for parties, gatherings, and special occasions.',     icon: '🎉' },
    ],
    about: 'One of A Kind Services brings a personal touch to cleaning and home care in Memphis. We are not a franchise — every client gets individualized attention and a customized service plan. Our reliable team handles the details so you can focus on what matters most.',
    cta: 'Get Your Custom Quote',
    color_primary: '#0F766E',
    color_secondary: '#14B8A6',
    hero_bg: 'linear-gradient(135deg, #134E4A 0%, #0F766E 100%)',
    nav_logo_icon: '✨',
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
