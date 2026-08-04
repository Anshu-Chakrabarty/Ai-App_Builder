// lib/template-ai/agents/interpreter.ts — Prompt Interpretation Layer (middle architecture)
// User NL → Structured Technical Instruction → Plan/Edit agents
import { GoogleGenAI } from "@google/genai";
import { generateContentResilient, parseJsonLoose } from "@/lib/gemini";
import {
  detectColumnCount,
  isLayoutIntent,
  resolveGalleryCardIndex,
  resolveImageTargetId,
  resolveLayoutUpdates,
  pickStockImage,
  type AgentHistoryTurn,
  type AgentWorkEntry,
} from "../agent-helpers";
import { galleryLabelsFor } from "@/lib/site-media";
import { isStyleIntent, resolveStyleUpdates, sanitizeCss } from "@/lib/site-styles";
import { resolvePageToDelete } from "@/lib/page-request";
import { listSectionMap } from "../config";
import type { ConfigUpdate, SiteConfig, TemplateManifest } from "../types";
import type { IntentPlan } from "./types";

export type ActionType =
  | "ui_update"
  | "copy_update"
  | "image_update"
  | "layout_update"
  | "style_update"
  | "section_ops"
  | "page_ops"
  | "component_add"
  | "component_remove"
  | "form_update"
  | "button_update";

export type StructuredAction = {
  type: ActionType;
  id: string;
  value?: unknown;
  op?: ConfigUpdate["op"];
  props?: Record<string, unknown>;
  note?: string;
};

/** Middle-layer output — precise technical instruction for the Website AI Agent */
export type StructuredInstruction = {
  /** Active / inferred page key */
  page: string;
  /** Primary target section/field/image */
  target: { id: string; kind?: string; label?: string } | null;
  /** Ordered technical actions */
  actions: StructuredAction[];
  /** Hard rules the editor must obey */
  constraints: string[];
  /** Confidence 0–1 */
  confidence: number;
  /** Human-readable restatement */
  summary: string;
  /** Source of this instruction */
  source: "local" | "llm" | "hybrid";
  /** Ready-to-apply config patches (skip edit LLM when set & complete) */
  resolvedUpdates?: ConfigUpdate[];
  assistantHint?: string;
  /** true = Code Editing agent still needs Gemini for values */
  needsModel: boolean;
};

export type InterpretArgs = {
  prompt: string;
  intent: IntentPlan;
  config: SiteConfig;
  manifest?: TemplateManifest;
  activePageKey: string;
  images?: string[];
  history?: AgentHistoryTurn[];
  workLog?: AgentWorkEntry[];
  idea?: string;
};

const DEFAULT_CONSTRAINTS = [
  "Maintain existing navigation unless explicitly asked to change it",
  "Keep the site responsive on mobile",
  "Prefer surgical ID updates — do not rewrite unrelated sections",
  "Nav/menu hover is styles.* — never media.gallery for “menu” nav requests",
  "Never remove the home page",
];

/**
 * Full Prompt Interpretation Layer entry.
 * 1) Local deterministic interpreter (fast, accurate for common prompts)
 * 2) If incomplete → small Gemini interpreter call (structured JSON only)
 * 3) Merge → always returns a StructuredInstruction for the pipeline middle
 */
export async function runPromptInterpreter(
  args: InterpretArgs
): Promise<StructuredInstruction> {
  const local = interpretPromptLocal(args);

  // High-confidence local resolution — no LLM
  if (!local.needsModel && (local.resolvedUpdates?.length || local.confidence >= 0.9)) {
    return local;
  }

  // Answer / clarify — no LLM
  if (args.intent.kind === "answer" || args.intent.kind === "clarify") {
    return local;
  }

  // Ambiguous / creative → LLM interpreter (structured instruction only)
  try {
    const llm = await interpretPromptWithLlm(args, local);
    return mergeInstructions(local, llm);
  } catch (err) {
    console.warn("prompt interpreter LLM fallback", err);
    return { ...local, source: "local", confidence: Math.min(local.confidence, 0.55) };
  }
}

/** Sync local-only interpreter (used by tests / fast paths) */
export function interpretPrompt(args: InterpretArgs): StructuredInstruction {
  return interpretPromptLocal(args);
}

function interpretPromptLocal(args: InterpretArgs): StructuredInstruction {
  const { prompt, intent, config, activePageKey, images } = args;
  const msg = stripTargetPrefix(prompt || "").trim();
  const lower = msg.toLowerCase();
  let target = intent.target;
  const page = inferPage(lower, activePageKey, config) || activePageKey || "home";
  const constraints = [...DEFAULT_CONSTRAINTS];
  const actions: StructuredAction[] = [];
  const updates: ConfigUpdate[] = [];

  const galleryLabels = galleryLabelsFor(config.media?.category || "default");
  const imageOpts = {
    galleryLabels,
    mediaCategory: config.media?.category || "default",
  };

  // Infer target from prompt nouns if missing
  if (!target) {
    target = inferTargetFromPrompt(lower, galleryLabels);
  }

  // ——— Questions ———
  if (intent.kind === "answer" || intent.actions.includes("question")) {
    return finish({
      page,
      target,
      actions: [],
      constraints,
      updates: [],
      summary: "User question — no mutations",
      confidence: 1,
      source: "local",
      needsModel: false,
      hint: "I can update copy, images, layout, theme, CSS/hover, forms, buttons, cards, hide sections, delete pages, or add pages. Click a section or name it for precision.",
    });
  }

  if (!msg && images?.length) {
    const imageId = resolveImageTargetId("uploaded image", target, imageOpts);
    updates.push({ type: "image", id: imageId, value: images[0], op: "set" });
    actions.push({ type: "image_update", id: imageId, value: images[0] });
    return finish({
      page,
      target,
      actions,
      constraints,
      updates,
      summary: `Apply uploaded image to ${imageId}`,
      confidence: 0.95,
      source: "local",
      needsModel: false,
      hint: `Updated ${imageId} with your uploaded image.`,
    });
  }

  // ——— STYLE / CSS / HOVER / MOTION ———
  if (intent.actions.includes("style") || isStyleIntent(msg)) {
    constraints.push("Do not modify gallery images for style/nav requests");
    const styleUpdates = resolveStyleUpdates(msg, config.accent);
    if (styleUpdates?.length) {
      for (const u of styleUpdates) {
        actions.push({ type: "style_update", id: u.id, value: u.value, op: u.op || "set" });
        updates.push(u);
      }
      return finish({
        page,
        target,
        actions,
        constraints,
        updates,
        summary: `Style/UI updates: ${styleUpdates.map((u) => u.id).join(", ")}`,
        confidence: 0.95,
        source: "local",
        needsModel: false,
        hint: `Applied styling (${styleUpdates.map((u) => u.id).slice(0, 4).join(", ")}).`,
      });
    }
    actions.push({ type: "style_update", id: "styles.customCss", note: "complex style" });
    return finish({
      page,
      target,
      actions,
      constraints,
      updates: [],
      summary: "Complex style request — needs model for CSS values",
      confidence: 0.6,
      source: "local",
      needsModel: true,
    });
  }

  // ——— LAYOUT ———
  if (intent.fastPath === "layout" || (isLayoutIntent(msg) && !/\b(image|photo)\b/i.test(msg))) {
    const layoutUpdates = resolveLayoutUpdates(msg, target);
    for (const u of layoutUpdates) {
      actions.push({ type: "layout_update", id: u.id, value: u.value });
      updates.push(u);
    }
    return finish({
      page,
      target,
      actions,
      constraints: [...constraints, "Layout-only — images untouched"],
      updates,
      summary: `Layout → ${detectColumnCount(msg)} columns`,
      confidence: 0.95,
      source: "local",
      needsModel: false,
      hint: `Aligned into a ${detectColumnCount(msg)}-column layout.`,
    });
  }

  // ——— GALLERY CARD / IMAGE ———
  const namedIdx = resolveGalleryCardIndex(msg, galleryLabels, target);
  if (
    namedIdx != null &&
    /\b(image|photo|picture|card|replace|change|swap|update|use)\b/i.test(msg) &&
    !isStyleIntent(msg) &&
    !/\bnav(igation)?\b/i.test(msg)
  ) {
    const imageId = `media.gallery.${namedIdx}`;
    const value = images?.[0] || pickStockImage(msg, config.media?.category);
    updates.push({ type: "image", id: imageId, value, op: "set" });
    actions.push({ type: "image_update", id: imageId, value });
    return finish({
      page,
      target: { id: imageId, kind: "image", label: galleryLabels[namedIdx] },
      actions,
      constraints,
      updates,
      summary: `Update gallery card ${namedIdx} (${galleryLabels[namedIdx]})`,
      confidence: 0.97,
      source: "local",
      needsModel: false,
      hint: `Updated “${galleryLabels[namedIdx] || "Gallery"}” card (${imageId}).`,
    });
  }

  if (images?.length && (intent.actions.includes("image") || /\b(image|photo|picture|upload)\b/i.test(msg))) {
    const imageId = resolveImageTargetId(msg, target, imageOpts);
    updates.push({ type: "image", id: imageId, value: images[0], op: "set" });
    actions.push({ type: "image_update", id: imageId, value: images[0] });
    return finish({
      page,
      target,
      actions,
      constraints,
      updates,
      summary: `Apply upload to ${imageId}`,
      confidence: 0.95,
      source: "local",
      needsModel: false,
      hint: `Updated ${imageId} with your uploaded image.`,
    });
  }

  // Hero / split / banner image by name
  const slot = detectMediaSlot(lower);
  if (slot && /\b(change|update|replace|swap|new|refresh)\b/i.test(msg)) {
    const value = images?.[0] || pickStockImage(msg, config.media?.category);
    updates.push({ type: "image", id: slot, value, op: "set" });
    actions.push({ type: "image_update", id: slot, value });
    return finish({
      page,
      target: { id: slot, kind: "image", label: slot },
      actions,
      constraints,
      updates,
      summary: `Update ${slot}`,
      confidence: 0.92,
      source: "local",
      needsModel: false,
      hint: `Updated ${slot}.`,
    });
  }

  // ——— SECTION HIDE / SHOW ———
  const sectionOp = detectSectionVisibility(lower, target);
  if (sectionOp) {
    updates.push({ type: "section", id: sectionOp.id, op: sectionOp.op });
    actions.push({ type: "section_ops", id: sectionOp.id, op: sectionOp.op });
    return finish({
      page,
      target: { id: sectionOp.id, kind: "section", label: sectionOp.id },
      actions,
      constraints,
      updates,
      summary: `${sectionOp.op} ${sectionOp.id}`,
      confidence: 0.93,
      source: "local",
      needsModel: false,
      hint:
        sectionOp.op === "hide_section"
          ? `Hid ${sectionOp.id}.`
          : `Showed ${sectionOp.id}.`,
    });
  }

  // ——— DELETE PAGE ———
  if (/\b(delete|remove|drop)\b/i.test(msg) && /\bpage\b/i.test(msg)) {
    let del = resolvePageToDelete(msg, config.pages);
    if (!del && /\b(this|current)\s+page\b/i.test(msg) && activePageKey !== "home") {
      const p = config.pages.find((x) => x.key === activePageKey);
      if (p) del = { key: p.key, label: p.label };
    }
    if (del && del.key !== "home") {
      updates.push({ type: "page", id: del.key, op: "remove_page" });
      actions.push({ type: "page_ops", id: del.key, op: "remove_page" });
      return finish({
        page,
        target,
        actions,
        constraints,
        updates,
        summary: `Remove page ${del.key}`,
        confidence: 0.95,
        source: "local",
        needsModel: false,
        hint: `Removed the “${del.label}” page.`,
      });
    }
  }

  // ——— ADD PAGE (structure only — content may need model) ———
  const addPage = detectAddPage(lower);
  if (addPage) {
    actions.push({
      type: "page_ops",
      id: addPage.key,
      op: "add_page",
      props: { label: addPage.label, components: addPage.components },
      note: `Create ${addPage.label} page`,
    });
    constraints.push(`Create page key=${addPage.key}`);
    return finish({
      page: addPage.key,
      target,
      actions,
      constraints,
      updates: [],
      summary: `Add page “${addPage.label}”`,
      confidence: 0.75,
      source: "local",
      needsModel: true,
      hint: `Plan: add “${addPage.label}” page.`,
    });
  }

  // ——— THEME COLORS ———
  const color = detectColor(msg);
  if (color && /\b(accent|primary|brand color|theme color)\b/i.test(msg)) {
    updates.push(
      { type: "theme", id: "theme.primary", value: color, op: "set" },
      { type: "style", id: "styles.tokens.primary", value: color, op: "set" }
    );
    actions.push({ type: "ui_update", id: "theme.primary", value: color });
    return finish({
      page,
      target,
      actions,
      constraints,
      updates,
      summary: `Accent → ${color}`,
      confidence: 0.95,
      source: "local",
      needsModel: false,
      hint: `Set accent to ${color}.`,
    });
  }
  if (color && /\bbackground\b/i.test(msg) && !/\bhero\b/i.test(msg)) {
    updates.push(
      { type: "theme", id: "theme.background", value: color, op: "set" },
      { type: "style", id: "styles.tokens.background", value: color, op: "set" }
    );
    actions.push({ type: "ui_update", id: "theme.background", value: color });
    return finish({
      page,
      target,
      actions,
      constraints,
      updates,
      summary: `Background → ${color}`,
      confidence: 0.95,
      source: "local",
      needsModel: false,
      hint: `Set background to ${color}.`,
    });
  }

  // ——— BUTTON / CTA LABEL ———
  const button = detectButtonUpdate(msg);
  if (button) {
    updates.push({ type: "text", id: button.id, value: button.value, op: "set" });
    actions.push({ type: "button_update", id: button.id, value: button.value });
    return finish({
      page,
      target: { id: button.id, kind: "field", label: button.id },
      actions,
      constraints,
      updates,
      summary: `Button ${button.id} → “${button.value}”`,
      confidence: 0.9,
      source: "local",
      needsModel: false,
      hint: `Updated button to “${button.value}”.`,
    });
  }

  // ——— FORM TITLES / SUBMIT ———
  const form = detectFormUpdate(msg);
  if (form) {
    for (const u of form) {
      updates.push({ type: "text", id: u.id, value: u.value, op: "set" });
      actions.push({ type: "form_update", id: u.id, value: u.value });
    }
    return finish({
      page,
      target: { id: "home.form", kind: "section", label: "Form" },
      actions,
      constraints,
      updates,
      summary: `Form updates: ${form.map((f) => f.id).join(", ")}`,
      confidence: 0.88,
      source: "local",
      needsModel: false,
      hint: `Updated form labels.`,
    });
  }

  // ——— QUOTED COPY ON TARGET ———
  const quoted = msg.match(/["“](.+?)["”]/);
  if (target?.id && quoted?.[1] && target.kind !== "image") {
    const fieldId =
      target.kind === "section" ? mapSectionToPrimaryField(target.id, lower) : target.id;
    const value = quoted[1].trim();
    if (fieldId && value.length < 400) {
      updates.push({ type: "text", id: fieldId, value, op: "set" });
      actions.push({ type: "copy_update", id: fieldId, value });
      return finish({
        page,
        target,
        actions,
        constraints,
        updates,
        summary: `Set ${fieldId} to quoted text`,
        confidence: 0.92,
        source: "local",
        needsModel: false,
        hint: `Updated ${fieldId}.`,
      });
    }
  }

  // ——— SET TITLE / SUBTITLE / CTA TO … ———
  const setField = detectSetField(msg);
  if (setField) {
    updates.push({ type: "text", id: setField.id, value: setField.value, op: "set" });
    actions.push({ type: "copy_update", id: setField.id, value: setField.value });
    return finish({
      page,
      target: { id: setField.id, kind: "field", label: setField.id },
      actions,
      constraints,
      updates,
      summary: `Set ${setField.id}`,
      confidence: 0.9,
      source: "local",
      needsModel: false,
      hint: `Set ${setField.id} to “${String(setField.value).slice(0, 60)}”.`,
    });
  }

  // ——— REMOVE BUTTON / FORM (map to hide or clear labels) ———
  if (/\b(remove|delete)\b/i.test(msg) && /\b(button|cta|sign\s*up|link)\b/i.test(msg)) {
    const id = detectButtonIdToClear(lower, target);
    if (id) {
      updates.push({ type: "text", id, value: "", op: "set" });
      actions.push({ type: "component_remove", id, value: "" });
      return finish({
        page,
        target,
        actions,
        constraints,
        updates,
        summary: `Clear button label ${id}`,
        confidence: 0.8,
        source: "local",
        needsModel: false,
        hint: `Removed button text on ${id}.`,
      });
    }
  }
  if (/\b(remove|delete)\b/i.test(msg) && /\b(form|contact form|lead form)\b/i.test(msg)) {
    updates.push({ type: "section", id: "home.form", op: "hide_section" });
    actions.push({ type: "component_remove", id: "home.form", op: "hide_section" });
    return finish({
      page,
      target: { id: "home.form", kind: "section", label: "Form" },
      actions,
      constraints,
      updates,
      summary: "Hide form section",
      confidence: 0.9,
      source: "local",
      needsModel: false,
      hint: "Hid the form section.",
    });
  }

  // ——— FEATURE CARD BY INDEX / ORDINAL ———
  const featureCard = detectFeatureCardCopy(msg);
  if (featureCard) {
    updates.push({ type: "text", id: featureCard.id, value: featureCard.value, op: "set" });
    actions.push({ type: "copy_update", id: featureCard.id, value: featureCard.value });
    return finish({
      page,
      target: { id: featureCard.id, kind: "field", label: featureCard.id },
      actions,
      constraints,
      updates,
      summary: `Feature card → ${featureCard.id}`,
      confidence: 0.88,
      source: "local",
      needsModel: false,
      hint: `Updated ${featureCard.id}.`,
    });
  }

  // ——— FOLLOW-UP SHORTEN etc. — scoped, needs model for rewrite ———
  if (target?.id && intent.continuity === "follow-up") {
    actions.push({
      type: "copy_update",
      id: target.kind === "section" ? mapSectionToPrimaryField(target.id, lower) || target.id : target.id,
      note: msg,
    });
    constraints.push(`Only edit ${target.id} and related fields`);
    return finish({
      page,
      target,
      actions,
      constraints,
      updates: [],
      summary: `Follow-up refine ${target.id}`,
      confidence: 0.7,
      source: "local",
      needsModel: true,
    });
  }

  // ——— GENERIC ACTION MAP for model ———
  for (const a of intent.actions) {
    actions.push({
      type: mapIntentAction(a),
      id: target?.id || a,
      note: intent.summary,
    });
  }
  if (target?.id) constraints.push(`Prefer target ${target.id}`);

  // Compound: style + copy signals
  const compound = /\band\b|,|also|then/i.test(msg);
  return finish({
    page,
    target,
    actions: actions.length
      ? actions
      : [{ type: "copy_update", id: target?.id || "hero.title", note: intent.summary }],
    constraints,
    updates: [],
    summary: intent.summary || msg.slice(0, 120),
    confidence: compound ? 0.45 : 0.55,
    source: "local",
    needsModel: true,
  });
}

async function interpretPromptWithLlm(
  args: InterpretArgs,
  local: StructuredInstruction
): Promise<StructuredInstruction> {
  const { prompt, intent, config, activePageKey, history, idea, manifest } = args;
  const sectionMap = manifest
    ? listSectionMap(manifest, activePageKey, config.sectionState)
    : "";
  const pages = config.pages.map((p) => `${p.key} (${p.label})`).join(", ");
  const galleryLabels = galleryLabelsFor(config.media?.category || "default");
  const hist = (history || [])
    .slice(-6)
    .map((h) => `${h.role}: ${h.text.slice(0, 200)}`)
    .join("\n");

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const result = await generateContentResilient(ai, {
    contents:
      `You are the Prompt Interpreter Layer for a website builder.\n` +
      `Convert the user prompt into STRUCTURED TECHNICAL INSTRUCTION JSON only.\n` +
      `Do NOT write final copy essays — emit precise actions with editable IDs.\n\n` +
      `Brand: ${config.brandName}. Active page: ${activePageKey}. Accent: ${config.accent}\n` +
      `Pages: ${pages}\n` +
      `Gallery cards: ${galleryLabels.map((l, i) => `${i}=${l}`).join(", ")}\n` +
      (sectionMap ? `Sections:\n${sectionMap.slice(0, 1600)}\n` : "") +
      `Local draft (refine/complete this):\n${JSON.stringify({
        page: local.page,
        target: local.target,
        actions: local.actions,
        constraints: local.constraints,
        summary: local.summary,
      })}\n` +
      (hist ? `Recent chat:\n${hist}\n` : "") +
      `Idea: ${(idea || "").slice(0, 300)}\n` +
      `NL intent: ${intent.summary} | actions=${intent.actions.join(",")}\n` +
      `User prompt:\n${stripTargetPrefix(prompt)}\n\n` +
      `Return ONLY JSON:\n` +
      `{\n` +
      `  "page": "home",\n` +
      `  "target": {"id":"home.hero","kind":"section","label":"Hero"} | null,\n` +
      `  "actions": [\n` +
      `    {"type":"copy_update|ui_update|image_update|layout_update|style_update|section_ops|page_ops|button_update|form_update|component_add|component_remove",\n` +
      `     "id":"hero.title","value":"...","op":"set|hide_section|show_section|remove_page|add_page","props":{},"note":"..."}\n` +
      `  ],\n` +
      `  "constraints": ["..."],\n` +
      `  "summary": "one line",\n` +
      `  "confidence": 0.0\n` +
      `}\n` +
      `Editable ID examples: hero.title, hero.subtitle, hero.ctaText, visual.cta.primaryLabel, visual.form.title, visual.form.submitLabel,\n` +
      `visual.features.items.0.title, media.hero, media.split, media.gallery.0, layout.galleryColumns, styles.nav.hoverColor, theme.primary, home.hero\n` +
      `Rules: nav hover → styles.*; gallery Menu card → media.gallery.N; never invent backend/auth code; keep constraints.\n`,
    config: {
      responseMimeType: "application/json",
      temperature: 0.15,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const parsed = parseJsonLoose(result.text ?? "") as Partial<StructuredInstruction> & {
    actions?: StructuredAction[];
  };

  const actions = Array.isArray(parsed.actions) ? parsed.actions.filter((a) => a && a.id) : [];
  const resolved = actionsToUpdates(actions, config);

  return {
    page: String(parsed.page || local.page || activePageKey),
    target: parsed.target || local.target,
    actions: actions.length ? actions : local.actions,
    constraints: Array.isArray(parsed.constraints)
      ? [...DEFAULT_CONSTRAINTS, ...parsed.constraints.map(String)]
      : local.constraints,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.75,
    summary: String(parsed.summary || local.summary || "").slice(0, 240),
    source: "llm",
    resolvedUpdates: resolved.length && resolvedComplete(actions, resolved) ? resolved : undefined,
    assistantHint: resolved.length
      ? `Interpreted & applied ${resolved.length} change(s).`
      : undefined,
    needsModel: !(resolved.length && resolvedComplete(actions, resolved)),
  };
}

function mergeInstructions(
  local: StructuredInstruction,
  llm: StructuredInstruction
): StructuredInstruction {
  // Prefer LLM actions when present; keep local resolvedUpdates if LLM incomplete
  if (llm.resolvedUpdates?.length && !llm.needsModel) {
    return { ...llm, source: "hybrid", confidence: Math.max(llm.confidence, 0.85) };
  }
  if (local.resolvedUpdates?.length && !local.needsModel) {
    return local;
  }
  return {
    page: llm.page || local.page,
    target: llm.target || local.target,
    actions: llm.actions.length ? llm.actions : local.actions,
    constraints: [...new Set([...local.constraints, ...llm.constraints])],
    confidence: Math.max(local.confidence, llm.confidence),
    summary: llm.summary || local.summary,
    source: "hybrid",
    resolvedUpdates: llm.resolvedUpdates || local.resolvedUpdates,
    assistantHint: llm.assistantHint || local.assistantHint,
    needsModel: llm.needsModel && local.needsModel,
  };
}

/** Convert structured actions with concrete values → ConfigUpdate[] */
export function actionsToUpdates(
  actions: StructuredAction[],
  config: SiteConfig
): ConfigUpdate[] {
  const out: ConfigUpdate[] = [];
  for (const a of actions) {
    if (a.op === "hide_section" || a.op === "show_section") {
      out.push({ type: "section", id: a.id, op: a.op });
      continue;
    }
    if (a.op === "remove_page") {
      out.push({ type: "page", id: a.id, op: "remove_page" });
      continue;
    }
    if (a.op === "add_page" && a.props) {
      out.push({
        type: "page",
        id: a.id,
        op: "add_page",
        value: {
          key: a.id,
          label: a.props.label || a.id,
          components: a.props.components || ["hero", "cta"],
          content: a.props.content || {},
        },
      });
      continue;
    }
    if (a.value === undefined || a.value === null) continue;

    if (a.type === "style_update" || a.id.startsWith("styles.")) {
      out.push({
        type: a.id.includes("customCss") || a.id.includes("patches.") ? "css" : "style",
        id: a.id.startsWith("styles.") ? a.id : `styles.${a.id}`,
        value:
          typeof a.value === "string" && /[{;:]/.test(a.value)
            ? sanitizeCss(String(a.value))
            : a.value,
        op: a.op || "set",
      });
      continue;
    }
    if (a.type === "layout_update" || a.id.startsWith("layout.")) {
      out.push({ type: "layout", id: a.id, value: a.value, op: "set" });
      continue;
    }
    if (a.type === "image_update" || a.id.startsWith("media.")) {
      out.push({ type: "image", id: a.id, value: a.value, op: "set" });
      continue;
    }
    if (a.id === "theme.primary" || a.id === "accent") {
      out.push({ type: "theme", id: "theme.primary", value: a.value, op: "set" });
      continue;
    }
    if (a.id.startsWith("theme.")) {
      out.push({ type: "theme", id: a.id, value: a.value, op: "set" });
      continue;
    }
    out.push({
      type: "text",
      id: a.id,
      value: a.value,
      op: (a.op as "set") || "set",
    });
  }

  // Ensure accent sync
  if (out.some((u) => u.id === "theme.primary") && config) {
    /* applyUpdatesToConfig already syncs accent */
  }
  return out;
}

function resolvedComplete(actions: StructuredAction[], updates: ConfigUpdate[]): boolean {
  // Every action that needs a value should have produced an update, or be a note-only
  const needing = actions.filter(
    (a) =>
      a.op === "hide_section" ||
      a.op === "show_section" ||
      a.op === "remove_page" ||
      a.op === "add_page" ||
      a.value !== undefined
  );
  return needing.length > 0 && updates.length >= Math.min(needing.length, updates.length) && updates.length > 0;
}

function finish(opts: {
  page: string;
  target: StructuredInstruction["target"];
  actions: StructuredAction[];
  constraints: string[];
  updates: ConfigUpdate[];
  summary: string;
  confidence: number;
  source: StructuredInstruction["source"];
  needsModel: boolean;
  hint?: string;
}): StructuredInstruction {
  return {
    page: opts.page,
    target: opts.target,
    actions: opts.actions,
    constraints: opts.constraints,
    confidence: opts.confidence,
    summary: opts.summary,
    source: opts.source,
    resolvedUpdates: opts.updates.length ? opts.updates : opts.needsModel ? undefined : [],
    assistantHint: opts.hint,
    needsModel: opts.needsModel,
  };
}

function stripTargetPrefix(prompt: string): string {
  return prompt.replace(/^\[Target:[^\]]+\]\s*/i, "").trim();
}

function inferPage(lower: string, active: string, config: SiteConfig): string | null {
  for (const p of config.pages) {
    if (new RegExp(`\\b${p.key}\\b`, "i").test(lower) || new RegExp(`\\b${p.label}\\b`, "i").test(lower)) {
      if (/\b(on|to|for|in)\b/i.test(lower) || /\bpage\b/i.test(lower)) return p.key;
    }
  }
  if (/\bon\s+(the\s+)?home\b|\bhomepage\b/i.test(lower)) return "home";
  return active || "home";
}

function inferTargetFromPrompt(
  lower: string,
  galleryLabels: string[]
): { id: string; kind: string; label: string } | null {
  if (/\bhero\b/.test(lower)) return { id: "home.hero", kind: "section", label: "Hero" };
  if (/\bsplit\b/.test(lower)) return { id: "home.split", kind: "section", label: "Split" };
  if (/\bgallery\b/.test(lower)) return { id: "home.gallery", kind: "section", label: "Gallery" };
  if (/\bfeature/.test(lower)) return { id: "home.features", kind: "section", label: "Features" };
  if (/\bcta\b|call to action/.test(lower)) return { id: "home.cta", kind: "section", label: "CTA" };
  if (/\bform\b/.test(lower)) return { id: "home.form", kind: "section", label: "Form" };
  if (/\bnav|navigation/.test(lower)) return { id: "styles.nav", kind: "field", label: "Navigation" };
  const gIdx = resolveGalleryCardIndex(lower, galleryLabels, null);
  if (gIdx != null) return { id: `media.gallery.${gIdx}`, kind: "image", label: galleryLabels[gIdx] };
  return null;
}

function detectMediaSlot(lower: string): string | null {
  if (/\b(hero|background|cover)\b.*\b(image|photo|picture)\b|\b(image|photo)\b.*\b(hero|background|cover)\b/.test(lower))
    return "media.hero";
  if (/\bsplit\b.*\b(image|photo|picture)\b|\b(image|photo)\b.*\bsplit\b/.test(lower)) return "media.split";
  if (/\bbanner\b.*\b(image|photo|picture)\b|\b(image|photo)\b.*\bbanner\b/.test(lower))
    return "media.banner";
  return null;
}

function detectSectionVisibility(
  lower: string,
  target: { id: string; kind?: string } | null
): { id: string; op: "hide_section" | "show_section" } | null {
  const show = /\b(show|unhide|reveal)\b/.test(lower);
  const hide = /\b(hide|remove)\b/.test(lower) && /\bsection\b/.test(lower);
  if (!show && !hide) {
    // "hide the gallery" without saying section
    const m = lower.match(/\b(hide|remove|show|unhide)\s+(the\s+)?(hero|gallery|features|split|cta|form|banner)\b/);
    if (m) {
      const name = m[3];
      const id = name === "cta" || name === "form" ? `home.${name}` : `home.${name}`;
      return {
        id,
        op: /show|unhide/.test(m[1]) ? "show_section" : "hide_section",
      };
    }
    return null;
  }
  if (target?.id && (target.kind === "section" || target.id.startsWith("home."))) {
    return { id: target.id, op: show ? "show_section" : "hide_section" };
  }
  return null;
}

function detectAddPage(lower: string): { key: string; label: string; components: string[] } | null {
  if (!/\b(add|create|new)\b/.test(lower) || !/\bpage\b/.test(lower)) return null;
  const known: Record<string, string[]> = {
    pricing: ["hero", "pricing", "faq", "cta"],
    about: ["hero", "split", "cta"],
    services: ["hero", "features", "cta"],
    blog: ["hero", "cta"],
    contact: ["hero", "form", "cta"],
    account: ["hero", "form", "cta"],
    faq: ["hero", "faq", "cta"],
    shop: ["hero", "gallery", "cta"],
  };
  for (const [key, components] of Object.entries(known)) {
    if (new RegExp(`\\b${key}\\b`).test(lower)) {
      return { key, label: key[0].toUpperCase() + key.slice(1), components };
    }
  }
  const m = lower.match(/\b(?:add|create|new)\s+(?:a\s+)?([a-z][a-z0-9-]{2,20})\s+page\b/);
  if (m) {
    const key = m[1].replace(/[^a-z0-9-]/g, "");
    if (key && key !== "new" && key !== "the") {
      return { key, label: key[0].toUpperCase() + key.slice(1), components: ["hero", "cta"] };
    }
  }
  return null;
}

function detectColor(msg: string): string | null {
  const hex = msg.match(/#([0-9a-f]{3,8})\b/i)?.[0];
  if (hex) return hex;
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
  const lower = msg.toLowerCase();
  for (const [name, val] of Object.entries(named)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) return val;
  }
  return null;
}

function detectButtonUpdate(msg: string): { id: string; value: string } | null {
  const m =
    msg.match(
      /\b(?:add|change|set|update|make|rename)\s+(?:a\s+|the\s+)?(?:primary\s+|secondary\s+)?(?:["“](.+?)["”]|([A-Za-z][^.]{1,40}?))\s+button\b/i
    ) ||
    msg.match(/\bbutton\s+(?:label|text)?\s*(?:to|as|:)\s*["“](.+?)["”]/i) ||
    msg.match(/\bcta\s+(?:to|as|:)\s*["“](.+?)["”]/i) ||
    msg.match(/\bhero\s+(?:cta|button)\s+(?:to|as|:)\s*["“](.+?)["”]/i);
  if (!m) return null;
  const value = (m[1] || m[2] || "").trim().replace(/^["“]|["”]$/g, "");
  if (!value || value.length > 80) return null;
  const lower = msg.toLowerCase();
  let id = "hero.ctaText";
  if (/\bsecondary\b|\bskip\b|\blearn more\b/i.test(lower)) id = "visual.cta.secondaryLabel";
  else if (/\bcta\s+band\b|\bcta band\b|\bsticky\b/i.test(lower)) id = "visual.cta.primaryLabel";
  else if (/\bsplit\b/i.test(lower)) id = "visual.split.cta";
  else if (/\bform\b|submit/i.test(lower)) id = "visual.form.submitLabel";
  else if (/\bprimary\b/i.test(lower) && /\bcta\b/i.test(lower)) id = "visual.cta.primaryLabel";
  return { id, value };
}

function detectFormUpdate(msg: string): { id: string; value: string }[] | null {
  if (!/\bform\b/i.test(msg)) return null;
  const out: { id: string; value: string }[] = [];
  const title = msg.match(/\bform\s+title\s+(?:to|as|:)\s*["“](.+?)["”]/i);
  if (title) out.push({ id: "visual.form.title", value: title[1] });
  const submit = msg.match(/\bsubmit\s+(?:button\s+)?(?:to|as|:|label)\s*["“](.+?)["”]/i);
  if (submit) out.push({ id: "visual.form.submitLabel", value: submit[1] });
  const rewrite = msg.match(/\b(?:rewrite|set|change)\s+(?:the\s+)?form\s+title\s+to\s+["“](.+?)["”]/i);
  if (rewrite) out.push({ id: "visual.form.title", value: rewrite[1] });
  return out.length ? out : null;
}

function detectSetField(msg: string): { id: string; value: string } | null {
  const m =
    msg.match(
      /\b(?:change|set|update|make|rewrite)\s+(?:the\s+)?(hero\s+)?(title|heading|subtitle|cta|button)\s+(?:to|as|:)\s*["“]?(.+?)["”]?$/i
    ) || msg.match(/\b(hero\s+)?(title|heading|subtitle|cta)\s*[:=]\s*["“](.+?)["”]/i);
  if (!m) return null;
  const kind = (m[2] || "").toLowerCase();
  const value = String(m[3] || "")
    .replace(/^["“]|["”]$/g, "")
    .trim();
  if (!value || value.length > 400) return null;
  const id =
    kind === "subtitle"
      ? "hero.subtitle"
      : kind === "cta" || kind === "button"
        ? "hero.ctaText"
        : "hero.title";
  return { id, value };
}

function detectButtonIdToClear(
  lower: string,
  target: { id: string } | null
): string | null {
  if (target?.id && /\.|cta|button|label/i.test(target.id)) return target.id;
  if (/\bsecondary\b|\blearn more\b|\bskip\b/.test(lower)) return "visual.cta.secondaryLabel";
  if (/\bsign\s*up\b|\bget started\b|\bhero\b/.test(lower)) return "hero.ctaText";
  return "visual.cta.primaryLabel";
}

function detectFeatureCardCopy(msg: string): { id: string; value: string } | null {
  const m = msg.match(
    /\b(?:change|set|update|rename)\s+(?:the\s+)?(first|second|third|1st|2nd|3rd|\d+)(?:\w*)?\s+feature\s+(?:card\s+)?(title|body|heading)?\s+(?:to|as|:)\s*["“](.+?)["”]/i
  );
  if (!m) return null;
  const ord = m[1].toLowerCase();
  const map: Record<string, number> = {
    first: 0,
    "1st": 0,
    "1": 0,
    second: 1,
    "2nd": 1,
    "2": 1,
    third: 2,
    "3rd": 2,
    "3": 2,
  };
  const idx = map[ord] ?? Math.max(0, Number(ord) - 1);
  const field = (m[2] || "title").toLowerCase() === "body" ? "body" : "title";
  return { id: `visual.features.items.${idx}.${field}`, value: m[3].trim() };
}

function mapSectionToPrimaryField(sectionId: string, lower: string): string | null {
  if (/hero/i.test(sectionId)) {
    if (/subtitle/.test(lower)) return "hero.subtitle";
    if (/cta|button/.test(lower)) return "hero.ctaText";
    return "hero.title";
  }
  if (/split/i.test(sectionId)) return "visual.split.title";
  if (/feature/i.test(sectionId)) return "visual.features.title";
  if (/gallery/i.test(sectionId)) return "visual.gallery.title";
  if (/cta/i.test(sectionId)) return "visual.cta.title";
  if (/form/i.test(sectionId)) return "visual.form.title";
  return null;
}

function mapIntentAction(a: string): ActionType {
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
      return "ui_update";
  }
}
