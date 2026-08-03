// lib/template-ai/config.ts — apply AI JSON updates to config (template code never changes)
import type { ConfigUpdate, SiteConfig, TemplateManifest } from "./types";
import type { PageDef } from "@/lib/types";
import { slugForPage } from "@/lib/page-designs";
import { sanitizeCss, setStylePath, type SiteStyles } from "@/lib/site-styles";

export function getByPath(obj: any, path: string): any {
  if (!path) return obj;
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function setByPath(obj: any, path: string, value: any): any {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  if (!parts.length) return value;
  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur: any = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const next = parts[i + 1];
    const isIndex = /^\d+$/.test(next);
    if (cur[p] == null) cur[p] = isIndex ? [] : {};
    else if (Array.isArray(cur[p])) cur[p] = [...cur[p]];
    else if (typeof cur[p] === "object") cur[p] = { ...cur[p] };
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return root;
}

export function deleteByPath(obj: any, path: string): any {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  if (!parts.length) return obj;
  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur: any = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null) return root;
    if (Array.isArray(cur[p])) cur[p] = [...cur[p]];
    else cur[p] = { ...cur[p] };
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (Array.isArray(cur) && /^\d+$/.test(last)) cur.splice(Number(last), 1);
  else delete cur[last];
  return root;
}

/** Resolve field id from manifest (id may equal path). */
export function resolveUpdatePath(
  update: ConfigUpdate,
  manifest: TemplateManifest
): string {
  const field = manifest.editableFields.find((f) => f.id === update.id);
  if (field) return field.path;
  // Allow direct dotted paths / known aliases
  if (update.id.startsWith("theme.")) return update.id;
  if (update.id.startsWith("layout.")) return update.id;
  if (update.id.startsWith("styles.")) return update.id;
  if (update.id === "brandName" || update.id === "accent") return update.id;
  return update.id;
}

/**
 * Apply AI output updates → config.json merge.
 * This is the only mutation surface after templates are AI-ready.
 */
export function applyUpdatesToConfig(
  config: SiteConfig,
  updates: ConfigUpdate[],
  manifest: TemplateManifest
): SiteConfig {
  let next: SiteConfig = {
    ...config,
    content: structuredClone(config.content),
    theme: { ...(config.theme || {}) },
    layout: { ...(config.layout || {}) },
    styles: config.styles ? structuredClone(config.styles) : {},
    media: config.media
      ? {
          ...config.media,
          gallery: [...(config.media.gallery || [])],
          // Backfill split/banner for older projects so section edits stick
          split: config.media.split || config.media.gallery?.[1] || config.media.hero,
          banner: config.media.banner || config.media.gallery?.[2] || config.media.hero,
        }
      : config.media,
    sectionState: { ...(config.sectionState || {}) },
    customPages: { ...(config.customPages || {}) },
    pages: [...config.pages],
    updatedAt: Date.now(),
  };

  for (const u of updates || []) {
    const op = u.op || "set";
    const value = u.value !== undefined ? u.value : u.url;

    if (op === "hide_section" || (u.type === "section" && u.value === false)) {
      next.sectionState![u.id] = { ...(next.sectionState![u.id] || {}), visible: false };
      continue;
    }
    if (op === "show_section") {
      next.sectionState![u.id] = { ...(next.sectionState![u.id] || {}), visible: true };
      continue;
    }
    if (op === "remove_page") {
      const key = u.id.replace(/^page\./, "");
      if (key !== "home") {
        next.pages = next.pages.filter((p) => p.key !== key);
        next.content = deleteByPath(next.content, key);
        delete next.customPages![key];
      }
      continue;
    }
    if (op === "add_page" && value && typeof value === "object") {
      const key = String(value.key || u.id).replace(/^page\./, "");
      const label = String(value.label || key);
      const page: PageDef = {
        key,
        label,
        slug: slugForPage(key),
        designId: value.designId,
      };
      if (!next.pages.some((p) => p.key === key)) next.pages.push(page);
      next.content = setByPath(next.content, key, value.content || value);
      continue;
    }

    if (u.id === "brandName") {
      next.brandName = String(value ?? next.brandName);
      continue;
    }
    if (u.id === "accent" || u.id === "theme.primary") {
      next.accent = String(value ?? next.accent);
      next.theme!.primary = next.accent;
      continue;
    }
    if (u.id.startsWith("theme.")) {
      const k = u.id.slice("theme.".length);
      next.theme![k] = value;
      continue;
    }
    if (u.type === "layout" || u.id.startsWith("layout.")) {
      const key = u.id.startsWith("layout.") ? u.id.slice("layout.".length) : String(u.id);
      const layout = { ...(next.layout || {}) } as Record<string, any>;
      if (op === "delete") {
        delete layout[key];
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(layout, value);
      } else {
        layout[key] = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
      }
      next.layout = layout as SiteConfig["layout"];
      continue;
    }

    // CSS / style channel — tokens, nav hover, motion, patches, customCss
    if (
      u.type === "css" ||
      u.type === "style" ||
      u.id.startsWith("styles.") ||
      u.id === "customCss"
    ) {
      const styles = { ...(next.styles || {}) } as SiteStyles;
      const id = u.id === "customCss" ? "styles.customCss" : u.id;
      if (op === "delete") {
        next.styles = setStylePath(styles, id, null);
      } else if (op === "append" && (id.endsWith("customCss") || id === "styles.customCss")) {
        const prev = styles.customCss || "";
        next.styles = setStylePath(
          styles,
          "styles.customCss",
          sanitizeCss(`${prev}\n${String(value ?? "")}`)
        );
      } else if (value && typeof value === "object" && !Array.isArray(value) && id === "styles") {
        next.styles = { ...styles, ...(value as SiteStyles) };
      } else {
        next.styles = setStylePath(styles, id, value);
      }
      continue;
    }

    const path = resolveUpdatePath(u, manifest);

    // Imagery / background live in config.media, not content
    if (path === "media" || path.startsWith("media.")) {
      const baseMedia = next.media || { hero: "", gallery: [] as string[], category: "default" };
      const mediaPath = path === "media" ? "" : path.slice("media.".length);
      if (op === "delete") {
        next.media = mediaPath ? deleteByPath(baseMedia, mediaPath) : baseMedia;
      } else {
        // Reliable gallery[N] writes (setByPath can miss array indices)
        const galMatch = mediaPath.match(/^gallery\.(\d+)$/);
        if (galMatch) {
          const i = Number(galMatch[1]);
          const gallery = [...(baseMedia.gallery || [])];
          while (gallery.length <= i) {
            gallery.push(gallery[gallery.length - 1] || baseMedia.hero || "");
          }
          gallery[i] = String(value ?? "");
          next.media = { ...baseMedia, gallery };
        } else {
          next.media = mediaPath ? setByPath(baseMedia, mediaPath, value) : value;
        }
      }
      continue;
    }

    // Paths for page-scoped design content already include page key
    if (op === "delete") {
      next.content = deleteByPath(next.content, path);
    } else {
      // Root-level schema fields live at content root (hero.title not home.hero.title)
      next.content = setByPath(next.content, path, value);
    }
  }

  return next;
}

/** Convert config back to the copy object expected by existing template.render */
export function configToCopy(config: SiteConfig): Record<string, any> {
  return {
    ...structuredClone(config.content),
    __meta: {
      brandName: config.brandName,
      accent: config.accent,
      theme: config.theme,
      media: config.media,
      layout: config.layout,
      styles: config.styles,
      sectionState: config.sectionState,
    },
  };
}

export function listEditableCatalog(manifest: TemplateManifest): string {
  return manifest.editableFields
    .slice(0, 400)
    .map((f) => `- ${f.id} (${f.type}) on ${f.pageKey}/${f.sectionId} — ${f.label}`)
    .join("\n");
}

/**
 * Explicit section map so the agent understands every block it can edit
 * (hero, template sections, split, gallery, features, widgets, …).
 */
export function listSectionMap(
  manifest: TemplateManifest,
  pageKey: string,
  sectionState?: SiteConfig["sectionState"]
): string {
  const secs = (manifest.sections || []).filter(
    (s) => s.pageKey === pageKey || s.pageKey === "home" || s.pageKey === "site"
  );
  if (!secs.length) return "(no sections registered)";
  return secs
    .map((s) => {
      const fields = (manifest.editableFields || [])
        .filter((f) => f.sectionId === s.id || f.sectionId === s.component)
        .map((f) => f.id)
        .slice(0, 14);
      const st = sectionState?.[s.id] || sectionState?.[s.component];
      const vis = st?.visible === false ? "hidden" : "visible";
      return `- ${s.id} (“${s.name}”) [${vis}] · ${s.component} · edit: ${fields.join(", ") || "section ops"}`;
    })
    .join("\n");
}
