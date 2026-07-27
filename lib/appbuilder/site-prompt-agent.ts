// lib/appbuilder/site-prompt-agent.ts — freeform AI prompt → site mutations or answers
import { GoogleGenAI } from "@google/genai";
import { generateContentResilient, parseJsonLoose } from "@/lib/gemini";
import type { SiteWidget } from "@/lib/site-widgets";
import { widgetsFromInstruction } from "@/lib/site-widgets";

export type PromptAgentResult = {
  mode: "answer" | "mutate";
  assistantMessage: string;
  /** Deep-merge into site copy */
  copyUpdates: Record<string, any>;
  /** Dot paths or top-level keys to remove from copy */
  removeKeys: string[];
  /** Page keys to delete */
  deletePageKeys: string[];
  /** Widgets to append on a page */
  addWidgets: { pageKey: string; widgets: SiteWidget[] }[];
  /** Clear stored widgets on a page */
  clearWidgetsOn: string[];
  /** Raw HTML blocks to inject on a page (sections/buttons/etc.) */
  htmlBlocks: {
    pageKey: string;
    action: "append" | "prepend" | "replace";
    html: string;
    label?: string;
  }[];
  /** Clear previous htmlBlocks for a page */
  clearHtmlBlocksOn: string[];
  targetPageKey?: string;
};

const AGENT_SCHEMA = `{
  "mode": "answer" | "mutate",
  "assistantMessage": "short clear reply to the user",
  "targetPageKey": "home or other page key, optional",
  "copyUpdates": { "any": "partial JSON to deep-merge into site copy" },
  "removeKeys": ["optional top-level keys or page-scoped keys to delete from copy"],
  "deletePageKeys": ["page keys to remove entirely"],
  "clearWidgetsOn": ["page keys whose injected forms/CTAs should be cleared"],
  "addWidgets": [{
    "pageKey": "home",
    "widgets": [{ "type": "lead-form|cta-band", "...": "fields per type" }]
  }],
  "clearHtmlBlocksOn": ["page keys"],
  "htmlBlocks": [{
    "pageKey": "home",
    "action": "append|prepend|replace",
    "label": "optional section name",
    "html": "<section class=\\"wrap\\">...</section> safe HTML snippet only, no script tags"
  }]
}`;

function deepMerge(base: any, patch: any): any {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(patch)) return patch;
  if (typeof patch !== "object") return patch;
  if (typeof base !== "object" || base === null || Array.isArray(base)) return patch;
  const out: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = k in base ? deepMerge(base[k], v) : v;
  }
  return out;
}

export function applyCopyUpdates(
  copy: Record<string, any>,
  updates: Record<string, any>,
  removeKeys: string[]
): Record<string, any> {
  let next = deepMerge(copy, updates || {});
  for (const key of removeKeys || []) {
    if (!key) continue;
    if (key.includes(".")) {
      const parts = key.split(".");
      let cur: any = next;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur?.[parts[i]]) {
          cur = null;
          break;
        }
        cur = cur[parts[i]];
      }
      if (cur && typeof cur === "object") delete cur[parts[parts.length - 1]];
    } else {
      const { [key]: _, ...rest } = next;
      next = rest;
    }
  }
  return next;
}

export function applyHtmlBlocksToCopy(
  copy: Record<string, any>,
  blocks: PromptAgentResult["htmlBlocks"],
  clearOn: string[]
): Record<string, any> {
  const prev = { ...(copy.__htmlBlocks || {}) } as Record<string, any[]>;
  for (const key of clearOn || []) {
    prev[key] = [];
  }
  for (const b of blocks || []) {
    if (!b?.pageKey || !b.html) continue;
    const safe = String(b.html)
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+=(["']).*?\1/gi, "");
    const list = Array.isArray(prev[b.pageKey]) ? [...prev[b.pageKey]] : [];
    if (b.action === "replace") {
      prev[b.pageKey] = [{ action: "append", html: safe, label: b.label }];
    } else if (b.action === "prepend") {
      prev[b.pageKey] = [{ action: "prepend", html: safe, label: b.label }, ...list];
    } else {
      prev[b.pageKey] = [...list, { action: "append", html: safe, label: b.label }];
    }
  }
  return { ...copy, __htmlBlocks: prev };
}

export function applyWidgetOps(
  copy: Record<string, any>,
  addWidgets: PromptAgentResult["addWidgets"],
  clearOn: string[]
): Record<string, any> {
  const prev = { ...(copy.__widgets || {}) } as Record<string, SiteWidget[]>;
  for (const key of clearOn || []) prev[key] = [];
  for (const entry of addWidgets || []) {
    if (!entry?.pageKey || !Array.isArray(entry.widgets)) continue;
    const existing = Array.isArray(prev[entry.pageKey]) ? prev[entry.pageKey] : [];
    prev[entry.pageKey] = [...existing, ...entry.widgets];
  }
  return { ...copy, __widgets: prev };
}

function heuristicFallback(
  instruction: string,
  pageKey: string
): PromptAgentResult {
  const msg = instruction.toLowerCase();
  const isQuestion =
    /^(what|why|how|when|where|who|which|can you|could you|explain|tell me)\b/i.test(
      instruction.trim()
    ) && !/\b(add|delete|remove|change|update|make|upgrade|replace)\b/i.test(msg);

  if (isQuestion) {
    return {
      mode: "answer",
      assistantMessage:
        "I can edit this site for you — ask me to change copy, add/remove sections or buttons, upgrade the look, or add pages. Example: “Delete the insurance form on home” or “Add a blue Book Now button under the hero”.",
      copyUpdates: {},
      removeKeys: [],
      deletePageKeys: [],
      addWidgets: [],
      clearWidgetsOn: [],
      htmlBlocks: [],
      clearHtmlBlocksOn: [],
      targetPageKey: pageKey,
    };
  }

  const widgets = widgetsFromInstruction(instruction);
  const wantsDelete =
    /\b(delete|remove|clear|get rid of)\b/.test(msg) &&
    /\b(form|section|cta|banner|widget|button)\b/.test(msg);

  if (wantsDelete) {
    return {
      mode: "mutate",
      assistantMessage: `Removed injected forms/CTAs on “${pageKey}”.`,
      copyUpdates: {},
      removeKeys: [],
      deletePageKeys: [],
      addWidgets: [],
      clearWidgetsOn: [pageKey],
      htmlBlocks: [],
      clearHtmlBlocksOn: [pageKey],
      targetPageKey: pageKey,
    };
  }

  if (widgets.length) {
    return {
      mode: "mutate",
      assistantMessage: `Applied your request on “${pageKey}” (added ${widgets
        .map((w) => w.type)
        .join(", ")}).`,
      copyUpdates: {},
      removeKeys: [],
      deletePageKeys: [],
      addWidgets: [{ pageKey, widgets }],
      clearWidgetsOn: [],
      htmlBlocks: [],
      clearHtmlBlocksOn: [],
      targetPageKey: pageKey,
    };
  }

  // Generic HTML block for add section/button
  if (/\b(add|create|insert|put)\b/.test(msg) && /\b(section|button|banner|block)\b/.test(msg)) {
    const isButton = /\bbutton\b/.test(msg);
    const html = isButton
      ? `<div class="wrap" style="padding:28px 0"><a class="btn" href="contact.html">Get started</a></div>`
      : `<section class="wrap" style="padding:48px 0"><div class="eyebrow">New</div><h2>New section</h2><p class="lead">Updated from your prompt: ${instruction
          .slice(0, 160)
          .replace(/</g, "")}</p><div style="margin-top:18px"><a class="btn" href="contact.html">Learn more</a></div></section>`;
    return {
      mode: "mutate",
      assistantMessage: `Added a ${isButton ? "button" : "section"} on “${pageKey}”.`,
      copyUpdates: {},
      removeKeys: [],
      deletePageKeys: [],
      addWidgets: [],
      clearWidgetsOn: [],
      htmlBlocks: [{ pageKey, action: "append", html, label: "Prompt addition" }],
      clearHtmlBlocksOn: [],
      targetPageKey: pageKey,
    };
  }

  return {
    mode: "mutate",
    assistantMessage: `I'll apply “${instruction.slice(0, 80)}” to the current page copy.`,
    copyUpdates: {},
    removeKeys: [],
    deletePageKeys: [],
    addWidgets: [],
    clearWidgetsOn: [],
    htmlBlocks: [],
    clearHtmlBlocksOn: [],
    targetPageKey: pageKey,
    // signal caller to also regenerate page copy with instruction
  };
}

export async function runSitePromptAgent(args: {
  instruction: string;
  brandName: string;
  idea: string;
  pageKey: string;
  pages: { key: string; label: string }[];
  copy: Record<string, any>;
  accent: string;
}): Promise<PromptAgentResult & { regenerateCopy: boolean }> {
  const pageList = args.pages.map((p) => `${p.key} (${p.label})`).join(", ");
  const copySlice = JSON.stringify(args.copy).slice(0, 9000);

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const result = await generateContentResilient(ai, {
      contents:
        `You are the in-studio website co-pilot for "${args.brandName}".\n` +
        `The user can ask ANYTHING: questions, delete sections, upgrade design, add buttons/sections/forms, change headlines, tone, CTAs, remove pages, etc.\n` +
        `Brand idea/context:\n${(args.idea || "").slice(0, 1500)}\n` +
        `Current page being edited: ${args.pageKey}\n` +
        `Available pages: ${pageList}\n` +
        `Accent color: ${args.accent}\n` +
        `User prompt:\n${args.instruction}\n\n` +
        `Current site copy JSON (truncated):\n${copySlice}\n\n` +
        `Return ONLY JSON matching this schema:\n${AGENT_SCHEMA}\n` +
        `Rules:\n` +
        `- mode=answer for pure questions with no site change.\n` +
        `- mode=mutate when the site should change.\n` +
        `- Prefer copyUpdates for text/tone/CTA/headline changes.\n` +
        `- Use htmlBlocks for new visual sections/buttons not in the schema.\n` +
        `- Use clearWidgetsOn / clearHtmlBlocksOn when deleting injected forms/sections.\n` +
        `- Use deletePageKeys only when user clearly asks to remove a page.\n` +
        `- html must be safe semantic HTML (section/div/a/button/form/input/h2/p). No scripts.\n` +
        `- assistantMessage must confirm what you did or answer clearly.`,
      config: {
        responseMimeType: "application/json",
        temperature: 0.35,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const parsed = parseJsonLoose(result.text ?? "") as Partial<PromptAgentResult>;
    const mode = parsed.mode === "answer" ? "answer" : "mutate";
    const copyUpdates =
      parsed.copyUpdates && typeof parsed.copyUpdates === "object" ? parsed.copyUpdates : {};
    const hasStructural =
      Object.keys(copyUpdates).length > 0 ||
      (parsed.removeKeys || []).length > 0 ||
      (parsed.deletePageKeys || []).length > 0 ||
      (parsed.addWidgets || []).length > 0 ||
      (parsed.clearWidgetsOn || []).length > 0 ||
      (parsed.htmlBlocks || []).length > 0 ||
      (parsed.clearHtmlBlocksOn || []).length > 0;

    // If mutate but empty patches, ask caller to regenerate page copy with the instruction
    const regenerateCopy = mode === "mutate" && !hasStructural;

    return {
      mode,
      assistantMessage:
        String(parsed.assistantMessage || "").trim() ||
        (mode === "answer" ? "Here’s what I can help with on your site." : "Updated the site."),
      copyUpdates,
      removeKeys: Array.isArray(parsed.removeKeys) ? parsed.removeKeys.map(String) : [],
      deletePageKeys: Array.isArray(parsed.deletePageKeys)
        ? parsed.deletePageKeys.map(String)
        : [],
      addWidgets: Array.isArray(parsed.addWidgets) ? (parsed.addWidgets as any) : [],
      clearWidgetsOn: Array.isArray(parsed.clearWidgetsOn)
        ? parsed.clearWidgetsOn.map(String)
        : [],
      htmlBlocks: Array.isArray(parsed.htmlBlocks) ? (parsed.htmlBlocks as any) : [],
      clearHtmlBlocksOn: Array.isArray(parsed.clearHtmlBlocksOn)
        ? parsed.clearHtmlBlocksOn.map(String)
        : [],
      targetPageKey: parsed.targetPageKey || args.pageKey,
      regenerateCopy,
    };
  } catch (err) {
    console.warn("site prompt agent fallback", err);
    const fb = heuristicFallback(args.instruction, args.pageKey);
    return {
      ...fb,
      regenerateCopy: fb.mode === "mutate" && !fb.htmlBlocks.length && !fb.addWidgets.length,
    };
  }
}
