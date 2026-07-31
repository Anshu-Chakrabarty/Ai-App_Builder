// lib/appbuilder/pick-template.ts — map idea → real site template
import { TEMPLATES } from "@/lib/templates";
import { EXTRA_TEMPLATES } from "@/lib/templates-extra";
import type { Template } from "@/lib/types";
import { ALL_TEMPLATES, FEATURE_CATALOG } from "./catalog";
import { bestSiteTemplateIdForIdea } from "./domain-catalog";
import { findPageDesign, slugForPage } from "@/lib/page-designs";
import type { PageDef } from "@/lib/types";

export function allSiteTemplates(): Template[] {
  return [...TEMPLATES, ...EXTRA_TEMPLATES];
}

export function pickSiteTemplate(idea: string, preferredId?: string | null): Template {
  const all = allSiteTemplates();
  if (preferredId) {
    const hit = all.find((t) => t.id === preferredId);
    if (hit) return hit;
    // Catalog / domain card id → underlying site engine
    const card = ALL_TEMPLATES.find((t) => t.id === preferredId);
    if (card?.siteTemplateId) {
      const mapped = all.find((t) => t.id === card.siteTemplateId);
      if (mapped) return mapped;
    }
  }
  // Map AppBuilder UI template ids → site templates
  const uiMap: Record<string, string> = {
    "taskflow-pro": "agency",
    "saas-pulse": "agency",
    "admin-nova": "education",
    "minimal-board": "agency",
  };
  if (preferredId && uiMap[preferredId]) {
    const mapped = all.find((t) => t.id === uiMap[preferredId]);
    if (mapped) return mapped;
  }

  const scoredId = bestSiteTemplateIdForIdea(idea, null);
  if (scoredId) {
    const hit = all.find((x) => x.id === scoredId);
    if (hit) return hit;
  }

  const t = idea.toLowerCase();
  if (/dental|dentist|orthodont/i.test(t)) return all.find((x) => x.id === "dental") || all[0];
  if (/hospital|multi-?special|hms|inpatient/i.test(t))
    return all.find((x) => x.id === "hospital") || all[0];
  if (/mental|therap|counsel|psych/i.test(t))
    return all.find((x) => x.id === "mental-health") || all[0];
  if (/pharm/i.test(t)) return all.find((x) => x.id === "pharmacy") || all[0];
  if (/telehealth|virtual visit|video visit/i.test(t))
    return all.find((x) => x.id === "telehealth") || all[0];
  if (/clinic|primary care|family medicine|doctor/i.test(t))
    return all.find((x) => x.id === "primary-care") || all[0];
  if (/specialty|cardiolog|ortho|derm/i.test(t))
    return all.find((x) => x.id === "specialty") || all[0];
  if (/saas|dashboard|admin|task|crm|project management|startup/i.test(t))
    return all.find((x) => x.id === "agency") || EXTRA_TEMPLATES[0] || all[0];
  if (/ecommerce|e-commerce|shop|store|fashion|boutique|food delivery|delivery app/i.test(t))
    return all.find((x) => x.id === "ecommerce") || EXTRA_TEMPLATES[0] || all[0];
  if (/restaurant|food|cafe|dining|menu|meal|pizza|burger/i.test(t))
    return all.find((x) => x.id === "ecommerce") || EXTRA_TEMPLATES[0] || all[0];
  if (/hotel|fitness|salon|beauty|pet/i.test(t))
    return all.find((x) => x.id === "agency") || EXTRA_TEMPLATES[0] || all[0];
  if (/real estate|property|listing|travel|resort/i.test(t))
    return all.find((x) => x.id === "realestate") || EXTRA_TEMPLATES[0] || all[0];
  if (/learn|education|course|lms|school|event|conference/i.test(t))
    return all.find((x) => x.id === "education") || EXTRA_TEMPLATES[0] || all[0];
  if (/agency|marketing|brand|law|legal|nonprofit|construction|portfolio/i.test(t))
    return all.find((x) => x.id === "agency") || EXTRA_TEMPLATES[0] || all[0];

  return all.find((x) => x.id === "agency") || all[0];
}

/** Build page list from selected AppBuilder features + idea pages. */
export function pagesFromFeatures(
  featureIds: string[],
  ideaPages: { key: string; label: string }[],
  idea?: string
): PageDef[] {
  const pages: PageDef[] = [];
  const seen = new Set<string>();
  const ideaText = (idea || "").toLowerCase();
  const isFood = /food|delivery|restaurant|cafe|dining|menu|meal/.test(ideaText);
  const isCommerce = isFood || /ecommerce|shop|store|cart|checkout/.test(ideaText);
  const isHealthcare = /hospital|clinic|patient|doctor|dental|health/.test(ideaText);
  // SaaS feature pages don't belong on food/commerce/health marketing sites
  const skipSaasFeatures = isFood || isCommerce || isHealthcare;

  const push = (key: string, label: string, designId?: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    pages.push({ key, label, slug: slugForPage(key), designId });
  };

  push("home", "Home");

  for (const p of ideaPages) {
    if (p.key === "home" || p.key === "dashboard") continue;
    const design = findPageDesign(p.label) || findPageDesign(p.key);
    push(design?.id || p.key, p.label, design?.id);
  }

  for (const fid of featureIds) {
    if (skipSaasFeatures && !["auth"].includes(fid)) continue;
    const f = FEATURE_CATALOG.find((x) => x.id === fid);
    if (!f) continue;
    const map: Record<string, { key: string; label: string; design?: string }> = {
      auth: { key: "login", label: "Sign in", design: undefined },
      tasks: { key: "services", label: "Tasks", design: "services" },
      projects: { key: "projects", label: "Projects", design: "services" },
      team: { key: "team", label: "Team", design: "team" },
      calendar: { key: "booking", label: "Calendar", design: "booking" },
      notifications: { key: "faq", label: "Alerts", design: "faq" },
      activity: { key: "blog", label: "Activity", design: "blog" },
      dashboard: { key: "home", label: "Home" },
      files: { key: "resources", label: "Files", design: "blog" },
      comments: { key: "testimonials", label: "Feedback", design: "testimonials" },
      reports: { key: "reports", label: "Reports", design: "services" },
      integrations: { key: "integrations", label: "Integrations", design: "services" },
    };
    const m = map[fid];
    if (!m || m.key === "home") continue;
    const design = m.design ? findPageDesign(m.design) : findPageDesign(m.label);
    push(design?.id || m.key, m.label, design?.id);
  }

  // Always include contact for site completeness unless already present
  if (!seen.has("contact")) {
    push("contact", "Contact");
  }

  return pages;
}

export function buildGenerationPrompt(args: {
  idea: string;
  requirementsText?: string;
  featureIds: string[];
  brandName: string;
  pages: PageDef[];
}): string {
  const featureNames = args.featureIds
    .map((id) => FEATURE_CATALOG.find((f) => f.id === id)?.name || id)
    .join(", ");

  const pageLines = args.pages
    .map((p) => `${p.label}`)
    .join("\n");

  return [
    `Build a complete multi-page website for: ${args.brandName}.`,
    "",
    "Application idea:",
    args.idea,
    "",
    args.requirementsText
      ? "Requirements document:\n" + args.requirementsText.slice(0, 8000)
      : "",
    "",
    "Selected features/modules: " + featureNames,
    "",
    "IMPORTANT — site map rules:",
    "- Build ONLY the pages listed below. Do not invent pages from adjectives or quality goals",
    "  (e.g. never create pages named Modern, Responsive, Fast-loading, Brief Requirements).",
    "- Design qualities (modern, responsive, fast) belong in copy/style — not as separate pages.",
    "- Homepage content (hero, overview, highlights) stays on Home — do not split into extra pages.",
    "",
    "Generate ONLY these pages (one per line) — do not invent extra pages:",
    pageLines,
    "",
    "Write polished, specific, production-ready copy for every schema field.",
  ]
    .filter(Boolean)
    .join("\n");
}
