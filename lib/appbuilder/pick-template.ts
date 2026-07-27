// lib/appbuilder/pick-template.ts — map idea → real site template
import { TEMPLATES } from "@/lib/templates";
import { EXTRA_TEMPLATES } from "@/lib/templates-extra";
import type { Template } from "@/lib/types";
import { FEATURE_CATALOG } from "./catalog";
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
  if (/saas|dashboard|admin|task|crm|project management/i.test(t))
    return all.find((x) => x.id === "agency") || EXTRA_TEMPLATES[0] || all[0];
  if (/ecommerce|e-commerce|shop|store/i.test(t))
    return all.find((x) => x.id === "ecommerce") || EXTRA_TEMPLATES[0] || all[0];
  if (/restaurant|food|booking/i.test(t))
    return all.find((x) => x.id === "clinic") || EXTRA_TEMPLATES[0] || all[0];
  if (/real estate|property|listing/i.test(t))
    return all.find((x) => x.id === "realestate") || EXTRA_TEMPLATES[0] || all[0];
  if (/learn|education|course|lms/i.test(t))
    return all.find((x) => x.id === "education") || EXTRA_TEMPLATES[0] || all[0];
  if (/agency|marketing|brand/i.test(t))
    return all.find((x) => x.id === "agency") || EXTRA_TEMPLATES[0] || all[0];

  return all.find((x) => x.id === "primary-care") || all[0];
}

/** Build page list from selected AppBuilder features + idea pages. */
export function pagesFromFeatures(
  featureIds: string[],
  ideaPages: { key: string; label: string }[]
): PageDef[] {
  const pages: PageDef[] = [];
  const seen = new Set<string>();

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
    "Generate ONLY these pages (one per line) — do not invent extra pages:",
    pageLines,
    "",
    "Write polished, specific, production-ready copy for every schema field.",
  ]
    .filter(Boolean)
    .join("\n");
}
