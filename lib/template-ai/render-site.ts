// lib/template-ai/render-site.ts — Website Renderer: config + original template components
import type { Template } from "@/lib/types";
import { renderPage } from "@/lib/render";
import type { SiteConfig, TemplateManifest, TemplateKnowledge } from "./types";
import { configToCopy } from "./config";
import { getPageDesign } from "@/lib/page-designs";
import { schemaForCustomDesign, renderCustomDesign } from "@/lib/custom-designs";
import { renderBoundPages } from "./render-bound";
import { patchCardSectionsInSiteHtml } from "./html-card-patch";

/**
 * Render all pages. Template render functions stay unchanged —
 * only config (data) drives content.
 * When boundPages exist (ZIP/HTML ingest), prefer mustache-bound HTML renderer.
 */
export function renderSiteFromConfig(args: {
  template: Template;
  manifest: TemplateManifest;
  config: SiteConfig;
  knowledge?: TemplateKnowledge;
  boundPages?: Record<string, string>;
  assets?: Record<string, string>;
}): Record<string, string> {
  const { template, config, knowledge, boundPages, assets } = args;

  let html: Record<string, string>;

  if (boundPages && Object.keys(boundPages).length > 0) {
    const rendered = renderBoundPages({ boundPages, config, knowledge, assets });
    // New AI pages not in bound set still need assembly
    for (const page of config.pages) {
      if (rendered[page.slug]) continue;
      const custom = config.customPages?.[page.key];
      if (custom) {
        rendered[page.slug] = renderCustomAssembledPage({
          template,
          config,
          pageKey: page.key,
          label: page.label,
          custom,
        });
      } else {
        try {
          rendered[page.slug] = renderPage(
            template,
            configToCopy(config),
            page.key,
            config.accent,
            config.brandName,
            config.pages
          );
        } catch (err) {
          console.error(`renderSiteFromConfig (bound) failed for "${page.key}":`, err);
          try {
            const c = configToCopy(config);
            rendered[page.slug] = renderPage(
              template,
              { ...(template.fallback || {}), __meta: c.__meta, visual: c.visual },
              page.key,
              config.accent,
              config.brandName,
              config.pages
            );
          } catch {
            rendered[page.slug] = `<!doctype html><html><body><h1>${page.label}</h1></body></html>`;
          }
        }
      }
    }
    html = rendered;
  } else {
    const copy = configToCopy(config);
    const pages = config.pages;
    html = {};

    for (const page of pages) {
      const custom = config.customPages?.[page.key];
      if (custom && !page.designId) {
        html[page.slug] = renderCustomAssembledPage({
          template,
          config,
          pageKey: page.key,
          label: page.label,
          custom,
        });
        continue;
      }

      try {
        html[page.slug] = renderPage(
          template,
          copy,
          page.key,
          config.accent,
          config.brandName,
          pages
        );
      } catch (err) {
        console.error(`renderSiteFromConfig failed for page "${page.key}":`, err);
        try {
          // Last resort: template fallback only (ignore corrupted AI content shape)
          html[page.slug] = renderPage(
            template,
            { ...(template.fallback || {}), __meta: copy.__meta, visual: copy.visual },
            page.key,
            config.accent,
            config.brandName,
            pages
          );
        } catch (err2) {
          console.error(`renderSiteFromConfig fallback also failed for "${page.key}":`, err2);
          html[page.slug] = `<!doctype html><html><body style="font-family:system-ui;padding:40px">
<h1>${page.label}</h1>
<p>This page could not be rendered. Click <strong>Regenerate Site</strong> to rebuild it.</p>
</body></html>`;
        }
      }
    }
  }

  // Guarantee card/list edits appear in preview (native + bound + hospital homes)
  return patchCardSectionsInSiteHtml(html, config);
}

function renderCustomAssembledPage(args: {
  template: Template;
  config: SiteConfig;
  pageKey: string;
  label: string;
  custom: NonNullable<SiteConfig["customPages"]>[string];
}): string {
  const { template, config, custom, label } = args;
  const c = custom.content || {};
  // Prefer catalog design if components include a known design id
  for (const comp of custom.components || []) {
    const design = getPageDesign(comp);
    if (design) {
      const pageCopy = { ...design.fallback, ...c };
      const fakePages = config.pages;
      // Temporarily use design render via page def trick
      const pages = fakePages.map((p) =>
        p.key === args.pageKey ? { ...p, designId: design.id } : p
      );
      const copy = { ...configToCopy(config), [args.pageKey]: pageCopy };
      return renderPage(template, copy, args.pageKey, config.accent, config.brandName, pages);
    }
  }

  // Assemble from component defaults as a card-grid custom page
  const sections =
    c.sections ||
    (custom.components || []).map((id) => ({
      title: id.charAt(0).toUpperCase() + id.slice(1),
      body: c[id]?.blurb || c[id]?.subtitle || `Content for ${id}`,
    }));

  const pageCopy = {
    heading: c.heading || c.title || label,
    blurb: c.blurb || c.subtitle || `Built with the ${template.name} design system.`,
    sections:
      sections.length > 0
        ? sections
        : [
            { title: "Overview", body: "Generated from your template knowledge engine." },
            { title: "Details", body: "Components reused from the design DNA." },
            { title: "Next step", body: "Contact us to continue." },
          ],
    cta: c.cta || c.button || "Get started",
    __customDesign: "card-grid",
  };

  const body = renderCustomDesign("card-grid", pageCopy, config.accent);
  // Wrap with shared chrome via renderPage custom design path
  const pages = config.pages.map((p) =>
    p.key === args.pageKey ? { ...p, designId: "custom:card-grid" } : p
  );
  const copy = {
    ...configToCopy(config),
    [args.pageKey]: pageCopy,
  };
  return renderPage(template, copy, args.pageKey, config.accent, config.brandName, pages);
}

// silence unused import if tree-shaken oddly
void schemaForCustomDesign;
