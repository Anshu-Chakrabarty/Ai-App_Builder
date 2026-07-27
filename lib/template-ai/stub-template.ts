// lib/template-ai/stub-template.ts — fallback Template for ZIP/HTML-ingested sites
import type { Template } from "@/lib/types";
import { SANS } from "@/lib/render";

/** Minimal Template used when rendering bound HTML or assembling new pages without a TS template. */
export function makeIngestStubTemplate(args: {
  id: string;
  name: string;
  pages: { key: string; label: string; slug: string }[];
  accent?: string;
}): Template {
  return {
    id: args.id,
    name: args.name,
    category: "uploaded",
    tagline: "Uploaded HTML template (AI-ready)",
    font: SANS,
    previewImage: "",
    previewAccent: args.accent || "#2563EB",
    pages: args.pages.map((p) => ({
      key: p.key,
      label: p.label,
      slug: p.slug,
    })),
    availablePageDesigns: [],
    schema: `{ "hero": { "title": "", "subtitle": "", "ctaText": "" } }`,
    fallback: {
      hero: {
        title: "Welcome",
        subtitle: "Built from your uploaded template.",
        ctaText: "Get started",
      },
    },
    render: (copy, accent, brand, pageKey) => {
      const hero = copy?.hero || {};
      return `<section class="wrap" style="padding:64px 28px">
        <h1 style="color:${accent}">${hero.title || brand}</h1>
        <p>${hero.subtitle || ""}</p>
        <p><em>Page: ${pageKey}</em></p>
      </section>`;
    },
  };
}
