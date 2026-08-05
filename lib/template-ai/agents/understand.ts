// lib/template-ai/agents/understand.ts — Natural Language Agent
import {
  isFollowUpPrompt,
  isLayoutIntent,
  isNewTopicPrompt,
  inferTargetFromMemory,
  resolveGalleryCardIndex,
  resolveImageTargetId,
  resolveSectionTargetFromPrompt,
  type AgentHistoryTurn,
  type AgentWorkEntry,
} from "../agent-helpers";
import { galleryLabelsFor } from "@/lib/site-media";
import { isStyleIntent } from "@/lib/site-styles";
import type { SiteConfig, TemplateManifest } from "../types";
import type { ContinuityMode, IntentAction, IntentKind, IntentPlan, IntentScope } from "./types";

export type UnderstandArgs = {
  prompt: string;
  config: SiteConfig;
  activePageKey: string;
  history?: AgentHistoryTurn[];
  workLog?: AgentWorkEntry[];
  target?: { id: string; kind?: string; label?: string } | null;
  images?: string[];
  manifest?: TemplateManifest | null;
};

/**
 * Natural Language Agent — understands what the user wants.
 * Local/deterministic first (fast, reliable); no LLM required.
 */
export function understandIntent(args: UnderstandArgs): IntentPlan {
  const { prompt, config, history, workLog, images } = args;
  const rawTarget = args.target || null;
  const msg = (prompt || "").trim();
  const lower = msg.toLowerCase();

  let continuity: ContinuityMode = "standalone";
  if (isFollowUpPrompt(msg)) continuity = "follow-up";
  else if (isNewTopicPrompt(msg)) continuity = "new-topic";

  let target = rawTarget;
  // Name/keyword in the prompt → section (works without Studio selection)
  const namedSection =
    !rawTarget
      ? resolveSectionTargetFromPrompt(msg, {
          manifest: args.manifest,
          config,
          activePageKey: args.activePageKey,
        })
      : null;
  if (namedSection) {
    target = namedSection;
  } else if (!target && continuity === "follow-up") {
    target = inferTargetFromMemory(history, workLog);
  } else if (target && continuity === "new-topic" && !rawTarget) {
    target = null;
  }

  const galleryLabels = galleryLabelsFor(config.media?.category || "default");
  const styleIntent = isStyleIntent(msg);
  // Don't treat "nav menu hover" as the food "Menu" gallery card
  const namedGalleryIdx =
    styleIntent && /\b(nav|navigation|hover|active|transition|animation|css|style)\b/i.test(msg)
      ? null
      : resolveGalleryCardIndex(msg, galleryLabels, target);
  const layoutOnly =
    isLayoutIntent(msg) &&
    !/\b(replace|upload|swap)\s+(the\s+)?(image|photo|picture)\b/i.test(msg) &&
    !styleIntent;

  const actions = detectActions(msg, images, layoutOnly, namedGalleryIdx, styleIntent);
  // Card-count / services-grid prompts need copy+layout (not layout-only)
  if (/\b\d{1,2}\s+cards?\b|\b(make\s+it|add)\s+\d+\s+cards?\b/i.test(msg)) {
    if (!actions.includes("copy")) actions.push("copy");
    if (!actions.includes("layout")) actions.push("layout");
  }
  const kind = detectKind(msg, actions, images);
  const scope = detectScope(msg, target, actions);
  const fastPath = detectFastPath({
    layoutOnly,
    namedGalleryIdx,
    images,
    prompt: msg,
    actions,
    styleIntent,
  });

  const notes: string[] = [];
  if (namedSection?.id) {
    notes.push(`Named section from prompt: ${namedSection.id} (“${namedSection.label}”)`);
  }
  if (continuity === "follow-up" && target?.id) {
    notes.push(`Follow-up: keep editing ${target.id}`);
  }
  if (continuity === "new-topic") {
    notes.push("New topic — do not reuse prior sticky target");
  }
  if (styleIntent) {
    notes.push("CSS/UI style request — use styles.* / theme.* (hover, motion, colors)");
  }
  if (namedGalleryIdx != null) {
    notes.push(`Gallery card index ${namedGalleryIdx} (“${galleryLabels[namedGalleryIdx]}”)`);
  }
  if (images?.length) {
    const imageId = resolveImageTargetId(msg, target, {
      galleryLabels,
      mediaCategory: config.media?.category || "default",
    });
    notes.push(`Image target candidate: ${imageId}`);
  }

  return {
    kind,
    scope,
    actions,
    continuity,
    target,
    summary: summarize(kind, actions, target, msg),
    notes,
    fastPath,
  };
}

function detectActions(
  msg: string,
  images: string[] | undefined,
  layoutOnly: boolean,
  namedGalleryIdx: number | null,
  styleIntent: boolean
): IntentAction[] {
  const actions: IntentAction[] = [];
  const lower = msg.toLowerCase();

  if (styleIntent) {
    actions.push("style");
    if (/\b(color|accent|theme|palette|background)\b/i.test(msg)) actions.push("theme");
  }

  if (layoutOnly) actions.push("layout");
  // Style-only requests should not also pull in image/copy unless clearly asked
  const imageAsked =
    images?.length ||
    (/\b(image|photo|picture|hero|gallery|banner|upload|swap)\b/i.test(msg) &&
      !/\b(nav|navigation|hover|transition|animation|css)\b/i.test(msg));
  if (imageAsked && !layoutOnly && !styleIntent) {
    actions.push("image");
  }
  if (namedGalleryIdx != null && !layoutOnly && !styleIntent) {
    if (!actions.includes("image")) actions.push("image");
  }
  if (!styleIntent && /\b(color|accent|theme|background|palette)\b/i.test(msg)) {
    actions.push("theme");
  }
  if (/\b(add|create|new)\b.*\bpage\b|\bpage\b.*\b(add|create|new)\b/i.test(msg)) {
    actions.push("page-add");
  }
  if (/\b(delete|remove|drop)\b.*\bpage\b|\bpage\b.*\b(delete|remove)\b/i.test(msg)) {
    actions.push("page-remove");
  }
  if (
    /\b(hide)\b.*\b(section|block|hero|gallery|features|services|split|cta|form|banner)\b/i.test(msg) &&
    !/\bcards?\b/i.test(msg)
  ) {
    actions.push("hide-section");
  }
  if (
    /\b(hide|remove)\b/i.test(msg) &&
    /\b(services?\s+at\s+a\s+glance|care\s+pathways)\b/i.test(msg) &&
    !/\bcards?\b/i.test(msg) &&
    !actions.includes("hide-section")
  ) {
    actions.push("hide-section");
  }
  if (/\b(show|unhide|reveal)\b.*\b(section|block)\b/i.test(msg)) {
    actions.push("show-section");
  }
  if (
    !styleIntent &&
    (/\b(change|update|rewrite|make|set|edit|fix|tweak|shorter|longer|warmer|bolder)\b/i.test(
      msg
    ) ||
      /\b(title|heading|subtitle|copy|text)\b/i.test(msg))
  ) {
    if (!actions.includes("copy") && !layoutOnly) actions.push("copy");
  }

  const isQuestion =
    /^(what|why|how|when|where|who|which|explain|tell me)\b/i.test(msg) &&
    !/\b(add|delete|remove|change|update|make|create|upgrade)\b/i.test(lower);
  if (isQuestion && !actions.length) actions.push("question");

  if (!actions.length && msg) actions.push(styleIntent ? "style" : "copy");
  if (images?.length && !actions.includes("image") && !layoutOnly && !styleIntent) {
    actions.push("image");
  }

  return actions;
}

function detectKind(
  msg: string,
  actions: IntentAction[],
  images?: string[]
): IntentKind {
  if (actions.length === 1 && actions[0] === "question") return "answer";
  if (!msg.trim() && images?.length) return "mutate";
  if (!msg.trim() && !images?.length) return "clarify";
  return "mutate";
}

function detectScope(
  msg: string,
  target: { id: string; kind?: string } | null,
  actions: IntentAction[]
): IntentScope {
  if (actions.includes("page-add") || actions.includes("page-remove")) return "page";
  if (actions.includes("style") || actions.includes("theme")) return "site";
  if (/\b(whole|entire|all)\s+(site|pages?)\b|\beverywhere\b/i.test(msg)) return "site";
  if (target?.kind === "section" || /\b(this\s+)?section\b/i.test(msg)) return "section";
  if (target?.kind === "field" || target?.kind === "image") return "field";
  if (/\b(page|homepage|home|about|contact)\b/i.test(msg)) return "page";
  return target?.id ? "field" : "section";
}

function detectFastPath(opts: {
  layoutOnly: boolean;
  namedGalleryIdx: number | null;
  images?: string[];
  prompt: string;
  actions: IntentAction[];
  styleIntent: boolean;
}): IntentPlan["fastPath"] {
  if (opts.styleIntent && opts.actions.includes("style")) return "style";
  if (opts.layoutOnly) return "layout";
  if (
    opts.namedGalleryIdx != null &&
    /\b(image|photo|picture|card|replace|change|swap|update|use)\b/i.test(opts.prompt) &&
    !opts.actions.includes("layout") &&
    !opts.styleIntent
  ) {
    return "gallery-card";
  }
  if (
    opts.images?.length &&
    (!opts.prompt.trim() ||
      /replace|upload|use|set|change|image|photo|picture|hero|background|split|gallery|banner|card/i.test(
        opts.prompt
      )) &&
    !opts.actions.includes("layout") &&
    !opts.styleIntent
  ) {
    return "image-upload";
  }
  return null;
}

function summarize(
  kind: IntentKind,
  actions: IntentAction[],
  target: { id: string; label?: string } | null,
  msg: string
): string {
  if (kind === "answer") return "User is asking a question about the site.";
  if (kind === "clarify") return "Prompt is empty — need clarification.";
  const where = target?.label || target?.id || "the relevant section";
  const what = actions.filter((a) => a !== "question").join(", ") || "edit";
  return `User wants to ${what} on ${where}: “${msg.slice(0, 120)}”`;
}
