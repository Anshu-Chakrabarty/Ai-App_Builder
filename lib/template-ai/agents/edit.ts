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
  detectColumnCount,
  type AgentHistoryTurn,
  type AgentWorkEntry,
} from "../agent-helpers";
import { galleryLabelsFor } from "@/lib/site-media";
import { resolvePageToDelete } from "@/lib/page-request";
import type {
  AiUpdatePayload,
  ConfigUpdate,
  SiteConfig,
  TemplateKnowledge,
  TemplateManifest,
} from "../types";
import { scopedCatalog } from "./plan";
import type { EditPlan, IntentPlan } from "./types";

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
};

/**
 * Code Editing Agent — implements the EditPlan as config JSON updates.
 * Never rewrites template source; only emits editable-ID patches.
 */
export async function editFromPlan(args: EditArgs): Promise<AiUpdatePayload> {
  const { plan, intent, prompt, config, images, activePageKey, knowledge } = args;

  // Planner already resolved surgical updates
  if (plan.resolvedUpdates) {
    return {
      mode: plan.resolvedUpdates.length ? "mutate" : "answer",
      assistantMessage:
        plan.assistantHint ||
        (plan.resolvedUpdates.length
          ? `Applied planned updates (${plan.resolvedUpdates.map((u) => u.id).join(", ")}).`
          : "No config changes needed."),
      updates: plan.resolvedUpdates,
    };
  }

  // Gallery card without upload — stock photo (still deterministic)
  if (intent.fastPath === "gallery-card") {
    const labels = galleryLabelsFor(config.media?.category || "default");
    const idx = resolveGalleryCardIndex(prompt, labels, intent.target) ?? 0;
    const imageId = `media.gallery.${idx}`;
    const value = pickStockImage(prompt, config.media?.category);
    return {
      mode: "mutate",
      assistantMessage:
        plan.assistantHint ||
        `Updated the “${labels[idx] || "Gallery"}” gallery card (${imageId}).`,
      updates: [{ type: "image", id: imageId, value, op: "set" }],
    };
  }

  try {
    return await editWithGemini(args);
  } catch (err) {
    console.warn("edit agent fallback", err);
    return heuristicEdit(args);
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

  const galleryCardMap = galleryLabels
    .map((lab, i) => `- media.gallery.${i} = “${lab}” card image`)
    .join("\n");
  const components = knowledge.components
    .map((c) => `${c.id}: ${c.name} — ${c.description}`)
    .join("\n");
  const variants =
    plan.variants.join("\n") ||
    (knowledge.componentVariants || [])
      .slice(0, 12)
      .map((v) => `${v.variantId} (${v.componentId}): ${v.name}`)
      .join("\n");
  const pageList = config.pages.map((p) => `- ${p.key} (“${p.label}”)`).join("\n");

  const historyBlock = (history || [])
    .slice(-40)
    .map((h, idx, arr) => {
      const recent = idx >= arr.length - 10;
      return `${h.role.toUpperCase()}: ${h.text.slice(0, recent ? 700 : 220)}`;
    })
    .join("\n");

  const workBlock = (workLog || [])
    .slice(-20)
    .map(
      (w) =>
        `- ${w.summary}${w.ops?.length ? ` [${w.ops.join(", ")}]` : ""} · was: “${(w.prompt || "").slice(0, 100)}”`
    )
    .join("\n");

  const planBlock =
    `EDIT PLAN (follow exactly — only these components/properties):\n` +
    plan.steps.map((s, i) => `${i + 1}. [${s.action}] ${s.ids.join(", ") || "(new page)"} — ${s.rationale}`).join("\n") +
    `\nAllowed IDs: ${plan.allowedIds.slice(0, 40).join(", ") || "(planner open — prefer section map)"}\n` +
    `Constraints:\n${plan.constraints.map((c) => `- ${c}`).join("\n")}\n`;

  const intentBlock =
    `INTENT (from Natural Language Agent):\n` +
    `- summary: ${intent.summary}\n` +
    `- kind: ${intent.kind}; scope: ${intent.scope}; actions: ${intent.actions.join(", ")}\n` +
    `- continuity: ${intent.continuity}\n` +
    (intent.target
      ? `- target: ${intent.target.id} (${intent.target.kind || "field"}) “${intent.target.label || ""}”\n`
      : "") +
    (intent.notes.length ? `- notes: ${intent.notes.join("; ")}\n` : "");

  const imageBlock =
    images && images.length
      ? `UPLOADED IMAGES (${images.length}): use first as image field value when changing photos.\n` +
        `Preferred image id: ${resolveImg(prompt)}\n`
      : "";

  const contentPreview = JSON.stringify(config.content).slice(0, 6000);
  const layoutPreview = JSON.stringify(config.layout || {});

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const result = await generateContentResilient(ai, {
    contents:
      `You are the Code Editing Agent for brand "${config.brandName}".\n` +
      `You implement an EditPlan. NEVER change template code. Only emit JSON updates by editable ID.\n` +
      `Active page: ${activePageKey}. Accent: ${config.accent}.\n` +
      `Idea: ${(idea || "").slice(0, 800)}\n\n` +
      intentBlock +
      `\n` +
      planBlock +
      `\nPages:\n${pageList}\n\n` +
      (historyBlock ? `Chat history:\n${historyBlock}\n\n` : "") +
      (workBlock ? `Work log:\n${workBlock}\n\n` : "") +
      (imageBlock ? `${imageBlock}\n` : "") +
      `SITE SECTION MAP:\n${sectionMap}\n\n` +
      `GALLERY CARD MAP:\n${galleryCardMap}\n\n` +
      `Scoped editable IDs:\n${catalog}\n\n` +
      `Components for NEW pages:\n${components}\n\n` +
      (variants ? `Variants:\n${variants}\n\n` : "") +
      `config.content (truncated):\n${contentPreview}\n` +
      `layout: ${layoutPreview}\n\n` +
      `User prompt:\n${prompt}\n\n` +
      `Return ONLY JSON:\n` +
      `{"mode":"answer"|"mutate","assistantMessage":"...","updates":[{"type":"...","id":"...","value":"...","op":"set|delete|hide_section|show_section|add_page|remove_page"}],"newPages":[{"key":"...","label":"...","components":[],"content":{}}]}\n` +
      `Rules:\n` +
      `- Stay inside the Edit Plan allowed IDs when possible.\n` +
      `- Questions only → mode=answer, empty updates.\n` +
      `- Layout requests → layout.* only, never media.*.\n` +
      `- Named gallery cards → exact media.gallery.N from GALLERY CARD MAP.\n` +
      `- Never remove page "home".\n` +
      `- Prefer many small ID updates over inventing unknown ids.\n`,
    config: {
      responseMimeType: "application/json",
      temperature: 0.3,
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const parsed = parseJsonLoose(result.text ?? "") as Partial<AiUpdatePayload>;
  let payload = normalizeEditPayload(parsed, activePageKey, prompt, config);

  // Force uploaded image if model forgot (and plan allows image)
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
  const { prompt, intent, config, knowledge, activePageKey, images } = args;
  const msg = prompt.toLowerCase();
  const target = intent.target;

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

  if (target?.id && prompt.trim() && !/\b(delete|remove|hide)\b.*\b(page|section)\b/i.test(prompt)) {
    if (target.kind === "section" && /\b(hide|remove|delete)\b/i.test(msg)) {
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
    if (target?.kind === "section" && target.id) {
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
