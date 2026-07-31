// lib/template-ai/agent.ts — Part 2 / Phase 3: AI Website Agent → JSON updates by ID
import { GoogleGenAI } from "@google/genai";
import { generateContentResilient, parseJsonLoose } from "@/lib/gemini";
import type {
  AiUpdatePayload,
  ConfigUpdate,
  SiteConfig,
  TemplateKnowledge,
  TemplateManifest,
} from "./types";
import { listEditableCatalog, listSectionMap } from "./config";
import { slugForPage } from "@/lib/page-designs";
import { resolvePageToDelete } from "@/lib/page-request";
import { galleryLabelsFor } from "@/lib/site-media";

export type AgentHistoryTurn = { role: "user" | "assistant"; text: string };
export type AgentWorkEntry = {
  at: number;
  prompt: string;
  summary: string;
  ops?: string[];
};

/** Gallery caption → index (Delivery → 2 for food, etc.). */
export function resolveGalleryCardIndex(
  prompt: string,
  labels: string[],
  target?: { id?: string; label?: string } | null
): number | null {
  const msg = `${prompt || ""} ${target?.label || ""}`.toLowerCase();
  if (!msg.trim()) return null;

  // Already a specific gallery id
  const fromId = (target?.id || "").match(/^media\.gallery\.(\d+)$/i);
  if (fromId) return Number(fromId[1]);

  // Match caption labels: "delivery card", "change the Menu image"
  for (let i = 0; i < labels.length; i++) {
    const lab = String(labels[i] || "")
      .toLowerCase()
      .trim();
    if (lab.length < 2) continue;
    const re = new RegExp(
      `\\b${lab.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    if (re.test(msg)) return i;
  }

  const ordinals: Record<string, number> = {
    first: 0,
    second: 1,
    third: 2,
    fourth: 3,
    fifth: 4,
    sixth: 5,
    left: 0,
    middle: 1,
    center: 1,
    right: 2,
  };
  for (const [word, i] of Object.entries(ordinals)) {
    if (new RegExp(`\\b${word}\\s+(card|image|photo|shot|tile|picture)\\b`).test(msg)) {
      return i;
    }
  }

  const num =
    msg.match(/\b(?:gallery|card|image|photo|shot)\s*[#:]?\s*(\d+)\b/) ||
    msg.match(/\b(\d+)(?:st|nd|rd|th)\s+(?:card|image|photo|shot)\b/);
  if (num) {
    const n = Number(num[1]);
    if (n >= 1 && n <= 6) return n - 1;
    if (n >= 0 && n <= 5) return n;
  }

  return null;
}

/**
 * Pick which media field an uploaded/pasted image should update.
 * Never defaults every image edit to media.hero — respect target + prompt wording.
 * Gallery cards are resolved by caption (e.g. “Delivery card” → media.gallery.2).
 */
export function resolveImageTargetId(
  prompt: string,
  target?: { id: string; kind?: string; label?: string } | null,
  opts?: { galleryLabels?: string[]; mediaCategory?: string }
): string {
  const id = target?.id || "";
  if (/^media\.gallery\.\d+$/i.test(id)) return id;
  if (id.startsWith("media.") && !/^media\.gallery$/i.test(id)) return id;
  if (target?.kind === "image" && id && !/gallery/i.test(id)) return id;

  const labels =
    opts?.galleryLabels?.length
      ? opts.galleryLabels
      : galleryLabelsFor(opts?.mediaCategory || "default");
  const galleryIdx = resolveGalleryCardIndex(prompt, labels, target);
  if (galleryIdx != null) return `media.gallery.${galleryIdx}`;

  // Section targets → corresponding image slot
  if (/^split$|home\.split|visual\.split/i.test(id)) return "media.split";
  if (/^gallery$|home\.gallery|visual\.gallery/i.test(id)) return "media.gallery.0";
  if (/^banner$|home\.banner|page-banner/i.test(id)) return "media.banner";
  if (/^hero$|home\.hero|^media$/i.test(id)) return "media.hero";

  const msg = (prompt || "").toLowerCase();
  if (/\bsplit\b|\bright\s*(column|image|photo|picture)\b|\bpolished\s+layout\b/.test(msg)) {
    return "media.split";
  }
  if (
    /\b(gallery|photo\s*grid|card)\b/.test(msg) &&
    !/\bhero|background|banner|cover\b/.test(msg)
  ) {
    return "media.gallery.0";
  }
  if (/\bbanner\b/.test(msg) && !/\bhero\b/.test(msg)) return "media.banner";
  if (/\bhero\b|\bbackground\b|\bcover\b|\bfull[- ]?bleed\b/.test(msg)) return "media.hero";

  if (target?.kind === "section" && /split/i.test(id + (target.label || ""))) return "media.split";
  if (target?.kind === "section" && /gallery/i.test(id + (target.label || "")))
    return "media.gallery.0";
  if (target?.kind === "section" && /hero/i.test(id + (target.label || ""))) return "media.hero";

  if (/\b(image|photo|picture)\b/.test(msg) && !/\bhero|background|banner|cover|gallery\b/.test(msg)) {
    if (target?.kind === "section" || target?.kind === "image") return "media.split";
    return "media.hero";
  }
  return "media.hero";
}

/** True when the user clearly wants column/grid alignment — not copy/image edits. */
export function isLayoutIntent(prompt: string): boolean {
  const msg = (prompt || "").toLowerCase().trim();
  if (!msg) return false;
  // Must mention columns/grid/numeric layout — not vague "alignment" alone
  if (/\b\d\s*[\/x×]\s*\d\b/.test(msg)) return true; // 3/3, 3x3
  if (/\b(\d)\s*col(?:umn)?s?\b/.test(msg)) return true;
  if (/\bin\s+a\s+\d[- ]?(column|col|row)\b/.test(msg)) return true;
  if (/\b(equal|uniform)\s+(grid|columns?)\b/.test(msg)) return true;
  if (/\b(align|re-?arrange|arrange)\b/.test(msg) && /\b(column|columns|grid|row|\d)\b/.test(msg)) {
    return true;
  }
  if (/\b(make|set|put)\b.*\b(columns?|grid)\b/.test(msg)) return true;
  return false;
}

export function detectColumnCount(prompt: string): number {
  const msg = (prompt || "").toLowerCase();
  const m =
    msg.match(/\b(\d)\s*[\/x×]\s*\d\b/) ||
    msg.match(/\b(\d)\s*col(?:umn)?s?\b/) ||
    msg.match(/\bin\s+(\d)\b/) ||
    msg.match(/\b(\d)\s*per\s*row\b/);
  const n = m ? Number(m[1]) : 3;
  return Math.min(6, Math.max(2, n || 3));
}

/** Map section/target + prompt → layout updates (never touches images). */
export function resolveLayoutUpdates(
  prompt: string,
  target?: { id: string; kind?: string; label?: string } | null
): ConfigUpdate[] {
  const cols = detectColumnCount(prompt);
  const id = (target?.id || "").toLowerCase();
  const label = (target?.label || "").toLowerCase();
  const msg = (prompt || "").toLowerCase();
  const blob = `${id} ${label} ${msg}`;

  if (/gallery|photo|visual story/.test(blob)) {
    return [
      { type: "layout", id: "layout.galleryColumns", value: cols, op: "set" },
      { type: "layout", id: "layout.galleryVariant", value: "equal", op: "set" },
    ];
  }
  if (/feature|icon|card|why it feels/.test(blob)) {
    return [{ type: "layout", id: "layout.featureColumns", value: cols, op: "set" }];
  }
  if (/block|added|html|widget/.test(blob) || target?.id === "home.blocks") {
    return [{ type: "layout", id: "layout.blocksColumns", value: cols, op: "set" }];
  }
  // Default for "align in 3" with a whole-page or unknown section: equal gallery + blocks
  if (/gallery|photo|image|picture/.test(msg)) {
    return [
      { type: "layout", id: "layout.galleryColumns", value: cols, op: "set" },
      { type: "layout", id: "layout.galleryVariant", value: "equal", op: "set" },
    ];
  }
  return [
    { type: "layout", id: "layout.blocksColumns", value: cols, op: "set" },
    { type: "layout", id: "layout.galleryColumns", value: cols, op: "set" },
    { type: "layout", id: "layout.galleryVariant", value: "equal", op: "set" },
    { type: "layout", id: "layout.featureColumns", value: cols, op: "set" },
  ];
}

/** True when the user is continuing the previous turn (short refinements only). */
export function isFollowUpPrompt(prompt: string): boolean {
  const msg = (prompt || "").trim().toLowerCase();
  if (!msg || msg.length > 100) return false;
  if (isNewTopicPrompt(msg)) return false;
  // Single-word / tiny refinements
  if (/^(yes|no|ok|okay|more|less|perfect|better|worse|shorter|longer|warmer|cooler|bolder|softer)[.!]?$/i.test(msg)) {
    return true;
  }
  // Explicit "it/this" refinements — not "make the contact page shorter"
  if (/\b(make it|change it|update it|fix it|tweak it|refine it|try again)\b/i.test(msg)) {
    return true;
  }
  if (/^(make|change|update|fix|tweak|refine)\s+(it|this)([.!]|\s|$)/i.test(msg)) {
    return true;
  }
  return false;
}

/** True when the user is starting a separate request (ignore prior target). */
export function isNewTopicPrompt(prompt: string): boolean {
  const msg = (prompt || "").toLowerCase();
  return /\b(now |separately|separate(ly)?|new request|different|forget (that|previous)|ignore previous|start over|unrelated|on the (about|home|contact|doctors|departments)|switch to|another page|meanwhile)\b/i.test(
    msg
  );
}

/** Infer last edited field/section from chat + work log for follow-ups. */
export function inferTargetFromMemory(
  history?: AgentHistoryTurn[],
  workLog?: AgentWorkEntry[]
): { id: string; kind?: string; label?: string } | null {
  const lastWork = [...(workLog || [])]
    .reverse()
    .find((w) => w.ops?.length && !w.ops.includes("answer") && !w.ops.includes("undo"));
  if (lastWork?.ops?.length) {
    for (const op of lastWork.ops) {
      const id = op.includes(":") ? op.split(":").slice(1).join(":") : op;
      if (!id || id === "answer" || id === "undo") continue;
      if (id.startsWith("layout.")) {
        if (id.includes("gallery")) return { id: "home.gallery", kind: "section", label: "Gallery" };
        if (id.includes("feature")) return { id: "home.features", kind: "section", label: "Features" };
        if (id.includes("blocks")) return { id: "home.blocks", kind: "section", label: "Blocks" };
        continue;
      }
      const kind = id.startsWith("media.")
        ? "image"
        : /^home\./.test(id) || /^(hero|split|gallery|features|banner)$/i.test(id)
          ? "section"
          : id.includes(".")
            ? "field"
            : "section";
      return { id, kind, label: id };
    }
  }

  const lastUser = [...(history || [])].reverse().find((h) => h.role === "user");
  if (lastUser?.text) {
    // Prefixed instruction: [Target: Label (id, kind)]
    const bracket = lastUser.text.match(/\[Target:\s*([^\]]+)\]/i);
    if (bracket?.[1]) {
      const m = bracket[1].match(/^(.+?)\s*\(([^,]+),\s*([^)]+)\)/);
      if (m) {
        return { label: m[1].trim(), id: m[2].trim(), kind: m[3].trim() };
      }
    }
    // Chat line suffix: "… → Label" — map common labels to ids
    const arrow = lastUser.text.match(/→\s*([^\n[]+)/);
    if (arrow?.[1]) {
      const label = arrow[1].trim().toLowerCase();
      if (/hero image|media\.hero/.test(label)) return { id: "media.hero", kind: "image", label: arrow[1].trim() };
      if (/split image|media\.split/.test(label)) return { id: "media.split", kind: "image", label: arrow[1].trim() };
      if (/gallery/.test(label)) return { id: "home.gallery", kind: "section", label: arrow[1].trim() };
      if (/split/.test(label)) return { id: "home.split", kind: "section", label: arrow[1].trim() };
      if (/feature/.test(label)) return { id: "home.features", kind: "section", label: arrow[1].trim() };
      if (/hero/.test(label)) return { id: "home.hero", kind: "section", label: arrow[1].trim() };
      if (/title|heading|subtitle|cta/.test(label) && /\./.test(label)) {
        return { id: arrow[1].trim(), kind: "field", label: arrow[1].trim() };
      }
    }
  }
  return null;
}

/**
 * AI Chat Engine: understands intent and returns structured JSON updates
 * targeting editable IDs — never rewrites template code.
 */
export async function runWebsiteAgent(args: {
  prompt: string;
  config: SiteConfig;
  manifest: TemplateManifest;
  knowledge: TemplateKnowledge;
  activePageKey: string;
  idea?: string;
  /** Recent chat turns for continuity */
  history?: AgentHistoryTurn[];
  /** Structured past actions the agent should respect */
  workLog?: AgentWorkEntry[];
  /** User-selected section/field to edit */
  target?: { id: string; kind?: string; label?: string } | null;
  /** Uploaded image data URLs or https URLs */
  images?: string[];
}): Promise<AiUpdatePayload> {
  const {
    prompt,
    config,
    manifest,
    knowledge,
    activePageKey,
    idea,
    history,
    workLog,
    target: rawTarget,
    images,
  } = args;

  // Follow-up → reuse last target from memory; new topic → ignore sticky target unless explicit
  let target = rawTarget || null;
  if (!target && isFollowUpPrompt(prompt)) {
    target = inferTargetFromMemory(history, workLog);
  }
  if (target && isNewTopicPrompt(prompt) && !rawTarget) {
    target = null;
  }

  const catalog = listEditableCatalog(manifest);
  const sectionMap = listSectionMap(manifest, activePageKey, config.sectionState);
  const galleryLabels = galleryLabelsFor(config.media?.category || "default");
  const imageOpts = {
    galleryLabels,
    mediaCategory: config.media?.category || "default",
  };
  const galleryCardMap = galleryLabels
    .map((lab, i) => `- media.gallery.${i} = “${lab}” card image`)
    .join("\n");
  const resolveImg = (p: string, t?: typeof target) =>
    resolveImageTargetId(p, t || target, imageOpts);
  const components = knowledge.components
    .map((c) => `${c.id}: ${c.name} — ${c.description}`)
    .join("\n");
  const variants = (knowledge.componentVariants || [])
    .slice(0, 16)
    .map((v) => `${v.variantId} (${v.componentId}): ${v.name}`)
    .join("\n");
  const contentKeys = (knowledge.contentMap || [])
    .slice(0, 40)
    .map((c) => c.id)
    .join(", ");
  const tokens = knowledge.themeTokens
    ? `primary=${knowledge.themeTokens.primary}; wrap=${knowledge.layoutRules?.wrapMaxWidth}; icons=${(knowledge.themeTokens.iconSet || []).slice(0, 6).join(",")}`
    : `primary=${config.accent}`;

  const pageList = config.pages
    .map((p) => `- ${p.key} (“${p.label}”)`)
    .join("\n");

  const historyBlock = (history || [])
    .slice(-60)
    .map((h, idx, arr) => {
      // Recent turns get more detail so the model can loop accurately
      const recent = idx >= arr.length - 12;
      const max = recent ? 900 : 280;
      return `${h.role.toUpperCase()}: ${h.text.slice(0, max)}`;
    })
    .join("\n");

  const workBlock = (workLog || [])
    .slice(-30)
    .map((w) => `- ${w.summary}${w.ops?.length ? ` [${w.ops.join(", ")}]` : ""} · was: “${(w.prompt || "").slice(0, 140)}”`)
    .join("\n");

  const continuityNote = isFollowUpPrompt(prompt)
    ? `CONTINUITY: This is a FOLLOW-UP. Keep editing the same element/section as the prior turn (${target?.id || "last target"}). Do not switch topics.\n`
    : isNewTopicPrompt(prompt)
      ? `CONTINUITY: This is a NEW / SEPARATE request. Do not reuse the previous target unless the user names it again.\n`
      : `CONTINUITY: Use full chat history. If ambiguous, prefer the latest USER TARGET or last work-log field.\n`;

  const targetBlock = target?.id
    ? `USER TARGET (priority — apply changes HERE):\n- id: ${target.id}\n- kind: ${target.kind || "field"}\n- label: ${target.label || target.id}\n` +
      (target.kind === "section"
        ? `- SECTION MODE: edit this whole section’s layout/copy/images only. Do not change unrelated sections.\n`
        : "")
    : "";

  const imageBlock =
    images && images.length
      ? `UPLOADED IMAGES (${images.length}):\n` +
        images
          .map((u, i) => `- image[${i}]: ${u.startsWith("data:") ? "[data-url attached — use as value for image fields]" : u}`)
          .join("\n") +
        `\nWhen replacing an image, set value to the FIRST uploaded data URL (or https URL).\n` +
        `Preferred ids: ${resolveImg(prompt, target)}.\n` +
        `IMPORTANT: media.split = the right-column photo in the split section (NOT the hero background).\n` +
        `media.hero = full-bleed hero/background only. media.gallery.N = gallery grid cards (see GALLERY CARD MAP).\n` +
        `media.banner = inner page banner.\n` +
        `If the user asked to ALIGN / COLUMN / GRID / LAYOUT, do NOT change images — emit layout.* updates instead.\n`
      : "";

  const contentPreview = JSON.stringify(config.content).slice(0, 8000);
  const layoutPreview = JSON.stringify(config.layout || {});

  // Layout / align first — never hijack with image swaps
  if (isLayoutIntent(prompt) && !/\b(replace|upload|swap)\s+(the\s+)?(image|photo|picture)\b/i.test(prompt)) {
    const updates = resolveLayoutUpdates(prompt, target);
    return {
      mode: "mutate",
      assistantMessage: `Aligned the selected section into a ${detectColumnCount(prompt)}-column layout (design structure preserved — images untouched).`,
      updates,
    };
  }

  // Fast path: named gallery card (“Delivery card”, “Menu image”, card 3, …)
  const namedGalleryIdx = resolveGalleryCardIndex(prompt, galleryLabels, target);
  if (
    namedGalleryIdx != null &&
    /\b(image|photo|picture|card|replace|change|swap|update|use)\b/i.test(prompt) &&
    !isLayoutIntent(prompt)
  ) {
    const imageId = `media.gallery.${namedGalleryIdx}`;
    const cardName = galleryLabels[namedGalleryIdx] || `Card ${namedGalleryIdx + 1}`;
    if (images?.length) {
      return {
        mode: "mutate",
        assistantMessage: `Updated the “${cardName}” gallery card (${imageId}) with your uploaded image.`,
        updates: [{ type: "image", id: imageId, value: images[0], op: "set" }],
      };
    }
    // No upload — still swap to a fresh stock photo for that card
    const stock = pickStockImage(prompt, config.media?.category);
    return {
      mode: "mutate",
      assistantMessage: `Updated the “${cardName}” gallery card (${imageId}) with a new photo.`,
      updates: [{ type: "image", id: imageId, value: stock, op: "set" }],
    };
  }

  // Fast path: image upload with clear target — no model needed
  if (
    images?.length &&
    (!prompt.trim() ||
      /replace|upload|use|set|change|image|photo|picture|hero|background|split|gallery|banner|card/i.test(prompt)) &&
    !isLayoutIntent(prompt)
  ) {
    const imageId = resolveImg(prompt, target);
    const cardHint = /^media\.gallery\.(\d+)$/.test(imageId)
      ? ` (“${galleryLabels[Number(imageId.split(".").pop())] || "Gallery"}” card)`
      : "";
    return {
      mode: "mutate",
      assistantMessage: `Updated ${imageId}${cardHint} with your uploaded image.`,
      updates: [{ type: "image", id: imageId, value: images[0], op: "set" }],
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const result = await generateContentResilient(ai, {
      contents:
        `You are the AI Website Agent for brand "${config.brandName}".\n` +
        `Architecture rule: NEVER change template code. Only emit JSON updates by editable ID.\n` +
        `Active page: ${activePageKey}\n` +
        `Accent: ${config.accent}\n` +
        `Theme tokens: ${tokens}\n` +
        `Idea context: ${(idea || "").slice(0, 1200)}\n\n` +
        `Current pages (use these exact keys for remove_page):\n${pageList}\n\n` +
        (historyBlock ? `FULL conversation history (remember everything — like ChatGPT):\n${historyBlock}\n\n` : "") +
        (workBlock ? `Prior work log (do not undo unless asked; stay consistent):\n${workBlock}\n\n` : "") +
        continuityNote +
        (targetBlock ? `${targetBlock}\n` : "") +
        (imageBlock ? `${imageBlock}\n` : "") +
        `SITE SECTION MAP (every block on this site — understand & edit via these ids):\n${sectionMap}\n\n` +
        `GALLERY CARD MAP (use these exact ids when user names a card like “Delivery” or “Menu”):\n${galleryCardMap}\n\n` +
        `Editable field IDs (use exact ids in updates):\n${catalog}\n\n` +
        `Reusable components for NEW pages:\n${components}\n\n` +
        (variants ? `Component variants (design DNA):\n${variants}\n\n` : "") +
        (contentKeys ? `Content map keys: ${contentKeys}\n\n` : "") +
        `Current config.content (truncated):\n${contentPreview}\n\n` +
        `Current layout config: ${layoutPreview}\n\n` +
        `User prompt:\n${prompt}\n\n` +
        `Return ONLY JSON:\n` +
        `{\n` +
        `  "mode": "answer" | "mutate",\n` +
        `  "assistantMessage": "what you did or the answer",\n` +
        `  "updates": [\n` +
        `    { "type": "text|textarea|image|url|color|list|object|section|page|theme|layout|delete", "id": "hero.title", "value": "...", "op": "set|delete|hide_section|show_section|add_page|remove_page" }\n` +
        `  ],\n` +
        `  "newPages": [\n` +
        `    { "key": "pricing", "label": "Pricing", "components": ["hero","pricing","faq","cta"], "content": { "heading": "...", "plans": [] } }\n` +
        `  ]\n` +
        `}\n` +
        `Rules:\n` +
        `- MEMORY: Treat the FULL conversation history as long-term project memory (like ChatGPT). Continue loops/follow-ups on the same element. When the user starts a SEPARATE request, switch cleanly.\n` +
        `- SECTION AWARENESS: Before editing, locate the section in SITE SECTION MAP. Every home block (hero, template body sections, features, split, gallery, CTA, form, blocks) is listed with its field ids.\n` +
        `- You can change every section, image, heading, and body text via editable IDs — prefer the USER TARGET when set.\n` +
        `- When the user says “this section” / “make it warmer” without a target, use the latest USER TARGET or the section implied by the last work-log op.\n` +
        `- Generative order: answer follow-ups in sequence (what they asked last, in context of what came before).\n` +
        `- For questions only → mode=answer and empty updates.\n` +
        `- If USER TARGET kind=section, scope ALL changes to that section (layout/copy/images inside it only).\n` +
        `- ALIGN / COLUMNS / GRID / “3/3 row” → layout updates ONLY, never swap images:\n` +
        `  { "type":"layout", "id":"layout.galleryColumns", "value":3 }, { "type":"layout", "id":"layout.galleryVariant", "value":"equal" }\n` +
        `  or layout.featureColumns / layout.blocksColumns.\n` +
        `- If UPLOADED IMAGES exist AND user wants a photo change, set image field values to the provided data URL / https URL.\n` +
        `- NEVER change media.* when the user only asked to align/arrange/layout.\n` +
        `- For copy/image/CTA changes → updates with exact editable ids.\n` +
        `- To change the hero/background image → { "type":"image", "id":"media.hero", "value":"<url or data-url>" }.\n` +
        `- To change the split-section photo (right column, NOT hero) → { "type":"image", "id":"media.split", "value":"<url or data-url>" }.\n` +
        `- To change a gallery/photo image → id like media.gallery.0 (indexes 0-5). Match the card caption from GALLERY CARD MAP (e.g. “Delivery card” → media.gallery.N for Delivery).\n` +
        `- NEVER update media.gallery.0 when the user named a different card (Delivery/Menu/Dining/etc.).\n` +
        `- To change an inner-page banner → { "type":"image", "id":"media.banner", "value":"<url or data-url>" }.\n` +
        `- To change page background color → { "type":"theme", "id":"theme.background", "value":"#0b1020" } (color or CSS gradient).\n` +
        `- To edit split section text → ids visual.split.title, visual.split.subtitle, visual.split.cta, etc.\n` +
        `- To edit feature cards → visual.features.items.0.title / .body (and title/subtitle).\n` +
        `- To edit CTA band / lead form → visual.cta.* / visual.form.*.\n` +
        `- NEVER put a section photo onto media.hero unless the user explicitly asks for hero/background.\n` +
        `- To hide a section → op hide_section and id like home.hero or section id from the map.\n` +
        `- To create a new page → fill newPages using components from the library; keep design DNA (same tone/structure).\n` +
        `- NEVER create pages from adjectives or quality goals (Modern, Responsive, Fast-loading, Brief Requirements).\n` +
        `- To DELETE / REMOVE a page → updates: [{ "type":"page", "id":"<exact page key from list>", "op":"remove_page" }]. Never remove "home".\n` +
        `- If user says "delete this page" use active page key "${activePageKey}" (unless it is home).\n` +
        `- theme.primary / accent for color upgrades.\n` +
        `- Prefer many small ID updates over inventing unknown ids.\n` +
        `- Use conversation history + work log so follow-ups stay consistent with earlier edits.\n`,
      config: {
        responseMimeType: "application/json",
        temperature: 0.35,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const parsed = parseJsonLoose(result.text ?? "") as Partial<AiUpdatePayload>;
    let payload = normalizePayload(parsed, activePageKey, prompt, config);

    // If images were uploaded but model forgot to apply them, force onto resolved target
    // (skip when this was a layout-only request)
    if (images?.length && payload.mode === "mutate" && !isLayoutIntent(prompt)) {
      const hasImageUpdate = payload.updates.some(
        (u) => u.type === "image" || /image|media|photo|src|logo/i.test(u.id)
      );
      if (!hasImageUpdate) {
        const imageId = resolveImg(prompt, target);
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
  } catch (err) {
    console.warn("website agent fallback", err);
    return heuristicAgent(prompt, activePageKey, config, knowledge, target, images);
  }
}

function normalizePayload(
  parsed: Partial<AiUpdatePayload>,
  activePageKey: string,
  prompt: string,
  config?: SiteConfig
): AiUpdatePayload {
  const mode = parsed.mode === "answer" ? "answer" : "mutate";
  let updates = Array.isArray(parsed.updates) ? (parsed.updates as ConfigUpdate[]) : [];
  const newPages = Array.isArray(parsed.newPages) ? parsed.newPages : [];

  // Normalize remove_page ids (label → key); block deleting home
  updates = updates.map((u) => {
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
  }).filter((u) => !(u.op === "remove_page" && (u.id === "home" || !u.id)));

  return {
    mode,
    assistantMessage:
      String(parsed.assistantMessage || "").trim() ||
      (mode === "answer"
        ? "I can update any editable field, hide sections, delete pages, or create new pages from the template components."
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

function heuristicAgent(
  prompt: string,
  activePageKey: string,
  config: SiteConfig,
  knowledge: TemplateKnowledge,
  target?: { id: string; kind?: string; label?: string } | null,
  images?: string[]
): AiUpdatePayload {
  const msg = prompt.toLowerCase();

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

  // Named gallery card without upload
  {
    const labels = galleryLabelsFor(config.media?.category || "default");
    const gIdx = resolveGalleryCardIndex(prompt, labels, target);
    if (
      gIdx != null &&
      /\b(image|photo|picture|card|replace|change|swap|update)\b/i.test(msg) &&
      !isLayoutIntent(prompt)
    ) {
      const imageId = `media.gallery.${gIdx}`;
      const value = pickStockImage(msg, config.media?.category);
      return {
        mode: "mutate",
        assistantMessage: `Updated the “${labels[gIdx] || "Gallery"}” card (${imageId}).`,
        updates: [{ type: "image", id: imageId, value, op: "set" }],
      };
    }
  }

  if (isLayoutIntent(msg)) {
    const updates = resolveLayoutUpdates(prompt, target);
    return {
      mode: "mutate",
      assistantMessage: `Aligned into a ${detectColumnCount(prompt)}-column layout without changing images.`,
      updates,
    };
  }

  // Targeted text edit
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

  const isQuestion =
    /^(what|why|how|when|where|who|which|explain|tell me)\b/i.test(prompt.trim()) &&
    !/\b(add|delete|remove|change|update|make|create|upgrade)\b/i.test(msg);

  if (isQuestion) {
    return {
      mode: "answer",
      assistantMessage:
        `This site is data-driven. I edit config by IDs (e.g. hero.title), can hide sections, delete pages, or assemble new pages from: ${knowledge.components
          .map((c) => c.id)
          .join(", ")}. Current pages: ${config.pages.map((p) => p.label).join(", ")}.`,
      updates: [],
    };
  }

  // Delete / remove page (before generic section delete)
  if (/\b(delete|remove|drop|get rid of)\b/i.test(prompt)) {
    let target = resolvePageToDelete(prompt, config.pages);
    if (!target && /\b(this|current)\s+page\b/i.test(prompt) && activePageKey !== "home") {
      const p = config.pages.find((x) => x.key === activePageKey);
      if (p) target = { key: p.key, label: p.label };
    }
    if (target && target.key !== "home") {
      return {
        mode: "mutate",
        assistantMessage: `Removed the “${target.label}” page.`,
        updates: [{ type: "page", id: target.key, op: "remove_page" }],
      };
    }
    if (/\bpage\b/i.test(msg) && !/\bsection\b/i.test(msg)) {
      return {
        mode: "answer",
        assistantMessage:
          `Tell me which page to delete (not Home). Current pages: ${config.pages
            .filter((p) => p.key !== "home")
            .map((p) => p.label)
            .join(", ") || "none"}.`,
        updates: [],
      };
    }
  }

  if (/\b(create|add)\b/.test(msg) && /\bpage\b/.test(msg)) {
    const nameMatch = prompt.match(/\b(?:page|for)\s+([A-Za-z][A-Za-z0-9 &\-]{1,40})/i);
    let label = nameMatch?.[1]?.replace(/\bpage\b/i, "").trim() || "New Page";
    if (/pricing/i.test(msg)) label = "Pricing";
    if (/faq/i.test(msg)) label = "FAQ";
    if (/team|about/i.test(msg)) label = /team/i.test(msg) ? "Team" : "About";
    if (/career/i.test(msg)) label = "Careers";
    if (/blog/i.test(msg)) label = "Blog";
    if (/doctor/i.test(msg)) label = "Doctors";
    if (/department|specialt/i.test(msg)) label = "Departments";
    if (/appointment|booking/i.test(msg)) label = "Appointments";
    // Reject quality-adjective page names
    if (/^(modern|responsive|fast|clean|beautiful)/i.test(label)) {
      return {
        mode: "answer",
        assistantMessage:
          "That sounds like a design quality, not a page. Try “Add an About page” or “Add a Doctors page”.",
        updates: [],
      };
    }
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
    const comps =
      /pricing/i.test(msg)
        ? ["hero", "pricing", "faq", "cta"]
        : /faq/i.test(msg)
          ? ["hero", "faq", "cta"]
          : /team|doctor/i.test(msg)
            ? ["hero", "team", "cta"]
            : ["hero", "services", "cta"];
    const assembled: Record<string, any> = { heading: label, blurb: `${label} for ${config.brandName}.` };
    for (const id of comps) {
      const bp = knowledge.components.find((c) => c.id === id);
      if (bp) Object.assign(assembled, bp.defaultContent);
    }
    return {
      mode: "mutate",
      assistantMessage: `Created “${label}” using template components: ${comps.join(", ")}.`,
      updates: [],
      newPages: [{ key, label, components: comps, content: assembled }],
    };
  }

  if (/\b(delete|remove|hide)\b/.test(msg) && /\bsection\b/.test(msg)) {
    const section = /hero/i.test(msg)
      ? "home.hero"
      : /testimonial/i.test(msg)
        ? "home.testimonials"
        : /service/i.test(msg)
          ? "home.services"
          : `${activePageKey}.hero`;
    return {
      mode: "mutate",
      assistantMessage: `Hid section ${section}. Template code unchanged — only config sectionState updated.`,
      updates: [{ type: "section", id: section, op: "hide_section", value: false }],
    };
  }

  // Image / background changes (pasted URL or keyword-matched stock photo)
  if (/\b(image|photo|picture|background|hero|banner|cover|split|gallery)\b/.test(msg)) {
    const urlMatch = prompt.match(
      /https?:\/\/[^\s"')]+\.(?:png|jpe?g|webp|gif|avif)(?:\?[^\s"')]*)?/i
    );
    const imageTarget = resolveImageTargetId(prompt, target, {
      galleryLabels: galleryLabelsFor(config.media?.category || "default"),
      mediaCategory: config.media?.category,
    });

    // Solid/gradient background color request
    const bgColor = detectBackgroundColor(msg);
    if (/\bbackground\b/.test(msg) && bgColor && !urlMatch && !UNSPLASH_KEYWORDS.some((k) => msg.includes(k))) {
      return {
        mode: "mutate",
        assistantMessage: `Set the page background to ${bgColor}.`,
        updates: [{ type: "theme", id: "theme.background", value: bgColor, op: "set" }],
      };
    }

    const value = urlMatch?.[0] || pickStockImage(msg, config.media?.category);
    return {
      mode: "mutate",
      assistantMessage: urlMatch
        ? `Updated ${imageTarget} to your image.`
        : `Updated ${imageTarget} with a matching stock photo.`,
      updates: [{ type: "image", id: imageTarget, value, op: "set" }],
    };
  }

  if (/\b(upgrade|premium|modern|blue|green|purple)\b/.test(msg) || /\bcolor\b/.test(msg)) {
    const accent = /\bblue\b/.test(msg)
      ? "#2563EB"
      : /\bgreen\b/.test(msg)
        ? "#059669"
        : /\bpurple\b/.test(msg)
          ? "#7C3AED"
          : config.accent;
    return {
      mode: "mutate",
      assistantMessage: `Updated theme accent to ${accent}.`,
      updates: [{ type: "color", id: "accent", value: accent, op: "set" }],
    };
  }

  // Default: try hero title update if "headline/title" mentioned
  if (/\b(title|headline|heading)\b/.test(msg)) {
    const quoted = prompt.match(/["“](.+?)["”]/);
    const value = quoted?.[1] || prompt.replace(/^.*?\bto\b/i, "").trim().slice(0, 80);
    return {
      mode: "mutate",
      assistantMessage: `Updated hero.title.`,
      updates: [{ type: "text", id: "hero.title", value, op: "set" }],
    };
  }

  return {
    mode: "mutate",
    assistantMessage:
      "Describe a specific field (e.g. change hero.title), hide a section, or create a page like “Add a Pricing page”.",
    updates: [],
  };
}

/** Keyword → curated Unsplash photo (static URLs so downloaded HTML still works). */
const STOCK_IMAGES: Record<string, string> = {
  beach: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
  ocean: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?auto=format&fit=crop&w=1600&q=80",
  mountain: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
  city: "https://images.unsplash.com/photo-1444723121867-7a241cacace9?auto=format&fit=crop&w=1600&q=80",
  office: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
  team: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80",
  food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80",
  restaurant: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
  tech: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80",
  medical: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80",
  fitness: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80",
  fashion: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1600&q=80",
  nature: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=80",
  night: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1600&q=80",
};

export const UNSPLASH_KEYWORDS = Object.keys(STOCK_IMAGES);

function pickStockImage(msg: string, category?: string): string {
  const foodPool = [
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
  ];
  // Card-specific food cues
  if (/\bdelivery\b/.test(msg))
    return "https://images.unsplash.com/photo-1576867757603-05b134ebc379?auto=format&fit=crop&w=1600&q=80";
  if (/\bmenu\b/.test(msg))
    return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1600&q=80";
  if (/\bdining\b/.test(msg))
    return "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80";
  if (/\b(dish|kitchen|chef)\b/.test(msg))
    return foodPool[Math.floor(Math.random() * foodPool.length)];

  for (const k of UNSPLASH_KEYWORDS) {
    if (msg.includes(k)) return STOCK_IMAGES[k];
  }
  const byCategory: Record<string, string> = {
    healthcare: STOCK_IMAGES.medical,
    dental: STOCK_IMAGES.medical,
    agency: STOCK_IMAGES.office,
    ecommerce: STOCK_IMAGES.fashion,
    food: foodPool[Math.floor(Math.random() * foodPool.length)],
    realestate: STOCK_IMAGES.city,
    education: STOCK_IMAGES.team,
  };
  return byCategory[category || ""] || STOCK_IMAGES.office;
}

function detectBackgroundColor(msg: string): string | null {
  const named: Record<string, string> = {
    black: "#0b0e14",
    white: "#ffffff",
    "dark": "#0b1020",
    navy: "#0b1e3f",
    blue: "#0b1e3f",
    green: "#06251b",
    purple: "#1a0b2e",
    gray: "#111318",
    grey: "#111318",
    cream: "#faf6ef",
    beige: "#f4ecdf",
  };
  const hex = msg.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  if (hex) return hex[0];
  for (const [name, val] of Object.entries(named)) {
    if (msg.includes(name)) return val;
  }
  return null;
}

/** Merge newPages from agent into config structure helpers */
export function materializeNewPages(
  config: SiteConfig,
  knowledge: TemplateKnowledge,
  newPages: NonNullable<AiUpdatePayload["newPages"]>
): SiteConfig {
  let next = { ...config, pages: [...config.pages], customPages: { ...(config.customPages || {}) }, content: structuredClone(config.content) };
  for (const np of newPages) {
    const key = np.key || "page";
    if (key === "home") continue;
    if (!next.pages.some((p) => p.key === key)) {
      next.pages.push({ key, label: np.label, slug: slugForPage(key) });
    }
    const content: Record<string, any> = { ...(np.content || {}) };
    for (const comp of np.components || []) {
      const bp = knowledge.components.find((c) => c.id === comp);
      if (bp && content[comp] == null) {
        Object.assign(content, bp.defaultContent);
      }
    }
    next.customPages![key] = {
      label: np.label,
      slug: slugForPage(key),
      components: np.components,
      content,
    };
    next.content[key] = content;
  }
  next.updatedAt = Date.now();
  return next;
}
