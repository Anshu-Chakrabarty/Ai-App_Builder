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
    .replace(
      /^(please\s+)?(can you\s+)?(could you\s+)?(also\s+)?/i,
      ""
    )
    .replace(
      /^(add|create|include|make|need|want|build)\s+(me\s+)?/i,
      ""
    )
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
    .filter((p) => p.length > 0);

  if (!parts.length) return null;

  const hasPageWord = /\bpages?\b/i.test(msg);
  const hasKnownPage = parts.some((p) => !!findPageDesign(p) || isHomeLabel(p));

  // Avoid treating vague improvement prompts as page names
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
 * Split a generation brief into page intents.
 * Lines / list items like "About Us (Vision, Mission)" or
 * "Home Page with hero, specialties" → page title + section hints.
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
    const parsed = parseChunkTitleAndHints(chunk);
    if (!parsed) continue;
    const req = resolvePageRequest(parsed.title, parsed.hints);
    if (seen.has(req.key)) {
      if (parsed.hints) {
        sectionHints[req.key] = [sectionHints[req.key], parsed.hints]
          .filter(Boolean)
          .join("; ");
        const existing = pages.find((p) => p.key === req.key);
        if (existing) existing.sectionHints = sectionHints[req.key];
      }
      continue;
    }
    seen.add(req.key);
    if (parsed.hints) sectionHints[req.key] = parsed.hints;
    pages.push(req);
  }

  // Only treat as prompt-driven when we found at least one clear page title
  const fromPrompt =
    pages.length > 0 &&
    (chunks.length >= 2 ||
      pages.some((p) => p.key !== "home") ||
      /\b(home\s*page|about|department|services|contact|faq)\b/i.test(text));

  return { pages, sectionHints, fromPrompt };
}

function splitBriefIntoChunks(text: string): string[] {
  // Prefer newline / numbered / bulleted structure
  const byLine = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  if (byLine.length >= 2) return byLine;

  // Single block: split on ". " only when it looks like "Page Name. Next Page"
  const sentenceish = text
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentenceish.length >= 2) {
    const pageLike = sentenceish.filter((s) => looksLikePageChunk(s));
    if (pageLike.length >= 2) return pageLike;
  }

  // Last resort: one chunk (may still parse "Home with …")
  return [text];
}

function looksLikePageChunk(s: string): boolean {
  const head = s.split(/\s+with\s+/i)[0].split("(")[0].trim();
  if (head.length > 48) return false;
  if (isHomeLabel(head.replace(/\bpages?\b/gi, "").trim())) return true;
  if (findPageDesign(head.replace(/\bpages?\b/gi, "").trim())) return true;
  // Title-like short phrases: "Departments", "About Us", "Our Team"
  return /^[A-Za-z][A-Za-z0-9 &/-]{1,40}$/.test(head) && head.split(/\s+/).length <= 5;
}

function parseChunkTitleAndHints(
  chunk: string
): { title: string; hints: string } | null {
  let raw = chunk.trim().replace(/\.$/, "").trim();
  if (!raw) return null;

  // "Title (hints)" or "Title — hints" or "Title: hints" or "Title with hints"
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
      const colon = raw.match(/^([^:?—–-]{2,40})\s*[:—–-]\s+(.+)$/);
      if (colon && colon[1].split(/\s+/).length <= 5) {
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
  // Reject narrative sentences posing as titles
  if (/\b(we|our clinic|please|generate|create a site)\b/i.test(title) && !isHomeLabel(title)) {
    return null;
  }

  return { title, hints };
}
