// lib/template-ai/agents/validate.ts — Validation Agent
import type { AiUpdatePayload, ConfigUpdate, SiteConfig, TemplateManifest } from "../types";
import type { EditPlan, IntentPlan } from "./types";

export type ValidateArgs = {
  payload: AiUpdatePayload;
  plan: EditPlan;
  intent: IntentPlan;
  manifest: TemplateManifest;
  config: SiteConfig;
  prompt: string;
};

export type ValidateResult = {
  payload: AiUpdatePayload;
  dropped: ConfigUpdate[];
  warnings: string[];
};

/**
 * Validation Agent — ensures only intended changes land.
 * Drops unknown / out-of-plan updates, unsafe page ops, oversized strings.
 */
export function validateAgainstPlan(args: ValidateArgs): ValidateResult {
  const { payload, plan, intent, manifest, config, prompt } = args;
  const dropped: ConfigUpdate[] = [];
  const warnings: string[] = [];

  if (payload.mode === "answer" || intent.kind === "answer" || intent.kind === "clarify") {
    return {
      payload: {
        ...payload,
        mode: intent.kind === "clarify" ? "answer" : payload.mode,
        updates: [],
        newPages: intent.kind === "clarify" ? [] : payload.newPages,
        assistantMessage:
          intent.kind === "clarify"
            ? plan.assistantHint || payload.assistantMessage
            : payload.assistantMessage,
      },
      dropped: payload.updates || [],
      warnings: intent.kind === "clarify" ? ["Clarification required"] : [],
    };
  }

  const knownFieldIds = new Set(manifest.editableFields.map((f) => f.id));
  const sectionIds = new Set(manifest.sections.map((s) => s.id));
  const pageKeys = new Set(config.pages.map((p) => p.key));
  const allow = buildAllowlist(plan, intent, knownFieldIds, sectionIds);

  const strict =
    plan.allowedIds.length > 0 &&
    intent.scope !== "site" &&
    !intent.actions.includes("page-add") &&
    !(plan.resolvedUpdates && plan.resolvedUpdates.length > 0);

  let updates = (payload.updates || []).filter((u) => {
    // Always drop home deletion
    if (u.op === "remove_page" && (u.id === "home" || !u.id)) {
      dropped.push(u);
      warnings.push("Blocked removing home page");
      return false;
    }

    // Normalize / allow page ops
    if (u.op === "remove_page") {
      if (!pageKeys.has(u.id) && !config.pages.some((p) => p.label.toLowerCase() === u.id.toLowerCase())) {
        dropped.push(u);
        warnings.push(`Unknown page for remove: ${u.id}`);
        return false;
      }
      return true;
    }

    if (u.op === "hide_section" || u.op === "show_section") {
      if (!isAllowedId(u.id, allow, strict) && !sectionIds.has(u.id) && !u.id.startsWith("home.")) {
        dropped.push(u);
        warnings.push(`Dropped out-of-plan section op: ${u.id}`);
        return false;
      }
      return true;
    }

    // Theme / layout / media / styles / brand always structurally valid if allowed
    if (
      u.id.startsWith("theme.") ||
      u.id.startsWith("layout.") ||
      u.id.startsWith("styles.") ||
      u.id.startsWith("media.") ||
      u.id === "brandName" ||
      u.id === "accent" ||
      u.type === "css" ||
      u.type === "style"
    ) {
      if (strict && !isAllowedId(u.id, allow, true) && !relaxesForAction(u, intent)) {
        dropped.push(u);
        warnings.push(`Dropped unintended ${u.id}`);
        return false;
      }
      return true;
    }

    // Known editable fields
    const known =
      knownFieldIds.has(u.id) ||
      manifest.editableFields.some((f) => f.path === u.id) ||
      u.id.includes(".");

    if (!known && u.op !== "add_page") {
      dropped.push(u);
      warnings.push(`Dropped unknown id: ${u.id}`);
      return false;
    }

    if (strict && !isAllowedId(u.id, allow, true) && !relaxesForAction(u, intent)) {
      dropped.push(u);
      warnings.push(`Dropped out-of-plan update: ${u.id}`);
      return false;
    }

    // Cap string length from manifest
    const field = manifest.editableFields.find((f) => f.id === u.id || f.path === u.id);
    if (field?.maxLength && typeof u.value === "string" && u.value.length > field.maxLength) {
      u = { ...u, value: u.value.slice(0, field.maxLength) };
      warnings.push(`Truncated ${u.id} to ${field.maxLength} chars`);
    }

    return true;
  });

  // Layout-only intent: strip media updates
  if (intent.actions.includes("layout") && !intent.actions.includes("image")) {
    const before = updates.length;
    updates = updates.filter((u) => {
      if (u.type === "image" || u.id.startsWith("media.")) {
        dropped.push(u);
        return false;
      }
      return true;
    });
    if (updates.length < before) {
      warnings.push("Stripped image changes from layout-only request");
    }
  }

  // Style-only: never hijack gallery/images (e.g. "Menu" nav vs "Menu" card)
  if (
    intent.actions.includes("style") &&
    !intent.actions.includes("image") &&
    !intent.actions.includes("copy")
  ) {
    const before = updates.length;
    updates = updates.filter((u) => {
      if (u.type === "image" || u.id.startsWith("media.")) {
        dropped.push(u);
        return false;
      }
      return true;
    });
    if (updates.length < before) {
      warnings.push("Stripped image changes from style/CSS request");
    }
  }

  // Image-only: prefer not rewriting lots of copy unless plan includes copy
  if (
    intent.actions.includes("image") &&
    !intent.actions.includes("copy") &&
    intent.fastPath
  ) {
    const before = updates.length;
    updates = updates.filter((u) => {
      if (u.type === "image" || u.id.startsWith("media.") || u.id.startsWith("layout.") || u.id.startsWith("styles."))
        return true;
      if (u.op === "hide_section" || u.op === "show_section") return true;
      dropped.push(u);
      return false;
    });
    if (updates.length < before) {
      warnings.push("Kept image-only scope for fast-path edit");
    }
  }

  // If everything dropped but we had a plan with resolved updates, restore plan
  if (!updates.length && plan.resolvedUpdates?.length) {
    updates = [...plan.resolvedUpdates];
    warnings.push("Restored planned updates after empty validation");
  }

  let assistantMessage = payload.assistantMessage;
  if (dropped.length && updates.length) {
    assistantMessage = `${assistantMessage} (kept ${updates.length} intended change${updates.length === 1 ? "" : "s"}; skipped ${dropped.length} unintended).`;
  } else if (dropped.length && !updates.length) {
    assistantMessage =
      plan.assistantHint ||
      `I understood “${prompt.slice(0, 80)}” but blocked unintended edits. Try clicking the exact section or naming the field.`;
  }

  // Filter newPages if not in plan
  let newPages = payload.newPages;
  if (newPages?.length && !intent.actions.includes("page-add") && intent.scope !== "site") {
    warnings.push("Dropped newPages — not in intent");
    newPages = [];
  }

  const nextMode: AiUpdatePayload["mode"] =
    updates.length || newPages?.length ? "mutate" : "answer";

  return {
    payload: {
      ...payload,
      mode: nextMode,
      updates,
      newPages,
      assistantMessage,
    },
    dropped,
    warnings,
  };
}

function buildAllowlist(
  plan: EditPlan,
  intent: IntentPlan,
  knownFieldIds: Set<string>,
  sectionIds: Set<string>
): Set<string> {
  const allow = new Set<string>(plan.allowedIds);
  for (const step of plan.steps) {
    step.ids.forEach((id) => allow.add(id));
  }
  if (intent.target?.id) {
    allow.add(intent.target.id);
    // Expand section → known fields that share prefix
    const tid = intent.target.id.replace(/^home\./, "");
    for (const id of knownFieldIds) {
      if (id.startsWith(tid) || id.includes(`.${tid}`) || id.startsWith(`visual.${tid}`)) {
        allow.add(id);
      }
    }
    if (sectionIds.has(intent.target.id)) allow.add(intent.target.id);
  }
  // Always allow layout/theme/styles when those actions present
  if (intent.actions.includes("layout")) {
    allow.add("layout.galleryColumns");
    allow.add("layout.galleryVariant");
    allow.add("layout.featureColumns");
    allow.add("layout.blocksColumns");
  }
  if (intent.actions.includes("theme") || intent.actions.includes("style")) {
    allow.add("theme.primary");
    allow.add("theme.background");
    allow.add("accent");
    allow.add("styles.customCss");
    allow.add("styles.nav.hoverColor");
    allow.add("styles.nav.activeColor");
    allow.add("styles.nav.hoverUnderline");
    allow.add("styles.nav.activeUnderline");
    allow.add("styles.nav.transition");
    allow.add("styles.motion.duration");
    allow.add("styles.motion.easing");
    allow.add("styles.motion.hoverLift");
    allow.add("styles.button.hoverLift");
    allow.add("styles.button.hoverScale");
    allow.add("styles.cards.hoverLift");
    allow.add("styles.tokens.primary");
    allow.add("styles.tokens.background");
    allow.add("styles.patches.nav-hover");
  }
  return allow;
}

function isAllowedId(id: string, allow: Set<string>, strict: boolean): boolean {
  if (!strict) return true;
  if (allow.has(id)) return true;
  for (const a of allow) {
    if (!a) continue;
    if (id === a || id.startsWith(a + ".") || a.startsWith(id + ".")) return true;
    const short = a.replace(/^home\./, "").replace(/^visual\./, "");
    if (short && (id.startsWith(short) || id.includes(`.${short}`))) return true;
    if (a.startsWith("media.") && id.startsWith("media.")) {
      // gallery.0 vs gallery — allow sibling gallery slots only if plan listed gallery
      if (a.startsWith("media.gallery") && id.startsWith("media.gallery")) {
        return a === id || allow.has(id);
      }
      if (a === id) return true;
    }
  }
  return false;
}

function relaxesForAction(u: ConfigUpdate, intent: IntentPlan): boolean {
  if (intent.actions.includes("layout") && u.id.startsWith("layout.")) return true;
  if (intent.actions.includes("theme") && (u.id.startsWith("theme.") || u.id === "accent")) return true;
  if (
    intent.actions.includes("style") &&
    (u.id.startsWith("styles.") ||
      u.type === "css" ||
      u.type === "style" ||
      u.id.startsWith("theme.") ||
      u.id === "accent")
  ) {
    return true;
  }
  if (intent.actions.includes("image") && (u.type === "image" || u.id.startsWith("media."))) return true;
  if (intent.actions.includes("page-remove") && u.op === "remove_page") return true;
  if (
    (intent.actions.includes("hide-section") || intent.actions.includes("show-section")) &&
    (u.op === "hide_section" || u.op === "show_section")
  ) {
    return true;
  }
  return false;
}
