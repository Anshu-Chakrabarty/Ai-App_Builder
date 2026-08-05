// lib/template-ai/agent-helpers.ts — shared intent/target helpers (no pipeline imports)
import type { ConfigUpdate, SiteConfig, TemplateManifest } from "./types";
import { galleryLabelsFor } from "@/lib/site-media";

export type AgentTarget = { id: string; kind?: string; label?: string };

/** Common heading / keyword aliases → section component (matched against prompt text). */
const SECTION_COMPONENT_ALIASES: Record<string, string[]> = {
  hero: ["hero", "homepage hero", "main banner", "hero section"],
  split: ["split", "split media", "polished layout", "split section"],
  gallery: ["gallery", "photo grid", "visual story", "gallery section"],
  features: ["features", "feature icons", "feature section", "why it feels"],
  services: [
    "services at a glance",
    "care pathways",
    "service cards",
    "services section",
    "services",
    "service grid",
  ],
  highlights: ["highlights", "highlight section"],
  cta: ["cta", "call to action", "cta band", "cta section"],
  form: ["form", "lead form", "contact form", "form section"],
  banner: ["page banner", "banner section"],
  blocks: ["custom blocks", "blocks section"],
  doctors: ["doctors", "meet your doctors", "providers", "care team"],
  patients: ["for patients", "patients", "visiting"],
  work: ["work", "portfolio", "projects"],
  about: ["about", "about us"],
  contact: ["contact", "contact section"],
  pricing: ["pricing", "plans", "pricing section"],
  faq: ["faq", "faqs", "frequently asked"],
  team: ["team", "our team"],
  testimonials: ["testimonials", "reviews"],
};

/**
 * Resolve a section from prompt text by id, component, manifest name, heading aliases,
 * or live config titles — so naming a section works without a Studio selection.
 */
export function resolveSectionTargetFromPrompt(
  prompt: string,
  opts?: {
    manifest?: TemplateManifest | null;
    config?: SiteConfig | null;
    activePageKey?: string;
  }
): AgentTarget | null {
  const raw = (prompt || "").replace(/^\[Target:[^\]]+\]\s*/i, "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const page = opts?.activePageKey || "home";
  const manifest = opts?.manifest;
  const config = opts?.config;

  type Cand = { id: string; label: string; score: number; pageKey: string };
  const cands: Cand[] = [];

  const push = (id: string, label: string, score: number, pageKey = "home") => {
    if (!id || score <= 0) return;
    const existing = cands.find((c) => c.id === id);
    if (existing) {
      if (score > existing.score) {
        existing.score = score;
        existing.label = label;
      }
      return;
    }
    cands.push({ id, label, score, pageKey });
  };

  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const phraseIn = (phrase: string): number => {
    const p = phrase.toLowerCase().trim();
    if (p.length < 2) return 0;
    // Prefer multi-word / longer phrases
    if (p.includes(" ")) {
      if (lower.includes(p)) return 40 + Math.min(30, p.length);
      return 0;
    }
    // Single token: word boundary; short tokens need stronger context
    const re = new RegExp(`\\b${escapeRe(p)}\\b`, "i");
    if (!re.test(lower)) return 0;
    if (p.length <= 3) return 8;
    if (p.length <= 5) return 18;
    return 28;
  };

  // 1) Manifest sections — name, id, component
  const sections = manifest?.sections || [];
  for (const s of sections) {
    let score = 0;
    score = Math.max(score, phraseIn(s.name));
    score = Math.max(score, phraseIn(s.id));
    score = Math.max(score, phraseIn(s.component));
    // “home.services” written explicitly
    if (lower.includes(s.id.toLowerCase())) score = Math.max(score, 55);
    // Prefer active page
    if (score > 0 && s.pageKey === page) score += 5;
    if (score > 0) push(s.id, s.name || s.component, score, s.pageKey);
  }

  // 2) Built-in component aliases (covers headings like “Services at a glance”)
  for (const [component, aliases] of Object.entries(SECTION_COMPONENT_ALIASES)) {
    let best = 0;
    for (const a of aliases) {
      best = Math.max(best, phraseIn(a));
    }
    if (best <= 0) continue;
    // Prefer existing manifest section on active/home page
    const match =
      sections.find((s) => s.component === component && s.pageKey === page) ||
      sections.find((s) => s.component === component && s.pageKey === "home") ||
      sections.find((s) => s.component === component);
    const id = match?.id || `${page}.${component}`;
    const label =
      match?.name ||
      (component === "services" ? "Services at a glance" : component.charAt(0).toUpperCase() + component.slice(1));
    // Multi-word alias hits should beat short generic tokens
    push(id, label, best + (match ? 3 : 0), match?.pageKey || page);
  }

  // 3) Live config titles (gallery/features/cta/form/split)
  const titleMap: Array<{ path: string[]; sectionId: string; labelFallback: string }> = [
    { path: ["visual", "gallery", "title"], sectionId: "home.gallery", labelFallback: "Gallery" },
    { path: ["visual", "features", "title"], sectionId: "home.features", labelFallback: "Features" },
    { path: ["visual", "cta", "title"], sectionId: "home.cta", labelFallback: "CTA" },
    { path: ["visual", "form", "title"], sectionId: "home.form", labelFallback: "Form" },
    { path: ["visual", "split", "title"], sectionId: "home.split", labelFallback: "Split media" },
    { path: ["hero", "title"], sectionId: "home.hero", labelFallback: "Hero" },
  ];
  if (config) {
    for (const t of titleMap) {
      let cur: any = config.content;
      for (const key of t.path) cur = cur?.[key];
      const title = typeof cur === "string" ? cur.trim() : "";
      if (title.length < 3) continue;
      const sc = phraseIn(title);
      if (sc > 0) {
        const man = sections.find((s) => s.id === t.sectionId);
        push(t.sectionId, title || man?.name || t.labelFallback, sc + 10, "home");
      }
    }
  }

  // 4) Disambiguate services vs highlights when both matched
  const servicesHit = cands.find((c) => /services/i.test(c.id));
  const highlightsHit = cands.find((c) => /highlights/i.test(c.id));
  if (
    servicesHit &&
    highlightsHit &&
    /\b(services?\s+at\s+a\s+glance|care\s+pathways|service\s*cards?|services?)\b/i.test(lower)
  ) {
    highlightsHit.score = Math.min(highlightsHit.score, 5);
    servicesHit.score += 15;
  }

  // Need a meaningful hit — ignore weak single short-token noise
  cands.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const best = cands[0];
  if (!best || best.score < 18) return null;

  // Don't steal gallery-card captions as sections (e.g. short "Care") unless score is strong
  const component = best.id.includes(".") ? best.id.split(".").pop()! : best.id;
  if (best.score < 28 && best.label.length <= 5 && !/\bsection\b/i.test(lower)) {
    if (!new RegExp(`\\b${escapeRe(component)}\\b`, "i").test(lower)) {
      return null;
    }
  }

  return { id: best.id, kind: "section", label: best.label };
}

export type AgentHistoryTurn = { role: "user" | "assistant"; text: string };
export type AgentWorkEntry = {
  at: number;
  prompt: string;
  summary: string;
  ops?: string[];
};

/** Gallery caption → index (Delivery → 2 for food, etc.). */
export function resolveGalleryCardIndex(
  prompt: string,
  labels: string[],
  target?: { id?: string; label?: string } | null
): number | null {
  const msg = `${prompt || ""} ${target?.label || ""}`.toLowerCase();
  if (!msg.trim()) return null;

  const fromId = (target?.id || "").match(/^media\.gallery\.(\d+)$/i);
  if (fromId) return Number(fromId[1]);

  // Don't treat copy edits ("hero title", "Fort Care") as gallery hits
  const galleryContext =
    /\b(gallery|photo\s*grid|shot|tile|unsplash)\b/.test(msg) ||
    /\b(image|photo|picture)\b/.test(msg) ||
    /\b(card)\b/.test(msg) && !/\b(service|feature|pricing|title|heading|subtitle|cta|button)\b/.test(msg) ||
    /^media\.gallery/i.test(target?.id || "");

  for (let i = 0; i < labels.length; i++) {
    const lab = String(labels[i] || "")
      .toLowerCase()
      .trim();
    if (lab.length < 2) continue;
    // Short labels ("Care", "Team") only match with explicit gallery/image context
    if (lab.length <= 5 && !galleryContext) continue;
    const re = new RegExp(
      `\\b${lab.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    if (re.test(msg)) return i;
  }

  if (!galleryContext && !/\b(first|second|third|fourth|fifth|1st|2nd|3rd)\b/.test(msg)) {
    return null;
  }

  const ordinals: Record<string, number> = {
    first: 0,
    second: 1,
    third: 2,
    fourth: 3,
    fifth: 4,
    sixth: 5,
    left: 0,
    middle: 1,
    center: 1,
    right: 2,
  };
  for (const [word, i] of Object.entries(ordinals)) {
    if (new RegExp(`\\b${word}\\s+(card|image|photo|shot|tile|picture)\\b`).test(msg)) {
      return i;
    }
  }

  const num =
    msg.match(/\b(?:gallery|card|image|photo|shot)\s*[#:]?\s*(\d+)\b/) ||
    msg.match(/\b(\d+)(?:st|nd|rd|th)\s+(?:card|image|photo|shot)\b/);
  if (num) {
    const n = Number(num[1]);
    if (n >= 1 && n <= 6) return n - 1;
    if (n >= 0 && n <= 5) return n;
  }

  return null;
}

/**
 * Pick which media field an uploaded/pasted image should update.
 * Never defaults every image edit to media.hero — respect target + prompt wording.
 */
export function resolveImageTargetId(
  prompt: string,
  target?: { id: string; kind?: string; label?: string } | null,
  opts?: { galleryLabels?: string[]; mediaCategory?: string }
): string {
  const id = target?.id || "";
  if (/^media\.gallery\.\d+$/i.test(id)) return id;
  if (id.startsWith("media.") && !/^media\.gallery$/i.test(id)) return id;
  if (target?.kind === "image" && id && !/gallery/i.test(id)) return id;

  const labels =
    opts?.galleryLabels?.length
      ? opts.galleryLabels
      : galleryLabelsFor(opts?.mediaCategory || "default");
  const galleryIdx = resolveGalleryCardIndex(prompt, labels, target);
  if (galleryIdx != null) return `media.gallery.${galleryIdx}`;

  if (/^split$|home\.split|visual\.split/i.test(id)) return "media.split";
  if (/^gallery$|home\.gallery|visual\.gallery/i.test(id)) return "media.gallery.0";
  if (/^banner$|home\.banner|page-banner/i.test(id)) return "media.banner";
  if (/^hero$|home\.hero|^media$/i.test(id)) return "media.hero";

  const msg = (prompt || "").toLowerCase();
  if (/\bsplit\b|\bright\s*(column|image|photo|picture)\b|\bpolished\s+layout\b/.test(msg)) {
    return "media.split";
  }
  if (
    /\b(gallery|photo\s*grid|card)\b/.test(msg) &&
    !/\bhero|background|banner|cover\b/.test(msg)
  ) {
    return "media.gallery.0";
  }
  if (/\bbanner\b/.test(msg) && !/\bhero\b/.test(msg)) return "media.banner";
  if (/\bhero\b|\bbackground\b|\bcover\b|\bfull[- ]?bleed\b/.test(msg)) return "media.hero";

  if (target?.kind === "section" && /split/i.test(id + (target.label || ""))) return "media.split";
  if (target?.kind === "section" && /gallery/i.test(id + (target.label || "")))
    return "media.gallery.0";
  if (target?.kind === "section" && /hero/i.test(id + (target.label || ""))) return "media.hero";

  if (/\b(image|photo|picture)\b/.test(msg) && !/\bhero|background|banner|cover|gallery\b/.test(msg)) {
    if (target?.kind === "section" || target?.kind === "image") return "media.split";
    return "media.hero";
  }
  return "media.hero";
}

export function isLayoutIntent(prompt: string): boolean {
  const msg = (prompt || "").toLowerCase().trim();
  if (!msg) return false;
  // “Make it 6 cards” / images+text on cards is content reshape, not layout-only
  if (/\b\d{1,2}\s+cards?\b/.test(msg)) return false;
  if (/\b(add|more)\s+cards?\b/.test(msg)) return false;
  if (/\bcards?\b/.test(msg) && /\b(image|images|photo|text|modify|rewrite)\b/.test(msg)) {
    return false;
  }
  if (/\b\d\s*[\/x×]\s*\d\b/.test(msg)) return true;
  if (/\b(\d)\s*by\s*(\d)\b/.test(msg)) return true;
  if (/\b(\d)[- ]?col(?:umn)?s?\b/.test(msg)) return true;
  if (/\bin\s+a\s+\d[- ]?(column|col|row)\b/.test(msg)) return true;
  if (/\b(equal|uniform)\s+(grid|columns?)\b/.test(msg)) return true;
  if (/\b(align|re-?arrange|arrange)\b/.test(msg) && /\b(column|columns|grid|row|\d)\b/.test(msg)) {
    return true;
  }
  if (/\b(make|set|put)\b.*\b(columns?|grid)\b/.test(msg)) return true;
  return false;
}

export function detectColumnCount(prompt: string): number {
  const msg = (prompt || "").toLowerCase();
  const m =
    msg.match(/\b(\d)\s*[\/x×]\s*\d\b/) ||
    msg.match(/\b(\d)\s*by\s*\d\b/) ||
    msg.match(/\b(\d)[- ]?col(?:umn)?s?\b/) ||
    msg.match(/\bin\s+a\s+(\d)[- ]?(?:column|col|row)\b/) ||
    msg.match(/\bin\s+(\d)\b/) ||
    msg.match(/\b(\d)\s*per\s*row\b/);
  const n = m ? Number(m[1]) : 3;
  return Math.min(6, Math.max(2, n || 3));
}

export function resolveLayoutUpdates(
  prompt: string,
  target?: { id: string; kind?: string; label?: string } | null
): ConfigUpdate[] {
  const cols = detectColumnCount(prompt);
  const id = (target?.id || "").toLowerCase();
  const label = (target?.label || "").toLowerCase();
  const msg = (prompt || "").toLowerCase();
  const blob = `${id} ${label} ${msg}`;

  if (/gallery|photo|visual story/.test(blob)) {
    return [
      { type: "layout", id: "layout.galleryColumns", value: cols, op: "set" },
      { type: "layout", id: "layout.galleryVariant", value: "equal", op: "set" },
    ];
  }
  if (/service|glance|care pathway|home\.services|home\.highlights/.test(blob)) {
    return [{ type: "layout", id: "layout.serviceColumns", value: cols, op: "set" }];
  }
  if (/feature|icon|why it feels|feature-icons|home\.features/.test(blob)) {
    return [{ type: "layout", id: "layout.featureColumns", value: cols, op: "set" }];
  }
  if (/block|added|html|widget/.test(blob) || target?.id === "home.blocks") {
    return [{ type: "layout", id: "layout.blocksColumns", value: cols, op: "set" }];
  }
  if (/gallery|photo|image|picture/.test(msg)) {
    return [
      { type: "layout", id: "layout.galleryColumns", value: cols, op: "set" },
      { type: "layout", id: "layout.galleryVariant", value: "equal", op: "set" },
    ];
  }
  return [
    { type: "layout", id: "layout.blocksColumns", value: cols, op: "set" },
    { type: "layout", id: "layout.galleryColumns", value: cols, op: "set" },
    { type: "layout", id: "layout.galleryVariant", value: "equal", op: "set" },
    { type: "layout", id: "layout.featureColumns", value: cols, op: "set" },
    { type: "layout", id: "layout.serviceColumns", value: cols, op: "set" },
  ];
}

export function isFollowUpPrompt(prompt: string): boolean {
  const msg = (prompt || "").trim().toLowerCase();
  if (!msg || msg.length > 100) return false;
  if (isNewTopicPrompt(msg)) return false;
  if (/^(yes|no|ok|okay|more|less|perfect|better|worse|shorter|longer|warmer|cooler|bolder|softer)[.!]?$/i.test(msg)) {
    return true;
  }
  if (/\b(make it|change it|update it|fix it|tweak it|refine it|try again)\b/i.test(msg)) {
    return true;
  }
  if (/^(make|change|update|fix|tweak|refine)\s+(it|this)([.!]|\s|$)/i.test(msg)) {
    return true;
  }
  return false;
}

export function isNewTopicPrompt(prompt: string): boolean {
  const msg = (prompt || "").toLowerCase();
  return /\b(now |separately|separate(ly)?|new request|different|forget (that|previous)|ignore previous|start over|unrelated|on the (about|home|contact|doctors|departments)|switch to|another page|meanwhile)\b/i.test(
    msg
  );
}

export function inferTargetFromMemory(
  history?: AgentHistoryTurn[],
  workLog?: AgentWorkEntry[]
): { id: string; kind?: string; label?: string } | null {
  const lastWork = [...(workLog || [])]
    .reverse()
    .find((w) => w.ops?.length && !w.ops.includes("answer") && !w.ops.includes("undo"));
  if (lastWork?.ops?.length) {
    for (const op of lastWork.ops) {
      const id = op.includes(":") ? op.split(":").slice(1).join(":") : op;
      if (!id || id === "answer" || id === "undo") continue;
      if (id.startsWith("layout.")) {
        if (id.includes("gallery")) return { id: "home.gallery", kind: "section", label: "Gallery" };
        if (id.includes("feature")) return { id: "home.features", kind: "section", label: "Features" };
        if (id.includes("blocks")) return { id: "home.blocks", kind: "section", label: "Blocks" };
        continue;
      }
      const kind = id.startsWith("media.")
        ? "image"
        : /^home\./.test(id) || /^(hero|split|gallery|features|banner)$/i.test(id)
          ? "section"
          : id.includes(".")
            ? "field"
            : "section";
      return { id, kind, label: id };
    }
  }

  const lastUser = [...(history || [])].reverse().find((h) => h.role === "user");
  if (lastUser?.text) {
    const bracket = lastUser.text.match(/\[Target:\s*([^\]]+)\]/i);
    if (bracket?.[1]) {
      const m = bracket[1].match(/^(.+?)\s*\(([^,]+),\s*([^)]+)\)/);
      if (m) {
        return { label: m[1].trim(), id: m[2].trim(), kind: m[3].trim() };
      }
    }
    const arrow = lastUser.text.match(/→\s*([^\n[]+)/);
    if (arrow?.[1]) {
      const label = arrow[1].trim().toLowerCase();
      if (/hero image|media\.hero/.test(label)) return { id: "media.hero", kind: "image", label: arrow[1].trim() };
      if (/split image|media\.split/.test(label)) return { id: "media.split", kind: "image", label: arrow[1].trim() };
      if (/gallery/.test(label)) return { id: "home.gallery", kind: "section", label: arrow[1].trim() };
      if (/split/.test(label)) return { id: "home.split", kind: "section", label: arrow[1].trim() };
      if (/feature/.test(label)) return { id: "home.features", kind: "section", label: arrow[1].trim() };
      if (/hero/.test(label)) return { id: "home.hero", kind: "section", label: arrow[1].trim() };
      if (/title|heading|subtitle|cta/.test(label) && /\./.test(label)) {
        return { id: arrow[1].trim(), kind: "field", label: arrow[1].trim() };
      }
    }
  }
  return null;
}

const STOCK_IMAGES: Record<string, string> = {
  office: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
  team: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80",
  city: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80",
  restaurant: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
  tech: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80",
  medical: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80",
  fitness: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80",
  fashion: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1600&q=80",
  nature: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=80",
  night: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1600&q=80",
};

export const UNSPLASH_KEYWORDS = Object.keys(STOCK_IMAGES);

export function pickStockImage(msg: string, category?: string): string {
  const foodPool = [
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
  ];
  if (/\bdelivery\b/.test(msg))
    return "https://images.unsplash.com/photo-1576867757603-05b134ebc379?auto=format&fit=crop&w=1600&q=80";
  if (/\bmenu\b/.test(msg))
    return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1600&q=80";
  if (/\bdining\b/.test(msg))
    return "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80";
  if (/\b(dish|kitchen|chef)\b/.test(msg))
    return foodPool[Math.floor(Math.random() * foodPool.length)];

  for (const k of UNSPLASH_KEYWORDS) {
    if (msg.includes(k)) return STOCK_IMAGES[k];
  }
  const byCategory: Record<string, string> = {
    healthcare: STOCK_IMAGES.medical,
    dental: STOCK_IMAGES.medical,
    agency: STOCK_IMAGES.office,
    ecommerce: STOCK_IMAGES.fashion,
    food: foodPool[Math.floor(Math.random() * foodPool.length)],
    realestate: STOCK_IMAGES.city,
    education: STOCK_IMAGES.team,
  };
  return byCategory[category || ""] || STOCK_IMAGES.office;
}

export function detectBackgroundColor(msg: string): string | null {
  const named: Record<string, string> = {
    black: "#0b0e14",
    white: "#ffffff",
    dark: "#0b1020",
    navy: "#0b1e3f",
    blue: "#0b1e3f",
    green: "#06251b",
    purple: "#1a0b2e",
    gray: "#111318",
    grey: "#111318",
    cream: "#faf6ef",
    beige: "#f4ecdf",
  };
  const hex = msg.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  if (hex) return hex[0];
  for (const [name, val] of Object.entries(named)) {
    if (msg.includes(name)) return val;
  }
  return null;
}
