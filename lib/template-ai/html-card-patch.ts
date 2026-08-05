// lib/template-ai/html-card-patch.ts
// Force service / feature card grids in rendered HTML so Studio edits always show,
// even on bound HTML, hospital homes without a services block, or stale template markup.
import { parse } from "node-html-parser";
import { renderServiceCards } from "@/lib/site-media";
import { layoutOverrideCSS } from "@/lib/site-media";
import type { SiteConfig } from "./types";

/**
 * Patch every page HTML so card-list config changes are visible in the preview.
 */
export function patchCardSectionsInSiteHtml(
  htmlBySlug: Record<string, string>,
  config: SiteConfig
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [slug, html] of Object.entries(htmlBySlug || {})) {
    out[slug] = patchCardSectionsInHtml(html, config);
  }
  return out;
}

export function patchCardSectionsInHtml(html: string, config: SiteConfig): string {
  if (!html || typeof html !== "string") return html;
  try {
    let next = html;

    const services = Array.isArray(config.content?.services) ? config.content.services : null;
    if (services && services.length) {
      next = patchServicesSection(next, services, config);
    }

    const features = config.content?.visual?.features?.items;
    if (Array.isArray(features) && features.length) {
      next = patchFeaturesSection(next, features, config);
    }

    const layoutCss = layoutOverrideCSS(config.layout || null);
    if (layoutCss) {
      next = injectStyleOnce(next, "ai-layout-override", layoutCss);
    }

    return next;
  } catch (err) {
    console.error("patchCardSectionsInHtml failed:", err);
    return html;
  }
}

function patchServicesSection(
  html: string,
  services: Array<{ name?: string; desc?: string; image?: string }>,
  config: SiteConfig
): string {
  const gridHtml = renderServiceCards(services, {
    href: config.pages?.some((p) => p.key === "services") ? "services.html" : "#",
  });
  const cols = config.layout?.serviceColumns || (services.length >= 6 ? 3 : undefined);
  const sectionInner = `
    <div class="eyebrow">Care pathways</div>
    <h2>Services at a glance</h2>
    ${gridHtml}
  `;

  // 1) Replace existing .service-cards-grid
  try {
    const root = parse(html, { comment: true });
    const grid = root.querySelector(".service-cards-grid");
    if (grid) {
      grid.replaceWith(gridHtml);
      let out = root.toString();
      if (cols) {
        out = injectStyleOnce(
          out,
          "ai-service-cols",
          `@media(min-width:721px){.service-cards-grid{grid-template-columns:repeat(${cols},minmax(0,1fr))!important}}`
        );
      }
      return out;
    }
  } catch {
    /* fall through */
  }

  // 2) Replace section tagged as services / highlights near “Services at a glance”
  try {
    const root = parse(html, { comment: true });
    const sections = root.querySelectorAll("section");
    for (const sec of sections) {
      const text = sec.text || "";
      const id = `${sec.getAttribute("data-ai-section") || ""} ${sec.getAttribute("data-ai-id") || ""} ${sec.getAttribute("id") || ""} ${sec.getAttribute("class") || ""}`;
      const isServices =
        /services at a glance|care pathways/i.test(text) ||
        /services|highlights/i.test(id);
      if (!isServices) continue;

      // Keep section attrs; replace children with heading + new grid
      const attrs = sec.rawAttrs || "";
      const hasAi =
        /data-ai-section/i.test(attrs) || /data-ai-id/i.test(attrs);
      const open = hasAi
        ? `<section ${attrs}>`
        : `<section class="wrap services" data-ai-section="services" data-ai-id="home.services" id="services" ${attrs}>`;
      sec.replaceWith(`${open}${sectionInner}</section>`);
      let out = root.toString();
      if (cols) {
        out = injectStyleOnce(
          out,
          "ai-service-cols",
          `@media(min-width:721px){.service-cards-grid{grid-template-columns:repeat(${cols},minmax(0,1fr))!important}}`
        );
      }
      return out;
    }
  } catch {
    /* fall through */
  }

  // 3) Regex replace around “Services at a glance” heading block
  if (/Services at a glance/i.test(html)) {
    const replaced = html.replace(
      /(<h2[^>]*>\s*Services at a glance\s*<\/h2>)([\s\S]*?)(?=<section\b|<\/main\b|<footer\b|$)/i,
      `$1\n${gridHtml}\n`
    );
    if (replaced !== html) {
      return cols
        ? injectStyleOnce(
            replaced,
            "ai-service-cols",
            `@media(min-width:721px){.service-cards-grid{grid-template-columns:repeat(${cols},minmax(0,1fr))!important}}`
          )
        : replaced;
    }
  }

  // 4) Inject a new services section before features / gallery / footer
  const block = `<section class="wrap services" data-ai-section="services" data-ai-id="home.services" id="services" style="padding-top:40px">${sectionInner}</section>`;
  if (/data-ai-section=["']features["']/i.test(html) || /id=["']features["']/i.test(html)) {
    return html.replace(
      /<section[^>]*(?:data-ai-section=["']features["']|id=["']features["'])[^>]*>/i,
      `${block}$&`
    );
  }
  if (/<\/main>/i.test(html)) return html.replace(/<\/main>/i, `${block}</main>`);
  if (/<footer\b/i.test(html)) return html.replace(/<footer\b/i, `${block}<footer`);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}</body>`);
  return html + block;
}

function patchFeaturesSection(
  html: string,
  items: Array<{ icon?: string; title?: string; body?: string; image?: string }>,
  config: SiteConfig
): string {
  if (!/feature-icons|visual\.features|home\.features/i.test(html)) return html;
  const cols = config.layout?.featureColumns;
  const cards = items
    .map((f, i) => {
      const img = f.image
        ? `<img data-ai-id="visual.features.items.${i}.image" src="${escAttr(f.image)}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:12px;margin-bottom:12px" loading="lazy" />`
        : "";
      return `<div class="card-soft" data-ai-id="visual.features.items.${i}">${img}<h3 data-ai-id="visual.features.items.${i}.title">${esc(f.title)}</h3><p data-ai-id="visual.features.items.${i}.body">${esc(f.body)}</p></div>`;
    })
    .join("");

  let next = html.replace(
    /(<div[^>]*class=["'][^"']*feature-icons[^"']*["'][^>]*>)([\s\S]*?)(<\/div>)/i,
    `$1${cards}$3`
  );
  if (cols) {
    next = injectStyleOnce(
      next,
      "ai-feature-cols",
      `@media(min-width:721px){.feature-icons{grid-template-columns:repeat(${cols},minmax(0,1fr))!important}}`
    );
  }
  return next;
}

function injectStyleOnce(html: string, id: string, css: string): string {
  const tag = `<style data-ai-patch="${id}">${css}</style>`;
  if (new RegExp(`data-ai-patch="${id}"`).test(html)) {
    return html.replace(
      new RegExp(`<style data-ai-patch="${id}">[\\s\\S]*?<\\/style>`, "i"),
      tag
    );
  }
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}</head>`);
  return tag + html;
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(s: unknown): string {
  return esc(s).replace(/"/g, "&quot;");
}
