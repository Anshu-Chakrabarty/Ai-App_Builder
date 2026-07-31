// lib/render.ts
import type { Template, PageDef } from "./types";
import { getPageDesign } from "./page-designs";
import { renderCustomDesign } from "./custom-designs";
import {
  defaultContactForm,
  defaultHomeCta,
  defaultHomeLeadForm,
  interactiveCSS,
  interactiveScript,
  renderWidget,
  type SiteWidget,
} from "./site-widgets";
import {
  iconHTML,
  mediaCSS,
  layoutOverrideCSS,
  resolveMediaTheme,
  renderVisualPackage,
  renderOptionalHomeHero,
  ensureGalleryUrls,
  isBrokenMediaUrl,
  FALLBACK_IMAGE,
} from "./site-media";

export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
export const SANS =
  '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const DISPLAY =
  '"Fraunces", Georgia, "Times New Roman", serif';

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function baseCSS(
  accent: string,
  font: string,
  layout?: {
    galleryColumns?: number;
    galleryVariant?: "featured" | "equal";
    featureColumns?: number;
    blocksColumns?: number;
  } | null
): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:${font};color:#1a1a1a;line-height:1.65;-webkit-font-smoothing:antialiased;background:#fff}
    a{color:inherit;text-decoration:none}
    .wrap{max-width:1100px;margin:0 auto;padding:0 28px}
    nav{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;
        align-items:center;padding:14px 28px;background:rgba(255,255,255,.88);
        backdrop-filter:blur(14px);border-bottom:1px solid #ececec;box-shadow:0 1px 0 rgba(255,255,255,.6)}
    nav .brand{font-weight:800;letter-spacing:-.02em;font-size:18px;display:flex;align-items:center;gap:10px}
    nav .links{display:flex;gap:18px;font-size:14px;font-weight:600;flex-wrap:wrap;align-items:center}
    nav .links a{opacity:.72;transition:.2s;display:inline-flex;align-items:center;gap:6px}
    nav .links a:hover,nav .links a.active{opacity:1;color:${accent}}
    nav .nav-cta{background:${accent};color:#fff!important;opacity:1!important;padding:9px 14px;border-radius:10px;font-size:13px;box-shadow:0 8px 20px ${accent}44}
    section{padding:72px 0}
    h1{font-size:clamp(34px,6vw,60px);line-height:1.05;letter-spacing:-.03em;font-weight:800}
    h2{font-size:clamp(26px,3.5vw,38px);letter-spacing:-.02em;font-weight:800;margin-bottom:14px}
    h3{letter-spacing:-.01em}
    .eyebrow{font-family:${MONO};font-size:12px;letter-spacing:.16em;text-transform:uppercase;
        color:${accent};font-weight:700;margin-bottom:16px;display:inline-flex;align-items:center;gap:8px}
    .btn{display:inline-flex;align-items:center;gap:8px;background:${accent};color:#fff;padding:14px 24px;border-radius:12px;
        font-weight:700;font-size:15px;transition:.2s;border:none;cursor:pointer;box-shadow:0 10px 24px ${accent}33}
    .btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
    .btn-secondary{display:inline-flex;align-items:center;gap:8px;background:transparent;color:${accent};padding:13px 22px;border-radius:12px;
        font-weight:700;font-size:15px;border:1.5px solid ${accent}}
    .lead{font-size:19px;color:#4a4a4a;max-width:560px}
    footer{padding:44px 0 96px;border-top:1px solid #ececec;color:#888;font-size:14px;
        display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:24px}
    footer .wrap-foot{display:contents}
    ${interactiveCSS(accent)}
    ${mediaCSS(accent)}
    ${layoutOverrideCSS(layout)}
    @media(max-width:720px){
      .wrap{padding:0 16px}
      section{padding:40px 0}
      nav{flex-wrap:wrap;gap:10px;padding:12px 14px;align-items:flex-start}
      nav .brand{font-size:15px;max-width:46%;min-width:0}
      nav .brand span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      nav .links{
        width:100%;gap:8px;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;
        padding-bottom:4px;scrollbar-width:thin
      }
      nav .links a{display:inline-flex!important;font-size:12px;white-space:nowrap;flex-shrink:0;opacity:.8}
      nav .nav-cta{padding:8px 12px;font-size:12px}
      h1{font-size:clamp(28px,8vw,42px)}
      h2{font-size:clamp(22px,6vw,30px)}
      .lead{font-size:16px;max-width:100%}
      .btn,.btn-secondary{width:100%;justify-content:center;text-align:center}
      .hero-actions,.btn-row{flex-direction:column;align-items:stretch}
      footer{padding:28px 0 100px;flex-direction:column;gap:8px}
      .sticky-cta{left:12px;right:12px;bottom:12px;justify-content:stretch}
      .sticky-cta a{flex:1;justify-content:center;width:100%}
      /* Collapse template inline multi-column grids on phones */
      [style*="grid-template-columns"]{grid-template-columns:1fr!important}
      [style*="display:grid"][style*="gap"]{gap:16px!important}
    }
  `;
}

function navHTML(
  brand: string,
  pages: PageDef[],
  activeSlug: string,
  logoUrl?: string
): string {
  const contact = pages.find((p) => p.key === "contact")?.slug || pages[0]?.slug || "#";
  const links = pages
    .map((p) => {
      const cls = [
        p.slug === activeSlug ? "active" : "",
        p.key === "contact" ? "nav-cta" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<a href="${p.slug}" class="${cls}">${esc(p.label)}</a>`;
    })
    .join("");
  const hasContact = pages.some((p) => p.key === "contact");
  const extraCta = hasContact
    ? ""
    : `<a href="${contact}" class="nav-cta">${iconHTML("calendar")} Get started</a>`;
  const logo = logoUrl
    ? `<img class="brand-mark-img" src="${esc(logoUrl)}" alt="" width="34" height="34"/>`
    : `<span class="icon-badge" style="width:34px;height:34px;margin:0;border-radius:10px">${iconHTML("spark")}</span>`;
  return `<nav><div class="brand">${logo}<span>${esc(brand)}</span></div><div class="links">${links}${extraCta}</div></nav>`;
}

function footerHTML(brand: string): string {
  return `<footer class="wrap"><div>© ${new Date().getFullYear()} ${esc(
    brand
  )}</div><div style="display:flex;align-items:center;gap:8px">${iconHTML("spark")} Built with AppBuilder AI</div></footer>
  <div class="sticky-cta"><a class="btn" href="contact.html">${iconHTML("phone")} Book / Contact</a></div>
  ${interactiveScript()}`;
}

function widgetsForPage(copy: any, pageKey: string, brand: string): SiteWidget[] {
  const stored: SiteWidget[] = Array.isArray(copy?.__widgets?.[pageKey])
    ? copy.__widgets[pageKey]
    : [];
  const defaults: SiteWidget[] = [];
  const vis = copy?.visual || {};
  if (pageKey === "home" && stored.length === 0) {
    const baseCta = defaultHomeCta(brand) as Extract<SiteWidget, { type: "cta-band" }>;
    const cta: Extract<SiteWidget, { type: "cta-band" }> = {
      type: "cta-band",
      title: vis.cta?.title || baseCta.title,
      blurb: vis.cta?.blurb || baseCta.blurb,
      primaryLabel: vis.cta?.primaryLabel || baseCta.primaryLabel,
      primaryHref: baseCta.primaryHref,
      secondaryLabel: vis.cta?.secondaryLabel || baseCta.secondaryLabel,
      secondaryHref: baseCta.secondaryHref,
    };
    const baseForm = defaultHomeLeadForm() as Extract<SiteWidget, { type: "lead-form" }>;
    const form: Extract<SiteWidget, { type: "lead-form" }> = {
      type: "lead-form",
      title: vis.form?.title || baseForm.title,
      blurb: vis.form?.blurb || baseForm.blurb,
      fields: baseForm.fields,
      submitLabel: vis.form?.submitLabel || baseForm.submitLabel,
    };
    defaults.push(cta, form);
  }
  if (pageKey === "contact") {
    const hasForm = stored.some((w) => w.type === "lead-form");
    if (!hasForm) defaults.push(defaultContactForm(brand));
  }
  return [...stored, ...defaults];
}

function heroBitsFromCopy(copy: any, brand: string) {
  const hero = copy?.hero || {};
  return {
    title: String(hero.title || `Welcome to ${brand}`),
    subtitle: String(
      hero.subtitle ||
        "A modern site with photography, icons, forms, and conversion-ready styling."
    ),
    cta: String(hero.ctaText || "Get started"),
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Fill missing/invalid template fields from fallback so `template.render`
 * never crashes on wiped hero/lists after AI edits.
 * Copy values win when shape-compatible; `__*` + `visual` always from copy.
 */
export function mergeTemplateFallback(fallback: unknown, copy: unknown): any {
  const fill = (base: any, overlay: any): any => {
    if (Array.isArray(base)) {
      return Array.isArray(overlay) && overlay.length > 0 ? overlay : base;
    }
    if (isPlainObject(base)) {
      if (!isPlainObject(overlay)) return structuredClone(base);
      const out: Record<string, any> = { ...structuredClone(base) };
      for (const [k, v] of Object.entries(overlay)) {
        if (k in out) out[k] = fill(out[k], v);
        else out[k] = v;
      }
      return out;
    }
    if (overlay === undefined || overlay === null || overlay === "") return base;
    return overlay;
  };

  const merged = fill(
    fallback && typeof fallback === "object" ? structuredClone(fallback) : {},
    copy && typeof copy === "object" ? copy : {}
  );
  if (copy && typeof copy === "object") {
    for (const [k, v] of Object.entries(copy as Record<string, unknown>)) {
      if (k.startsWith("__") || k === "visual") merged[k] = v;
    }
  }
  return merged;
}

/** Build a complete standalone HTML document for one page of a site. */
export function renderPage(
  template: Template,
  copy: any,
  pageKey: string,
  accent: string,
  brand: string,
  pages?: PageDef[]
): string {
  const allPages = pages || template.pages;
  const page = allPages.find((p) => p.key === pageKey) || template.pages.find((p) => p.key === pageKey);
  if (!page) {
    return `<!doctype html><html><body><p>Unknown page</p></body></html>`;
  }

  // Always fill required template shape (hero, featured, etc.) before render
  const safeCopy = mergeTemplateFallback(template.fallback, copy);

  const base = resolveMediaTheme(
    template.category,
    template.id,
    template.previewImage,
    brand
  );
  const metaMedia = (safeCopy as any)?.__meta?.media;
  const category = (metaMedia?.category as string) || base.category;
  const rawGallery =
    Array.isArray(metaMedia?.gallery) && metaMedia.gallery.length
      ? (metaMedia.gallery as string[])
      : base.gallery;
  const gallery = ensureGalleryUrls(rawGallery, category, 6);
  const theme = {
    hero: isBrokenMediaUrl(metaMedia?.hero) ? base.hero : (metaMedia?.hero as string) || base.hero,
    gallery,
    category,
    split: isBrokenMediaUrl(metaMedia?.split)
      ? gallery[1] || base.split
      : (metaMedia?.split as string) || gallery[1] || base.split,
    banner: isBrokenMediaUrl(metaMedia?.banner)
      ? gallery[2] || base.banner
      : (metaMedia?.banner as string) || gallery[2] || base.banner,
  };
  // never leave empty hero
  if (isBrokenMediaUrl(theme.hero)) theme.hero = FALLBACK_IMAGE;
  const bgOverride: string =
    metaMedia?.background || (safeCopy as any)?.__meta?.theme?.background || "";
  const hero = heroBitsFromCopy(safeCopy, brand);
  const visualCopy = (safeCopy as any)?.visual || {};
  const layout =
    (safeCopy as any)?.__meta?.layout ||
    (safeCopy as any)?.__meta?.theme?.layout ||
    null;

  let body = "";
  if (page.designId?.startsWith("custom:")) {
    const customId = page.designId.slice("custom:".length);
    const pageCopy = safeCopy?.[page.key] ?? {};
    body = renderCustomDesign(pageCopy.__customDesign || customId, pageCopy, accent);
  } else if (page.designId) {
    const design = getPageDesign(page.designId);
    const pageCopy = safeCopy?.[page.key] ?? design?.fallback ?? {};
    body = design ? design.render(pageCopy, accent, brand) : `<section class="wrap"><p>Missing design</p></section>`;
  } else {
    body = template.render(safeCopy, accent, brand, pageKey);
  }

  // Stamp template mid-page sections so clicks + AI can target them
  const contentKeys = Object.keys(safeCopy || {}).filter(
    (k) => !k.startsWith("__") && k !== "visual" && typeof (safeCopy as any)[k] === "object"
  );
  body = stampTemplateSections(body, pageKey, contentKeys);

  const visual = renderVisualPackage({
    pageKey,
    brand,
    accent,
    theme,
    heroTitle: hero.title,
    heroSubtitle: hero.subtitle,
    heroCta: hero.cta,
    pageLabel: page.label,
    visualCopy,
    layout,
  });

  if (pageKey === "home") {
    // Full-bleed photo hero first, then template sections, then icon/gallery package
    body =
      renderOptionalHomeHero({
        brand,
        theme,
        title: hero.title,
        subtitle: hero.subtitle,
        cta: hero.cta,
      }) +
      body +
      visual;
  } else {
    body = visual + body;
  }

  const widgets = widgetsForPage(safeCopy, pageKey, brand);
  if (widgets.length) {
    body += widgets.map((w) => renderWidget(w, accent)).join("");
  }

  const htmlBlocks = Array.isArray(safeCopy?.__htmlBlocks?.[pageKey])
    ? safeCopy.__htmlBlocks[pageKey]
    : [];
  if (htmlBlocks.length) {
    const prepend = htmlBlocks
      .filter((b: any) => b?.action === "prepend" && b.html)
      .map((b: any) => b.html)
      .join("");
    const appendItems = htmlBlocks.filter(
      (b: any) => b?.action !== "prepend" && b?.action !== "replace" && b.html
    );
    const replaceItems = htmlBlocks.filter((b: any) => b?.action === "replace" && b.html);
    const wrapBlocks = (html: string) => {
      if (!html) return "";
      const cols = layout?.blocksColumns;
      if (cols && cols >= 2) {
        return `<div class="html-blocks-grid" data-ai-section="blocks" data-ai-id="home.blocks" id="blocks">${html}</div>`;
      }
      return `<div data-ai-section="blocks" data-ai-id="home.blocks" id="blocks">${html}</div>`;
    };
    if (replaceItems.length) {
      body = wrapBlocks(replaceItems.map((b: any) => b.html).join(""));
    } else {
      if (prepend) body = wrapBlocks(prepend) + body;
      if (appendItems.length) {
        body += wrapBlocks(appendItems.map((b: any) => b.html).join(""));
      }
    }
  }

  body = rewriteMissingPageLinks(body, allPages);
  body = applySectionVisibility(
    body,
    (safeCopy as any)?.__meta?.sectionState || null
  );

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brand)} — ${esc(page.label)}</title>
<meta name="description" content="${esc(hero.subtitle)}">
<style>${baseCSS(accent, template.font, layout)}${
    bgOverride ? `\nbody{background:${bgOverride} !important}` : ""
  }</style></head>
<body>${navHTML(brand, allPages, page.slug, theme.hero)}${body}${footerHTML(brand)}</body></html>`;
}

/** Tag unmarked <section>s so Studio/AI can target template body blocks. */
function stampTemplateSections(html: string, pageKey: string, contentKeys: string[]): string {
  let idx = 0;
  return html.replace(/<section(\s[^>]*)?>/gi, (full, attrs = "") => {
    if (/data-ai-section\s*=/i.test(attrs || "")) return full;
    idx += 1;
    const idAttr = ((attrs || "").match(/\bid=["']([^"']+)/i) || [])[1];
    const cls = ((attrs || "").match(/\bclass=["']([^"']+)/i) || [])[1] || "";
    let name =
      idAttr ||
      (/hero/i.test(cls) ? "hero" : "") ||
      (/service/i.test(cls) ? "services" : "") ||
      (/work|portfolio|project/i.test(cls) ? "work" : "") ||
      (/about/i.test(cls) ? "about" : "") ||
      (/contact/i.test(cls) ? "contact" : "") ||
      (/capabilit/i.test(cls) ? "capabilities" : "") ||
      (/highlight/i.test(cls) ? "highlights" : "") ||
      (/feature/i.test(cls) ? "featured" : "") ||
      (/shop|product/i.test(cls) ? "shop" : "") ||
      "";
    if (!name) {
      const match = contentKeys.find(
        (k) => k !== "hero" && k !== "contact" // hero/contact often elsewhere
      );
      // Prefer ordered content keys for unmarked sections
      name = contentKeys[Math.min(idx - 1, contentKeys.length - 1)] || `section-${idx}`;
      void match;
    }
    if (contentKeys.includes(name) || !name) {
      /* keep */
    } else {
      const fuzzy = contentKeys.find((k) => name.includes(k) || k.includes(name));
      if (fuzzy) name = fuzzy;
    }
    const canonical = name.includes(".") ? name : `${pageKey}.${name}`;
    const cleaned = (attrs || "")
      .replace(/\sid=["'][^"']*["']/i, "")
      .replace(/\sdata-ai-id=["'][^"']*["']/i, "");
    return `<section data-ai-section="${name}" data-ai-id="${canonical}" id="${name}"${cleaned}>`;
  });
}

/** Honor config.sectionState hide/show for data-ai-section / data-ai-id. */
function applySectionVisibility(
  html: string,
  sectionState: Record<string, { visible?: boolean; order?: number }> | null
): string {
  if (!sectionState) return html;
  let out = html;
  for (const [id, state] of Object.entries(sectionState)) {
    if (state?.visible !== false) continue;
    const key = id.replace(/^home\./, "");
    const patterns = [id, key].filter(Boolean);
    for (const p of patterns) {
      const re = new RegExp(
        `<(section|div|header)(\\s[^>]*?(?:data-ai-section|data-ai-id)=["']${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*)>`,
        "gi"
      );
      out = out.replace(re, `<$1$2 hidden style="display:none!important">`);
    }
  }
  return out;
}

/** Point hrefs at existing pages only (prompt-driven sites omit template defaults). */
function rewriteMissingPageLinks(html: string, pages: PageDef[]): string {
  const slugs = setSlugs(pages);
  const fallback =
    pages.find((p) => p.key === "contact")?.slug ||
    pages.find((p) => p.key !== "home")?.slug ||
    pages[0]?.slug ||
    "#";
  return html.replace(/href="([^"]+\.html)"/g, (full, slug: string) => {
    if (slugs.has(slug)) return full;
    return `href="${fallback}"`;
  });
}

function setSlugs(pages: PageDef[]) {
  return new Set(pages.map((p) => p.slug));
}
