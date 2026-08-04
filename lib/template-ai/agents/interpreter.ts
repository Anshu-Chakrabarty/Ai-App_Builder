// lib/template-ai/agents/interpreter.ts — Prompt Interpreter Layer (local, zero-LLM)
// Turns natural language → structured technical instruction → ConfigUpdate[] when possible.
import {
  detectColumnCount,
  isLayoutIntent,
  resolveGalleryCardIndex,
  resolveImageTargetId,
  resolveLayoutUpdates,
  pickStockImage,
} from "../agent-helpers";
import { galleryLabelsFor } from "@/lib/site-media";
import { isStyleIntent, resolveStyleUpdates } from "@/lib/site-styles";
import { resolvePageToDelete } from "@/lib/page-request";
import type { ConfigUpdate, SiteConfig } from "../types";
import type { IntentPlan } from "./types";

export type StructuredAction = {
  type:
    | "ui_update"
    | "copy_update"
    | "image_update"
    | "layout_update"
    | "style_update"
    | "section_ops"
    | "page_ops"
    | "component_hint";
  id: string;
  value?: unknown;
  op?: ConfigUpdate["op"];
  note?: string;
};

/** Interpreter output — fed to planner / editor */
export type StructuredInstruction = {
  page: string;
  target: { id: string; kind?: string; label?: string } | null;
  actions: StructuredAction[];
  constraints: string[];
  /** When set, Code Editing Agent can skip Gemini entirely */
  resolvedUpdates?: ConfigUpdate[];
  assistantHint?: string;
  /** true = still need LLM for creative/multi-step work */
  needsModel: boolean;
};

export type InterpretArgs = {
  prompt: string;
  intent: IntentPlan;
  config: SiteConfig;
  activePageKey: string;
  images?: string[];
};

/**
 * Prompt Interpreter — local, fast, deterministic.
 * Covers the majority of Studio prompts without calling Gemini.
 */
export function interpretPrompt(args: InterpretArgs): StructuredInstruction {
  const { prompt, intent, config, activePageKey, images } = args;
  const msg = (prompt || "").trim();
  const lower = msg.toLowerCase();
  const target = intent.target;
  const page = activePageKey || "home";
  const constraints: string[] = [
    "Maintain existing navigation structure unless asked",
    "Keep site responsive",
    "Prefer surgical ID updates over broad rewrites",
  ];
  const actions: StructuredAction[] = [];
  const updates: ConfigUpdate[] = [];

  const galleryLabels = galleryLabelsFor(config.media?.category || "default");
  const imageOpts = {
    galleryLabels,
    mediaCategory: config.media?.category || "default",
  };

  // ——— Style / CSS / hover / motion (never touch gallery for “menu” nav) ———
  if (intent.actions.includes("style") || isStyleIntent(msg)) {
    constraints.push("Do not modify gallery images for style/nav requests");
    const styleUpdates = resolveStyleUpdates(msg, config.accent);
    if (styleUpdates?.length) {
      for (const u of styleUpdates) {
        actions.push({
          type: "style_update",
          id: u.id,
          value: u.value,
          op: u.op || "set",
        });
        updates.push(u);
      }
      return done({
        page,
        target,
        actions,
        constraints,
        updates,
        hint: `Applied styling (${styleUpdates.map((u) => u.id).slice(0, 3).join(", ")}).`,
        needsModel: false,
      });
    }
    // Allow model only for complex custom CSS wording
    actions.push({
      type: "style_update",
      id: "styles.customCss",
      note: "Complex style — model may emit CSS patch",
    });
    return {
      page,
      target,
      actions,
      constraints,
      needsModel: true,
    };
  }

  // ——— Layout columns ———
  if (intent.fastPath === "layout" || (isLayoutIntent(msg) && !/\bimage|photo\b/i.test(msg))) {
    const layoutUpdates = resolveLayoutUpdates(msg, target);
    for (const u of layoutUpdates) {
      actions.push({ type: "layout_update", id: u.id, value: u.value });
      updates.push(u);
    }
    return done({
      page,
      target,
      actions,
      constraints: [...constraints, "Layout-only — images untouched"],
      updates,
      hint: `Aligned into a ${detectColumnCount(msg)}-column layout.`,
      needsModel: false,
    });
  }

  // ——— Image upload / named gallery card ———
  const namedIdx =
    intent.actions.includes("style")
      ? null
      : resolveGalleryCardIndex(msg, galleryLabels, target);
  if (
    namedIdx != null &&
    /\b(image|photo|picture|card|replace|change|swap|update|use)\b/i.test(msg) &&
    !isStyleIntent(msg)
  ) {
    const imageId = `media.gallery.${namedIdx}`;
    const value = images?.[0] || pickStockImage(msg, config.media?.category);
    updates.push({ type: "image", id: imageId, value, op: "set" });
    actions.push({ type: "image_update", id: imageId, value });
    return done({
      page,
      target,
      actions,
      constraints,
      updates,
      hint: `Updated “${galleryLabels[namedIdx] || "Gallery"}” card (${imageId}).`,
      needsModel: false,
    });
  }

  if (images?.length && intent.actions.includes("image")) {
    const imageId = resolveImageTargetId(msg, target, imageOpts);
    updates.push({ type: "image", id: imageId, value: images[0], op: "set" });
    actions.push({ type: "image_update", id: imageId, value: images[0] });
    return done({
      page,
      target,
      actions,
      constraints,
      updates,
      hint: `Updated ${imageId} with your uploaded image.`,
      needsModel: false,
    });
  }

  // ——— Hide / show section ———
  if (/\b(hide|remove|delete)\b/i.test(msg) && /\bsection\b/i.test(msg) && target?.id) {
    updates.push({ type: "section", id: target.id, op: "hide_section" });
    actions.push({ type: "section_ops", id: target.id, op: "hide_section" });
    return done({
      page,
      target,
      actions,
      constraints,
      updates,
      hint: `Hid section ${target.label || target.id}.`,
      needsModel: false,
    });
  }
  if (/\b(show|unhide|reveal)\b/i.test(msg) && /\bsection\b/i.test(msg) && target?.id) {
    updates.push({ type: "section", id: target.id, op: "show_section" });
    actions.push({ type: "section_ops", id: target.id, op: "show_section" });
    return done({
      page,
      target,
      actions,
      constraints,
      updates,
      hint: `Showed section ${target.label || target.id}.`,
      needsModel: false,
    });
  }
  // Common section names without click-target
  const hideNamed = lower.match(
    /\b(hide|remove)\s+(the\s+)?(hero|gallery|features|split|cta|form|banner)\b/
  );
  if (hideNamed) {
    const name = hideNamed[3];
    const id = name === "cta" || name === "form" ? `visual.${name}` : `home.${name}`;
    updates.push({ type: "section", id, op: "hide_section" });
    actions.push({ type: "section_ops", id, op: "hide_section" });
    return done({
      page,
      target: { id, kind: "section", label: name },
      actions,
      constraints,
      updates,
      hint: `Hid ${name} section.`,
      needsModel: false,
    });
  }

  // ——— Delete page ———
  if (/\b(delete|remove|drop)\b/i.test(msg) && /\bpage\b/i.test(msg)) {
    let del = resolvePageToDelete(msg, config.pages);
    if (!del && /\b(this|current)\s+page\b/i.test(msg) && activePageKey !== "home") {
      const p = config.pages.find((x) => x.key === activePageKey);
      if (p) del = { key: p.key, label: p.label };
    }
    if (del && del.key !== "home") {
      updates.push({ type: "page", id: del.key, op: "remove_page" });
      actions.push({ type: "page_ops", id: del.key, op: "remove_page" });
      return done({
        page,
        target,
        actions,
        constraints,
        updates,
        hint: `Removed the “${del.label}” page.`,
        needsModel: false,
      });
    }
  }

  // ——— Theme / accent color ———
  const hex = msg.match(/#([0-9a-f]{3,8})\b/i)?.[0];
  const namedColor = detectSimpleColor(lower);
  const color = hex || namedColor;
  if (
    color &&
    /\b(accent|primary|brand color|theme color|color)\b/i.test(msg) &&
    !/\b(background|bg)\b/i.test(msg)
  ) {
    updates.push(
      { type: "theme", id: "theme.primary", value: color, op: "set" },
      { type: "style", id: "styles.tokens.primary", value: color, op: "set" }
    );
    actions.push({ type: "ui_update", id: "theme.primary", value: color });
    return done({
      page,
      target,
      actions,
      constraints,
      updates,
      hint: `Set accent / primary to ${color}.`,
      needsModel: false,
    });
  }
  if (color && /\bbackground\b/i.test(msg) && !/\bhero\b/i.test(msg)) {
    updates.push(
      { type: "theme", id: "theme.background", value: color, op: "set" },
      { type: "style", id: "styles.tokens.background", value: color, op: "set" }
    );
    actions.push({ type: "ui_update", id: "theme.background", value: color });
    return done({
      page,
      target,
      actions,
      constraints,
      updates,
      hint: `Set background to ${color}.`,
      needsModel: false,
    });
  }

  // ——— Quoted copy onto explicit target field ———
  const quoted = msg.match(/["“](.+?)["”]/);
  if (target?.id && quoted?.[1] && target.kind !== "image" && target.kind !== "section") {
    const value = quoted[1].trim();
    if (value.length > 0 && value.length < 400) {
      updates.push({ type: "text", id: target.id, value, op: "set" });
      actions.push({ type: "copy_update", id: target.id, value });
      return done({
        page,
        target,
        actions,
        constraints,
        updates,
        hint: `Updated ${target.label || target.id} to “${value.slice(0, 60)}”.`,
        needsModel: false,
      });
    }
  }

  // ——— “Change X to Y” / “set title to …” on known fields ———
  const setTo =
    msg.match(
      /\b(?:change|set|update|make|rewrite)\s+(?:the\s+)?(hero\s+)?(title|heading|subtitle|cta|button|label)\s+(?:to|as|:)\s*["“]?(.+?)["”]?$/i
    ) ||
    msg.match(
      /\b(?:hero\s+)?(title|heading|subtitle|cta|button)\s*[:=]\s*["“](.+?)["”]/i
    );
  if (setTo) {
    const kind = (setTo[2] || setTo[1] || "").toLowerCase();
    const value = String(setTo[3] || setTo[2] || "")
      .replace(/^["“]|["”]$/g, "")
      .trim();
    const id =
      kind === "subtitle"
        ? "hero.subtitle"
        : kind === "cta" || kind === "button"
          ? "hero.cta"
          : "hero.title";
    if (value && value.length < 400) {
      updates.push({ type: "text", id, value, op: "set" });
      actions.push({ type: "copy_update", id, value });
      return done({
        page,
        target: target || { id, kind: "field", label: kind },
        actions,
        constraints,
        updates,
        hint: `Set ${id} to “${value.slice(0, 60)}”.`,
        needsModel: false,
      });
    }
  }

  // ——— Shorten / warmer / cooler on targeted field ———
  if (target?.id && target.kind !== "image" && /^(shorter|longer|warmer|cooler|bolder|softer|more|less)[.!]?$/i.test(msg)) {
    actions.push({
      type: "copy_update",
      id: target.id,
      note: `Refine tone: ${msg}`,
    });
    // Still needs model for rewriting existing copy — but tightly scoped
    return {
      page,
      target,
      actions,
      constraints: [...constraints, `Only edit ${target.id}`],
      needsModel: true,
    };
  }

  // ——— “make it shorter” with target ———
  if (
    target?.id &&
    target.kind !== "image" &&
    /\b(make it|change it|update it)\b/i.test(msg) &&
    /\b(shorter|concise|brief)\b/i.test(msg)
  ) {
    actions.push({ type: "copy_update", id: target.id, note: "shorten" });
    return {
      page,
      target,
      actions,
      constraints: [...constraints, `Only edit ${target.id}`],
      needsModel: true,
    };
  }

  // ——— Simple stock image swap by slot name ———
  if (
    /\b(change|update|replace|swap|new)\b/i.test(msg) &&
    /\b(hero|background|cover)\b.*\b(image|photo|picture)\b|\b(image|photo)\b.*\b(hero|background)\b/i.test(
      msg
    )
  ) {
    const value = images?.[0] || pickStockImage(msg, config.media?.category);
    updates.push({ type: "image", id: "media.hero", value, op: "set" });
    actions.push({ type: "image_update", id: "media.hero", value });
    return done({
      page,
      target,
      actions,
      constraints,
      updates,
      hint: "Updated hero image.",
      needsModel: false,
    });
  }
  if (/\b(split)\b.*\b(image|photo|picture)\b|\b(image|photo)\b.*\bsplit\b/i.test(msg)) {
    const value = images?.[0] || pickStockImage(msg, config.media?.category);
    updates.push({ type: "image", id: "media.split", value, op: "set" });
    actions.push({ type: "image_update", id: "media.split", value });
    return done({
      page,
      target,
      actions,
      constraints,
      updates,
      hint: "Updated split-section image.",
      needsModel: false,
    });
  }

  // ——— Questions ———
  if (intent.kind === "answer" || intent.actions.includes("question")) {
    return {
      page,
      target,
      actions: [],
      constraints,
      resolvedUpdates: [],
      assistantHint:
        "I can update copy, images, layout, theme, CSS/hover, hide sections, delete pages, or add pages. Click a section or name it for the most accurate edit.",
      needsModel: false,
    };
  }

  // ——— Everything else → model, but with structured hints ———
  for (const a of intent.actions) {
    actions.push({
      type: actionTypeFor(a),
      id: target?.id || a,
      note: intent.summary,
    });
  }
  if (target?.id) {
    constraints.push(`Prefer target ${target.id}`);
  }
  if (intent.actions.includes("image") && !intent.actions.includes("copy")) {
    constraints.push("Image-focused — avoid unrelated copy rewrites");
  }

  return {
    page,
    target,
    actions,
    constraints,
    needsModel: true,
  };
}

function done(opts: {
  page: string;
  target: StructuredInstruction["target"];
  actions: StructuredAction[];
  constraints: string[];
  updates: ConfigUpdate[];
  hint: string;
  needsModel: boolean;
}): StructuredInstruction {
  return {
    page: opts.page,
    target: opts.target,
    actions: opts.actions,
    constraints: opts.constraints,
    resolvedUpdates: opts.updates,
    assistantHint: opts.hint,
    needsModel: opts.needsModel,
  };
}

function actionTypeFor(a: string): StructuredAction["type"] {
  switch (a) {
    case "style":
    case "theme":
      return "style_update";
    case "image":
      return "image_update";
    case "layout":
      return "layout_update";
    case "hide-section":
    case "show-section":
      return "section_ops";
    case "page-add":
    case "page-remove":
      return "page_ops";
    case "copy":
      return "copy_update";
    default:
      return "component_hint";
  }
}

function detectSimpleColor(msg: string): string | null {
  const named: Record<string, string> = {
    black: "#0b0e14",
    white: "#ffffff",
    navy: "#0b1e3f",
    blue: "#2563eb",
    green: "#059669",
    teal: "#0d9488",
    purple: "#7c3aed",
    violet: "#7c3aed",
    red: "#dc2626",
    orange: "#ea580c",
    pink: "#db2777",
    cream: "#faf6ef",
    beige: "#f4ecdf",
    gray: "#4b5563",
    grey: "#4b5563",
    gold: "#d97706",
  };
  for (const [name, val] of Object.entries(named)) {
    if (new RegExp(`\\b${name}\\b`).test(msg)) return val;
  }
  return null;
}
