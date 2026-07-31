// lib/template-ai/render-bound.ts — fill {{bindings}} from SiteConfig (template HTML unchanged structurally)
import type { SiteConfig, TemplateKnowledge } from "./types";
import { getByPath } from "./config";

/**
 * Render bound HTML pages by substituting {{path}} from config.
 * Template code (structure/CSS) stays as ingested — only data changes.
 */
export function renderBoundPages(args: {
  boundPages: Record<string, string>;
  config: SiteConfig;
  knowledge?: TemplateKnowledge;
  assets?: Record<string, string>;
}): Record<string, string> {
  const { boundPages, config, knowledge, assets } = args;
  const out: Record<string, string> = {};
  const themeCss = themeVarsCss(config, knowledge);

  for (const [slug, html] of Object.entries(boundPages)) {
    let rendered = substituteBindings(html, config);
    if (assets) {
      rendered = resolveAssetPlaceholders(rendered, assets);
    }
    rendered = injectThemeVars(rendered, themeCss);
    // Apply background override if present
    const bg = config.media?.background || config.theme?.background;
    if (bg) {
      rendered = injectThemeVars(
        rendered,
        `body{background:${bg} !important}`
      );
    }
    out[slug] = rendered;
  }
  return out;
}

function substituteBindings(html: string, config: SiteConfig): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_.[\]]+)\s*\}\}/g, (_m, rawPath: string) => {
    const path = rawPath.trim();
    if (path === "brandName") return esc(config.brandName);
    if (path === "accent" || path === "theme.primary") return esc(config.accent);

    if (path === "media.hero") return esc(config.media?.hero || "");
    if (path === "media.split") return esc(config.media?.split || "");
    if (path === "media.banner") return esc(config.media?.banner || "");
    if (path === "media.background") return esc(config.media?.background || "");
    if (path.startsWith("media.gallery.")) {
      const idx = Number(path.split(".").pop());
      return esc(config.media?.gallery?.[idx] || "");
    }
    if (path.startsWith("theme.")) {
      const k = path.slice("theme.".length);
      return esc(config.theme?.[k] ?? "");
    }

    const fromContent = getByPath(config.content, path);
    if (fromContent != null && typeof fromContent !== "object") {
      return esc(String(fromContent));
    }
    // Leave unknown bindings empty (avoid showing raw mustache)
    return "";
  });
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function themeVarsCss(config: SiteConfig, knowledge?: TemplateKnowledge): string {
  const t = knowledge?.themeTokens;
  const primary = config.accent || t?.primary || "#2563EB";
  const text = t?.neutrals.text || "#1a1a1a";
  const muted = t?.neutrals.muted || "#5b6472";
  const bg = config.media?.background || config.theme?.background || t?.neutrals.bg || "#ffffff";
  const wrap = knowledge?.layoutRules.wrapMaxWidth || "1100px";
  return `:root{--ai-primary:${primary};--ai-text:${text};--ai-muted:${muted};--ai-bg:${bg};--ai-wrap:${wrap}}`;
}

function injectThemeVars(html: string, css: string): string {
  const tag = `<style data-ai-theme="1">${css}</style>`;
  if (/data-ai-theme="1"/.test(html)) {
    return html.replace(/<style data-ai-theme="1">[\s\S]*?<\/style>/, tag);
  }
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}</head>`);
  return tag + html;
}

function resolveAssetPlaceholders(html: string, assets: Record<string, string>): string {
  return html.replace(/\{\{asset:([^}]+)\}\}/g, (_m, path: string) => assets[path.trim()] || "");
}
