// lib/template-ai/ingest/from-zip.ts — Phase 1: ZIP/HTML → AI-ready package
import JSZip from "jszip";
import type {
  AiReadyPackage,
  EditableField,
  SectionDef,
  SiteConfig,
  TemplateManifest,
  TemplateKnowledge,
  ComponentBlueprint,
  ComponentVariant,
  ContentMapEntry,
  ContentSchemaField,
  DesignSystem,
  KnowledgeGraphEdge,
  LayoutRules,
  ResponsiveRule,
  ThemeTokens,
} from "../types";
import { parseHtmlDocument, pagesFromParsed, type ParsedPage } from "./parse-html";
import { bindParsedPage, mergeContent } from "./bind";

const DEFAULT_ACCENT = "#2563EB";
const DEFAULT_BRAND = "Your Brand";

export async function ingestZipBuffer(
  buffer: ArrayBuffer | Buffer,
  opts?: { brandName?: string; accent?: string; templateName?: string }
): Promise<AiReadyPackage> {
  const zip = await JSZip.loadAsync(buffer);
  const htmlFiles: { path: string; html: string }[] = [];
  const assets: Record<string, string> = {};

  const entries = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  for (const path of entries) {
    const file = zip.files[path];
    const lower = path.toLowerCase();
    // Skip macOS junk / node_modules
    if (path.includes("__MACOSX") || path.includes("node_modules")) continue;

    if (/\.html?$/i.test(lower)) {
      const html = await file.async("string");
      htmlFiles.push({ path, html });
    } else if (/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(lower)) {
      const b64 = await file.async("base64");
      const mime = mimeFor(lower);
      assets[normalizeAssetPath(path)] = `data:${mime};base64,${b64}`;
    } else if (/\.css$/i.test(lower)) {
      const css = await file.async("string");
      assets[normalizeAssetPath(path)] = css;
    }
  }

  if (!htmlFiles.length) {
    throw new Error("No HTML files found in ZIP");
  }

  // Prefer root-level HTML; sort index first
  htmlFiles.sort((a, b) => {
    const aIdx = /index\.html?$/i.test(a.path) ? 0 : 1;
    const bIdx = /index\.html?$/i.test(b.path) ? 0 : 1;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.path.localeCompare(b.path);
  });

  return buildPackageFromHtmlFiles(htmlFiles, {
    ...opts,
    assets,
    source: "zip",
  });
}

export async function ingestHtmlString(
  html: string,
  fileName = "index.html",
  opts?: { brandName?: string; accent?: string; templateName?: string }
): Promise<AiReadyPackage> {
  return buildPackageFromHtmlFiles([{ path: fileName, html }], {
    ...opts,
    assets: {},
    source: "html",
  });
}

function buildPackageFromHtmlFiles(
  htmlFiles: { path: string; html: string }[],
  opts: {
    brandName?: string;
    accent?: string;
    templateName?: string;
    assets: Record<string, string>;
    source: "zip" | "html";
  }
): AiReadyPackage {
  const brandName = opts.brandName || DEFAULT_BRAND;
  const accent = opts.accent || DEFAULT_ACCENT;
  const templateId = `ingested-${Date.now().toString(36)}`;
  const templateName = opts.templateName || "Uploaded Template";

  const parsedPages: ParsedPage[] = [];
  for (const f of htmlFiles.slice(0, 12)) {
    // Rewrite relative image srcs to data URLs when available
    let html = f.html;
    html = rewriteAssetRefs(html, opts.assets, f.path);
    parsedPages.push(parseHtmlDocument({ html, fileName: f.path, templateId }));
  }

  const boundPages: Record<string, string> = {};
  const contentParts: Record<string, any>[] = [];
  const allFields: EditableField[] = [];
  const allSections: SectionDef[] = [];
  const bindings: Record<string, string> = {};

  for (const page of parsedPages) {
    const { boundHtml, content, bindings: pageBindings } = bindParsedPage(page);
    // Inject linked CSS as <style> if relative stylesheet exists in assets
    boundPages[page.slug] = injectCssAssets(boundHtml, opts.assets);
    contentParts.push(content);
    allFields.push(...page.editables.map((e) => e.field));
    allSections.push(...page.sections);
    Object.assign(bindings, pageBindings);
  }

  // Dedupe fields
  const seen = new Set<string>();
  const editableFields = allFields.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });

  const pages = pagesFromParsed(parsedPages);
  const content = mergeContent(...contentParts);

  // Promote first hero image to media.hero when present
  let mediaHero = "";
  const firstImage = editableFields.find((f) => f.type === "image");
  if (firstImage) {
    const parts = firstImage.path.split(".");
    let cur: any = content;
    for (const p of parts) cur = cur?.[p];
    if (typeof cur === "string") mediaHero = cur;
  }

  const manifest: TemplateManifest = {
    version: 1,
    templateId,
    templateName,
    category: "uploaded",
    brandBinding: "{{brandName}}",
    accentBinding: "{{accent}}",
    pages,
    sections: allSections,
    editableFields,
    bindings: {
      ...bindings,
      brandName: "{{brandName}}",
      accent: "{{accent}}",
      "media.hero": "{{media.hero}}",
    },
    createdAt: Date.now(),
  };

  // Register media.hero as editable if we found an image
  if (mediaHero && !editableFields.some((f) => f.id === "media.hero")) {
    manifest.editableFields.push({
      id: "media.hero",
      type: "image",
      label: "Hero / background image",
      sectionId: `${pages[0]?.key || "home"}.media`,
      pageKey: pages[0]?.key || "home",
      path: "media.hero",
    });
  }

  const config: SiteConfig = {
    brandName,
    accent,
    theme: { primary: accent },
    media: {
      hero: mediaHero || "",
      gallery: editableFields
        .filter((f) => f.type === "image")
        .slice(0, 6)
        .map((f) => {
          const parts = f.path.split(".");
          let cur: any = content;
          for (const p of parts) cur = cur?.[p];
          return typeof cur === "string" ? cur : "";
        })
        .filter(Boolean),
      category: "default",
    },
    pages,
    content,
    sectionState: {},
    customPages: {},
    updatedAt: Date.now(),
  };

  const knowledge = buildIngestKnowledge(templateId, manifest, accent, config);

  return {
    manifest,
    config,
    knowledge,
    boundPages,
    assets: opts.assets,
    source: opts.source,
  };
}

function buildIngestKnowledge(
  templateId: string,
  manifest: TemplateManifest,
  accent: string,
  config: SiteConfig
): TemplateKnowledge {
  const designSystem: DesignSystem = {
    colors: { primary: accent, text: "#1a1a1a", muted: "#5b6472", background: "#ffffff" },
    typography: { display: "DM Sans", body: "DM Sans", mono: "ui-monospace" },
    spacing: { section: "72px", wrap: "28px" },
    radius: "12px",
    button: { radius: "12px", weight: "700" },
  };

  const components: ComponentBlueprint[] = [
    {
      id: "hero",
      name: "Hero",
      description: "Opening section from uploaded template",
      fields: [
        { id: "title", type: "text", label: "Title" },
        { id: "subtitle", type: "textarea", label: "Subtitle" },
        { id: "ctaText", type: "text", label: "CTA" },
      ],
      defaultContent: { title: "Welcome", subtitle: "Built from your template.", ctaText: "Get started" },
    },
    {
      id: "services",
      name: "Services",
      description: "Feature / service cards",
      fields: [{ id: "items", type: "list", label: "Items" }],
      defaultContent: { items: [{ name: "Service", desc: "Description" }] },
    },
    {
      id: "cta",
      name: "CTA",
      description: "Call to action",
      fields: [
        { id: "title", type: "text", label: "Title" },
        { id: "button", type: "text", label: "Button" },
      ],
      defaultContent: { title: "Ready?", button: "Contact" },
    },
    {
      id: "faq",
      name: "FAQ",
      description: "Questions",
      fields: [{ id: "items", type: "list", label: "Items" }],
      defaultContent: { items: [{ q: "Question?", a: "Answer." }] },
    },
    {
      id: "pricing",
      name: "Pricing",
      description: "Pricing tiers",
      fields: [{ id: "plans", type: "list", label: "Plans" }],
      defaultContent: { plans: [{ name: "Starter", price: "$0", blurb: "Start free", cta: "Start" }] },
    },
    {
      id: "team",
      name: "Team",
      description: "People grid",
      fields: [{ id: "members", type: "list", label: "Members" }],
      defaultContent: { members: [{ name: "Alex", role: "Lead", bio: "Expert" }] },
    },
  ];

  const componentVariants: ComponentVariant[] = [
    { componentId: "hero", variantId: "hero-fullbleed", name: "Full-bleed", description: "Photo hero" },
    { componentId: "hero", variantId: "hero-split", name: "Split", description: "Copy + media" },
    { componentId: "hero", variantId: "hero-centered", name: "Centered", description: "Centered stack" },
    { componentId: "services", variantId: "services-grid-3", name: "3-col", description: "Card grid" },
    { componentId: "cta", variantId: "cta-band", name: "Band", description: "Accent CTA" },
  ];

  const layoutRules: LayoutRules = {
    wrapMaxWidth: "1100px",
    columns: 12,
    gutters: "24px",
    breakpoints: { mobile: "640px", tablet: "860px", desktop: "1100px" },
    alignment: "stretch",
  };

  const themeTokens: ThemeTokens = {
    primary: accent,
    secondary: accent,
    neutrals: { bg: "#fff", surface: "#f7f8fa", border: "#e8ecf2", text: "#1a1a1a", muted: "#5b6472" },
    fontScale: { xs: "12px", sm: "14px", md: "16px", lg: "20px", xl: "28px", display: "clamp(32px,5vw,52px)" },
    iconSet: ["spark", "check", "users", "star"],
  };

  const responsiveRules: ResponsiveRule[] = manifest.sections.slice(0, 12).map((s) => ({
    id: s.id,
    mobile: "show",
    tablet: "show",
    desktop: "show",
  }));

  const contentSchema: ContentSchemaField[] = manifest.editableFields.map((f) => ({
    id: f.id,
    type: f.type,
    label: f.label,
    required: /title|heading/i.test(f.id),
    maxLength: f.maxLength,
    pageKey: f.pageKey,
  }));

  const knowledgeGraph: KnowledgeGraphEdge[] = [];
  for (const page of manifest.pages) {
    const secs = manifest.sections.filter((s) => s.pageKey === page.key).sort((a, b) => a.order - b.order);
    for (let i = 0; i < secs.length - 1; i++) {
      knowledgeGraph.push({ from: secs[i].id, to: secs[i + 1].id, relation: "follows" });
    }
  }

  const contentMap: ContentMapEntry[] = manifest.editableFields.map((f) => ({
    id: f.id,
    kind: f.type === "image" ? "image" : f.type === "url" ? "url" : "text",
    pageKey: f.pageKey,
    preview: "",
  }));
  if (config.media?.hero) {
    contentMap.push({ id: "media.hero", kind: "image", pageKey: "home", preview: config.media.hero.slice(0, 80) });
  }

  return {
    templateId,
    designSystem,
    components,
    pageBlueprints: manifest.pages.map((p) => ({
      key: p.key,
      label: p.label,
      sections: manifest.sections.filter((s) => s.pageKey === p.key).map((s) => s.component),
    })),
    contentSchemaIds: manifest.editableFields.map((f) => f.id),
    componentVariants,
    layoutRules,
    themeTokens,
    responsiveRules,
    contentSchema,
    knowledgeGraph,
    contentMap,
  };
}

function mimeFor(path: string): string {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

function normalizeAssetPath(path: string): string {
  return path.replace(/^\.\//, "").replace(/\\/g, "/");
}

function rewriteAssetRefs(html: string, assets: Record<string, string>, htmlPath: string): string {
  const dir = htmlPath.includes("/") ? htmlPath.replace(/\/[^/]+$/, "/") : "";
  return html.replace(/(src|href)=["']([^"']+)["']/gi, (full, attr, ref) => {
    if (/^(https?:|data:|mailto:|#)/i.test(ref)) return full;
    const candidates = [
      normalizeAssetPath(ref),
      normalizeAssetPath(dir + ref),
      normalizeAssetPath(ref.replace(/^\.\//, "")),
    ];
    for (const c of candidates) {
      if (assets[c] && assets[c].startsWith("data:")) {
        return `${attr}="${assets[c]}"`;
      }
    }
    return full;
  });
}

function injectCssAssets(html: string, assets: Record<string, string>): string {
  const cssChunks: string[] = [];
  for (const [path, val] of Object.entries(assets)) {
    if (path.toLowerCase().endsWith(".css") && !val.startsWith("data:")) {
      cssChunks.push(val);
    }
  }
  if (!cssChunks.length) return html;
  const style = `<style data-ai-injected="1">\n${cssChunks.join("\n")}\n</style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${style}</head>`);
  return style + html;
}
