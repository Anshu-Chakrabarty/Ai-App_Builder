// lib/template-ai/types.ts — AI-ready template architecture (manifest + config + updates)
import type { PageDef } from "@/lib/types";

export type EditableFieldType =
  | "text"
  | "textarea"
  | "image"
  | "url"
  | "color"
  | "list"
  | "object"
  | "html";

export type EditableField = {
  id: string;
  type: EditableFieldType;
  label: string;
  sectionId: string;
  pageKey: string;
  maxLength?: number;
  path: string; // dotted path into config
};

export type SectionDef = {
  id: string;
  pageKey: string;
  name: string;
  component: string;
  order: number;
  editableFields: string[]; // field ids
};

export type TemplateManifest = {
  version: 1;
  templateId: string;
  templateName: string;
  category: string;
  brandBinding: string;
  accentBinding: string;
  pages: PageDef[];
  sections: SectionDef[];
  editableFields: EditableField[];
  /** Binding map: field id → mustache path used in docs */
  bindings: Record<string, string>;
  createdAt: number;
};

/** Site content — only this changes after AI edits */
export type SiteConfig = {
  brandName: string;
  accent: string;
  theme?: Record<string, string>;
  /** Editable imagery — hero/background/gallery. AI can swap these by URL. */
  media?: {
    hero: string;
    gallery: string[];
    category: string;
    /** Optional page background override (color or CSS gradient) */
    background?: string;
  };
  pages: PageDef[];
  /** Nested content keyed like hero.title, services[0].name via nested object */
  content: Record<string, any>;
  /** Section visibility / order overrides */
  sectionState?: Record<
    string,
    { visible?: boolean; order?: number }
  >;
  /** Extra AI-assembled pages (new pages) */
  customPages?: Record<
    string,
    {
      label: string;
      slug: string;
      components: string[];
      content: Record<string, any>;
    }
  >;
  updatedAt: number;
};

export type ConfigUpdate = {
  type: EditableFieldType | "section" | "page" | "theme" | "delete";
  id: string;
  value?: any;
  url?: string;
  /** For delete operations */
  op?: "set" | "delete" | "hide_section" | "show_section" | "add_page" | "remove_page";
};

export type AiUpdatePayload = {
  mode: "answer" | "mutate";
  assistantMessage: string;
  updates: ConfigUpdate[];
  /** Optional new page blueprint */
  newPages?: {
    key: string;
    label: string;
    components: string[];
    content?: Record<string, any>;
  }[];
};

export type DesignSystem = {
  colors: { primary: string; text: string; muted: string; background: string };
  typography: { display: string; body: string; mono: string };
  spacing: { section: string; wrap: string };
  radius: string;
  button: { radius: string; weight: string };
};

export type ComponentBlueprint = {
  id: string;
  name: string;
  description: string;
  fields: { id: string; type: EditableFieldType; label: string }[];
  defaultContent: Record<string, any>;
};

export type ComponentVariant = {
  componentId: string;
  variantId: string;
  name: string;
  description: string;
};

export type LayoutRules = {
  wrapMaxWidth: string;
  columns: number;
  gutters: string;
  breakpoints: { mobile: string; tablet: string; desktop: string };
  alignment: "left" | "center" | "stretch";
};

export type ThemeTokens = {
  primary: string;
  secondary: string;
  neutrals: { bg: string; surface: string; border: string; text: string; muted: string };
  fontScale: { xs: string; sm: string; md: string; lg: string; xl: string; display: string };
  iconSet: string[];
};

export type ResponsiveRule = {
  id: string;
  mobile: "show" | "hide" | "stack";
  tablet: "show" | "hide" | "stack";
  desktop: "show" | "hide" | "stack";
};

export type ContentSchemaField = {
  id: string;
  type: EditableFieldType;
  label: string;
  required?: boolean;
  maxLength?: number;
  pageKey?: string;
};

export type KnowledgeGraphEdge = {
  from: string;
  to: string;
  relation: "follows" | "supports" | "cta-to" | "shares-style";
  note?: string;
};

export type ContentMapEntry = {
  id: string;
  kind: "text" | "image" | "icon" | "video" | "document" | "url";
  pageKey: string;
  preview: string;
};

export type TemplateKnowledge = {
  templateId: string;
  designSystem: DesignSystem;
  components: ComponentBlueprint[];
  pageBlueprints: { key: string; label: string; sections: string[] }[];
  contentSchemaIds: string[];
  /** Phase 2 extras — Design DNA */
  componentVariants: ComponentVariant[];
  layoutRules: LayoutRules;
  themeTokens: ThemeTokens;
  responsiveRules: ResponsiveRule[];
  contentSchema: ContentSchemaField[];
  knowledgeGraph: KnowledgeGraphEdge[];
  contentMap: ContentMapEntry[];
};

/** AI-ready package from ZIP/HTML ingest (Phase 1 output) */
export type AiReadyPackage = {
  manifest: TemplateManifest;
  config: SiteConfig;
  knowledge: TemplateKnowledge;
  /** HTML pages with {{binding}} placeholders */
  boundPages: Record<string, string>;
  /** Relative asset path → data URL or absolute URL */
  assets: Record<string, string>;
  source: "zip" | "html" | "template";
};
