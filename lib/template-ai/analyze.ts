// lib/template-ai/analyze.ts — Part 1: make template AI-ready (manifest + default config + knowledge)
import type { Template, PageDef } from "@/lib/types";
import { getPageDesign } from "@/lib/page-designs";
import { resolveMediaTheme } from "@/lib/site-media";
import type {
  EditableField,
  SectionDef,
  SiteConfig,
  TemplateKnowledge,
  TemplateManifest,
  ComponentBlueprint,
  ComponentVariant,
  ContentMapEntry,
  ContentSchemaField,
  DesignSystem,
  KnowledgeGraphEdge,
  LayoutRules,
  ResponsiveRule,
  ThemeTokens,
} from "./types";

/** Parse a JSON-ish schema string into a nested object of empty placeholders. */
export function schemaStringToShape(schema: string): any {
  try {
    // Schemas often contain "...exactly N items]" comments — strip those
    const cleaned = schema
      .replace(/\.\.\.exactly\s+\d+\s+items?/gi, "")
      .replace(/,\s*]/g, "}")
      .replace(/,\s*]/g, "]");
    return JSON.parse(cleaned);
  } catch {
    try {
      // Fallback: extract keys with regex for flat-ish schemas
      return { _raw: true };
    } catch {
      return {};
    }
  }
}

function walkFields(
  value: any,
  pageKey: string,
  sectionId: string,
  path: string,
  fields: EditableField[],
  sections: Map<string, SectionDef>
): void {
  if (value === null || value === undefined) return;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const id = path;
    const leaf = path.split(".").pop() || path;
    const type =
      /image|photo|avatar|logo|src/i.test(leaf)
        ? "image"
        : /url|href|link/i.test(leaf)
          ? "url"
          : /color|accent/i.test(leaf)
            ? "color"
            : String(value).length > 80 || /blurb|subtitle|bio|desc|body|description/i.test(leaf)
              ? "textarea"
              : "text";
    fields.push({
      id,
      type,
      label: leaf.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
      sectionId,
      pageKey,
      maxLength: type === "text" ? 80 : type === "textarea" ? 400 : undefined,
      path,
    });
    const sec = sections.get(sectionId);
    if (sec && !sec.editableFields.includes(id)) sec.editableFields.push(id);
    return;
  }

  if (Array.isArray(value)) {
    // Register list itself
    fields.push({
      id: path,
      type: "list",
      label: path.split(".").pop() || path,
      sectionId,
      pageKey,
      path,
    });
    value.slice(0, 8).forEach((item, i) => {
      walkFields(item, pageKey, sectionId, `${path}.${i}`, fields, sections);
    });
    return;
  }

  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const childPath = path ? `${path}.${k}` : k;
      // Top-level keys become sections on home
      const childSection =
        !path && pageKey === "home"
          ? `${pageKey}.${k}`
          : sectionId;
      if (!path && pageKey === "home" && !sections.has(childSection)) {
        sections.set(childSection, {
          id: childSection,
          pageKey,
          name: k.charAt(0).toUpperCase() + k.slice(1),
          component: k,
          order: sections.size,
          editableFields: [],
        });
      }
      walkFields(v, pageKey, childSection, childPath, fields, sections);
    }
  }
}

function ensureSection(
  sections: Map<string, SectionDef>,
  pageKey: string,
  name: string,
  component: string
) {
  const id = `${pageKey}.${component}`;
  if (!sections.has(id)) {
    sections.set(id, {
      id,
      pageKey,
      name,
      component,
      order: sections.size,
      editableFields: [],
    });
  }
  return id;
}

/**
 * Part 1 workflow: analyze template → sections → editable IDs → manifest + default config.
 * Template render code is NOT modified; we only produce data contracts.
 */
export function analyzeTemplate(args: {
  template: Template;
  pages: PageDef[];
  content: Record<string, any>;
  brandName: string;
  accent: string;
}): { manifest: TemplateManifest; config: SiteConfig; knowledge: TemplateKnowledge } {
  const { template, pages, content, brandName, accent } = args;
  const fields: EditableField[] = [];
  const sections = new Map<string, SectionDef>();

  // Strip runtime-only keys from analysis
  const scrubbed = { ...content };
  delete scrubbed.__widgets;
  delete scrubbed.__htmlBlocks;
  delete scrubbed.__meta;

  const root = { ...(template.fallback || {}), ...scrubbed };
  ensureSection(sections, "home", "Hero", "hero");
  walkFields(root, "home", "home.root", "", fields, sections);

  // Design pages
  for (const page of pages) {
    if (page.key === "home") continue;
    if (page.designId) {
      const design = getPageDesign(page.designId);
      const pageContent = content[page.key] || design?.fallback || {};
      const secId = ensureSection(sections, page.key, page.label, page.designId || page.key);
      walkFields(pageContent, page.key, secId, page.key, fields, sections);
    } else if (content[page.key]) {
      const secId = ensureSection(sections, page.key, page.label, page.key);
      walkFields(content[page.key], page.key, secId, page.key, fields, sections);
    }
  }

  // Imagery — hero/background + gallery become editable so AI can swap images
  const media = resolveMediaTheme(
    template.category,
    template.id,
    template.previewImage
  );
  ensureSection(sections, "home", "Imagery", "media");
  const mediaSectionId = "home.media";
  fields.push({
    id: "media.hero",
    type: "image",
    label: "Hero / background image",
    sectionId: mediaSectionId,
    pageKey: "home",
    path: "media.hero",
  });
  media.gallery.slice(0, 6).forEach((_, i) => {
    fields.push({
      id: `media.gallery.${i}`,
      type: "image",
      label: `Gallery image ${i + 1}`,
      sectionId: mediaSectionId,
      pageKey: "home",
      path: `media.gallery.${i}`,
    });
  });
  const mediaSec = sections.get(mediaSectionId);
  if (mediaSec) {
    mediaSec.editableFields = [
      "media.hero",
      ...media.gallery.slice(0, 6).map((_, i) => `media.gallery.${i}`),
    ];
  }

  // Dedupe fields by id
  const seen = new Set<string>();
  const editableFields = fields.filter((f) => {
    if (!f.id || seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });

  const bindings: Record<string, string> = {};
  for (const f of editableFields) {
    bindings[f.id] = `{{${f.path}}}`;
  }

  const manifest: TemplateManifest = {
    version: 1,
    templateId: template.id,
    templateName: template.name,
    category: template.category,
    brandBinding: "{{brandName}}",
    accentBinding: "{{accent}}",
    pages,
    sections: Array.from(sections.values()).sort((a, b) => a.order - b.order),
    editableFields,
    bindings,
    createdAt: Date.now(),
  };

  const config: SiteConfig = {
    brandName,
    accent,
    theme: { primary: accent },
    media: {
      hero: media.hero,
      gallery: [...media.gallery],
      category: media.category,
    },
    pages,
    content: structuredClone(content),
    sectionState: {},
    customPages: {},
    updatedAt: Date.now(),
  };

  const knowledge = buildKnowledge(template, manifest, accent, config);
  return { manifest, config, knowledge };
}

function buildKnowledge(
  template: Template,
  manifest: TemplateManifest,
  accent: string,
  config?: SiteConfig
): TemplateKnowledge {
  const designSystem: DesignSystem = {
    colors: {
      primary: accent,
      text: "#1a1a1a",
      muted: "#5b6472",
      background: "#ffffff",
    },
    typography: {
      display: template.font.includes("Fraunces") ? "Fraunces" : "DM Sans",
      body: "DM Sans",
      mono: "ui-monospace",
    },
    spacing: { section: "88px", wrap: "28px" },
    radius: "12px",
    button: { radius: "12px", weight: "700" },
  };

  const components: ComponentBlueprint[] = [
    {
      id: "hero",
      name: "Hero",
      description: "Page opening with title, subtitle, CTA",
      fields: [
        { id: "title", type: "text", label: "Title" },
        { id: "subtitle", type: "textarea", label: "Subtitle" },
        { id: "ctaText", type: "text", label: "CTA" },
      ],
      defaultContent: {
        title: "Welcome",
        subtitle: "We help you move forward.",
        ctaText: "Get started",
      },
    },
    {
      id: "services",
      name: "Services / Cards",
      description: "Grid of service or feature cards",
      fields: [{ id: "items", type: "list", label: "Items" }],
      defaultContent: {
        items: [
          { name: "Service one", desc: "Short description" },
          { name: "Service two", desc: "Short description" },
          { name: "Service three", desc: "Short description" },
        ],
      },
    },
    {
      id: "faq",
      name: "FAQ",
      description: "Question and answer list",
      fields: [
        { id: "heading", type: "text", label: "Heading" },
        { id: "items", type: "list", label: "Questions" },
      ],
      defaultContent: {
        heading: "Frequently asked questions",
        items: [
          { q: "How does it work?", a: "Tell us your goals and we deliver." },
          { q: "How soon can we start?", a: "Usually within a week." },
        ],
      },
    },
    {
      id: "pricing",
      name: "Pricing",
      description: "Pricing cards with CTAs",
      fields: [
        { id: "heading", type: "text", label: "Heading" },
        { id: "plans", type: "list", label: "Plans" },
      ],
      defaultContent: {
        heading: "Simple pricing",
        plans: [
          { name: "Starter", price: "$0", blurb: "For trying things out", cta: "Start free" },
          { name: "Pro", price: "$49", blurb: "For growing teams", cta: "Go Pro" },
        ],
      },
    },
    {
      id: "cta",
      name: "CTA Band",
      description: "Full-width call to action",
      fields: [
        { id: "title", type: "text", label: "Title" },
        { id: "blurb", type: "textarea", label: "Blurb" },
        { id: "button", type: "text", label: "Button" },
      ],
      defaultContent: {
        title: "Ready to get started?",
        blurb: "Talk to us and we’ll map the next step.",
        button: "Contact us",
      },
    },
    {
      id: "contact",
      name: "Contact",
      description: "Contact details and form prompt",
      fields: [
        { id: "heading", type: "text", label: "Heading" },
        { id: "email", type: "text", label: "Email" },
        { id: "phone", type: "text", label: "Phone" },
      ],
      defaultContent: {
        heading: "Contact us",
        email: "hello@example.com",
        phone: "+1 (555) 010-2000",
      },
    },
    {
      id: "team",
      name: "Team",
      description: "People / doctors / agents grid",
      fields: [{ id: "members", type: "list", label: "Members" }],
      defaultContent: {
        members: [
          { name: "Alex Rivera", role: "Lead", bio: "Focused on clear outcomes." },
          { name: "Sam Chen", role: "Specialist", bio: "Detail-oriented partner." },
        ],
      },
    },
    {
      id: "testimonials",
      name: "Testimonials",
      description: "Social proof quotes",
      fields: [{ id: "items", type: "list", label: "Quotes" }],
      defaultContent: {
        items: [
          { quote: "Outstanding experience.", name: "Jordan Lee", role: "Customer" },
        ],
      },
    },
  ];

  const componentVariants: ComponentVariant[] = [
    { componentId: "hero", variantId: "hero-fullbleed", name: "Full-bleed photo", description: "Image background with overlay copy" },
    { componentId: "hero", variantId: "hero-split", name: "Split media", description: "Copy left, image right" },
    { componentId: "hero", variantId: "hero-centered", name: "Centered stack", description: "Centered headline and CTA" },
    { componentId: "hero", variantId: "hero-minimal", name: "Minimal", description: "Tight typography, no media" },
    { componentId: "services", variantId: "services-grid-3", name: "3-column cards", description: "Equal card grid" },
    { componentId: "services", variantId: "services-icon", name: "Icon features", description: "Icon badge + short copy" },
    { componentId: "cta", variantId: "cta-band", name: "Accent band", description: "Full-width colored CTA" },
    { componentId: "cta", variantId: "cta-soft", name: "Soft panel", description: "Bordered soft CTA block" },
    { componentId: "pricing", variantId: "pricing-2", name: "Two tiers", description: "Starter + Pro" },
    { componentId: "pricing", variantId: "pricing-3", name: "Three tiers", description: "Starter / Pro / Enterprise" },
    { componentId: "faq", variantId: "faq-list", name: "Stacked FAQ", description: "Simple Q&A list" },
    { componentId: "team", variantId: "team-grid", name: "Team grid", description: "Avatar cards" },
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
    neutrals: {
      bg: "#ffffff",
      surface: "#f7f8fa",
      border: "#e8ecf2",
      text: "#1a1a1a",
      muted: "#5b6472",
    },
    fontScale: {
      xs: "12px",
      sm: "14px",
      md: "16px",
      lg: "20px",
      xl: "28px",
      display: "clamp(32px, 5vw, 52px)",
    },
    iconSet: ["spark", "check", "users", "star", "calendar", "shield", "phone", "mail"],
  };

  const sectionIds = manifest.sections.map((s) => s.id);
  const responsiveRules: ResponsiveRule[] = sectionIds.slice(0, 12).map((id) => ({
    id,
    mobile: id.includes("gallery") ? "stack" : "show",
    tablet: "show",
    desktop: "show",
  }));

  const contentSchema: ContentSchemaField[] = manifest.editableFields.map((f) => ({
    id: f.id,
    type: f.type,
    label: f.label,
    required: /title|heading|brand/i.test(f.id),
    maxLength: f.maxLength,
    pageKey: f.pageKey,
  }));

  const knowledgeGraph: KnowledgeGraphEdge[] = [];
  for (const page of manifest.pages) {
    const secs = manifest.sections
      .filter((s) => s.pageKey === page.key)
      .sort((a, b) => a.order - b.order);
    for (let i = 0; i < secs.length - 1; i++) {
      knowledgeGraph.push({
        from: secs[i].id,
        to: secs[i + 1].id,
        relation: "follows",
        note: "Natural page flow",
      });
    }
    const hero = secs.find((s) => /hero/i.test(s.component));
    const cta = secs.find((s) => /cta|contact/i.test(s.component));
    if (hero && cta) {
      knowledgeGraph.push({
        from: hero.id,
        to: cta.id,
        relation: "cta-to",
        note: "Hero should lead to a conversion block",
      });
    }
  }
  // Cross-page best practices
  if (manifest.pages.some((p) => p.key === "home") && manifest.pages.some((p) => p.key === "contact")) {
    knowledgeGraph.push({
      from: "home",
      to: "contact",
      relation: "cta-to",
      note: "Home CTAs typically deep-link to contact",
    });
  }

  const contentMap: ContentMapEntry[] = [];
  for (const f of manifest.editableFields.slice(0, 200)) {
    const kind: ContentMapEntry["kind"] =
      f.type === "image" ? "image" : f.type === "url" ? "url" : "text";
    let preview = "";
    if (config) {
      if (f.path.startsWith("media.")) {
        const m = config.media as any;
        if (f.path === "media.hero") preview = String(m?.hero || "").slice(0, 80);
        else if (f.path.startsWith("media.gallery.")) {
          const idx = Number(f.path.split(".").pop());
          preview = String(m?.gallery?.[idx] || "").slice(0, 80);
        }
      } else {
        const parts = f.path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
        let cur: any = config.content;
        for (const p of parts) {
          if (cur == null) break;
          cur = cur[p];
        }
        preview = typeof cur === "string" ? cur.slice(0, 80) : cur != null ? JSON.stringify(cur).slice(0, 80) : "";
      }
    }
    contentMap.push({ id: f.id, kind, pageKey: f.pageKey, preview });
  }
  if (config?.media?.hero) {
    contentMap.push({
      id: "media.hero",
      kind: "image",
      pageKey: "home",
      preview: config.media.hero.slice(0, 80),
    });
  }

  return {
    templateId: template.id,
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
