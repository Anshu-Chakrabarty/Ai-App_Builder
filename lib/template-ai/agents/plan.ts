// lib/template-ai/agents/plan.ts — Design Planning Agent
import {
  detectColumnCount,
  resolveGalleryCardIndex,
  resolveImageTargetId,
  resolveLayoutUpdates,
} from "../agent-helpers";
import { listEditableCatalog, listSectionMap } from "../config";
import { galleryLabelsFor } from "@/lib/site-media";
import type { SiteConfig, TemplateKnowledge, TemplateManifest } from "../types";
import type { EditPlan, EditPlanStep, IntentAction, IntentPlan } from "./types";

export type PlanArgs = {
  intent: IntentPlan;
  prompt: string;
  config: SiteConfig;
  manifest: TemplateManifest;
  knowledge: TemplateKnowledge;
  activePageKey: string;
  images?: string[];
};

/**
 * Design Planning Agent — decides which components/properties should change.
 * Deterministic mapping from intent + section map (no LLM).
 */
export function planEdits(args: PlanArgs): EditPlan {
  const { intent, prompt, config, manifest, knowledge, activePageKey, images } = args;
  const galleryLabels = galleryLabelsFor(config.media?.category || "default");
  const imageOpts = {
    galleryLabels,
    mediaCategory: config.media?.category || "default",
  };

  const steps: EditPlanStep[] = [];
  const allowed = new Set<string>();
  const constraints: string[] = [
    "Never rewrite template source code — only config IDs",
    "Do not touch fields outside allowedIds unless scope is site",
  ];

  // Fast paths → resolved updates, skip LLM editor
  if (intent.fastPath === "layout") {
    const updates = resolveLayoutUpdates(prompt, intent.target);
    updates.forEach((u) => allowed.add(u.id));
    return {
      steps: [
        {
          action: "layout",
          ids: updates.map((u) => u.id),
          rationale: `Align into ${detectColumnCount(prompt)} columns`,
        },
      ],
      allowedIds: [...allowed],
      constraints: [...constraints, "Layout-only — do not change images or copy"],
      variants: [],
      resolvedUpdates: updates,
      assistantHint: `Aligned into a ${detectColumnCount(prompt)}-column layout (images untouched).`,
    };
  }

  if (intent.fastPath === "gallery-card") {
    const idx = resolveGalleryCardIndex(prompt, galleryLabels, intent.target) ?? 0;
    const imageId = `media.gallery.${idx}`;
    allowed.add(imageId);
    const cardName = galleryLabels[idx] || `Card ${idx + 1}`;
    const value = images?.[0];
    return {
      steps: [
        {
          action: "image",
          ids: [imageId],
          rationale: `Update “${cardName}” gallery card`,
        },
      ],
      allowedIds: [imageId],
      constraints: [...constraints, `Only update ${imageId}`],
      variants: [],
      resolvedUpdates: value
        ? [{ type: "image", id: imageId, value, op: "set" }]
        : undefined, // editor will pick stock if no upload
      assistantHint: value
        ? `Updated the “${cardName}” gallery card (${imageId}) with your uploaded image.`
        : `Updated the “${cardName}” gallery card (${imageId}).`,
    };
  }

  if (intent.fastPath === "image-upload" && images?.length) {
    const imageId = resolveImageTargetId(prompt, intent.target, imageOpts);
    allowed.add(imageId);
    return {
      steps: [
        {
          action: "image",
          ids: [imageId],
          rationale: "Apply uploaded image to resolved media slot",
        },
      ],
      allowedIds: [imageId],
      constraints: [...constraints, `Only update ${imageId}`, "Do not change layout"],
      variants: [],
      resolvedUpdates: [{ type: "image", id: imageId, value: images[0], op: "set" }],
      assistantHint: `Updated ${imageId} with your uploaded image.`,
    };
  }

  if (intent.kind === "answer") {
    return {
      steps: [{ action: "question", ids: [], rationale: "Answer without mutating config" }],
      allowedIds: [],
      constraints: ["mode=answer — empty updates"],
      variants: [],
      resolvedUpdates: [],
      assistantHint:
        "I can update copy, images, layout, theme, hide sections, delete pages, or assemble new pages from template components.",
    };
  }

  if (intent.kind === "clarify") {
    return {
      steps: [],
      allowedIds: [],
      constraints: ["Need a clearer prompt"],
      variants: [],
      resolvedUpdates: [],
      assistantHint: "Tell me what to change — e.g. “make the hero title shorter” or click a section first.",
    };
  }

  // Expand target → candidate field ids
  const targetIds = expandTargetIds(intent, prompt, config, manifest, activePageKey, imageOpts);
  targetIds.forEach((id) => allowed.add(id));

  for (const action of intent.actions) {
    const ids = idsForAction(action, intent, targetIds, prompt, config, imageOpts);
    ids.forEach((id) => allowed.add(id));
    if (ids.length || action === "page-add" || action === "page-remove") {
      steps.push({
        action,
        ids,
        rationale: rationaleFor(action, intent),
      });
    }
  }

  if (!steps.length && targetIds.length) {
    steps.push({
      action: "copy",
      ids: targetIds,
      rationale: "Apply requested change to resolved targets",
    });
    targetIds.forEach((id) => allowed.add(id));
  }

  // Scope constraints
  if (intent.scope === "field" && intent.target?.id) {
    constraints.push(`Prefer only ${intent.target.id} and closely related fields`);
  }
  if (intent.scope === "section" && intent.target?.id) {
    constraints.push(`Stay inside section ${intent.target.id}`);
  }
  if (intent.actions.includes("layout")) {
    constraints.push("If layout is requested, prefer layout.* ids — do not swap images");
  }
  if (intent.actions.includes("image") && !intent.actions.includes("copy")) {
    constraints.push("Image-focused request — avoid rewriting unrelated copy");
  }

  const variants = (knowledge.componentVariants || [])
    .slice(0, 8)
    .map((v) => `${v.variantId} (${v.componentId})`);

  // Include section map context size hint
  const sectionMap = listSectionMap(manifest, activePageKey, config.sectionState);
  if (sectionMap) {
    constraints.push("Use SITE SECTION MAP ids from the edit prompt");
  }

  return {
    steps,
    allowedIds: [...allowed],
    constraints,
    variants,
  };
}

function expandTargetIds(
  intent: IntentPlan,
  prompt: string,
  config: SiteConfig,
  manifest: TemplateManifest,
  activePageKey: string,
  imageOpts: { galleryLabels: string[]; mediaCategory: string }
): string[] {
  const ids: string[] = [];
  const t = intent.target;
  if (!t?.id) {
    // Infer from prompt keywords
    if (/\bhero\b/i.test(prompt)) ids.push("home.hero", "media.hero", "hero.title", "hero.subtitle");
    if (/\bsplit\b/i.test(prompt)) ids.push("home.split", "media.split", "visual.split.title");
    if (/\bgallery\b/i.test(prompt)) ids.push("home.gallery", "media.gallery.0");
    if (/\bfeature/i.test(prompt)) ids.push("home.features", "visual.features.title");
    if (/\bcta\b|\bcall to action\b/i.test(prompt)) ids.push("visual.cta.title", "visual.cta.button");
    return ids;
  }

  ids.push(t.id);

  if (t.kind === "section") {
    // Pull editable fields belonging to this section
    const section = manifest.sections.find(
      (s) => s.id === t.id || s.name.toLowerCase() === (t.label || "").toLowerCase()
    );
    if (section?.editableFields?.length) {
      section.editableFields.forEach((f) => ids.push(f));
    }
    // Common visual aliases
    if (/hero/i.test(t.id)) ids.push("media.hero", "hero.title", "hero.subtitle", "hero.cta");
    if (/split/i.test(t.id)) {
      ids.push("media.split", "visual.split.title", "visual.split.subtitle", "visual.split.cta");
    }
    if (/gallery/i.test(t.id)) {
      ids.push("media.gallery.0", "media.gallery.1", "media.gallery.2");
    }
    if (/feature/i.test(t.id)) {
      ids.push(
        "visual.features.title",
        "visual.features.subtitle",
        "visual.features.items.0.title",
        "visual.features.items.0.body"
      );
    }
    if (/cta/i.test(t.id)) ids.push("visual.cta.title", "visual.cta.subtitle", "visual.cta.button");
    if (/form/i.test(t.id)) ids.push("visual.form.title", "visual.form.button");
  }

  if (t.kind === "image" || intent.actions.includes("image")) {
    ids.push(resolveImageTargetId(prompt, t, imageOpts));
  }

  // Active page context
  if (intent.scope === "page") {
    ids.push(activePageKey);
  }

  return [...new Set(ids.filter(Boolean))];
}

function idsForAction(
  action: IntentAction,
  intent: IntentPlan,
  targetIds: string[],
  prompt: string,
  config: SiteConfig,
  imageOpts: { galleryLabels: string[]; mediaCategory: string }
): string[] {
  switch (action) {
    case "layout":
      return resolveLayoutUpdates(prompt, intent.target).map((u) => u.id);
    case "image":
      return [resolveImageTargetId(prompt, intent.target, imageOpts)];
    case "theme":
      return ["theme.primary", "theme.background", "accent"];
    case "hide-section":
    case "show-section":
      return intent.target?.id ? [intent.target.id] : targetIds.filter((id) => !id.includes("."));
    case "page-remove":
      return config.pages.map((p) => p.key).filter((k) => k !== "home");
    case "page-add":
      return [];
    case "copy":
      return targetIds.filter(
        (id) =>
          !id.startsWith("media.") &&
          !id.startsWith("layout.") &&
          !id.startsWith("theme.")
      );
    default:
      return targetIds;
  }
}

function rationaleFor(action: IntentAction, intent: IntentPlan): string {
  const where = intent.target?.label || intent.target?.id || "site";
  switch (action) {
    case "layout":
      return `Adjust layout properties for ${where}`;
    case "image":
      return `Update imagery for ${where}`;
    case "theme":
      return "Update theme/color tokens";
    case "page-add":
      return "Assemble a new page from component library";
    case "page-remove":
      return "Remove a page from the site map";
    case "hide-section":
      return `Hide section ${where}`;
    case "show-section":
      return `Show section ${where}`;
    case "copy":
      return `Rewrite copy on ${where}`;
    default:
      return `Apply ${action} to ${where}`;
  }
}

/** Catalog snippet limited to planned ids (for the editor prompt). */
export function scopedCatalog(
  manifest: TemplateManifest,
  allowedIds: string[],
  activePageKey: string,
  config: SiteConfig
): { catalog: string; sectionMap: string } {
  const full = listEditableCatalog(manifest);
  const sectionMap = listSectionMap(manifest, activePageKey, config.sectionState);
  if (!allowedIds.length) return { catalog: full, sectionMap };

  const allow = new Set(allowedIds.map((a) => a.toLowerCase()));
  const lines = full.split("\n").filter((line) => {
    const id = line.split(/\s|—|-/)[0]?.trim().toLowerCase();
    if (!id) return false;
    for (const a of allow) {
      if (id === a || id.startsWith(a + ".") || a.startsWith(id)) return true;
      // section home.hero → hero.*
      const short = a.replace(/^home\./, "");
      if (id.startsWith(short)) return true;
    }
    return false;
  });

  return {
    catalog: lines.length ? lines.join("\n") : full.slice(0, 4000),
    sectionMap,
  };
}
