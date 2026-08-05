// lib/template-ai/analyze.ts — Part 1: make template AI-ready (manifest + default config + knowledge)
import type { Template, PageDef } from "@/lib/types";
import { getPageDesign } from "@/lib/page-designs";
import { resolveMediaTheme, galleryLabelsFor } from "@/lib/site-media";
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
  idea?: string;
}): { manifest: TemplateManifest; config: SiteConfig; knowledge: TemplateKnowledge } {
  const { template, pages, content, brandName, accent, idea } = args;
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

  // Imagery — hero / split / banner / gallery are independently editable
  const media = resolveMediaTheme(
    template.category,
    template.id,
    template.previewImage,
    [idea, brandName].filter(Boolean).join(" ")
  );
  ensureSection(sections, "home", "Imagery", "media");
  const mediaSectionId = "home.media";
  fields.push(
    {
      id: "media.hero",
      type: "image",
      label: "Hero / background image",
      sectionId: mediaSectionId,
      pageKey: "home",
      path: "media.hero",
    },
    {
      id: "media.split",
      type: "image",
      label: "Split section image",
      sectionId: mediaSectionId,
      pageKey: "home",
      path: "media.split",
    },
    {
      id: "media.banner",
      type: "image",
      label: "Page banner image",
      sectionId: mediaSectionId,
      pageKey: "home",
      path: "media.banner",
    }
  );
  media.gallery.slice(0, 6).forEach((_, i) => {
    const cap = galleryLabelsFor(media.category)[i] || `Gallery ${i + 1}`;
    fields.push({
      id: `media.gallery.${i}`,
      type: "image",
      label: `${cap} card image`,
      sectionId: mediaSectionId,
      pageKey: "home",
      path: `media.gallery.${i}`,
    });
  });

  // Split-media copy (the “A polished layout with depth” block)
  ensureSection(sections, "home", "Split media", "split");
  const splitSectionId = "home.split";
  const splitFields: Array<{ id: string; type: "text" | "textarea"; label: string; path: string }> = [
    { id: "visual.split.title", type: "text", label: "Split title", path: "visual.split.title" },
    { id: "visual.split.subtitle", type: "textarea", label: "Split subtitle", path: "visual.split.subtitle" },
    { id: "visual.split.trust", type: "text", label: "Split trust line", path: "visual.split.trust" },
    { id: "visual.split.cta", type: "text", label: "Split primary CTA", path: "visual.split.cta" },
    { id: "visual.split.secondaryCta", type: "text", label: "Split secondary CTA", path: "visual.split.secondaryCta" },
  ];
  for (const f of splitFields) {
    fields.push({
      ...f,
      sectionId: splitSectionId,
      pageKey: "home",
    });
  }
  const splitSec = sections.get(splitSectionId);
  if (splitSec) {
    splitSec.editableFields = ["media.split", ...splitFields.map((f) => f.id)];
  }

  // Gallery + features copy
  ensureSection(sections, "home", "Gallery", "gallery");
  ensureSection(sections, "home", "Features", "features");
  const visualExtra: Array<{ id: string; type: "text" | "textarea"; label: string; path: string; sectionId: string }> = [
    { id: "visual.gallery.title", type: "text", label: "Gallery title", path: "visual.gallery.title", sectionId: "home.gallery" },
    { id: "visual.gallery.subtitle", type: "textarea", label: "Gallery subtitle", path: "visual.gallery.subtitle", sectionId: "home.gallery" },
    { id: "visual.features.title", type: "text", label: "Features title", path: "visual.features.title", sectionId: "home.features" },
    { id: "visual.features.subtitle", type: "textarea", label: "Features subtitle", path: "visual.features.subtitle", sectionId: "home.features" },
    { id: "hero.title", type: "text", label: "Hero title", path: "hero.title", sectionId: "home.hero" },
    { id: "hero.subtitle", type: "textarea", label: "Hero subtitle", path: "hero.subtitle", sectionId: "home.hero" },
    { id: "hero.ctaText", type: "text", label: "Hero CTA", path: "hero.ctaText", sectionId: "home.hero" },
  ];
  for (const f of visualExtra) {
    fields.push({
      id: f.id,
      type: f.type,
      label: f.label,
      sectionId: f.sectionId,
      pageKey: "home",
      path: f.path,
    });
  }
  const galSec = sections.get("home.gallery");
  if (galSec) {
    galSec.editableFields = [
      ...(galSec.editableFields || []),
      "visual.gallery.title",
      "visual.gallery.subtitle",
      ...media.gallery.slice(0, 6).map((_, i) => `media.gallery.${i}`),
    ];
  }
  const featSec = sections.get("home.features");
  if (featSec) {
    featSec.editableFields = [
      ...(featSec.editableFields || []),
      "visual.features.title",
      "visual.features.subtitle",
      "visual.features.items.0.title",
      "visual.features.items.0.body",
      "visual.features.items.1.title",
      "visual.features.items.1.body",
      "visual.features.items.2.title",
      "visual.features.items.2.body",
      "visual.features.items.3.title",
      "visual.features.items.3.body",
    ];
  }

  // Feature card bodies (editable)
  for (let i = 0; i < 4; i++) {
    fields.push(
      {
        id: `visual.features.items.${i}.title`,
        type: "text",
        label: `Feature ${i + 1} title`,
        sectionId: "home.features",
        pageKey: "home",
        path: `visual.features.items.${i}.title`,
      },
      {
        id: `visual.features.items.${i}.body`,
        type: "textarea",
        label: `Feature ${i + 1} body`,
        sectionId: "home.features",
        pageKey: "home",
        path: `visual.features.items.${i}.body`,
      }
    );
  }

  // Banner (inner pages) + CTA + form + blocks
  ensureSection(sections, "home", "Page banner", "banner");
  ensureSection(sections, "home", "CTA band", "cta");
  ensureSection(sections, "home", "Lead form", "form");
  ensureSection(sections, "home", "Custom blocks", "blocks");
  for (const f of [
    { id: "visual.cta.title", type: "text" as const, label: "CTA title", path: "visual.cta.title", sectionId: "home.cta" },
    { id: "visual.cta.blurb", type: "textarea" as const, label: "CTA blurb", path: "visual.cta.blurb", sectionId: "home.cta" },
    { id: "visual.cta.primaryLabel", type: "text" as const, label: "CTA primary button", path: "visual.cta.primaryLabel", sectionId: "home.cta" },
    { id: "visual.cta.secondaryLabel", type: "text" as const, label: "CTA secondary button", path: "visual.cta.secondaryLabel", sectionId: "home.cta" },
    { id: "visual.form.title", type: "text" as const, label: "Form title", path: "visual.form.title", sectionId: "home.form" },
    { id: "visual.form.blurb", type: "textarea" as const, label: "Form blurb", path: "visual.form.blurb", sectionId: "home.form" },
    { id: "visual.form.submitLabel", type: "text" as const, label: "Form submit label", path: "visual.form.submitLabel", sectionId: "home.form" },
  ]) {
    fields.push({
      id: f.id,
      type: f.type,
      label: f.label,
      sectionId: f.sectionId,
      pageKey: "home",
      path: f.path,
    });
  }
  const ctaSec = sections.get("home.cta");
  if (ctaSec) {
    ctaSec.editableFields = [
      "visual.cta.title",
      "visual.cta.blurb",
      "visual.cta.primaryLabel",
      "visual.cta.secondaryLabel",
    ];
  }
  const formSec = sections.get("home.form");
  if (formSec) {
    formSec.editableFields = [
      "visual.form.title",
      "visual.form.blurb",
      "visual.form.submitLabel",
    ];
  }
  const blockSec = sections.get("home.blocks");
  if (blockSec) {
    blockSec.editableFields = ["layout.blocksColumns"];
  }
  const banSec = sections.get("home.banner");
  if (banSec) {
    banSec.editableFields = ["media.banner"];
  }

  const mediaSec = sections.get(mediaSectionId);
  if (mediaSec) {
    mediaSec.editableFields = [
      "media.hero",
      "media.split",
      "media.banner",
      ...media.gallery.slice(0, 6).map((_, i) => `media.gallery.${i}`),
      "layout.galleryColumns",
      "layout.galleryVariant",
      "layout.featureColumns",
      "layout.blocksColumns",
      "layout.serviceColumns",
    ];
  }

  // Layout knobs (columns) — agent can change without touching images
  for (const f of [
    { id: "layout.galleryColumns", label: "Gallery columns" },
    { id: "layout.galleryVariant", label: "Gallery layout variant" },
    { id: "layout.featureColumns", label: "Feature columns" },
    { id: "layout.blocksColumns", label: "Blocks columns" },
    { id: "layout.serviceColumns", label: "Service card columns" },
  ] as const) {
    fields.push({
      id: f.id,
      type: "text",
      label: f.label,
      sectionId: mediaSectionId,
      pageKey: "home",
      path: f.id,
    });
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
      split: media.split,
      banner: media.banner,
    },
    pages,
    content: {
      ...structuredClone(content),
      visual: {
        split: {
          title: "A polished layout with depth",
          subtitle:
            "Layered photography, icon badges, and conversion-ready CTAs — the same ingredients modern AI site builders use.",
          trust: "Trusted by teams shipping faster",
          cta: "Get started",
          secondaryCta: "View gallery",
        },
        gallery: {
          title: "Real imagery, ready to ship",
          subtitle: "High-quality photos matched to your category — swap with your brand assets anytime.",
        },
        features: {
          title: "Designed with icons, imagery & polish",
          subtitle:
            "Every generated site ships with styled components, photo layouts, and SVG icons — not just plain text.",
          items: [
            { title: "Modern experience", body: "Clean UI with purposeful motion and clarity.", icon: "spark" },
            { title: "Built for people", body: "Flows that feel obvious on day one.", icon: "users" },
            { title: "Reliable foundation", body: "Production-ready structure you can deploy.", icon: "shield" },
            { title: "Clear next steps", body: "CTAs and forms that convert visitors.", icon: "check" },
          ],
        },
        cta: {
          title: `Ready to get started with ${brandName}?`,
          blurb: "Book online in minutes — or tell us what you need and we’ll follow up.",
          primaryLabel: "Book now",
          secondaryLabel: "Talk to us",
        },
        form: {
          title: "Request a callback",
          blurb: "Leave your details and we’ll call you back.",
          submitLabel: "Request callback",
        },
        ...(content as any)?.visual,
      },
    },
    sectionState: {},
    customPages: {},
    updatedAt: Date.now(),
  };

  // Merge defaults under any partial visual from content
  const vis = config.content.visual || {};
  config.content.visual = {
    ...vis,
    features: {
      title: vis.features?.title || "Designed with icons, imagery & polish",
      subtitle:
        vis.features?.subtitle ||
        "Every generated site ships with styled components, photo layouts, and SVG icons — not just plain text.",
      items:
        Array.isArray(vis.features?.items) && vis.features.items.length
          ? vis.features.items
          : [
              { title: "Modern experience", body: "Clean UI with purposeful motion and clarity.", icon: "spark" },
              { title: "Built for people", body: "Flows that feel obvious on day one.", icon: "users" },
              { title: "Reliable foundation", body: "Production-ready structure you can deploy.", icon: "shield" },
              { title: "Clear next steps", body: "CTAs and forms that convert visitors.", icon: "check" },
            ],
    },
    cta: {
      title: vis.cta?.title || `Ready to get started with ${brandName}?`,
      blurb: vis.cta?.blurb || "Book online in minutes — or tell us what you need and we’ll follow up.",
      primaryLabel: vis.cta?.primaryLabel || "Book now",
      secondaryLabel: vis.cta?.secondaryLabel || "Talk to us",
    },
    form: {
      title: vis.form?.title || "Request a callback",
      blurb: vis.form?.blurb || "Leave your details and we’ll call you back.",
      submitLabel: vis.form?.submitLabel || "Request callback",
    },
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
        else if (f.path === "media.split") preview = String(m?.split || "").slice(0, 80);
        else if (f.path === "media.banner") preview = String(m?.banner || "").slice(0, 80);
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
