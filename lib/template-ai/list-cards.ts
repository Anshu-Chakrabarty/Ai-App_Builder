// lib/template-ai/list-cards.ts — expand/reshape card lists (services, features, etc.)
import type { ConfigUpdate, SiteConfig } from "./types";
import { pickStockImage } from "./agent-helpers";

const SERVICE_SEEDS = [
  { name: "Primary care", desc: "Same-week visits with clear follow-up plans." },
  { name: "Specialty clinics", desc: "Coordinated referrals across key departments." },
  { name: "Diagnostics", desc: "On-site imaging and lab with fast results." },
  { name: "Urgent care", desc: "Walk-in support when you need answers quickly." },
  { name: "Patient portal", desc: "Records, messaging, and prescriptions in one place." },
  { name: "Care navigation", desc: "Guidance from intake through recovery." },
];

const WORD_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function parseCountToken(raw: string): number | null {
  const t = String(raw || "")
    .trim()
    .toLowerCase();
  if (/^\d{1,2}$/.test(t)) return Number(t);
  if (WORD_NUM[t] != null) return WORD_NUM[t];
  return null;
}

/** True when user wants to remove/shrink cards — never hide the whole section. */
export function isCardRemoveOrResizePrompt(prompt: string): boolean {
  const msg = (prompt || "").toLowerCase();
  if (!/\bcards?\b/.test(msg)) return false;
  return (
    /\b(remove|delete|drop|trim|cut)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\w+\s+){0,3}cards?\b/.test(
      msg
    ) ||
    /\b(remove|delete|drop)\s+(?:\w+\s+){0,2}cards?\b/.test(msg) ||
    /\b(keep|leave|only)\s+(\d{1,2}|one|two|three|four|five|six)\s+cards?\b/.test(msg) ||
    /\breduce\s+(?:to\s+)?(\d{1,2}|one|two|three|four|five|six)\s+cards?\b/.test(msg) ||
    /\bmake\s+(?:it|them)\s+(\d{1,2}|one|two|three|four|five|six)\s+cards?\b/.test(msg)
  );
}

/**
 * Detect “make it 6 cards”, “remove 3 cards”, “keep only 3 cards”, etc.
 * Pass currentLength so “remove 3” → current - 3.
 */
export function detectCardCountRequest(
  prompt: string,
  currentLength?: number
): {
  count: number | null;
  columns: number | null;
  wantImages: boolean;
  wantText: boolean;
  removeDelta: number | null;
} {
  const msg = (prompt || "").toLowerCase();
  let count: number | null = null;
  let columns: number | null = null;
  let removeDelta: number | null = null;

  // “remove 3 cards” / “delete three cards” → shrink by N (do NOT hide section)
  const removeN = msg.match(
    /\b(?:remove|delete|drop|trim|cut)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\w+\s+){0,3}cards?\b/
  );
  if (removeN) {
    removeDelta = parseCountToken(removeN[1]);
    if (removeDelta != null) {
      const cur = typeof currentLength === "number" ? currentLength : null;
      if (cur != null) {
        count = Math.max(1, cur - removeDelta);
      }
      // If current unknown, buildCardListUpdates will resolve with list length
    }
  }

  // “keep only 3 cards” / “leave 3 cards” / “reduce to 3 cards”
  if (count == null) {
    const keep = msg.match(
      /\b(?:keep|leave|only)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\w+\s+){0,2}cards?\b/
    ) ||
      msg.match(
        /\breduce\s+(?:to\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\w+\s+){0,2}cards?\b/
      );
    if (keep) count = parseCountToken(keep[1]);
  }

  // Prefer explicit target count over “there are 4 cards …”
  if (count == null) {
    const makeIt =
      msg.match(/\bmake\s+(?:it|them)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\w+\s+){0,2}cards?\b/) ||
      msg.match(/\b(?:to|into|show|use|want|need)\s+(\d{1,2})\s+(?:\w+\s+){0,2}cards?\b/) ||
      msg.match(/\b(?:expand|grow|resize)\s+(?:to\s+)?(\d{1,2})\s+(?:\w+\s+){0,2}cards?\b/) ||
      msg.match(/\b(\d{1,2})\s+(?:service\s+|feature\s+|pricing\s+)?cards?\b/);
    if (makeIt) {
      count = parseCountToken(makeIt[1]);
    } else if (removeDelta == null) {
      const all = [...msg.matchAll(/\b(\d{1,2})\s+cards?\b/g)];
      if (all.length === 1) {
        if (!/\b(there\s+are|currently|have|has|only)\s+\d{1,2}\s+cards?\b/.test(msg)) {
          count = Number(all[0][1]);
        }
      } else if (all.length > 1) {
        count = Number(all[all.length - 1][1]);
      }
    }
  }

  const addMore = msg.match(/\badd\s+(\d{1,2}|one|two|three|four|five|six)\s+more\s+cards?\b/);
  if (addMore && count == null) {
    const n = parseCountToken(addMore[1]);
    if (n != null && typeof currentLength === "number") {
      count = Math.min(12, currentLength + n);
    }
  }

  const grid = msg.match(/\b(\d)\s*[x×\/]\s*(\d)\b|\b(\d)\s*by\s*(\d)\b/i);
  if (grid) {
    const a = Number(grid[1] || grid[3]);
    columns = a;
  }

  const colOnly = msg.match(/\b(\d)[- ]?col(?:umn)?s?\b/);
  if (colOnly) columns = Number(colOnly[1]);

  if (count != null) count = Math.min(12, Math.max(1, count));
  if (columns != null) columns = Math.min(6, Math.max(1, columns));

  return {
    count,
    columns,
    wantImages: /\b(image|images|photo|photos|picture|pictures|imagery)\b/.test(msg),
    wantText: /\b(text|copy|title|desc|description|modify|rewrite|update)\b/.test(msg),
    removeDelta,
  };
}

/** Which list in config.content to grow (services, departments, features). */
export function resolveCardListKey(
  prompt: string,
  target?: { id?: string; label?: string } | null,
  config?: SiteConfig
): "services" | "visual.features.items" | "departments" | "highlights" {
  const blob = `${prompt || ""} ${target?.id || ""} ${target?.label || ""}`.toLowerCase();

  if (/department/.test(blob) && Array.isArray(config?.content?.departments)) {
    return "departments";
  }
  if (
    /service|glance|care pathway|home\.services|home\.highlights|card/.test(blob) ||
    target?.id === "home.services" ||
    target?.id === "home.highlights"
  ) {
    if (Array.isArray(config?.content?.services)) return "services";
    // Hospital templates use departments on Home “Services at a glance”
    if (Array.isArray(config?.content?.departments)) return "departments";
    return "services";
  }
  if (/feature|home\.features|visual\.features/.test(blob)) {
    return "visual.features.items";
  }
  if (Array.isArray(config?.content?.services)) return "services";
  if (Array.isArray(config?.content?.departments)) return "departments";
  if (config?.content?.visual?.features?.items) return "visual.features.items";
  return "services";
}

/**
 * Build config updates: resize list + optional images/text refresh + column layout.
 */
export function buildCardListUpdates(args: {
  prompt: string;
  config: SiteConfig;
  target?: { id?: string; label?: string } | null;
}): ConfigUpdate[] {
  const listKey = resolveCardListKey(args.prompt, args.target, args.config);
  const current = getList(args.config, listKey);
  const req = detectCardCountRequest(args.prompt, current.length);

  // Resolve “remove 3 cards” when count wasn't computable without list length
  let count = req.count;
  if (count == null && req.removeDelta != null) {
    count = Math.max(1, current.length - req.removeDelta);
  }

  if (count == null && !req.wantImages && req.columns == null) return [];

  const updates: ConfigUpdate[] = [];
  const finalCount = count ?? Math.max(current.length, 4);
  const next = resizeList(current, finalCount, listKey, args.prompt, req.wantImages);

  if (listKey === "visual.features.items") {
    updates.push({
      type: "list",
      id: "visual.features.items",
      value: next,
      op: "set",
    });
  } else {
    updates.push({
      type: "list",
      id: listKey,
      value: next,
      op: "set",
    });
  }

  if (req.columns != null) {
    if (listKey === "visual.features.items") {
      updates.push({
        type: "layout",
        id: "layout.featureColumns",
        value: req.columns,
        op: "set",
      });
    } else {
      updates.push({
        type: "layout",
        id: "layout.serviceColumns",
        value: req.columns,
        op: "set",
      });
      // equal grid CSS for service cards
      updates.push({
        type: "css",
        id: "styles.patches.service-grid",
        value: `@media(min-width:721px){.service-cards-grid{grid-template-columns:repeat(${req.columns},minmax(0,1fr))!important;gap:16px}}`,
        op: "set",
      });
    }
  } else if (finalCount >= 6) {
    // Sensible default: 3 columns for 6 cards
    const cols = 3;
    if (listKey === "visual.features.items") {
      updates.push({ type: "layout", id: "layout.featureColumns", value: cols, op: "set" });
    } else {
      updates.push({ type: "layout", id: "layout.serviceColumns", value: cols, op: "set" });
      updates.push({
        type: "css",
        id: "styles.patches.service-grid",
        value: `@media(min-width:721px){.service-cards-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:16px}}`,
        op: "set",
      });
    }
  }

  return updates;
}

function getList(config: SiteConfig, key: string): any[] {
  if (key === "visual.features.items") {
    const items = config.content?.visual?.features?.items;
    return Array.isArray(items) ? structuredClone(items) : [];
  }
  const arr = config.content?.[key];
  return Array.isArray(arr) ? structuredClone(arr) : [];
}

function resizeList(
  current: any[],
  count: number,
  listKey: string,
  prompt: string,
  wantImages: boolean
): any[] {
  const next = current.slice(0, count);
  while (next.length < count) {
    const i = next.length;
    if (listKey === "visual.features.items") {
      next.push({
        icon: "spark",
        title: SERVICE_SEEDS[i % SERVICE_SEEDS.length].name,
        body: SERVICE_SEEDS[i % SERVICE_SEEDS.length].desc,
        ...(wantImages
          ? { image: pickStockImage(prompt + " medical", "healthcare") }
          : {}),
      });
    } else {
      const seed = SERVICE_SEEDS[i % SERVICE_SEEDS.length];
      next.push({
        name: seed.name,
        desc: seed.desc,
        wait: next[0]?.wait || "",
        note: next[0]?.note || "",
        floor: next[0]?.floor || `Level ${(i % 4) + 1}`,
        ...(wantImages
          ? { image: pickStockImage(prompt + " hospital " + seed.name, "healthcare") }
          : {}),
      });
    }
  }

  if (wantImages) {
    for (let i = 0; i < next.length; i++) {
      if (!next[i].image) {
        next[i] = {
          ...next[i],
          image: pickStockImage(`${prompt} card ${i} medical`, "healthcare"),
        };
      }
    }
  }

  // Light text refresh on new slots only; keep existing names unless empty
  for (let i = 0; i < next.length; i++) {
    if (listKey === "visual.features.items") {
      if (!next[i].title) next[i].title = SERVICE_SEEDS[i % SERVICE_SEEDS.length].name;
      if (!next[i].body) next[i].body = SERVICE_SEEDS[i % SERVICE_SEEDS.length].desc;
    } else {
      if (!next[i].name) next[i].name = SERVICE_SEEDS[i % SERVICE_SEEDS.length].name;
      if (!next[i].desc) next[i].desc = SERVICE_SEEDS[i % SERVICE_SEEDS.length].desc;
    }
  }

  return next;
}
