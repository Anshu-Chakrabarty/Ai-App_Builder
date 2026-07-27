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
  resolveMediaTheme,
  renderVisualPackage,
  renderOptionalHomeHero,
} from "./site-media";

export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
export const SANS =
  '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const DISPLAY =
  '"Fraunces", Georgia, "Times New Roman", serif';

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function baseCSS(accent: string, font: string): string {
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
    @media(max-width:720px){nav .links a:not(.nav-cta){display:none}}
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
  if (pageKey === "home" && stored.length === 0) {
    defaults.push(defaultHomeCta(brand), defaultHomeLeadForm());
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

  const base = resolveMediaTheme(
    template.category,
    template.id,
    template.previewImage
  );
  const metaMedia = (copy as any)?.__meta?.media;
  const theme = {
    hero: (metaMedia?.hero as string) || base.hero,
    gallery:
      Array.isArray(metaMedia?.gallery) && metaMedia.gallery.length
        ? (metaMedia.gallery as string[])
        : base.gallery,
    category: (metaMedia?.category as string) || base.category,
  };
  const bgOverride: string =
    metaMedia?.background || (copy as any)?.__meta?.theme?.background || "";
  const hero = heroBitsFromCopy(copy, brand);

  let body = "";
  if (page.designId?.startsWith("custom:")) {
    const customId = page.designId.slice("custom:".length);
    const pageCopy = copy?.[page.key] ?? {};
    body = renderCustomDesign(pageCopy.__customDesign || customId, pageCopy, accent);
  } else if (page.designId) {
    const design = getPageDesign(page.designId);
    const pageCopy = copy?.[page.key] ?? design?.fallback ?? {};
    body = design ? design.render(pageCopy, accent, brand) : `<section class="wrap"><p>Missing design</p></section>`;
  } else {
    body = template.render(copy, accent, brand, pageKey);
  }

  const visual = renderVisualPackage({
    pageKey,
    brand,
    accent,
    theme,
    heroTitle: hero.title,
    heroSubtitle: hero.subtitle,
    heroCta: hero.cta,
    pageLabel: page.label,
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

  const widgets = widgetsForPage(copy, pageKey, brand);
  if (widgets.length) {
    body +=
      `<section style="padding-top:24px;padding-bottom:40px">` +
      widgets.map((w) => renderWidget(w, accent)).join("") +
      `</section>`;
  }

  const htmlBlocks = Array.isArray(copy?.__htmlBlocks?.[pageKey])
    ? copy.__htmlBlocks[pageKey]
    : [];
  if (htmlBlocks.length) {
    const prepend = htmlBlocks
      .filter((b: any) => b?.action === "prepend" && b.html)
      .map((b: any) => b.html)
      .join("");
    const append = htmlBlocks
      .filter((b: any) => b?.action !== "prepend" && b.html)
      .map((b: any) => b.html)
      .join("");
    if (prepend) body = prepend + body;
    if (append) body += append;
  }

  body = rewriteMissingPageLinks(body, allPages);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brand)} — ${esc(page.label)}</title>
<meta name="description" content="${esc(hero.subtitle)}">
<style>${baseCSS(accent, template.font)}${
    bgOverride ? `\nbody{background:${bgOverride} !important}` : ""
  }</style></head>
<body>${navHTML(brand, allPages, page.slug, theme.hero)}${body}${footerHTML(brand)}</body></html>`;
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
