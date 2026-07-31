// lib/appbuilder/domain-catalog.ts — large domain-specific template catalog + idea matching
import type { CatalogTemplate } from "./catalog";

type DomainSeed = {
  key: string;
  label: string;
  category: string;
  siteTemplateId: string;
  keywords: string[];
  pages: string[];
  features: string[];
  description: string;
  previewImage: string;
  accent: string;
};

type StyleSeed = {
  id: string;
  badge: string;
  suffix: string;
  accent?: string;
};

/** Domain packs — each expands into multiple style variants. */
const DOMAIN_SEEDS: DomainSeed[] = [
  {
    key: "hospital",
    label: "Hospital",
    category: "healthcare",
    siteTemplateId: "hospital",
    keywords: ["hospital", "hms", "multi-specialty", "inpatient", "emergency", "ward", "medical center"],
    pages: ["Home", "Departments", "Specialists", "Visitors", "Emergency", "Contact"],
    features: ["Department directory", "Emergency CTA", "Visitor info"],
    description: "Multi-specialty hospital site with departments, specialists, and emergency access.",
    previewImage: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80",
    accent: "#0F766E",
  },
  {
    key: "clinic",
    label: "Clinic",
    category: "healthcare",
    siteTemplateId: "primary-care",
    keywords: ["clinic", "primary care", "family medicine", "outpatient", "gp", "doctor"],
    pages: ["Home", "Services", "Providers", "Patients", "Contact"],
    features: ["Booking CTAs", "Provider bios", "Patient resources"],
    description: "Primary-care clinic with bookings, providers, and patient guidance.",
    previewImage: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80",
    accent: "#2F6F5E",
  },
  {
    key: "dental",
    label: "Dental",
    category: "healthcare",
    siteTemplateId: "dental",
    keywords: ["dental", "dentist", "orthodont", "smile", "teeth", "oral"],
    pages: ["Home", "Services", "Smile Gallery", "Patients", "Contact"],
    features: ["Smile gallery", "Service menu", "Online booking"],
    description: "Dental practice site with treatments, smile gallery, and appointments.",
    previewImage: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=1200&q=80",
    accent: "#0284C7",
  },
  {
    key: "mental-health",
    label: "Mental Health",
    category: "healthcare",
    siteTemplateId: "mental-health",
    keywords: ["mental", "therapy", "counsel", "psych", "wellness", "anxiety", "depression"],
    pages: ["Home", "Programs", "Therapists", "Start", "Contact"],
    features: ["Program list", "Therapist bios", "Intake CTA"],
    description: "Counseling and therapy practice with programs and intake flow.",
    previewImage: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=1200&q=80",
    accent: "#7C3AED",
  },
  {
    key: "pharmacy",
    label: "Pharmacy",
    category: "healthcare",
    siteTemplateId: "pharmacy",
    keywords: ["pharmacy", "prescription", "drugstore", "rx", "medication"],
    pages: ["Home", "Services", "Prescriptions", "Wellness", "Contact"],
    features: ["Rx refill CTA", "Wellness tips", "Hours & location"],
    description: "Pharmacy site for prescriptions, wellness, and store services.",
    previewImage: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
    accent: "#059669",
  },
  {
    key: "telehealth",
    label: "Telehealth",
    category: "healthcare",
    siteTemplateId: "telehealth",
    keywords: ["telehealth", "virtual visit", "video visit", "online doctor", "remote care"],
    pages: ["Home", "How it works", "Specialties", "Pricing", "Contact"],
    features: ["Virtual visit flow", "Specialty list", "Pricing cards"],
    description: "Virtual care platform with specialties, pricing, and visit flow.",
    previewImage: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80",
    accent: "#2563EB",
  },
  {
    key: "specialty",
    label: "Specialty Care",
    category: "healthcare",
    siteTemplateId: "specialty",
    keywords: ["cardiology", "ortho", "dermatology", "specialty", "surgeon", "oncology"],
    pages: ["Home", "Conditions", "Treatments", "Surgeons", "Contact"],
    features: ["Condition library", "Treatment paths", "Surgeon profiles"],
    description: "Specialty practice site for conditions, treatments, and surgeons.",
    previewImage: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=1200&q=80",
    accent: "#BE123C",
  },
  {
    key: "agency",
    label: "Creative Agency",
    category: "corporate",
    siteTemplateId: "agency",
    keywords: ["agency", "marketing", "brand", "creative", "studio", "advertising", "design studio"],
    pages: ["Home", "Work", "Services", "About", "Contact"],
    features: ["Case studies", "Service grid", "Contact form"],
    description: "Agency marketing site with work, services, and about.",
    previewImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    accent: "#C45C26",
  },
  {
    key: "saas",
    label: "SaaS Product",
    category: "saas",
    siteTemplateId: "agency",
    keywords: ["saas", "software", "platform", "dashboard", "b2b", "subscription", "product"],
    pages: ["Home", "Features", "Pricing", "Customers", "Contact"],
    features: ["Feature grid", "Pricing table", "Customer logos"],
    description: "SaaS marketing site with features, pricing, and social proof.",
    previewImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    accent: "#0EA5E9",
  },
  {
    key: "crm",
    label: "CRM Suite",
    category: "saas",
    siteTemplateId: "agency",
    keywords: ["crm", "sales", "leads", "pipeline", "customer relationship"],
    pages: ["Home", "Pipeline", "Contacts", "Reports", "Contact"],
    features: ["Pipeline overview", "Contact CRM", "Reports"],
    description: "CRM-focused product site for sales teams and pipelines.",
    previewImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    accent: "#4F46E5",
  },
  {
    key: "ecommerce",
    label: "Online Store",
    category: "ecommerce",
    siteTemplateId: "ecommerce",
    keywords: ["ecommerce", "e-commerce", "shop", "store", "retail", "cart", "product"],
    pages: ["Home", "Shop", "Product", "About", "Contact"],
    features: ["Product grid", "Featured drops", "Checkout CTA"],
    description: "Product storefront with shop grid and product detail pages.",
    previewImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
    accent: "#B45309",
  },
  {
    key: "fashion",
    label: "Fashion Boutique",
    category: "ecommerce",
    siteTemplateId: "ecommerce",
    keywords: ["fashion", "boutique", "apparel", "clothing", "wear"],
    pages: ["Home", "Collections", "Lookbook", "About", "Contact"],
    features: ["Lookbook", "Collection grid", "Brand story"],
    description: "Fashion retail site with collections and lookbook energy.",
    previewImage: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
    accent: "#9D174D",
  },
  {
    key: "realestate",
    label: "Real Estate",
    category: "corporate",
    siteTemplateId: "realestate",
    keywords: ["real estate", "property", "listing", "homes", "realtor", "broker"],
    pages: ["Home", "Listings", "Neighborhoods", "Agents", "Contact"],
    features: ["Listing cards", "Agent directory", "Lead form"],
    description: "Property listings with neighborhoods and agent profiles.",
    previewImage: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80",
    accent: "#1D4ED8",
  },
  {
    key: "education",
    label: "Education / LMS",
    category: "education",
    siteTemplateId: "education",
    keywords: ["education", "school", "course", "lms", "university", "learn", "academy", "tuition"],
    pages: ["Home", "Courses", "Campus", "Admissions", "Contact"],
    features: ["Course catalog", "Admissions CTA", "Campus life"],
    description: "School or LMS site with courses, campus, and admissions.",
    previewImage: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80",
    accent: "#7C3AED",
  },
  {
    key: "restaurant",
    label: "Restaurant",
    category: "hospitality",
    siteTemplateId: "ecommerce",
    keywords: ["restaurant", "cafe", "food", "dining", "menu", "bistro", "kitchen", "delivery"],
    pages: ["Home", "Menu", "Reservations", "About", "Contact"],
    features: ["Menu highlights", "Reservation CTA", "Location"],
    description: "Restaurant site with menu, reservations, and atmosphere.",
    previewImage: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    accent: "#C2410C",
  },
  {
    key: "hotel",
    label: "Hotel & Stay",
    category: "hospitality",
    siteTemplateId: "realestate",
    keywords: ["hotel", "resort", "stay", "hospitality", "rooms", "booking"],
    pages: ["Home", "Rooms", "Amenities", "Offers", "Contact"],
    features: ["Room gallery", "Amenities", "Book stay"],
    description: "Hotel booking site with rooms, amenities, and offers.",
    previewImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    accent: "#0F766E",
  },
  {
    key: "fitness",
    label: "Fitness Studio",
    category: "lifestyle",
    siteTemplateId: "agency",
    keywords: ["fitness", "gym", "yoga", "studio", "workout", "trainer"],
    pages: ["Home", "Classes", "Trainers", "Membership", "Contact"],
    features: ["Class schedule", "Trainer bios", "Membership CTA"],
    description: "Gym or yoga studio with classes, trainers, and memberships.",
    previewImage: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
    accent: "#DC2626",
  },
  {
    key: "law",
    label: "Law Firm",
    category: "corporate",
    siteTemplateId: "agency",
    keywords: ["law", "lawyer", "attorney", "legal", "firm", "counsel"],
    pages: ["Home", "Practice Areas", "Attorneys", "Insights", "Contact"],
    features: ["Practice areas", "Attorney bios", "Consultation CTA"],
    description: "Law firm site with practice areas and attorney directory.",
    previewImage: "https://images.unsplash.com/photo-1589829545856-d5d6d8f53a95?auto=format&fit=crop&w=1200&q=80",
    accent: "#1E3A5F",
  },
  {
    key: "finance",
    label: "Finance / Fintech",
    category: "saas",
    siteTemplateId: "agency",
    keywords: ["finance", "fintech", "bank", "invest", "wealth", "accounting"],
    pages: ["Home", "Solutions", "Security", "Pricing", "Contact"],
    features: ["Trust signals", "Solution cards", "Security focus"],
    description: "Fintech or wealth site with solutions and trust-first layout.",
    previewImage: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
    accent: "#047857",
  },
  {
    key: "nonprofit",
    label: "Nonprofit",
    category: "corporate",
    siteTemplateId: "agency",
    keywords: ["nonprofit", "charity", "ngo", "foundation", "donate", "cause"],
    pages: ["Home", "Mission", "Programs", "Donate", "Contact"],
    features: ["Mission story", "Program list", "Donate CTA"],
    description: "Nonprofit site with mission, programs, and donation CTAs.",
    previewImage: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=80",
    accent: "#B45309",
  },
  {
    key: "events",
    label: "Events & Conference",
    category: "lifestyle",
    siteTemplateId: "education",
    keywords: ["event", "conference", "summit", "meetup", "ticket", "webinar"],
    pages: ["Home", "Agenda", "Speakers", "Tickets", "Contact"],
    features: ["Agenda", "Speaker grid", "Ticket CTA"],
    description: "Event site with agenda, speakers, and ticket sales.",
    previewImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80",
    accent: "#7C3AED",
  },
  {
    key: "portfolio",
    label: "Personal Portfolio",
    category: "minimal",
    siteTemplateId: "agency",
    keywords: ["portfolio", "freelancer", "personal", "resume", "designer", "developer"],
    pages: ["Home", "Work", "About", "Services", "Contact"],
    features: ["Case studies", "About", "Hire CTA"],
    description: "Personal portfolio for freelancers and creative professionals.",
    previewImage: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80",
    accent: "#334155",
  },
  {
    key: "construction",
    label: "Construction",
    category: "corporate",
    siteTemplateId: "agency",
    keywords: ["construction", "contractor", "builder", "architecture", "renovation"],
    pages: ["Home", "Projects", "Services", "About", "Contact"],
    features: ["Project gallery", "Service list", "Quote CTA"],
    description: "Contractor site with projects, services, and quote requests.",
    previewImage: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
    accent: "#92400E",
  },
  {
    key: "automotive",
    label: "Automotive",
    category: "ecommerce",
    siteTemplateId: "ecommerce",
    keywords: ["auto", "car", "dealership", "garage", "vehicle", "motors"],
    pages: ["Home", "Inventory", "Services", "Finance", "Contact"],
    features: ["Inventory grid", "Service bay", "Finance CTA"],
    description: "Dealership or garage site with inventory and services.",
    previewImage: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80",
    accent: "#1F2937",
  },
  {
    key: "beauty",
    label: "Beauty Salon",
    category: "lifestyle",
    siteTemplateId: "agency",
    keywords: ["beauty", "salon", "spa", "hair", "nails", "skincare"],
    pages: ["Home", "Services", "Gallery", "Booking", "Contact"],
    features: ["Service menu", "Gallery", "Book appointment"],
    description: "Salon or spa with services, gallery, and booking.",
    previewImage: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80",
    accent: "#DB2777",
  },
  {
    key: "pet",
    label: "Pet Care",
    category: "lifestyle",
    siteTemplateId: "agency",
    keywords: ["pet", "vet", "veterinary", "dog", "cat", "animal"],
    pages: ["Home", "Services", "Team", "Tips", "Contact"],
    features: ["Vet services", "Team", "Care tips"],
    description: "Veterinary or pet-care site with services and team.",
    previewImage: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1200&q=80",
    accent: "#EA580C",
  },
  {
    key: "travel",
    label: "Travel Agency",
    category: "hospitality",
    siteTemplateId: "realestate",
    keywords: ["travel", "tour", "trip", "vacation", "agency travel", "destination"],
    pages: ["Home", "Destinations", "Packages", "About", "Contact"],
    features: ["Destination cards", "Packages", "Inquiry form"],
    description: "Travel agency with destinations and package bookings.",
    previewImage: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80",
    accent: "#0284C7",
  },
  {
    key: "startup",
    label: "Startup Landing",
    category: "saas",
    siteTemplateId: "agency",
    keywords: ["startup", "landing", "mvp", "launch", "pitch"],
    pages: ["Home", "Product", "Team", "Blog", "Contact"],
    features: ["Hero CTA", "Product story", "Team"],
    description: "Startup landing with product story and waitlist energy.",
    previewImage: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1200&q=80",
    accent: "#4F46E5",
  },
  {
    key: "admin",
    label: "Admin Dashboard",
    category: "admin",
    siteTemplateId: "education",
    keywords: ["admin", "dashboard", "backoffice", "console", "analytics"],
    pages: ["Dashboard", "Tables", "Users", "Settings", "Reports"],
    features: ["KPI cards", "Data tables", "Settings"],
    description: "Admin console patterns for internal tools and analytics.",
    previewImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    accent: "#7C3AED",
  },
  {
    key: "project",
    label: "Project Management",
    category: "project-management",
    siteTemplateId: "agency",
    keywords: ["project management", "task", "kanban", "scrum", "productivity", "todo"],
    pages: ["Dashboard", "Projects", "Tasks", "Team", "Calendar"],
    features: ["Boards", "Task lists", "Team view"],
    description: "Project and task management product marketing site.",
    previewImage: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=1200&q=80",
    accent: "#4F46E5",
  },
];

const STYLES: StyleSeed[] = [
  { id: "modern", badge: "Modern", suffix: "Modern" },
  { id: "premium", badge: "Premium", suffix: "Premium", accent: "#0F172A" },
  { id: "minimal", badge: "Minimal", suffix: "Minimal", accent: "#334155" },
  { id: "bold", badge: "Bold", suffix: "Bold" },
  { id: "classic", badge: "Classic", suffix: "Classic", accent: "#1E3A5F" },
  { id: "soft", badge: "Soft", suffix: "Soft", accent: "#64748B" },
];

function buildDomainTemplates(): CatalogTemplate[] {
  const out: CatalogTemplate[] = [];
  for (const d of DOMAIN_SEEDS) {
    for (const s of STYLES) {
      out.push({
        id: `dom-${d.key}-${s.id}`,
        name: `${d.label} ${s.suffix}`,
        source: "Our Templates",
        price: "Free",
        stack: ["HTML", "CSS", d.label],
        description: `${d.description} · ${s.badge} visual system matched to ${d.label.toLowerCase()} businesses.`,
        category: d.category,
        siteTemplateId: d.siteTemplateId,
        pages: d.pages,
        features: d.features,
        previewImage: d.previewImage,
        accent: s.accent || d.accent,
        badge: `${d.label} · ${s.badge}`,
        keywords: d.keywords,
        domainKey: d.key,
      });
    }
  }
  return out;
}

export const DOMAIN_TEMPLATES: CatalogTemplate[] = buildDomainTemplates();

export type ScoredTemplate = CatalogTemplate & { score: number; matchedKeywords: string[] };

function tokenize(idea: string): string[] {
  return idea
    .toLowerCase()
    .replace(/[^a-z0-9\s+-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Score how well a catalog template matches the user's idea. */
export function scoreTemplateForIdea(
  template: CatalogTemplate & { keywords?: string[]; domainKey?: string },
  idea: string
): ScoredTemplate {
  const text = idea.toLowerCase();
  const tokens = tokenize(idea);
  const keywords = template.keywords || [];
  const hay = `${template.name} ${template.description} ${template.badge || ""} ${template.category} ${keywords.join(" ")} ${template.siteTemplateId}`.toLowerCase();

  let score = 0;
  const matched: string[] = [];

  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) {
      score += kw.includes(" ") ? 12 : 8;
      matched.push(kw);
    }
  }

  for (const tok of tokens) {
    if (hay.includes(tok)) score += 2;
    if (keywords.some((k) => k.includes(tok))) score += 3;
  }

  // Light boost for category-ish words in idea
  if (/hospital|clinic|health|dental|doctor|patient/.test(text) && /health|clinic|dental|hospital|care/.test(hay))
    score += 6;
  if (/shop|store|ecommerce|product|cart|checkout/.test(text) && /shop|ecom|store|product/.test(hay))
    score += 6;
  if (/food|restaurant|cafe|dining|delivery|menu|meal/.test(text) && /food|restaurant|cafe|dining|menu|delivery/.test(hay))
    score += 8;
  if (/saas|software|platform|dashboard/.test(text) && /saas|admin|software|dashboard|crm/.test(hay))
    score += 6;

  return { ...template, score, matchedKeywords: matched };
}

/** Rank templates for an idea — best matches first. */
export function rankTemplatesForIdea(
  templates: CatalogTemplate[],
  idea: string
): ScoredTemplate[] {
  if (!idea.trim()) {
    return templates.map((t) => ({ ...t, score: 0, matchedKeywords: [] }));
  }
  return templates
    .map((t) => scoreTemplateForIdea(t as CatalogTemplate & { keywords?: string[] }, idea))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/**
 * Domain-relevant templates for the idea.
 * If the idea strongly matches a domain, return only those (plus top related).
 * Otherwise return top-N scored across the full catalog.
 */
export function recommendTemplatesForIdea(
  templates: CatalogTemplate[],
  idea: string,
  opts?: { minScore?: number; limit?: number }
): { recommended: ScoredTemplate[]; domainLabel: string | null; showingAllFallback: boolean } {
  const limit = opts?.limit ?? 24;
  const minScore = opts?.minScore ?? 6;
  const ranked = rankTemplatesForIdea(templates, idea);
  const strong = ranked.filter((t) => t.score >= minScore);

  if (strong.length >= 3) {
    const topDomain = (strong[0] as ScoredTemplate & { domainKey?: string }).domainKey;
    const sameDomain = topDomain
      ? strong.filter((t) => (t as ScoredTemplate & { domainKey?: string }).domainKey === topDomain)
      : strong;
    const recommended = (sameDomain.length >= 2 ? sameDomain : strong).slice(0, limit);
    const label =
      recommended[0]?.badge?.split("·")[0]?.trim() ||
      recommended[0]?.name.split(" ")[0] ||
      null;
    return { recommended, domainLabel: label, showingAllFallback: false };
  }

  return {
    recommended: ranked.slice(0, limit),
    domainLabel: null,
    showingAllFallback: true,
  };
}

/** Best siteTemplateId for an idea using domain scores. */
export function bestSiteTemplateIdForIdea(idea: string, preferredId?: string | null): string | null {
  if (preferredId) return preferredId;
  const { recommended } = recommendTemplatesForIdea(DOMAIN_TEMPLATES, idea, { minScore: 4, limit: 1 });
  return recommended[0]?.siteTemplateId || null;
}

export const DOMAIN_CATEGORY_CHIPS = [
  { id: "all", label: "All domains" },
  { id: "healthcare", label: "Healthcare" },
  { id: "saas", label: "SaaS" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "corporate", label: "Corporate" },
  { id: "education", label: "Education" },
  { id: "hospitality", label: "Hospitality" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "admin", label: "Admin" },
  { id: "project-management", label: "Projects" },
  { id: "minimal", label: "Minimal" },
];
