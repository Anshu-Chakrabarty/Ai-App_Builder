// lib/template-ai/agents/understand.ts — Natural Language Agent
import {
  isFollowUpPrompt,
  isLayoutIntent,
  isNewTopicPrompt,
  inferTargetFromMemory,
  resolveGalleryCardIndex,
  resolveImageTargetId,
  type AgentHistoryTurn,
  type AgentWorkEntry,
} from "../agent-helpers";
import { galleryLabelsFor } from "@/lib/site-media";
import type { SiteConfig } from "../types";
import type { ContinuityMode, IntentAction, IntentKind, IntentPlan, IntentScope } from "./types";

export type UnderstandArgs = {
  prompt: string;
  config: SiteConfig;
  activePageKey: string;
  history?: AgentHistoryTurn[];
  workLog?: AgentWorkEntry[];
  target?: { id: string; kind?: string; label?: string } | null;
  images?: string[];
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
  if (!target && continuity === "follow-up") {
    target = inferTargetFromMemory(history, workLog);
  }
  if (target && continuity === "new-topic" && !rawTarget) {
    target = null;
  }

  const galleryLabels = galleryLabelsFor(config.media?.category || "default");
  const namedGalleryIdx = resolveGalleryCardIndex(msg, galleryLabels, target);
  const layoutOnly =
    isLayoutIntent(msg) &&
    !/\b(replace|upload|swap)\s+(the\s+)?(image|photo|picture)\b/i.test(msg);

  const actions = detectActions(msg, images, layoutOnly, namedGalleryIdx);
  const kind = detectKind(msg, actions, images);
  const scope = detectScope(msg, target, actions);
  const fastPath = detectFastPath({
    layoutOnly,
    namedGalleryIdx,
    images,
    prompt: msg,
    actions,
  });

  const notes: string[] = [];
  if (continuity === "follow-up" && target?.id) {
    notes.push(`Follow-up: keep editing ${target.id}`);
  }
  if (continuity === "new-topic") {
    notes.push("New topic — do not reuse prior sticky target");
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
  namedGalleryIdx: number | null
): IntentAction[] {
  const actions: IntentAction[] = [];
  const lower = msg.toLowerCase();

  if (layoutOnly) actions.push("layout");
  if (images?.length || /\b(image|photo|picture|hero|gallery|banner|upload|swap)\b/i.test(msg)) {
    if (!layoutOnly) actions.push("image");
  }
  if (namedGalleryIdx != null && !layoutOnly) {
    if (!actions.includes("image")) actions.push("image");
  }
  if (/\b(color|accent|theme|background|palette)\b/i.test(msg)) actions.push("theme");
  if (/\b(add|create|new)\b.*\bpage\b|\bpage\b.*\b(add|create|new)\b/i.test(msg)) {
    actions.push("page-add");
  }
  if (/\b(delete|remove|drop)\b.*\bpage\b|\bpage\b.*\b(delete|remove)\b/i.test(msg)) {
    actions.push("page-remove");
  }
  if (/\b(hide)\b.*\b(section|block|hero|gallery|features)\b/i.test(msg)) {
    actions.push("hide-section");
  }
  if (/\b(show|unhide|reveal)\b.*\b(section|block)\b/i.test(msg)) {
    actions.push("show-section");
  }
  if (
    /\b(change|update|rewrite|make|set|edit|fix|tweak|shorter|longer|warmer|bolder)\b/i.test(
      msg
    ) ||
    /\b(title|heading|subtitle|copy|text|cta|button)\b/i.test(msg)
  ) {
    if (!actions.includes("copy") && !layoutOnly) actions.push("copy");
  }

  const isQuestion =
    /^(what|why|how|when|where|who|which|explain|tell me)\b/i.test(msg) &&
    !/\b(add|delete|remove|change|update|make|create|upgrade)\b/i.test(lower);
  if (isQuestion && !actions.length) actions.push("question");

  if (!actions.length && msg) actions.push("copy");
  if (images?.length && !actions.includes("image") && !layoutOnly) actions.push("image");

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
}): IntentPlan["fastPath"] {
  if (opts.layoutOnly) return "layout";
  if (
    opts.namedGalleryIdx != null &&
    /\b(image|photo|picture|card|replace|change|swap|update|use)\b/i.test(opts.prompt) &&
    !opts.actions.includes("layout")
  ) {
    return "gallery-card";
  }
  if (
    opts.images?.length &&
    (!opts.prompt.trim() ||
      /replace|upload|use|set|change|image|photo|picture|hero|background|split|gallery|banner|card/i.test(
        opts.prompt
      )) &&
    !opts.actions.includes("layout")
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
