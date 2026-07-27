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
import { listEditableCatalog } from "./config";
import { slugForPage } from "@/lib/page-designs";

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
}): Promise<AiUpdatePayload> {
  const { prompt, config, manifest, knowledge, activePageKey, idea } = args;
  const catalog = listEditableCatalog(manifest);
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

  const contentPreview = JSON.stringify(config.content).slice(0, 8000);

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
        `Editable IDs (use these exact ids):\n${catalog}\n\n` +
        `Reusable components for NEW pages:\n${components}\n\n` +
        (variants ? `Component variants (design DNA):\n${variants}\n\n` : "") +
        (contentKeys ? `Content map keys: ${contentKeys}\n\n` : "") +
        `Current config.content (truncated):\n${contentPreview}\n\n` +
        `User prompt:\n${prompt}\n\n` +
        `Return ONLY JSON:\n` +
        `{\n` +
        `  "mode": "answer" | "mutate",\n` +
        `  "assistantMessage": "what you did or the answer",\n` +
        `  "updates": [\n` +
        `    { "type": "text|textarea|image|url|color|list|object|section|page|theme|delete", "id": "hero.title", "value": "...", "op": "set|delete|hide_section|show_section|add_page|remove_page" }\n` +
        `  ],\n` +
        `  "newPages": [\n` +
        `    { "key": "pricing", "label": "Pricing", "components": ["hero","pricing","faq","cta"], "content": { "heading": "...", "plans": [] } }\n` +
        `  ]\n` +
        `}\n` +
        `Rules:\n` +
        `- For questions only → mode=answer and empty updates.\n` +
        `- For copy/image/CTA changes → updates with exact editable ids.\n` +
        `- To change the hero/background image → { "type":"image", "id":"media.hero", "value":"<https image url>" }.\n` +
        `- To change a gallery/photo image → id like media.gallery.0 (indexes 0-5).\n` +
        `- Image values MUST be valid https image URLs. Prefer Unsplash format: https://images.unsplash.com/photo-XXXX?auto=format&fit=crop&w=1600&q=80 (use a real photo id relevant to the request).\n` +
        `- To change page background color → { "type":"theme", "id":"theme.background", "value":"#0b1020" } (color or CSS gradient).\n` +
        `- To hide a section → op hide_section and id like home.hero or section id.\n` +
        `- To create a new page → fill newPages using components from the library; keep design DNA (same tone/structure).\n` +
        `- To remove a page → op remove_page, id = page key.\n` +
        `- theme.primary / accent for color upgrades.\n` +
        `- Prefer many small ID updates over inventing unknown ids.\n`,
      config: {
        responseMimeType: "application/json",
        temperature: 0.35,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const parsed = parseJsonLoose(result.text ?? "") as Partial<AiUpdatePayload>;
    return normalizePayload(parsed, activePageKey, prompt);
  } catch (err) {
    console.warn("website agent fallback", err);
    return heuristicAgent(prompt, activePageKey, config, knowledge);
  }
}

function normalizePayload(
  parsed: Partial<AiUpdatePayload>,
  activePageKey: string,
  prompt: string
): AiUpdatePayload {
  const mode = parsed.mode === "answer" ? "answer" : "mutate";
  const updates = Array.isArray(parsed.updates) ? (parsed.updates as ConfigUpdate[]) : [];
  const newPages = Array.isArray(parsed.newPages) ? parsed.newPages : [];
  return {
    mode,
    assistantMessage:
      String(parsed.assistantMessage || "").trim() ||
      (mode === "answer"
        ? "I can update any editable field, hide sections, or create new pages from the template components."
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

function heuristicAgent(
  prompt: string,
  activePageKey: string,
  config: SiteConfig,
  knowledge: TemplateKnowledge
): AiUpdatePayload {
  const msg = prompt.toLowerCase();
  const isQuestion =
    /^(what|why|how|when|where|who|which|explain|tell me)\b/i.test(prompt.trim()) &&
    !/\b(add|delete|remove|change|update|make|create|upgrade)\b/i.test(msg);

  if (isQuestion) {
    return {
      mode: "answer",
      assistantMessage:
        `This site is data-driven. I edit config by IDs (e.g. hero.title), can hide sections, or assemble new pages from: ${knowledge.components
          .map((c) => c.id)
          .join(", ")}.`,
      updates: [],
    };
  }

  if (/\b(create|add)\b/.test(msg) && /\bpage\b/.test(msg)) {
    const nameMatch = prompt.match(/\b(?:page|for)\s+([A-Za-z][A-Za-z0-9 &\-]{1,40})/i);
    let label = nameMatch?.[1]?.replace(/\bpage\b/i, "").trim() || "New Page";
    if (/pricing/i.test(msg)) label = "Pricing";
    if (/faq/i.test(msg)) label = "FAQ";
    if (/team|about/i.test(msg)) label = /team/i.test(msg) ? "Team" : "About";
    if (/career/i.test(msg)) label = "Careers";
    if (/blog/i.test(msg)) label = "Blog";
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
    const comps =
      /pricing/i.test(msg)
        ? ["hero", "pricing", "faq", "cta"]
        : /faq/i.test(msg)
          ? ["hero", "faq", "cta"]
          : /team/i.test(msg)
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
  if (/\b(image|photo|picture|background|hero|banner|cover)\b/.test(msg)) {
    const urlMatch = prompt.match(
      /https?:\/\/[^\s"')]+\.(?:png|jpe?g|webp|gif|avif)(?:\?[^\s"')]*)?/i
    );
    const target =
      /\bgallery\b|\bphoto\b|\bgrid\b/.test(msg) && !/\bhero|background|banner|cover\b/.test(msg)
        ? "media.gallery.0"
        : "media.hero";

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
        ? `Updated ${target} to your image.`
        : `Updated ${target} with a matching stock photo.`,
      updates: [{ type: "image", id: target, value, op: "set" }],
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
  for (const k of UNSPLASH_KEYWORDS) {
    if (msg.includes(k)) return STOCK_IMAGES[k];
  }
  const byCategory: Record<string, string> = {
    healthcare: STOCK_IMAGES.medical,
    dental: STOCK_IMAGES.medical,
    agency: STOCK_IMAGES.office,
    ecommerce: STOCK_IMAGES.fashion,
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
