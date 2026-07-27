// lib/template-ai/ingest/bind.ts — replace static content with {{bindings}}
import type { ParsedPage } from "./parse-html";
import { setByPath } from "../config";

/**
 * Replace marked nodes with mustache bindings and extract default config values.
 * Text nodes → {{id}}; img src → src="{{id}}".
 */
export function bindParsedPage(page: ParsedPage): {
  boundHtml: string;
  content: Record<string, any>;
  bindings: Record<string, string>;
} {
  let html = page.html;
  const content: Record<string, any> = {};
  const bindings: Record<string, string> = {};

  for (const ed of page.editables) {
    const id = ed.field.id;
    bindings[id] = `{{${id}}}`;
    // Store value at dotted path matching field id
    Object.assign(content, setByPath(content, id, ed.value));

    const marker = ed.marker;
    if (ed.attr === "src") {
      // Replace src on the element that has this marker
      const re = new RegExp(
        `(data-ai-marker="${escapeReg(marker)}"[^>]*src=")([^"]*)(")|` +
          `(src=")([^"]*)("[^>]*data-ai-marker="${escapeReg(marker)}")`,
        "i"
      );
      html = html.replace(re, (_m, a1, _v1, a3, b1, _v2, b3) => {
        if (a1) return `${a1}{{${id}}}${a3}`;
        return `${b1}{{${id}}}${b3}`;
      });
      // Also try simpler: element already has marker; replace nearby src
      if (!html.includes(`{{${id}}}`)) {
        html = html.replace(
          new RegExp(`data-ai-marker="${escapeReg(marker)}"([^>]*)>`, "i"),
          (full, rest) => {
            if (/src="/i.test(rest)) {
              return `data-ai-marker="${marker}"${rest.replace(/src="[^"]*"/i, `src="{{${id}}}"`)}>`;
            }
            return full;
          }
        );
      }
    } else {
      // Replace inner text of element with data-ai-marker
      // Match opening tag with marker through closing tag of same type
      html = html.replace(
        new RegExp(
          `(<([a-z0-9]+)([^>]*data-ai-marker="${escapeReg(marker)}"[^>]*)>)([\\s\\S]*?)(<\\/\\2>)`,
          "i"
        ),
        (_m, open, _tag, _attrs, _inner, close) => `${open}{{${id}}}${close}`
      );
    }
  }

  // Clean helper attributes from bound HTML (optional keep for debugging — strip for clean output)
  html = html
    .replace(/\s*data-ai-id="[^"]*"/g, "")
    .replace(/\s*data-ai-marker="[^"]*"/g, "");

  return { boundHtml: html, content, bindings };
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Deep-merge content objects from multiple pages */
export function mergeContent(...parts: Record<string, any>[]): Record<string, any> {
  let out: Record<string, any> = {};
  for (const p of parts) {
    out = deepMerge(out, p);
  }
  return out;
}

function deepMerge(a: any, b: any): any {
  if (Array.isArray(a) && Array.isArray(b)) return b.length ? b : a;
  if (a && typeof a === "object" && b && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const out: Record<string, any> = {};
    for (const k of keys) {
      if (k in a && k in b) out[k] = deepMerge(a[k], b[k]);
      else if (k in b) out[k] = b[k];
      else out[k] = a[k];
    }
    return out;
  }
  return b !== undefined ? b : a;
}
