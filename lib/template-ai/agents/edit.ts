// lib/template-ai/agents/edit.ts — Code Editing Agent (config ID updates only)
import { GoogleGenAI } from "@google/genai";
import { generateContentResilient, parseJsonLoose } from "@/lib/gemini";
import {
  detectBackgroundColor,
  isLayoutIntent,
  pickStockImage,
  resolveGalleryCardIndex,
  resolveImageTargetId,
  resolveLayoutUpdates,
  resolveSectionTargetFromPrompt,
  detectColumnCount,
  type AgentHistoryTurn,
  type AgentWorkEntry,
} from "../agent-helpers";
import { galleryLabelsFor } from "@/lib/site-media";
import { resolvePageToDelete } from "@/lib/page-request";
import { resolveStyleUpdates } from "@/lib/site-styles";
import { buildCardListUpdates, isCardRemoveOrResizePrompt } from "../list-cards";
import type {
  AiUpdatePayload,
  ConfigUpdate,
  SiteConfig,
  TemplateKnowledge,
  TemplateManifest,
} from "../types";
import { scopedCatalog } from "./plan";
import type { EditPlan, IntentPlan } from "./types";
import type { StructuredInstruction } from "./interpreter";
import { actionsToUpdates } from "./interpreter";

export type EditArgs = {
  prompt: string;
  intent: IntentPlan;
  plan: EditPlan;
  config: SiteConfig;
  manifest: TemplateManifest;
  knowledge: TemplateKnowledge;
  activePageKey: string;
  idea?: string;
  history?: AgentHistoryTurn[];
  workLog?: AgentWorkEntry[];
  images?: string[];
  /** Slim Gemini context for faster/cheaper calls */
  compact?: boolean;
  instruction?: StructuredInstruction;
};

/**
 * Code Editing Agent — implements the EditPlan as config JSON updates.
 * Never rewrites template source; only emits editable-ID patches.
 * Skips Gemini whenever the interpreter/planner already resolved updates.
 */
export async function editFromPlan(args: EditArgs): Promise<AiUpdatePayload> {
  const { plan, intent, prompt, config, images, instruction } = args;

  // Interpreter / planner resolved — fastest accurate path
  if (plan.resolvedUpdates) {
    return {
      mode: plan.resolvedUpdates.length ? "mutate" : "answer",
      assistantMessage:
        plan.assistantHint ||
        instruction?.assistantHint ||
        (plan.resolvedUpdates.length
          ? `Applied interpreted updates (${plan.resolvedUpdates.map((u) => u.id).join(", ")}).`
          : "No config changes needed."),
      updates: plan.resolvedUpdates,
      newPages: [],
    };
  }

  if (instruction?.actions?.length && !instruction.needsModel) {
    const updates = actionsToUpdates(instruction.actions, config);
    if (updates.length) {
      return {
        mode: "mutate",
        assistantMessage:
          instruction.assistantHint ||
          `Applied ${updates.length} interpreted change(s).`,
        updates,
      };
    }
  }

  // Gallery card without upload — stock photo
  if (intent.fastPath === "gallery-card") {
    const labels = galleryLabelsFor(config.media?.category || "default");
    const idx = resolveGalleryCardIndex(prompt, labels, intent.target) ?? 0;
    const imageId = `media.gallery.${idx}`;
    const value = images?.[0] || pickStockImage(prompt, config.media?.category);
    return {
      mode: "mutate",
      assistantMessage:
        plan.assistantHint ||
        `Updated the “${labels[idx] || "Gallery"}” gallery card (${imageId}).`,
      updates: [{ type: "image", id: imageId, value, op: "set" }],
    };
  }

  const heuristic = heuristicEdit(args);
  if (
    heuristic.mode === "mutate" &&
    heuristic.updates.length > 0 &&
    (intent.fastPath ||
      intent.actions.every((a) =>
        ["style", "theme", "layout", "image", "hide-section", "show-section", "page-remove"].includes(
          a
        )
      ))
  ) {
    return heuristic;
  }

  try {
    return await editWithGemini(args);
  } catch (err) {
    console.warn("edit agent fallback", err);
    return heuristic;
  }
}

async function editWithGemini(args: EditArgs): Promise<AiUpdatePayload> {
  const {
    prompt,
    intent,
    plan,
    config,
    manifest,
    knowledge,
    activePageKey,
    idea,
    history,
    workLog,
    images,
    instruction,
  } = args;

  const galleryLabels = galleryLabelsFor(config.media?.category || "default");
  const imageOpts = {
    galleryLabels,
    mediaCategory: config.media?.category || "default",
  };
  const resolveImg = (p: string) => resolveImageTargetId(p, intent.target, imageOpts);
  const { catalog, sectionMap } = scopedCatalog(
    manifest,
    plan.allowedIds,
    activePageKey,
    config
  );

  // Compact context = faster + fewer tokens (most edits)
  const compact = args.compact !== false;
  const histN = compact ? 8 : 24;
  const histChars = compact ? 280 : 600;
  const contentLimit = compact ? 2200 : 6000;
  const maxOut = Number(process.env.GEMINI_EDIT_MAX_TOKENS) || (compact ? 4096 : 8192);

  const galleryCardMap = galleryLabels
    .map((lab, i) => `- media.gallery.${i} = “${lab}”`)
    .join("\n");
  const pageList = config.pages.map((p) => `${p.key}`).join(", ");

  const historyBlock = (history || [])
    .slice(-histN)
    .map((h) => `${h.role === "user" ? "U" : "A"}: ${h.text.slice(0, histChars)}`)
    .join("\n");

  const workBlock = (workLog || [])
    .slice(-8)
    .map((w) => `- ${w.summary.slice(0, 80)}`)
    .join("\n");

  const instructionBlock = instruction
    ? `PROMPT INTERPRETER OUTPUT (follow exactly):\n${JSON.stringify(
        {
          page: instruction.page,
          target: instruction.target,
          summary: instruction.summary,
          confidence: instruction.confidence,
          source: instruction.source,
          actions: instruction.actions.slice(0, 16),
          constraints: instruction.constraints.slice(0, 10),
        },
        null,
        0
      )}\nImplement ONLY these actions as config ID updates.\n\n`
    : "";

  const planBlock =
    `PLAN:\n` +
    plan.steps
      .slice(0, 8)
      .map((s, i) => `${i + 1}. [${s.action}] ${s.ids.slice(0, 6).join(", ")} — ${s.rationale}`)
      .join("\n") +
    `\nAllowed: ${(plan.allowedIds.length ? plan.allowedIds : ["(section map)"]).slice(0, 28).join(", ")}\n` +
    `Constraints:\n${plan.constraints.slice(0, 8).map((c) => `- ${c}`).join("\n")}\n`;

  const targetLine = intent.target
    ? `Target: ${intent.target.id} (${intent.target.kind || "field"}) ${intent.target.label || ""}\n`
    : "";

  const imageBlock =
    images && images.length
      ? `Upload → set image id ${resolveImg(prompt)} to first uploaded URL.\n`
      : "";

  // Only include content for allowed / target paths when possible
  let contentPreview = "";
  if (intent.target?.id && intent.target.kind !== "image") {
    contentPreview = JSON.stringify({
      focus: intent.target.id,
      content: config.content,
    }).slice(0, contentLimit);
  } else {
    contentPreview = JSON.stringify(config.content).slice(0, contentLimit);
  }

  const needNewPage = intent.actions.includes("page-add");
  const components = needNewPage
    ? knowledge.components.map((c) => c.id).join(", ")
    : "";

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const result = await generateContentResilient(ai, {
    contents:
      `Website edit agent for "${config.brandName}". Emit JSON config updates only (no template source).\n` +
      `Page: ${activePageKey}. Accent: ${config.accent}. ${(idea || "").slice(0, 240)}\n` +
      targetLine +
      `Intent: ${intent.summary} | actions=${intent.actions.join(",")}\n\n` +
      instructionBlock +
      planBlock +
      `Pages: ${pageList}\n` +
      (historyBlock ? `Recent chat:\n${historyBlock}\n` : "") +
      (workBlock ? `Work:\n${workBlock}\n` : "") +
      imageBlock +
      `Sections:\n${sectionMap.slice(0, 1800)}\n` +
      `Gallery:\n${galleryCardMap}\n` +
      `IDs:\n${catalog.slice(0, 2500)}\n` +
      `Style IDs: styles.nav.*, styles.motion.*, styles.button.*, styles.cards.*, styles.tokens.*, styles.patches.*, styles.customCss, theme.primary\n` +
      (components ? `New-page components: ${components}\n` : "") +
      `content:\n${contentPreview}\n` +
      `layout:${JSON.stringify(config.layout || {})}\n` +
      `styles:${JSON.stringify(config.styles || {}).slice(0, 800)}\n\n` +
      `User: ${prompt}\n\n` +
      `JSON only: {"mode":"answer"|"mutate","assistantMessage":"...","updates":[{"type":"...","id":"...","value":"...","op":"set|append|hide_section|show_section|remove_page"}],"newPages":[]}\n` +
      `Rules: stay in plan; CSS via styles.*; nav hover ≠ gallery Menu card; never remove home; never claim CSS is impossible.\n`,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: maxOut,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const parsed = parseJsonLoose(result.text ?? "") as Partial<AiUpdatePayload>;
  let payload = normalizeEditPayload(parsed, activePageKey, prompt, config);

  if (
    images?.length &&
    payload.mode === "mutate" &&
    !isLayoutIntent(prompt) &&
    intent.actions.includes("image")
  ) {
    const hasImageUpdate = payload.updates.some(
      (u) => u.type === "image" || /image|media|photo|src|logo/i.test(u.id)
    );
    if (!hasImageUpdate) {
      const imageId =
        plan.allowedIds.find((id) => id.startsWith("media.")) || resolveImg(prompt);
      payload = {
        ...payload,
        updates: [
          ...payload.updates,
          { type: "image", id: imageId, value: images[0], op: "set" },
        ],
        assistantMessage: `${payload.assistantMessage} Also applied your uploaded image to ${imageId}.`,
      };
    }
  }

  return payload;
}

export function normalizeEditPayload(
  parsed: Partial<AiUpdatePayload>,
  activePageKey: string,
  prompt: string,
  config?: SiteConfig
): AiUpdatePayload {
  const mode = parsed.mode === "answer" ? "answer" : "mutate";
  let updates = Array.isArray(parsed.updates) ? (parsed.updates as ConfigUpdate[]) : [];
  const newPages = Array.isArray(parsed.newPages) ? parsed.newPages : [];

  updates = updates
    .map((u) => {
      if (u.op !== "remove_page") return u;
      let key = String(u.id || "").replace(/^page\./, "");
      if (config) {
        const hit = config.pages.find(
          (p) =>
            p.key === key ||
            p.label.toLowerCase() === key.toLowerCase() ||
            p.key === keyFromLoose(key)
        );
        if (hit) key = hit.key;
      }
      return { ...u, id: key, type: "page" as const, op: "remove_page" as const };
    })
    .filter((u) => !(u.op === "remove_page" && (u.id === "home" || !u.id)));

  return {
    mode,
    assistantMessage:
      String(parsed.assistantMessage || "").trim() ||
      (mode === "answer"
        ? "I can update editable fields, hide sections, delete pages, or create new pages."
        : `Applied updates for: ${prompt.slice(0, 60)}`),
    updates,
    newPages: newPages.map((p) => ({
      key: String(p.key || "page"),
      label: String(p.label || p.key || "Page"),
      components: Array.isArray(p.components) ? p.components.map(String) : ["hero", "cta"],
      content: p.content && typeof p.content === "object" ? p.content : {},
    })),
  };
}

function keyFromLoose(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Deterministic fallback when Gemini fails */
export function heuristicEdit(args: EditArgs): AiUpdatePayload {
  const { prompt, intent, config, knowledge, activePageKey, images, manifest } = args;
  const msg = prompt.toLowerCase();
  let target = intent.target;
  if (!target?.id) {
    target =
      resolveSectionTargetFromPrompt(prompt, {
        manifest,
        config,
        activePageKey,
      }) || null;
  }

  if (images?.length && !isLayoutIntent(prompt)) {
    const imageId = resolveImageTargetId(prompt, target, {
      galleryLabels: galleryLabelsFor(config.media?.category || "default"),
      mediaCategory: config.media?.category,
    });
    return {
      mode: "mutate",
      assistantMessage: `Updated ${imageId} with your uploaded image.`,
      updates: [{ type: "image", id: imageId, value: images[0], op: "set" }],
    };
  }

  {
    const labels = galleryLabelsFor(config.media?.category || "default");
    const gIdx = resolveGalleryCardIndex(prompt, labels, target);
    if (
      gIdx != null &&
      /\b(image|photo|picture|card|replace|change|swap|update)\b/i.test(msg) &&
      !isLayoutIntent(prompt)
    ) {
      const imageId = `media.gallery.${gIdx}`;
      return {
        mode: "mutate",
        assistantMessage: `Updated the “${labels[gIdx] || "Gallery"}” card (${imageId}).`,
        updates: [
          {
            type: "image",
            id: imageId,
            value: pickStockImage(msg, config.media?.category),
            op: "set",
          },
        ],
      };
    }
  }

  if (isLayoutIntent(msg)) {
    return {
      mode: "mutate",
      assistantMessage: `Aligned into a ${detectColumnCount(prompt)}-column layout without changing images.`,
      updates: resolveLayoutUpdates(prompt, target),
    };
  }

  // CSS / hover / motion fallback
  {
    const styleUpdates = resolveStyleUpdates(prompt, config.accent);
    if (styleUpdates?.length) {
      return {
        mode: "mutate",
        assistantMessage: `Updated site styling (${styleUpdates
          .map((u) => u.id)
          .slice(0, 3)
          .join(", ")}).`,
        updates: styleUpdates,
      };
    }
  }

  if (target?.id && prompt.trim() && !/\b(delete|remove|hide)\b.*\b(page|section)\b/i.test(prompt)) {
    // Card removals must resize the list — never hide the selected section
    if (
      target.kind === "section" &&
      /\b(hide|remove|delete)\b/i.test(msg) &&
      (isCardRemoveOrResizePrompt(prompt) || /\bcards?\b/i.test(msg))
    ) {
      const cardUpdates = buildCardListUpdates({ prompt, config, target });
      if (cardUpdates.length) {
        const list = cardUpdates.find((u) => u.type === "list");
        const n = Array.isArray(list?.value) ? list!.value.length : null;
        return {
          mode: "mutate",
          assistantMessage:
            n != null
              ? `Updated cards — now ${n} (section kept).`
              : "Updated the card list (section kept).",
          updates: cardUpdates,
        };
      }
    }
    if (
      target.kind === "section" &&
      /\b(hide|remove|delete)\b/i.test(msg) &&
      !/\bcards?\b/i.test(msg)
    ) {
      return {
        mode: "mutate",
        assistantMessage: `Hid section ${target.id}.`,
        updates: [{ type: "section", id: target.id, op: "hide_section", value: false }],
      };
    }
    if (target.kind !== "image" && target.kind !== "section") {
      const quoted = prompt.match(/["“](.+?)["”]/);
      const value =
        quoted?.[1] ||
        prompt.replace(/^(change|update|set|make|rewrite)\s+(it|this|the\s+\w+)?\s*(to|as|:)?\s*/i, "").trim();
      if (value && value.length < 400) {
        return {
          mode: "mutate",
          assistantMessage: `Updated ${target.label || target.id}.`,
          updates: [{ type: "text", id: target.id, value, op: "set" }],
        };
      }
    }
  }

  if (
    /^(what|why|how|when|where|who|which|explain|tell me)\b/i.test(prompt.trim()) &&
    !/\b(add|delete|remove|change|update|make|create|upgrade)\b/i.test(msg)
  ) {
    return {
      mode: "answer",
      assistantMessage: `This site is data-driven. I edit config by IDs. Components: ${knowledge.components
        .map((c) => c.id)
        .join(", ")}. Pages: ${config.pages.map((p) => p.label).join(", ")}.`,
      updates: [],
    };
  }

  if (/\b(delete|remove|drop|get rid of)\b/i.test(prompt)) {
    // “remove 3 cards” → resize list, never hide the whole section
    if (isCardRemoveOrResizePrompt(prompt) || /\bcards?\b/i.test(prompt)) {
      const cardUpdates = buildCardListUpdates({ prompt, config, target });
      if (cardUpdates.length) {
        const list = cardUpdates.find((u) => u.type === "list");
        const n = Array.isArray(list?.value) ? list!.value.length : null;
        return {
          mode: "mutate",
          assistantMessage:
            n != null
              ? `Updated cards — now ${n} (section kept).`
              : "Updated the card list (section kept).",
          updates: cardUpdates,
        };
      }
    }
    let del = resolvePageToDelete(prompt, config.pages);
    if (!del && /\b(this|current)\s+page\b/i.test(prompt) && activePageKey !== "home") {
      const p = config.pages.find((x) => x.key === activePageKey);
      if (p) del = { key: p.key, label: p.label };
    }
    if (del && del.key !== "home") {
      return {
        mode: "mutate",
        assistantMessage: `Removed the “${del.label}” page.`,
        updates: [{ type: "page", id: del.key, op: "remove_page" }],
      };
    }
    // Only hide section when user clearly means the section itself (not cards)
    if (
      target?.kind === "section" &&
      target.id &&
      /\b(section|block|hero|gallery|features|split|cta|form)\b/i.test(prompt) &&
      !/\bcards?\b/i.test(prompt)
    ) {
      return {
        mode: "mutate",
        assistantMessage: `Hid section ${target.id}.`,
        updates: [{ type: "section", id: target.id, op: "hide_section" }],
      };
    }
  }

  if (/\b(image|photo|picture|hero|background)\b/i.test(msg)) {
    const imageId = resolveImageTargetId(prompt, target, {
      galleryLabels: galleryLabelsFor(config.media?.category || "default"),
      mediaCategory: config.media?.category,
    });
    return {
      mode: "mutate",
      assistantMessage: `Updated ${imageId} with a new photo.`,
      updates: [
        {
          type: "image",
          id: imageId,
          value: pickStockImage(msg, config.media?.category),
          op: "set",
        },
      ],
    };
  }

  const bg = detectBackgroundColor(msg);
  if (bg && /\b(background|bg|theme)\b/i.test(msg)) {
    return {
      mode: "mutate",
      assistantMessage: `Set background to ${bg}.`,
      updates: [{ type: "theme", id: "theme.background", value: bg, op: "set" }],
    };
  }

  // Soften hero title if vague "make it better"
  if (/\b(shorter|concise|brief)\b/i.test(msg)) {
    const title = String(
      (config.content as any)?.home?.hero?.title ||
        (config.content as any)?.hero?.title ||
        ""
    );
    if (title) {
      return {
        mode: "mutate",
        assistantMessage: "Shortened the hero title.",
        updates: [
          {
            type: "text",
            id: "hero.title",
            value: title.split(/[.!?]/)[0].slice(0, 48).trim(),
            op: "set",
          },
        ],
      };
    }
  }

  return {
    mode: "answer",
    assistantMessage:
      "I understood your request but need a clearer target — click a section in the preview, or name the field (e.g. “hero title”, “Delivery card”).",
    updates: [],
  };
}
