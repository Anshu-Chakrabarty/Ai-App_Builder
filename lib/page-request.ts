// lib/page-request.ts — parse "add page" chat + generation briefs
import { findPageDesign } from "./page-designs";
import type { PageDesign } from "./types";

const ADD_INTENT =
  /\b(add|create|include|make|need|want|build)\b/i;

export type ResolvedPageRequest = {
  /** Display label for the page */
  label: string;
  /** Stable page key */
  key: string;
  /** Catalog design when we have a ready layout */
  design?: PageDesign;
  /** Section / content hints from the brief for this page */
  sectionHints?: string;
};

export type BriefPagePlan = {
  pages: ResolvedPageRequest[];
  /** key → section hints string */
  sectionHints: Record<string, string>;
  /** True when we inferred a sitemap from the prompt (not template defaults) */
  fromPrompt: boolean;
};

/** Quality / meta lines that must NEVER become nav pages */
const NON_PAGE_LINE =
  /\b(modern|responsive|fast[- ]?loading|seo|accessible|mobile[- ]?friendly|clean design|ui\/ux|user[- ]friendly|brief requirements?|requirements? document|promotional website|website brief|style guide|look and feel|performance|security|scalability|hosting|tech stack|technology|framework)\b/i;

/** Titles that are meta, not pages */
const NON_PAGE_TITLE =
  /^(modern|responsive|design|brief|requirements?|overview|introduction|summary|general|notes?|misc|other|hospital promotional website|promotional website|website)$/i;

/**
 * Known site-page vocabulary → canonical label + key.
 * Used so briefs map to real pages (About, Doctors…) instead of adjective lines.
 */
const PAGE_ALIASES: { match: RegExp; label: string; key: string; designId?: string }[] = [
  { match: /\b(home\s*page|homepage|landing\s*page|^home$)\b/i, label: "Home", key: "home" },
  { match: /\b(about(\s+us)?|mission|vision|history|our\s+story)\b/i, label: "About", key: "about", designId: "about" },
  { match: /\b(department|specialt(y|ies)|clinical\s+services)\b/i, label: "Departments", key: "services", designId: "services" },
  { match: /\b(doctor|physician|provider|specialist|staff|team|profiles?)\b/i, label: "Doctors", key: "team", designId: "team" },
  { match: /\b(appointment|booking|schedule|book\s+(a\s+)?(visit|appointment))\b/i, label: "Appointments", key: "booking", designId: "booking" },
  { match: /\b(emergency|ambulance|urgent\s+care|24\s*\/?\s*7)\b/i, label: "Emergency", key: "emergency" },
  { match: /\b(health\s+package|packages?|pricing|plans?|services?\s+section)\b/i, label: "Packages", key: "services", designId: "services" },
  { match: /\b(contact(\s+us)?|get\s+in\s+touch|reach\s+us)\b/i, label: "Contact", key: "contact" },
  { match: /\b(faq|frequently\s+asked)\b/i, label: "FAQ", key: "faq", designId: "faq" },
  { match: /\b(testimonial|review|patient\s+stor)\b/i, label: "Testimonials", key: "testimonials", designId: "testimonials" },
  { match: /\b(blog|news|article|insight)\b/i, label: "Blog", key: "blog", designId: "blog" },
  { match: /\b(career|job|hiring)\b/i, label: "Careers", key: "careers", designId: "careers" },
  { match: /\b(insurance|coverage|billing)\b/i, label: "Insurance", key: "insurance", designId: "insurance" },
  { match: /\b(privacy|legal|terms)\b/i, label: "Privacy", key: "privacy", designId: "privacy" },
  { match: /\b(gallery|photos?|media)\b/i, label: "Gallery", key: "gallery" },
  { match: /\b(patient(\s+info|\s+resources)?|resources)\b/i, label: "Patients", key: "patients" },
  { match: /\b(service|treatment|what we (do|offer))\b/i, label: "Services", key: "services", designId: "services" },
  { match: /\b(pricing|rates|plans)\b/i, label: "Pricing", key: "pricing" },
  { match: /\b(location|directions|map|find us)\b/i, label: "Locations", key: "locations" },
];

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function keyFromLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "page"
  );
}

function isHomeLabel(name: string): boolean {
  const q = name.toLowerCase().trim();
  return (
    q === "home" ||
    q === "homepage" ||
    q === "home page" ||
    q === "landing" ||
    q === "landing page" ||
    q === "main page"
  );
}

function matchPageAlias(text: string): { label: string; key: string; designId?: string } | null {
  for (const a of PAGE_ALIASES) {
    if (a.match.test(text)) return { label: a.label, key: a.key, designId: a.designId };
  }
  return null;
}

function isQualityOrMetaLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  // Entire line is about design quality / non-page constraints
  if (NON_PAGE_LINE.test(t) && !matchPageAlias(t) && !/\b(page|section)\b/i.test(t)) {
    // "Modern homepage" still has homepage → keep; pure quality lines drop
    if (!/\b(home|about|doctor|department|appointment|contact|service|package|emergency)\b/i.test(t)) {
      return true;
    }
  }
  // Title-only meta
  const head = t.split(/\s+(?:with|[:—–-])\s+/i)[0].replace(/\bpages?\b/gi, "").trim();
  if (NON_PAGE_TITLE.test(head)) return true;
  // Adjective soup without a noun page type: "Modern, responsive, and fast-loading design"
  if (
    /^(modern|responsive|fast|clean|beautiful|sleek|elegant|professional)/i.test(t) &&
    /\b(design|ui|ux|look|feel|loading|performance)\b/i.test(t) &&
    !matchPageAlias(t)
  ) {
    return true;
  }
  return false;
}

/** Extract explicit page names from messages like "Add FAQ and insurance pages". */
export function extractPageNames(message: string): string[] | null {
  const msg = message.trim();
  if (!msg) return null;

  const hasIntent =
    ADD_INTENT.test(msg) ||
    /\bnew page\b/i.test(msg) ||
    /\banother page\b/i.test(msg);

  if (!hasIntent) return null;

  let rest = msg
    .replace(/^(please\s+)?(can you\s+)?(could you\s+)?(also\s+)?/i, "")
    .replace(/^(add|create|include|make|need|want|build)\s+(me\s+)?/i, "")
    .replace(/^(an?\s+)?(new\s+)?/i, "")
    .replace(/\bpages?\s*$/i, "")
    .trim();

  if (!rest) return null;

  const parts = rest
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map((p) =>
      p
        .replace(/^(a|an|the)\s+/i, "")
        .replace(/\bpage\b/gi, "")
        .trim()
    )
    .filter((p) => p.length > 0 && !isQualityOrMetaLine(p));

  if (!parts.length) return null;

  const hasPageWord = /\bpages?\b/i.test(msg);
  const hasKnownPage = parts.some(
    (p) => !!findPageDesign(p) || isHomeLabel(p) || !!matchPageAlias(p)
  );

  if (!hasPageWord && !hasKnownPage) return null;
  if (parts.some((p) => p.split(/\s+/).length > 5)) return null;

  return parts;
}

export function resolvePageRequest(
  name: string,
  sectionHints?: string
): ResolvedPageRequest {
  const cleaned = name.trim();
  if (isHomeLabel(cleaned)) {
    return {
      label: "Home",
      key: "home",
      sectionHints: sectionHints?.trim() || undefined,
    };
  }

  const alias = matchPageAlias(cleaned);
  if (alias) {
    const design = alias.designId ? findPageDesign(alias.designId) : findPageDesign(alias.label);
    return {
      label: alias.label,
      key: alias.key,
      design: design || undefined,
      sectionHints: sectionHints?.trim() || undefined,
    };
  }

  const design = findPageDesign(cleaned);
  const label = design?.label ?? titleCase(cleaned);
  const key = design?.id ?? keyFromLabel(label);
  return {
    label,
    key,
    design,
    sectionHints: sectionHints?.trim() || undefined,
  };
}

export function parseAddPageRequests(message: string): ResolvedPageRequest[] | null {
  const names = extractPageNames(message);
  if (!names?.length) return null;
  return names.map((n) => resolvePageRequest(n));
}

/**
 * Split a generation brief into REAL site pages only.
 * Quality lines ("Modern, responsive…") and meta titles are ignored;
 * content stays available as global style/context via the full idea string.
 */
export function parsePagesFromBrief(prompt: string): BriefPagePlan {
  const text = (prompt || "").trim();
  if (!text) {
    return { pages: [], sectionHints: {}, fromPrompt: false };
  }

  const chunks = splitBriefIntoChunks(text);
  const pages: ResolvedPageRequest[] = [];
  const sectionHints: Record<string, string> = {};
  const seen = new Set<string>();

  for (const chunk of chunks) {
    if (isQualityOrMetaLine(chunk)) continue;

    const parsed = parseChunkTitleAndHints(chunk);
    if (!parsed) continue;
    if (isQualityOrMetaLine(parsed.title)) continue;
    if (!isAcceptablePageTitle(parsed.title, chunk)) continue;

    const req = resolvePageRequest(parsed.title, parsed.hints || chunk);
    // Drop meta keys that slipped through
    if (NON_PAGE_TITLE.test(req.label) || NON_PAGE_TITLE.test(req.key.replace(/-/g, " "))) {
      continue;
    }
    if (seen.has(req.key)) {
      if (parsed.hints || chunk) {
        const extra = parsed.hints || chunk;
        sectionHints[req.key] = [sectionHints[req.key], extra].filter(Boolean).join("; ");
        const existing = pages.find((p) => p.key === req.key);
        if (existing) existing.sectionHints = sectionHints[req.key];
      }
      continue;
    }
    seen.add(req.key);
    if (parsed.hints) sectionHints[req.key] = parsed.hints;
    else sectionHints[req.key] = chunk;
    pages.push({ ...req, sectionHints: sectionHints[req.key] });
  }

  // If we found page-like content via aliases even without clean titles, scan whole text
  if (pages.length === 0) {
    for (const a of PAGE_ALIASES) {
      if (a.key === "home") continue;
      if (a.match.test(text) && !seen.has(a.key)) {
        seen.add(a.key);
        const design = a.designId ? findPageDesign(a.designId) : undefined;
        pages.push({
          label: a.label,
          key: a.key,
          design: design || undefined,
          sectionHints: undefined,
        });
      }
    }
  }

  const fromPrompt =
    pages.length > 0 &&
    (pages.some((p) => p.key !== "home") ||
      /\b(home\s*page|about|department|doctor|appointment|services|contact|faq)\b/i.test(text));

  return { pages, sectionHints, fromPrompt };
}

/** Accept only titles that map to real site pages or known catalog designs. */
function isAcceptablePageTitle(title: string, fullChunk: string): boolean {
  if (isHomeLabel(title)) return true;
  if (findPageDesign(title)) return true;
  if (matchPageAlias(title) || matchPageAlias(fullChunk)) return true;
  // Explicit "… page(s)" with a short noun phrase
  if (/\bpages?\b/i.test(fullChunk) && title.split(/\s+/).length <= 4) {
    if (NON_PAGE_TITLE.test(title)) return false;
    // Reject if title is only adjectives
    if (/^(modern|responsive|fast|clean|beautiful|sleek)/i.test(title)) return false;
    return true;
  }
  // "X with Y" structure where X is short — only if alias matches full chunk
  if (/\bwith\b/i.test(fullChunk) && matchPageAlias(fullChunk)) return true;
  return false;
}

function splitBriefIntoChunks(text: string): string[] {
  const byLine = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  if (byLine.length >= 2) return byLine;

  const sentenceish = text
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentenceish.length >= 2) {
    const pageLike = sentenceish.filter((s) => looksLikePageChunk(s));
    if (pageLike.length >= 2) return pageLike;
  }

  return [text];
}

function looksLikePageChunk(s: string): boolean {
  if (isQualityOrMetaLine(s)) return false;
  const head = s.split(/\s+with\s+/i)[0].split("(")[0].trim();
  if (head.length > 48) return false;
  if (isHomeLabel(head.replace(/\bpages?\b/gi, "").trim())) return true;
  if (findPageDesign(head.replace(/\bpages?\b/gi, "").trim())) return true;
  if (matchPageAlias(s) || matchPageAlias(head)) return true;
  return false;
}

function parseChunkTitleAndHints(
  chunk: string
): { title: string; hints: string } | null {
  let raw = chunk.trim().replace(/\.$/, "").trim();
  if (!raw) return null;

  let title = raw;
  let hints = "";

  const paren = raw.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (paren) {
    title = paren[1].trim();
    hints = paren[2].trim();
  } else {
    const withSplit = raw.match(/^(.+?)\s+\bwith\b\s+(.+)$/i);
    if (withSplit) {
      title = withSplit[1].trim();
      hints = withSplit[2].trim();
    } else {
      const colon = raw.match(/^([^:?—–-]{2,50})\s*[:—–-]\s+(.+)$/);
      if (colon && colon[1].split(/\s+/).length <= 6) {
        title = colon[1].trim();
        hints = colon[2].trim();
      }
    }
  }

  title = title
    .replace(/\bpages?\b/gi, "")
    .replace(/^(a|an|the)\s+/i, "")
    .trim();

  if (!title || title.split(/\s+/).length > 6) return null;
  if (/\b(we|our clinic|please|generate|create a site)\b/i.test(title) && !isHomeLabel(title)) {
    return null;
  }

  return { title, hints };
}

/** Resolve which existing page a delete/remove instruction refers to. */
export function resolvePageToDelete(
  prompt: string,
  pages: { key: string; label: string }[]
): { key: string; label: string } | null {
  const msg = prompt.toLowerCase();
  if (!/\b(delete|remove|drop|get rid of)\b/i.test(prompt)) return null;
  if (!/\bpage\b/i.test(msg) && !pages.some((p) => msg.includes(p.label.toLowerCase()))) {
    // Allow "delete about" / "remove doctors"
    const hit = pages.find(
      (p) => p.key !== "home" && (msg.includes(p.key) || msg.includes(p.label.toLowerCase()))
    );
    if (!hit || !/\b(delete|remove|drop)\b/i.test(prompt)) return null;
    return hit;
  }

  // Prefer explicit label/key mentions
  for (const p of pages) {
    if (p.key === "home") continue;
    const label = p.label.toLowerCase();
    if (msg.includes(label) || msg.includes(p.key.replace(/-/g, " ")) || msg.includes(p.key)) {
      return p;
    }
  }

  // "delete this page" → caller should pass active page
  if (/\b(this|current)\s+page\b/i.test(prompt)) return null;

  return null;
}
