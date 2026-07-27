// lib/template-ai/ingest/parse-html.ts — detect pages/sections/editable elements
import { parse, HTMLElement, Node, TextNode, NodeType } from "node-html-parser";
import type { EditableField, EditableFieldType, SectionDef } from "../types";
import type { PageDef } from "@/lib/types";

export type ParsedEditable = {
  field: EditableField;
  /** CSS-ish path used during binding (data-ai-id will be set) */
  value: string;
  attr?: "text" | "src" | "href" | "alt";
  /** Unique marker stamped on the node before serialization */
  marker: string;
};

export type ParsedPage = {
  pageKey: string;
  label: string;
  slug: string;
  fileName: string;
  sections: SectionDef[];
  editables: ParsedEditable[];
  root: HTMLElement;
  html: string;
};

const SECTION_HINT =
  /hero|feature|service|faq|cta|pricing|testimonial|team|about|contact|gallery|footer|header|banner|pricing|stats|blog/i;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.html?$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "page";
}

export function pageKeyFromFileName(fileName: string): { key: string; label: string; slug: string } {
  const base = fileName.split(/[/\\]/).pop() || fileName;
  const raw = slugify(base);
  if (raw === "index" || raw === "home" || raw === "") {
    return { key: "home", label: "Home", slug: "index.html" };
  }
  const label = raw
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { key: raw, label, slug: `${raw}.html` };
}

function guessSectionName(el: HTMLElement, index: number): { name: string; component: string } {
  const id = (el.getAttribute("id") || "").toLowerCase();
  const cls = (el.getAttribute("class") || "").toLowerCase();
  const tag = el.tagName.toLowerCase();
  const blob = `${id} ${cls} ${tag}`;
  const match = blob.match(SECTION_HINT);
  if (match) {
    const component = match[0].toLowerCase();
    return { name: component.charAt(0).toUpperCase() + component.slice(1), component };
  }
  if (tag === "header") return { name: "Header", component: "header" };
  if (tag === "footer") return { name: "Footer", component: "footer" };
  if (tag === "nav") return { name: "Nav", component: "nav" };
  return { name: `Section ${index + 1}`, component: `section${index + 1}` };
}

function fieldTypeFor(tag: string, attr: string, text: string): EditableFieldType {
  if (attr === "src" || tag === "img") return "image";
  if (attr === "href") return "url";
  if (text.length > 80) return "textarea";
  return "text";
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Parse a single HTML document into sections + editable elements.
 * Stamps data-ai-id markers on nodes for the binder.
 */
export function parseHtmlDocument(args: {
  html: string;
  fileName: string;
  templateId?: string;
}): ParsedPage {
  const { key, label, slug } = pageKeyFromFileName(args.fileName);
  const root = parse(args.html, { comment: true });
  const sections: SectionDef[] = [];
  const editables: ParsedEditable[] = [];
  const usedIds = new Set<string>();

  const sectionEls = root.querySelectorAll(
    "section, header, footer, [class*='hero'], [class*='feature'], [class*='service'], [class*='faq'], [class*='cta'], [class*='pricing'], [class*='team'], [class*='testimonial'], [class*='banner'], [class*='gallery']"
  );

  const uniqueSections: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  for (const el of sectionEls) {
    if (!(el instanceof HTMLElement)) continue;
    // Prefer outermost: skip if an ancestor is already selected
    let ancestor = el.parentNode as HTMLElement | null;
    let nested = false;
    while (ancestor && ancestor instanceof HTMLElement) {
      if (seen.has(ancestor)) {
        nested = true;
        break;
      }
      ancestor = ancestor.parentNode as HTMLElement | null;
    }
    if (nested) continue;
    seen.add(el);
    uniqueSections.push(el);
  }

  if (!uniqueSections.length) {
    const body = root.querySelector("body") || root;
    if (body instanceof HTMLElement) uniqueSections.push(body);
  }

  uniqueSections.forEach((secEl, secIdx) => {
    const { name, component } = guessSectionName(secEl, secIdx);
    const sectionId = `${key}.${component}`;
    const section: SectionDef = {
      id: sectionId,
      pageKey: key,
      name,
      component,
      order: secIdx,
      editableFields: [],
    };
    sections.push(section);

    // Headings
    secEl.querySelectorAll("h1, h2, h3").forEach((node, i) => {
      if (!(node instanceof HTMLElement)) return;
      const text = cleanText(node.text);
      if (!text || text.length < 2) return;
      const role = node.tagName.toLowerCase() === "h1" ? "title" : i === 0 ? "heading" : `heading${i}`;
      const id = uniqueId(usedIds, `${component}.${role}`);
      const marker = `ai-${key}-${id.replace(/\./g, "-")}`;
      node.setAttribute("data-ai-id", id);
      node.setAttribute("data-ai-marker", marker);
      const field: EditableField = {
        id,
        type: fieldTypeFor(node.tagName, "text", text),
        label: `${name} ${role}`,
        sectionId,
        pageKey: key,
        maxLength: text.length > 80 ? 400 : 80,
        path: id,
      };
      editables.push({ field, value: text, attr: "text", marker });
      section.editableFields.push(id);
    });

    // Paragraphs (limit per section)
    let pCount = 0;
    secEl.querySelectorAll("p").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (pCount >= 4) return;
      const text = cleanText(node.text);
      if (!text || text.length < 8) return;
      pCount++;
      const role = pCount === 1 ? "subtitle" : `body${pCount}`;
      const id = uniqueId(usedIds, `${component}.${role}`);
      const marker = `ai-${key}-${id.replace(/\./g, "-")}`;
      node.setAttribute("data-ai-id", id);
      node.setAttribute("data-ai-marker", marker);
      const field: EditableField = {
        id,
        type: "textarea",
        label: `${name} ${role}`,
        sectionId,
        pageKey: key,
        maxLength: 400,
        path: id,
      };
      editables.push({ field, value: text, attr: "text", marker });
      section.editableFields.push(id);
    });

    // Buttons / CTAs
    let btnCount = 0;
    secEl.querySelectorAll("a.btn, a.button, button, .btn, .cta a, a[class*='btn']").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (btnCount >= 3) return;
      const text = cleanText(node.text);
      if (!text || text.length > 60) return;
      btnCount++;
      const role = btnCount === 1 ? "ctaText" : `cta${btnCount}`;
      const id = uniqueId(usedIds, `${component}.${role}`);
      const marker = `ai-${key}-${id.replace(/\./g, "-")}`;
      node.setAttribute("data-ai-id", id);
      node.setAttribute("data-ai-marker", marker);
      const field: EditableField = {
        id,
        type: "text",
        label: `${name} CTA`,
        sectionId,
        pageKey: key,
        maxLength: 40,
        path: id,
      };
      editables.push({ field, value: text, attr: "text", marker });
      section.editableFields.push(id);
    });

    // Images
    let imgCount = 0;
    secEl.querySelectorAll("img").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (imgCount >= 4) return;
      const src = node.getAttribute("src") || "";
      if (!src || src.startsWith("data:image/svg")) return;
      imgCount++;
      const role =
        /hero|banner|cover/i.test(secEl.getAttribute("class") || "") && imgCount === 1
          ? "image"
          : `image${imgCount}`;
      const id = uniqueId(usedIds, `${component}.${role}`);
      const marker = `ai-${key}-${id.replace(/\./g, "-")}`;
      node.setAttribute("data-ai-id", id);
      node.setAttribute("data-ai-marker", marker);
      const field: EditableField = {
        id,
        type: "image",
        label: `${name} image`,
        sectionId,
        pageKey: key,
        path: id,
      };
      editables.push({ field, value: src, attr: "src", marker });
      section.editableFields.push(id);
    });

    // Form labels
    let labelCount = 0;
    secEl.querySelectorAll("label").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (labelCount >= 4) return;
      const text = cleanText(node.text);
      if (!text || text.length > 40) return;
      labelCount++;
      const id = uniqueId(usedIds, `${component}.label${labelCount}`);
      const marker = `ai-${key}-${id.replace(/\./g, "-")}`;
      node.setAttribute("data-ai-id", id);
      node.setAttribute("data-ai-marker", marker);
      const field: EditableField = {
        id,
        type: "text",
        label: `${name} label`,
        sectionId,
        pageKey: key,
        maxLength: 40,
        path: id,
      };
      editables.push({ field, value: text, attr: "text", marker });
      section.editableFields.push(id);
    });
  });

  return {
    pageKey: key,
    label,
    slug,
    fileName: args.fileName,
    sections,
    editables,
    root,
    html: root.toString(),
  };
}

function uniqueId(used: Set<string>, base: string): string {
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}_${n++}`;
  }
  used.add(id);
  return id;
}

export function pagesFromParsed(parsed: ParsedPage[]): PageDef[] {
  return parsed.map((p) => ({
    key: p.pageKey,
    label: p.label,
    slug: p.slug,
  }));
}

/** Silence unused Node imports for tree tools */
void Node;
void TextNode;
void NodeType;
