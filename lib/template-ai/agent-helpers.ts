// lib/template-ai/agent-helpers.ts — shared intent/target helpers (no pipeline imports)
import type { ConfigUpdate, SiteConfig } from "./types";
import { galleryLabelsFor } from "@/lib/site-media";

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

  for (let i = 0; i < labels.length; i++) {
    const lab = String(labels[i] || "")
      .toLowerCase()
      .trim();
    if (lab.length < 2) continue;
    const re = new RegExp(
      `\\b${lab.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    if (re.test(msg)) return i;
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
  if (/\b\d\s*[\/x×]\s*\d\b/.test(msg)) return true;
  if (/\b(\d)\s*col(?:umn)?s?\b/.test(msg)) return true;
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
    msg.match(/\b(\d)\s*col(?:umn)?s?\b/) ||
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
  if (/feature|icon|card|why it feels/.test(blob)) {
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
