// lib/types.ts
export type PageDef = {
  key: string;
  label: string;
  slug: string;
  /** When set, page is rendered from the shared page-design catalog */
  designId?: string;
};

export type Template = {
  id: string;
  name: string;
  category: string;
  tagline: string;
  font: string;
  /** Card preview image (Unsplash / SVG data URI) */
  previewImage: string;
  /** Soft accent used on template cards */
  previewAccent: string;
  pages: PageDef[];
  /** Extra page keys this template ships with designs for */
  availablePageDesigns: string[];
  schema: string;
  fallback: Record<string, any>;
  render: (copy: any, accent: string, brand: string, pageKey: string) => string;
};

export type Details = {
  brandName: string;
  description: string;
  tone: string;
  accent: string;
  notes: string;
  /** Single free-form prompt from the user */
  prompt: string;
  /** Per-page section hints parsed from the generation brief */
  sectionHints?: Record<string, string>;
};

export type PageDesign = {
  id: string;
  label: string;
  description: string;
  /** Keywords used to match user requests like "add a blog" */
  aliases: string[];
  schema: string;
  fallback: Record<string, any>;
  render: (copy: any, accent: string, brand: string) => string;
};

export type DesignOption = {
  id: string;
  label: string;
  description: string;
  previewHint: string;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  text: string;
  options?: DesignOption[];
  pendingPage?: { label: string; key: string };
  pendingQueue?: { label: string; key: string }[];
};

export type SiteProject = {
  id: string;
  name: string;
  templateId: string;
  details: Details;
  copy: Record<string, any>;
  pages: PageDef[];
  updatedAt: number;
};
