// lib/offline-site.ts — prompt-driven sample site when Gemini is unavailable
import type { DesignOption, PageDef, Template } from "./types";
import { parsePagesFromBrief } from "./page-request";
import { slugForPage } from "./page-designs";
import { optionsForMissingPage } from "./custom-designs";

function customPageFallback(label: string) {
  return {
    heading: label,
    blurb: `Learn more about ${label.toLowerCase()} at our practice.`,
    sections: [
      {
        title: "Overview",
        body: "We are committed to clear communication and patient-centered care.",
      },
      {
        title: "What to expect",
        body: "Our team will guide you through each step with compassion and respect.",
      },
      {
        title: "Next steps",
        body: "Contact us to learn more or schedule a visit.",
      },
    ],
    cta: "Contact us",
  };
}

export type OfflineSiteResult = {
  copy: Record<string, any>;
  pages: PageDef[];
  sectionHints: Record<string, string>;
  status: "ready" | "need_design";
  pendingPage?: { label: string; key: string };
  pendingQueue?: { label: string; key: string }[];
  options?: DesignOption[];
  assistantMessage: string;
};

/**
 * Build a site from the prompt using stored template/design sample copy.
 * Used when the Gemini API fails so the sitemap still follows the brief.
 */
export function buildOfflineSiteFromPrompt(args: {
  template: Template;
  prompt: string;
  brandName?: string;
}): OfflineSiteResult {
  const plan = parsePagesFromBrief(args.prompt);
  const usePrompt = plan.fromPrompt && plan.pages.length > 0;

  if (!usePrompt) {
    return {
      copy: { ...(args.template.fallback || {}) },
      pages: args.template.pages.map((p) => ({ ...p })),
      sectionHints: {},
      status: "ready",
      assistantMessage:
        "Gemini wasn’t available, so you’re seeing sample content for this template. Start a new project to retry generation.",
    };
  }

  const sectionHints = { ...plan.sectionHints };
  const copy: Record<string, any> = {
    ...(args.template.fallback || {}),
  };

  // Light brand tweak on home hero when present
  const brand = (args.brandName || "").trim();
  if (brand && copy.hero) {
    copy.hero = {
      ...copy.hero,
      subtitle:
        typeof copy.hero.subtitle === "string"
          ? copy.hero.subtitle.replace(
              /\b(Willow Primary Care|BrightPath Dental|our practice)\b/gi,
              brand
            )
          : copy.hero.subtitle,
    };
  }

  const pages: PageDef[] = [];
  const pendingUnknown: { label: string; key: string }[] = [];

  for (const req of plan.pages) {
    if (req.key === "home") {
      pages.push({ key: "home", label: "Home", slug: slugForPage("home") });
      continue;
    }
    if (req.design) {
      copy[req.key] = {
        ...req.design.fallback,
        ...(req.sectionHints
          ? {
              // Keep fallback shape; surface hints in body/blurb when useful
              body:
                (req.design.fallback as any).body ||
                `Focus areas: ${req.sectionHints}`,
              blurb:
                (req.design.fallback as any).blurb ||
                `Covering: ${req.sectionHints}`,
            }
          : {}),
      };
      pages.push({
        key: req.key,
        label: req.label,
        slug: slugForPage(req.key),
        designId: req.design.id,
      });
    } else {
      pendingUnknown.push({ label: req.label, key: req.key });
    }
  }

  pages.sort((a, b) => {
    if (a.key === "home") return -1;
    if (b.key === "home") return 1;
    return 0;
  });

  if (pendingUnknown.length > 0) {
    const [first, ...rest] = pendingUnknown;
    return {
      copy,
      pages,
      sectionHints,
      status: "need_design",
      pendingPage: first,
      pendingQueue: rest,
      options: optionsForMissingPage(),
      assistantMessage:
        `Gemini wasn’t available, so we built sample pages from your prompt: ${pages
          .map((p) => p.label)
          .join(", ") || "none yet"}. ` +
        `Pick a stored template or layout for “${first.label}”` +
        (sectionHints[first.key] ? ` (${sectionHints[first.key]})` : "") +
        ` — we’ll copy that design offline. Retry generation later for AI copy.`,
    };
  }

  return {
    copy,
    pages,
    sectionHints,
    status: "ready",
    assistantMessage:
      `Gemini wasn’t available, so you’re seeing sample content for exactly your prompt pages: ${pages
        .map((p) => p.label)
        .join(", ")}. Start a new project to retry AI generation.`,
  };
}

/** Apply a design pick offline when /api/modify is unavailable. */
export function applyDesignOffline(args: {
  copy: Record<string, any>;
  pages: PageDef[];
  pendingPage: { label: string; key: string };
  selectedDesignId: string;
  catalogFallback?: Record<string, any>;
  isCatalog: boolean;
  isLayout: boolean;
}): { copy: Record<string, any>; pages: PageDef[]; pageKey: string } | null {
  const { pendingPage, selectedDesignId } = args;
  const pageKey = pendingPage.key;
  if (args.pages.some((p) => p.key === pageKey)) return null;

  let pageCopy: Record<string, any>;
  let designId: string;

  if (args.isCatalog && args.catalogFallback) {
    pageCopy = { ...args.catalogFallback };
    designId = selectedDesignId;
  } else if (args.isLayout) {
    pageCopy = {
      ...customPageFallback(pendingPage.label),
      __customDesign: selectedDesignId,
    };
    designId = "custom:" + selectedDesignId;
  } else {
    return null;
  }

  return {
    copy: { ...args.copy, [pageKey]: pageCopy },
    pages: [
      ...args.pages,
      {
        key: pageKey,
        label: pendingPage.label,
        slug: slugForPage(pageKey),
        designId,
      },
    ],
    pageKey,
  };
}
