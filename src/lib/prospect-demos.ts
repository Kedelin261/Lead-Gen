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

  // ─── MEMPHIS ROOFING VALIDATION BATCH ─────────────────────────────────────
  // 20 personalized demos — Memphis, TN roofing niche — §4 validation run

  'mid-south-roofing-memphis': {
    slug: 'mid-south-roofing-memphis',
    business_name: 'Mid-South Roofing Co.',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-276-8000',
    tagline: 'Memphis Roofing Done Right — Fast, Honest, Guaranteed',
    services: [
      { name: 'Roof Replacement',   description: 'Full tear-off and re-roof with 30-year shingles and lifetime workmanship warranty.', icon: '🏠' },
      { name: 'Storm Damage Repair', description: 'Emergency response for hail, wind, and fallen-tree damage across greater Memphis.', icon: '⛈️' },
      { name: 'Leak Detection',     description: 'Same-day leak inspection and repair — we find it and fix it permanently.',            icon: '🔍' },
      { name: 'Gutter Installation', description: 'Seamless aluminum gutters sized for Memphis rainfall patterns.',                     icon: '🌧️' },
      { name: 'Flat Roof Systems',  description: 'TPO and EPDM commercial flat roofing with 15-year material warranty.',                icon: '🏗️' },
      { name: 'Free Estimates',     description: 'No-obligation roof inspection with detailed written estimate same day.',              icon: '📋' },
    ],
    about: 'Mid-South Roofing Co. has protected Memphis homes and businesses since 2007. We are a locally owned, fully licensed and insured roofing contractor serving Shelby, Fayette, and Tipton counties. Every job is backed by our 5-year labor guarantee.',
    cta: 'Get Your Free Roof Inspection',
    color_primary: '#B91C1C', color_secondary: '#DC2626',
    hero_bg: 'linear-gradient(135deg, #7F1D1D 0%, #B91C1C 100%)',
    nav_logo_icon: '🏠',
  },

  'delta-roofing-repair-memphis': {
    slug: 'delta-roofing-repair-memphis',
    business_name: 'Delta Roofing & Repair',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-335-4210',
    tagline: 'Delta Tough Roofing for Memphis Homes',
    services: [
      { name: 'Shingle Roofing',    description: 'Architectural and 3-tab shingle installation on all residential roof types.',        icon: '🏠' },
      { name: 'Roof Repair',        description: 'Fast repairs on missing shingles, flashing failures, and ridge cap damage.',         icon: '🔧' },
      { name: 'Insurance Claims',   description: 'We work directly with your insurance adjuster to maximize your storm claim.',        icon: '📄' },
      { name: 'Attic Ventilation',  description: 'Ridge and soffit ventilation solutions that extend roof life by up to 20 years.',   icon: '💨' },
      { name: 'Skylights',          description: 'Velux skylight installation and flashing — leak-free guaranteed.',                   icon: '☀️' },
      { name: 'Emergency Tarping',  description: '24/7 emergency tarp service after storm damage to prevent interior water damage.',   icon: '⛈️' },
    ],
    about: 'Delta Roofing & Repair is Memphis\'s go-to contractor for honest pricing and quality craftsmanship. Family owned and operated, we treat every roof like it\'s our own. Hundreds of 5-star reviews from homeowners across the Mid-South.',
    cta: 'Schedule Free Inspection',
    color_primary: '#1D4ED8', color_secondary: '#3B82F6',
    hero_bg: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)',
    nav_logo_icon: '🔧',
  },

  'shelby-county-roofing-memphis': {
    slug: 'shelby-county-roofing-memphis',
    business_name: 'Shelby County Roofing',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-458-9922',
    tagline: 'Shelby County\'s Most Trusted Roofer Since 2003',
    services: [
      { name: 'Residential Roofing', description: 'Complete residential re-roofing with manufacturer-certified installation.',          icon: '🏡' },
      { name: 'Commercial Roofing',  description: 'Low-slope commercial systems: TPO, modified bitumen, and metal standing seam.',    icon: '🏢' },
      { name: 'Roof Coating',        description: 'Elastomeric coatings that add 10-15 years to existing flat and low-slope roofs.',  icon: '🖌️' },
      { name: 'Hail Damage',        description: 'Certified hail damage assessment and full insurance claim management.',             icon: '🌩️' },
      { name: 'Metal Roofing',       description: 'Steel and aluminum standing seam metal roofing — lasts 50+ years.',               icon: '⚙️' },
      { name: 'Roof Tune-Up',        description: 'Annual maintenance program to catch small issues before they become big ones.',     icon: '🔍' },
    ],
    about: 'Shelby County Roofing has been the trusted name in Memphis roofing for over 20 years. We are GAF Master Elite certified — only 3% of roofers earn this designation. That means better warranties, better training, and better results for you.',
    cta: 'Claim Your Free Estimate',
    color_primary: '#065F46', color_secondary: '#059669',
    hero_bg: 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)',
    nav_logo_icon: '🏡',
  },

  'bluff-city-roofing-memphis': {
    slug: 'bluff-city-roofing-memphis',
    business_name: 'Bluff City Roofing LLC',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-299-3344',
    tagline: 'Protecting Memphis Homes One Roof at a Time',
    services: [
      { name: 'Asphalt Shingles',   description: 'Owens Corning and CertainTeed shingle systems with 50-year manufacturer warranty.',  icon: '🏠' },
      { name: 'Flat Roofs',         description: 'EPDM rubber and TPO membrane systems for commercial and residential flat roofs.',    icon: '🏗️' },
      { name: 'Storm Response',     description: 'Same-day emergency service after severe weather — we answer every call.',           icon: '⛈️' },
      { name: 'Flashing Repair',    description: 'Chimney, skylight, and valley flashing replacement to stop leaks for good.',        icon: '🔩' },
      { name: 'Fascia & Soffit',    description: 'Complete trim and eave work to protect your roof deck from moisture.',              icon: '🪟' },
      { name: 'Financing',          description: '0% financing available for qualifying homeowners — no money down.',                 icon: '💳' },
    ],
    about: 'Bluff City Roofing LLC is a Memphis-born company serving the community with fair prices and superior workmanship. All crews are W-2 employees — no subcontractors. You get the same trained team from estimate to final inspection.',
    cta: 'Get a Free Quote Today',
    color_primary: '#7C3AED', color_secondary: '#8B5CF6',
    hero_bg: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)',
    nav_logo_icon: '⚡',
  },

  'tennessee-top-roofing-memphis': {
    slug: 'tennessee-top-roofing-memphis',
    business_name: 'Tennessee Top Roofing',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-654-7731',
    tagline: 'Top-Tier Roofing. Memphis-Local. Zero Pressure.',
    services: [
      { name: 'New Roof Install',   description: 'Full replacement projects completed in 1–2 days with zero mess left behind.',       icon: '🔨' },
      { name: 'Repair Service',     description: 'Small repairs starting at $150 — no job too small.',                               icon: '🔧' },
      { name: 'Roof Inspection',    description: 'Detailed 27-point inspection report with drone photography.',                      icon: '📸' },
      { name: 'Wind Damage',        description: 'Wind uplift repairs and re-nailing for shingles loosened by storms.',              icon: '🌬️' },
      { name: 'Gutters & Downspouts', description: 'K-style and half-round gutter systems with leaf guard options.',                 icon: '🌧️' },
      { name: 'Commercial Work',    description: 'Strip malls, warehouses, and multi-family buildings across greater Memphis.',       icon: '🏢' },
    ],
    about: 'Tennessee Top Roofing was founded by a Memphis native who was tired of out-of-state storm chasers taking advantage of homeowners after bad weather. We live here, work here, and stand behind every single job we do.',
    cta: 'Book Free Roof Inspection',
    color_primary: '#B45309', color_secondary: '#D97706',
    hero_bg: 'linear-gradient(135deg, #78350F 0%, #B45309 100%)',
    nav_logo_icon: '⭐',
  },

  'king-roofing-services-memphis': {
    slug: 'king-roofing-services-memphis',
    business_name: 'King Roofing Services',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-503-2280',
    tagline: 'King-Quality Roofing. Memphis Proud.',
    services: [
      { name: 'Residential Replacement', description: 'Complete residential tear-off and re-roof in one day for most homes.',         icon: '🏠' },
      { name: 'Leak Repair',        description: 'Same-day leak diagnosis and repair — warranty on all leak work.',                  icon: '💧' },
      { name: 'Insurance Help',     description: 'Free claim assistance — we document damage and advocate with your adjuster.',      icon: '📋' },
      { name: 'Ventilation',        description: 'Attic ventilation improvements that lower cooling costs and extend roof life.',     icon: '💨' },
      { name: 'Flat Roofing',       description: 'Torch-down, EPDM, and TPO for commercial flat roofs.',                           icon: '🏗️' },
      { name: 'Siding',             description: 'Vinyl and fiber cement siding installation to complement your new roof.',          icon: '🏡' },
    ],
    about: 'King Roofing Services has been protecting Memphis properties for 15 years. We are fully licensed, bonded, and insured in Tennessee. Our team of 12 full-time roofers completes jobs on time and on budget — every time.',
    cta: 'Get Your Free Estimate',
    color_primary: '#0F766E', color_secondary: '#14B8A6',
    hero_bg: 'linear-gradient(135deg, #134E4A 0%, #0F766E 100%)',
    nav_logo_icon: '👑',
  },

  'pyramid-city-roofing-memphis': {
    slug: 'pyramid-city-roofing-memphis',
    business_name: 'Pyramid City Roofing',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-881-4455',
    tagline: 'Built to Last Like the Pyramids — Memphis Roofing',
    services: [
      { name: 'Shingle Roofing',    description: 'Dimensional and designer shingles in 40+ color options to match any home.',        icon: '🏠' },
      { name: 'Tile Roofing',       description: 'Concrete and clay tile installation — durable and beautiful.',                    icon: '🔺' },
      { name: 'Metal Panels',       description: 'Standing seam metal roofing that withstands 140 mph winds.',                     icon: '⚙️' },
      { name: 'Storm Repair',       description: 'Emergency storm repairs with same-day response across Memphis metro.',            icon: '⛈️' },
      { name: 'Maintenance Plan',   description: 'Annual roof maintenance to extend lifespan and protect your warranty.',           icon: '🔍' },
      { name: 'Free Quotes',        description: 'Detailed written estimates with no hidden fees and no sales pressure.',           icon: '📋' },
    ],
    about: 'Pyramid City Roofing is named for the city we love. We have completed over 2,000 roofing projects in Memphis and surrounding communities. Our reputation is built on honest assessments, fair pricing, and work that lasts decades.',
    cta: 'Schedule Free Estimate',
    color_primary: '#C2410C', color_secondary: '#EA580C',
    hero_bg: 'linear-gradient(135deg, #7C2D12 0%, #C2410C 100%)',
    nav_logo_icon: '🔺',
  },

  'storm-shield-roofing-memphis': {
    slug: 'storm-shield-roofing-memphis',
    business_name: 'Storm Shield Roofing',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-737-6614',
    tagline: 'Memphis Storm Damage Specialists — We Fight For You',
    services: [
      { name: 'Storm Damage Claims', description: 'We handle the entire insurance process — inspection, documentation, and claim.',   icon: '⛈️' },
      { name: 'Emergency Tarping',  description: '24/7 emergency response — we protect your home before permanent repairs.',         icon: '🚨' },
      { name: 'Hail Repair',        description: 'Expert hail damage assessment and full shingle replacement.',                     icon: '🌩️' },
      { name: 'Wind Damage',        description: 'Missing shingle replacement and re-fastening after high wind events.',             icon: '🌬️' },
      { name: 'Full Replacement',   description: 'Complete roof replacement when repair is not cost-effective.',                    icon: '🏠' },
      { name: 'Post-Storm Audit',   description: 'Free post-storm inspection to catch hidden damage before it leaks.',              icon: '🔍' },
    ],
    about: 'Storm Shield Roofing was built for one purpose: to protect Memphis homeowners from being taken advantage of after a storm. We are fully certified in storm damage assessment and have successfully processed over 500 insurance claims for our clients.',
    cta: 'Get Free Storm Inspection',
    color_primary: '#1E40AF', color_secondary: '#2563EB',
    hero_bg: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%)',
    nav_logo_icon: '🛡️',
  },

  'river-city-roofing-memphis': {
    slug: 'river-city-roofing-memphis',
    business_name: 'River City Roofing',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-218-9050',
    tagline: 'Memphis River City Roofing — Quality You Can Count On',
    services: [
      { name: 'Roof Replacement',   description: 'High-performance roofing systems with 25-year workmanship warranty.',              icon: '🏠' },
      { name: 'Flat Roofing',       description: 'Commercial flat roof specialists — TPO, EPDM, built-up roofing.',                 icon: '🏗️' },
      { name: 'Roof Repairs',       description: 'Any size repair, any roof type — we fix it right the first time.',                icon: '🔧' },
      { name: 'Gutters',            description: 'Seamless gutter installation and cleaning service.',                              icon: '🌧️' },
      { name: 'Skylights',          description: 'Skylight installation, replacement, and leak repair.',                            icon: '☀️' },
      { name: 'Inspections',        description: 'Pre-listing and post-storm roof inspections with written reports.',                icon: '📝' },
    ],
    about: 'River City Roofing has proudly served the greater Memphis area for 18 years. We understand the unique weather challenges of living along the Mississippi — from summer heat to ice storms. Every project comes with our written satisfaction guarantee.',
    cta: 'Get a Free Roof Quote',
    color_primary: '#0369A1', color_secondary: '#0EA5E9',
    hero_bg: 'linear-gradient(135deg, #0C4A6E 0%, #0369A1 100%)',
    nav_logo_icon: '🌊',
  },

  'elite-roofing-gutters-memphis': {
    slug: 'elite-roofing-gutters-memphis',
    business_name: 'Elite Roofing & Gutters',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-362-1188',
    tagline: 'Elite Craftsmanship. Memphis Roots.',
    services: [
      { name: 'Premium Shingles',   description: 'Owens Corning Duration and Pinnacle Pristine shingles — top-of-line product.',    icon: '🏠' },
      { name: 'Gutter Systems',     description: 'Seamless 5" and 6" gutters with micromesh leaf protection.',                      icon: '🌧️' },
      { name: 'Copper Work',        description: 'Custom copper gutters, downspouts, and accent flashing.',                         icon: '✨' },
      { name: 'Storm Repair',       description: 'Emergency repairs for hail, wind, and tree damage within 24 hours.',              icon: '⛈️' },
      { name: 'Commercial',         description: 'Class A fire-rated commercial roofing systems for businesses.',                   icon: '🏢' },
      { name: 'Financing',          description: 'Same-day credit decisions with 18-month same-as-cash financing.',                 icon: '💳' },
    ],
    about: 'Elite Roofing & Gutters delivers premium roofing products with hands-on personal service. We are a Owens Corning Platinum Preferred Contractor — the highest designation available. Only 1% of roofing companies achieve this status.',
    cta: 'Book Your Free Estimate',
    color_primary: '#92400E', color_secondary: '#B45309',
    hero_bg: 'linear-gradient(135deg, #78350F 0%, #92400E 100%)',
    nav_logo_icon: '🏆',
  },

  'southern-star-roofing-memphis': {
    slug: 'southern-star-roofing-memphis',
    business_name: 'Southern Star Roofing',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-444-0033',
    tagline: 'Southern Star — Memphis Roofing You Can Trust',
    services: [
      { name: 'Residential Roofing', description: 'Asphalt shingle, metal, and tile roofing for all home styles.',                  icon: '🏡' },
      { name: 'Roof Repair',        description: 'Rapid leak repair and shingle replacement — most repairs done same day.',         icon: '🔧' },
      { name: 'Insurance Claims',   description: 'Storm claim specialists with a 95% claim approval rate.',                        icon: '📄' },
      { name: 'Attic Insulation',   description: 'Spray foam and blown-in insulation to improve energy efficiency.',                icon: '🌡️' },
      { name: 'Chimney Flashing',   description: 'Chimney cap, crown, and flashing repair to stop leaks at the source.',           icon: '🏠' },
      { name: 'Free Inspection',    description: 'Comprehensive 40-point roof inspection at no charge.',                           icon: '🔍' },
    ],
    about: 'Southern Star Roofing brings a 5-star standard to Memphis roofing. We combine the latest roofing technology with old-fashioned Southern customer service. No high-pressure sales, no hidden costs — just honest work done right.',
    cta: 'Schedule Free Inspection',
    color_primary: '#6D28D9', color_secondary: '#7C3AED',
    hero_bg: 'linear-gradient(135deg, #4C1D95 0%, #6D28D9 100%)',
    nav_logo_icon: '⭐',
  },

  'pro-seal-roofing-memphis': {
    slug: 'pro-seal-roofing-memphis',
    business_name: 'Pro Seal Roofing',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-348-5577',
    tagline: 'Pro Seal — Watertight Roofs for Memphis Properties',
    services: [
      { name: 'Roof Coatings',      description: 'Silicone and acrylic roof coatings to stop leaks and reflect heat.',              icon: '🖌️' },
      { name: 'TPO Roofing',        description: 'Single-ply thermoplastic roofing for commercial and industrial buildings.',       icon: '🏗️' },
      { name: 'Roof Repair',        description: 'Emergency and non-emergency repair on all flat and low-slope systems.',           icon: '🔧' },
      { name: 'Drain Systems',      description: 'Interior drain, scupper, and overflow replacement to prevent ponding water.',     icon: '💧' },
      { name: 'Re-Roofing',         description: 'Overlay and tear-off re-roofing for residential and commercial properties.',      icon: '🏠' },
      { name: 'Maintenance',        description: 'Annual commercial roof maintenance programs to extend system life.',              icon: '📋' },
    ],
    about: 'Pro Seal Roofing specializes in commercial and flat roof systems across the Memphis metro. We have sealed over 3 million square feet of commercial roof since 2010. Our crews are OSHA-10 certified and carry $2M in liability coverage.',
    cta: 'Request Free Assessment',
    color_primary: '#0F766E', color_secondary: '#0D9488',
    hero_bg: 'linear-gradient(135deg, #134E4A 0%, #0F766E 100%)',
    nav_logo_icon: '💧',
  },

  'guardian-roofing-tn-memphis': {
    slug: 'guardian-roofing-tn-memphis',
    business_name: 'Guardian Roofing TN',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-626-9900',
    tagline: 'Guardian Roofing — Your Memphis Roof\'s Best Defense',
    services: [
      { name: 'Roof Replacement',   description: 'Complete roof replacement with manufacturer-backed 50-year warranty.',             icon: '🏠' },
      { name: 'Storm Assessment',   description: 'Post-storm inspection with photo documentation for insurance claims.',            icon: '📸' },
      { name: 'Leak Repair',        description: 'Pinpoint leak location and permanent repair — guaranteed.',                       icon: '💧' },
      { name: 'Ventilation',        description: 'Ridge vent, box vent, and turbine installation for proper attic airflow.',        icon: '💨' },
      { name: 'Gutter Guards',      description: 'LeafFilter and Gutterglove Pro installation to stop clogged gutters forever.',    icon: '🌧️' },
      { name: 'Senior Discount',    description: '10% discount for homeowners 65 and older — always.',                             icon: '🎖️' },
    ],
    about: 'Guardian Roofing TN has been defending Memphis homes since 2005. We are proud members of the National Roofing Contractors Association (NRCA) and hold an A+ rating with the Better Business Bureau. Your home is your biggest investment — protect it with Guardian.',
    cta: 'Get Protected Today',
    color_primary: '#991B1B', color_secondary: '#DC2626',
    hero_bg: 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)',
    nav_logo_icon: '🛡️',
  },

  'apex-roofing-siding-memphis': {
    slug: 'apex-roofing-siding-memphis',
    business_name: 'Apex Roofing & Siding',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-774-2200',
    tagline: 'Apex — Memphis Exterior Specialists',
    services: [
      { name: 'Roofing',            description: 'Asphalt, metal, and synthetic roofing systems for any budget.',                  icon: '🏠' },
      { name: 'Vinyl Siding',       description: 'James Hardie and CertainTeed siding for lasting curb appeal.',                  icon: '🏡' },
      { name: 'Storm Repair',       description: 'Combined roof and siding storm damage repair — one contractor, one call.',       icon: '⛈️' },
      { name: 'Windows',            description: 'Energy-efficient window replacement to complement your new exterior.',           icon: '🪟' },
      { name: 'Soffit & Fascia',    description: 'Aluminum and vinyl soffit and fascia replacement.',                             icon: '🔩' },
      { name: 'Free Estimate',      description: 'Comprehensive exterior inspection and written quote at no cost.',                icon: '📋' },
    ],
    about: 'Apex Roofing & Siding is Memphis\'s full-service exterior contractor. One call gets you a complete roof, siding, and window package — coordinated by a single project manager who is with you every step of the way.',
    cta: 'Get Your Free Exterior Quote',
    color_primary: '#1D4ED8', color_secondary: '#3B82F6',
    hero_bg: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)',
    nav_logo_icon: '🔺',
  },

  'crosstown-roofing-memphis': {
    slug: 'crosstown-roofing-memphis',
    business_name: 'Crosstown Roofing',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-527-8844',
    tagline: 'Crosstown Roofing — Heart of Memphis, Top of Every Roof',
    services: [
      { name: 'Residential Roofing', description: 'Same-day estimates and 2-day installs on most residential replacements.',        icon: '🏠' },
      { name: 'Commercial Roofing',  description: 'Low-slope and steep-slope commercial solutions for Memphis businesses.',         icon: '🏢' },
      { name: 'Roof Repair',         description: 'Fast turnaround repairs — most completed within 48 hours of call.',             icon: '🔧' },
      { name: 'Flat Roofs',          description: 'Modified bitumen and TPO systems with 20-year manufacturer warranty.',          icon: '🏗️' },
      { name: 'Solar Ready',         description: 'Solar-ready roof preparation and reinforcement for panel installation.',        icon: '☀️' },
      { name: 'Warranty',            description: '10-year labor warranty on all full replacements — the best in Memphis.',        icon: '📋' },
    ],
    about: 'Crosstown Roofing sits right in the heart of Memphis. We serve residential and commercial clients from East Memphis to Frayser, Midtown to Bartlett. Quick response, transparent pricing, and a crew that shows up when they say they will.',
    cta: 'Schedule Your Free Quote',
    color_primary: '#047857', color_secondary: '#059669',
    hero_bg: 'linear-gradient(135deg, #064E3B 0%, #047857 100%)',
    nav_logo_icon: '✖️',
  },

  'liberty-roofing-group-memphis': {
    slug: 'liberty-roofing-group-memphis',
    business_name: 'Liberty Roofing Group',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-309-6612',
    tagline: 'Liberty Roofing — Freedom From Roof Worries',
    services: [
      { name: 'Full Replacement',   description: 'Complete roof tear-off and replacement — done in one day on most homes.',         icon: '🏠' },
      { name: 'Partial Repair',     description: 'Section replacement for localized damage without full replacement cost.',         icon: '🔧' },
      { name: 'Storm Claims',       description: 'A-to-Z insurance claim handling with zero upfront cost to you.',                 icon: '📄' },
      { name: 'Flat Roofs',         description: 'Commercial flat roofing with 15-year no-leak guarantee.',                       icon: '🏗️' },
      { name: 'Energy Efficient',   description: 'Cool roof shingles that reduce AC bills by up to 15% in Memphis summers.',       icon: '🌡️' },
      { name: 'Financing',          description: 'Low monthly payment options — no credit score minimum.',                        icon: '💳' },
    ],
    about: 'Liberty Roofing Group was founded on one principle: every Memphis homeowner deserves a quality roof at a fair price. We cut no corners, use no shortcuts, and every project ends with a thorough walk-through and your written warranty in hand.',
    cta: 'Get Your Free Roof Audit',
    color_primary: '#B91C1C', color_secondary: '#DC2626',
    hero_bg: 'linear-gradient(135deg, #7F1D1D 0%, #B91C1C 100%)',
    nav_logo_icon: '🗽',
  },

  'handy-roof-pros-memphis': {
    slug: 'handy-roof-pros-memphis',
    business_name: 'Handy Roof Pros',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-482-3390',
    tagline: 'Handy Roof Pros — Small Jobs Welcome, Big Quality Always',
    services: [
      { name: 'Leak Repair',        description: 'Precise leak location and waterproof repair — any roof type.',                   icon: '💧' },
      { name: 'Shingle Replacement', description: 'Single shingle to full-section replacement with color matching.',               icon: '🏠' },
      { name: 'Flashing',           description: 'Chimney, pipe boot, and valley flashing repair and replacement.',                icon: '🔩' },
      { name: 'Gutter Cleaning',    description: 'Full gutter clean-out and downspout flush to prevent backup.',                   icon: '🌧️' },
      { name: 'Moss & Algae',       description: 'Safe chemical treatment and zinc strip installation to stop roof staining.',     icon: '🌿' },
      { name: 'Full Replacement',   description: 'Competitive pricing on complete roof replacements for any home size.',           icon: '🔨' },
    ],
    about: 'Handy Roof Pros started because homeowners needed a trustworthy roofer for small and mid-size jobs without being upsold on a full replacement. We give you an honest assessment every time. If you need a repair, we\'ll repair it. Period.',
    cta: 'Book a Free Inspection',
    color_primary: '#92400E', color_secondary: '#D97706',
    hero_bg: 'linear-gradient(135deg, #78350F 0%, #92400E 100%)',
    nav_logo_icon: '🔨',
  },

  'first-choice-roofing-memphis': {
    slug: 'first-choice-roofing-memphis',
    business_name: 'First Choice Roofing',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-395-7750',
    tagline: 'First Choice Roofing — Memphis Homeowners Choose Us First',
    services: [
      { name: 'Asphalt Shingles',   description: 'All major shingle brands installed by factory-trained crews.',                   icon: '🏠' },
      { name: 'Metal Roofing',      description: 'Standing seam and corrugated metal in 20+ colors.',                             icon: '⚙️' },
      { name: 'Storm Repair',       description: 'Emergency and scheduled storm damage repair across Shelby County.',              icon: '⛈️' },
      { name: 'Roof Over',          description: 'Economical shingle-over-shingle option for qualifying roofs.',                   icon: '🔧' },
      { name: 'Gutter Installation', description: '4", 5", and 6" seamless gutters with 10-year no-clog guarantee.',               icon: '🌧️' },
      { name: 'Senior/Veteran',     description: 'Special pricing for seniors and military veterans — always.',                    icon: '🎖️' },
    ],
    about: 'First Choice Roofing earned our name by being the first call Memphis homeowners make when they have a roof problem — and the last company they ever need. Our repeat and referral rate exceeds 70%, which speaks for itself.',
    cta: 'Make Us Your First Call',
    color_primary: '#1D4ED8', color_secondary: '#60A5FA',
    hero_bg: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)',
    nav_logo_icon: '1️⃣',
  },

  'sunrise-roofing-memphis': {
    slug: 'sunrise-roofing-memphis',
    business_name: 'Sunrise Roofing Memphis',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-678-4411',
    tagline: 'Sunrise Roofing — A New Day for Your Memphis Roof',
    services: [
      { name: 'Roof Replacement',   description: 'Complete residential and commercial roof replacement projects.',                  icon: '🌅' },
      { name: 'Roof Repair',        description: 'Same-day leak and storm damage repair — no job too small.',                      icon: '🔧' },
      { name: 'Inspection',         description: 'Free detailed inspection with written condition report and photos.',              icon: '📸' },
      { name: 'Metal Roofing',      description: 'Durable metal roofing systems with 40-year paint warranty.',                     icon: '⚙️' },
      { name: 'Attic Prep',         description: 'Deck repair, ventilation upgrade, and ice barrier before new roof.',             icon: '🏗️' },
      { name: 'Clean-Up Guarantee', description: 'Zero debris left on your property — we use magnetic nail sweepers.',            icon: '✨' },
    ],
    about: 'Sunrise Roofing Memphis brings fresh energy to the roofing industry. We use only top-tier materials and employ career roofers — not day laborers. Every project is managed by a licensed general contractor and inspected before we consider the job done.',
    cta: 'Start With a Free Inspection',
    color_primary: '#D97706', color_secondary: '#FBBF24',
    hero_bg: 'linear-gradient(135deg, #92400E 0%, #D97706 100%)',
    nav_logo_icon: '🌅',
  },

  'ace-roofing-restoration-memphis': {
    slug: 'ace-roofing-restoration-memphis',
    business_name: 'Ace Roofing & Restoration',
    industry: 'roofing',
    city: 'Memphis', state: 'TN',
    email: '', phone: '+1-901-821-5566',
    tagline: 'Ace Roofing — Memphis Storm Restoration Experts',
    services: [
      { name: 'Storm Restoration',  description: 'Complete storm damage restoration — roof, gutters, siding, and windows.',         icon: '⛈️' },
      { name: 'Insurance Claims',   description: 'Public adjuster partnership to maximize your claim settlement.',                  icon: '📄' },
      { name: 'Roof Replacement',   description: 'Manufacturer-certified installation with 50-year transferable warranty.',         icon: '🏠' },
      { name: 'Emergency Service',  description: '24/7 emergency tarping and board-up after severe weather events.',                icon: '🚨' },
      { name: 'Mold Remediation',   description: 'Attic mold treatment and prevention following any water intrusion.',              icon: '🌿' },
      { name: 'Financing',          description: '12-month interest-free financing — use insurance money to cover your deductible.', icon: '💳' },
    ],
    about: 'Ace Roofing & Restoration is Memphis\'s premier storm restoration specialist. When severe weather hits the Mid-South, homeowners call Ace first. We manage every aspect of the claim and restoration process, so you never have to deal with the insurance company alone.',
    cta: 'Get Free Storm Assessment',
    color_primary: '#B91C1C', color_secondary: '#EF4444',
    hero_bg: 'linear-gradient(135deg, #7F1D1D 0%, #B91C1C 100%)',
    nav_logo_icon: '♠️',
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
