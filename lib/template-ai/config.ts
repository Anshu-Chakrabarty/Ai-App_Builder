// lib/template-ai/config.ts — apply AI JSON updates to config (template code never changes)
import type { ConfigUpdate, SiteConfig, TemplateManifest } from "./types";
import type { PageDef } from "@/lib/types";
import { slugForPage } from "@/lib/page-designs";

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
    media: config.media
      ? { ...config.media, gallery: [...(config.media.gallery || [])] }
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

    const path = resolveUpdatePath(u, manifest);

    // Imagery / background live in config.media, not content
    if (path === "media" || path.startsWith("media.")) {
      const baseMedia = next.media || { hero: "", gallery: [], category: "default" };
      const mediaPath = path === "media" ? "" : path.slice("media.".length);
      if (op === "delete") {
        next.media = mediaPath ? deleteByPath(baseMedia, mediaPath) : baseMedia;
      } else {
        next.media = mediaPath ? setByPath(baseMedia, mediaPath, value) : value;
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
      sectionState: config.sectionState,
    },
  };
}

export function listEditableCatalog(manifest: TemplateManifest): string {
  return manifest.editableFields
    .slice(0, 120)
    .map((f) => `- ${f.id} (${f.type}) on ${f.pageKey}/${f.sectionId}`)
    .join("\n");
}
