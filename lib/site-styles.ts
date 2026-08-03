// lib/site-styles.ts — AI-editable CSS / motion / hover layer (safe, config-driven)
import type { ConfigUpdate } from "@/lib/template-ai/types";

/** Design tokens + motion + component style knobs + CSS patches */
export type SiteStyles = {
  tokens?: {
    primary?: string;
    secondary?: string;
    background?: string;
    surface?: string;
    text?: string;
    muted?: string;
    border?: string;
    radius?: string;
    shadow?: string;
    fontDisplay?: string;
    fontBody?: string;
  };
  motion?: {
    duration?: string;
    easing?: string;
    hoverLift?: boolean;
    hoverScale?: number;
    reducedMotion?: boolean;
  };
  nav?: {
    linkColor?: string;
    hoverColor?: string;
    hoverOpacity?: number;
    activeColor?: string;
    activeUnderline?: boolean;
    hoverUnderline?: boolean;
    underlineThickness?: string;
    transition?: string;
    background?: string;
    blur?: boolean;
  };
  button?: {
    hoverBrightness?: number;
    hoverScale?: number;
    hoverLift?: boolean;
    transition?: string;
    radius?: string;
  };
  cards?: {
    hoverLift?: boolean;
    hoverShadow?: string;
    transition?: string;
    radius?: string;
  };
  /** Named CSS patches (merged by key — agent can replace one patch without wiping others) */
  patches?: Record<string, string>;
  /** Freeform CSS appended last (sanitized) */
  customCss?: string;
};

const MAX_CUSTOM_CSS = 12000;
const MAX_PATCH = 4000;

/** Strip dangerous CSS constructs; keep visual styling only. */
export function sanitizeCss(raw: string, max = MAX_CUSTOM_CSS): string {
  let css = String(raw || "");
  // Remove HTML / script injection vectors
  css = css.replace(/<\/?style[^>]*>/gi, "");
  css = css.replace(/<\/?script[^>]*>/gi, "");
  css = css.replace(/<[^>]+>/g, "");
  // Dangerous CSS
  css = css.replace(/@import\b[^;]*;?/gi, "");
  css = css.replace(/expression\s*\(/gi, "/*blocked*/(");
  css = css.replace(/javascript\s*:/gi, "blocked:");
  css = css.replace(/-moz-binding\s*:/gi, "blocked:");
  css = css.replace(/behavior\s*:/gi, "blocked:");
  css = css.replace(/url\s*\(\s*["']?\s*data:/gi, "url(/*blocked*/");
  // Limit size
  if (css.length > max) css = css.slice(0, max);
  return css.trim();
}

export function isStyleIntent(prompt: string): boolean {
  const msg = (prompt || "").toLowerCase();
  if (!msg) return false;
  return (
    /\b(hover|active|focus|transition|animation|animate|keyframes|easing|duration)\b/.test(msg) ||
    /\b(css|stylesheet|style|styling|look and feel|visual style)\b/.test(msg) ||
    /\b(underline|glow|shadow|blur|fade|slide|scale|lift|parallax|smooth)\b/.test(msg) ||
    /\b(nav|navigation|menu|link|button|cta)\b.*\b(color|hover|active|underline|effect)\b/.test(msg) ||
    /\b(color|colour|accent|palette|theme|tint|background)\b/.test(msg) &&
      /\b(change|make|set|update|use|switch|brighter|darker|warmer|cooler)\b/.test(msg)
  );
}

/** Compile SiteStyles → CSS injected into every page. */
export function stylesToCSS(styles?: SiteStyles | null, accent?: string): string {
  if (!styles) return "";
  const parts: string[] = ["/* AI site styles */"];
  const t = styles.tokens || {};
  const primary = t.primary || accent || "";
  const rootVars: string[] = [];
  if (t.primary) rootVars.push(`--ai-primary:${t.primary}`);
  if (t.secondary) rootVars.push(`--ai-secondary:${t.secondary}`);
  if (t.background) rootVars.push(`--ai-bg:${t.background}`);
  if (t.surface) rootVars.push(`--ai-surface:${t.surface}`);
  if (t.text) rootVars.push(`--ai-text:${t.text}`);
  if (t.muted) rootVars.push(`--ai-muted:${t.muted}`);
  if (t.border) rootVars.push(`--ai-border:${t.border}`);
  if (t.radius) rootVars.push(`--ai-radius:${t.radius}`);
  if (t.shadow) rootVars.push(`--ai-shadow:${t.shadow}`);
  if (rootVars.length) parts.push(`:root{${rootVars.join(";")}}`);

  if (t.background) parts.push(`body{background:${t.background}!important}`);
  if (t.text) parts.push(`body{color:${t.text}}`);
  if (t.muted) parts.push(`.lead,.muted,footer{color:${t.muted}}`);
  if (t.border) parts.push(`nav{border-bottom-color:${t.border}}`);
  if (primary) {
    parts.push(`.eyebrow,nav .links a:hover,nav .links a.active{color:${primary}}`);
    parts.push(`.btn,nav .nav-cta{background:${primary}}`);
    parts.push(`.btn-secondary{color:${primary};border-color:${primary}}`);
  }
  if (t.radius) {
    parts.push(`.btn,.btn-secondary,nav .nav-cta,.card-soft,.shot,.frame{border-radius:${t.radius}}`);
  }

  const motion = styles.motion || {};
  const dur = motion.duration || "220ms";
  const ease = motion.easing || "cubic-bezier(.22,.61,.36,1)";
  if (motion.reducedMotion) {
    parts.push(`*,*::before,*::after{animation:none!important;transition:none!important}`);
  } else {
    parts.push(`a,.btn,.btn-secondary,.card-soft,.shot,nav .links a{transition:color ${dur} ${ease},background ${dur} ${ease},transform ${dur} ${ease},box-shadow ${dur} ${ease},opacity ${dur} ${ease},filter ${dur} ${ease},border-color ${dur} ${ease}}`);
    if (motion.hoverLift !== false) {
      const scale = motion.hoverScale ?? 1.02;
      parts.push(`.btn:hover{transform:translateY(-2px) scale(${scale})}`);
    }
  }

  const nav = styles.nav || {};
  if (nav.background) {
    parts.push(
      `nav{background:${nav.background}${nav.blur === false ? "" : ";backdrop-filter:blur(14px)"}}`
    );
  }
  if (nav.linkColor) parts.push(`nav .links a{color:${nav.linkColor};opacity:1}`);
  if (nav.hoverColor || nav.activeColor) {
    const hover = nav.hoverColor || nav.activeColor || primary;
    const active = nav.activeColor || hover;
    parts.push(`nav .links a:hover{color:${hover};opacity:${nav.hoverOpacity ?? 1}}`);
    parts.push(`nav .links a.active{color:${active};opacity:1}`);
  }
  const underline =
    nav.hoverUnderline || nav.activeUnderline
      ? `nav .links a{position:relative}
         nav .links a::after{content:"";position:absolute;left:0;right:0;bottom:-4px;height:${nav.underlineThickness || "2px"};background:currentColor;transform:scaleX(0);transform-origin:left;transition:transform ${nav.transition || dur} ${ease}}
         ${nav.hoverUnderline ? "nav .links a:hover::after{transform:scaleX(1)}" : ""}
         ${nav.activeUnderline ? "nav .links a.active::after{transform:scaleX(1)}" : ""}`
      : "";
  if (underline) parts.push(underline);
  if (nav.transition) parts.push(`nav .links a{transition:${nav.transition}}`);

  const btn = styles.button || {};
  if (btn.radius) parts.push(`.btn,.btn-secondary,nav .nav-cta{border-radius:${btn.radius}}`);
  if (btn.transition) parts.push(`.btn,.btn-secondary{transition:${btn.transition}}`);
  if (btn.hoverBrightness) {
    parts.push(`.btn:hover{filter:brightness(${btn.hoverBrightness})}`);
  }
  if (btn.hoverLift || btn.hoverScale) {
    const sc = btn.hoverScale ?? 1.03;
    parts.push(
      `.btn:hover{transform:translateY(${btn.hoverLift === false ? "0" : "-2px"}) scale(${sc})}`
    );
  }

  const cards = styles.cards || {};
  if (cards.radius) parts.push(`.card-soft,.shot,.frame{border-radius:${cards.radius}}`);
  if (cards.transition) parts.push(`.card-soft,.shot{transition:${cards.transition}}`);
  if (cards.hoverLift !== false) {
    parts.push(
      `.card-soft:hover,.feature-icons .card-soft:hover{transform:translateY(-4px);box-shadow:${cards.hoverShadow || "0 18px 40px rgba(16,24,40,.12)"}}`
    );
  }

  // Named patches
  for (const [key, css] of Object.entries(styles.patches || {})) {
    const clean = sanitizeCss(css, MAX_PATCH);
    if (clean) parts.push(`/* patch:${key} */\n${clean}`);
  }

  if (styles.customCss) {
    const clean = sanitizeCss(styles.customCss);
    if (clean) parts.push(`/* custom */\n${clean}`);
  }

  return parts.join("\n");
}

/**
 * Deterministic style updates for common UI requests (nav hover, transitions, etc.).
 * Returns null when the prompt is too vague for a local patch.
 */
export function resolveStyleUpdates(prompt: string, accent?: string): ConfigUpdate[] | null {
  const msg = (prompt || "").toLowerCase();
  if (!isStyleIntent(msg)) return null;

  const updates: ConfigUpdate[] = [];
  const color =
    msg.match(/#([0-9a-f]{3,8})\b/i)?.[0] ||
    detectNamedColor(msg) ||
    accent ||
    "#7c3aed";

  // Navigation hover / active
  if (/\b(nav|navigation|menu|link)\b/.test(msg) || /\bhover\b/.test(msg) && !/\bbutton|cta|card\b/.test(msg)) {
    if (/\bhover\b|\bactive\b|\bunderline\b|\btransition\b|\beffect\b|\bstate\b/.test(msg)) {
      updates.push({
        type: "style",
        id: "styles.nav.hoverColor",
        value: color,
        op: "set",
      });
      updates.push({
        type: "style",
        id: "styles.nav.activeColor",
        value: color,
        op: "set",
      });
      if (/\bunderline\b|\bactive\b|\bhover\b/.test(msg)) {
        updates.push({
          type: "style",
          id: "styles.nav.hoverUnderline",
          value: true,
          op: "set",
        });
        updates.push({
          type: "style",
          id: "styles.nav.activeUnderline",
          value: true,
          op: "set",
        });
      }
      updates.push({
        type: "style",
        id: "styles.nav.transition",
        value: "color 200ms ease, transform 200ms ease",
        op: "set",
      });
      updates.push({
        type: "css",
        id: "styles.patches.nav-hover",
        value: sanitizeCss(`
nav .links a{transition:color .2s ease, opacity .2s ease, transform .2s ease}
nav .links a:hover{color:${color};opacity:1;transform:translateY(-1px)}
nav .links a.active{color:${color};opacity:1;font-weight:700}
nav .links a:hover::after,nav .links a.active::after{transform:scaleX(1)}
nav .links a{position:relative}
nav .links a::after{content:"";position:absolute;left:0;right:0;bottom:-4px;height:2px;background:currentColor;transform:scaleX(0);transform-origin:left;transition:transform .2s ease}
        `),
        op: "set",
      });
    }
  }

  // Button hover / animation
  if (/\b(button|cta|btn)\b/.test(msg) && /\b(hover|animat|transition|scale|lift|glow)\b/.test(msg)) {
    updates.push({ type: "style", id: "styles.button.hoverLift", value: true, op: "set" });
    updates.push({ type: "style", id: "styles.button.hoverScale", value: 1.04, op: "set" });
    updates.push({ type: "style", id: "styles.button.hoverBrightness", value: 1.1, op: "set" });
    updates.push({
      type: "style",
      id: "styles.button.transition",
      value: "transform 200ms ease, filter 200ms ease, box-shadow 200ms ease",
      op: "set",
    });
  }

  // Card / gallery hover
  if (/\b(card|gallery|shot|tile)\b/.test(msg) && /\b(hover|lift|shadow|animat)\b/.test(msg)) {
    updates.push({ type: "style", id: "styles.cards.hoverLift", value: true, op: "set" });
    updates.push({
      type: "css",
      id: "styles.patches.card-hover",
      value: sanitizeCss(`
.photo-grid .shot{transition:transform .35s ease, box-shadow .35s ease}
.photo-grid .shot:hover{transform:translateY(-4px);box-shadow:0 16px 36px rgba(16,24,40,.14)}
.feature-icons .card-soft{transition:transform .25s ease, box-shadow .25s ease}
      `),
      op: "set",
    });
  }

  // Global transitions / smoother motion
  if (/\b(transition|animat|smooth|motion|easing)\b/.test(msg) && !updates.length) {
    updates.push({ type: "style", id: "styles.motion.duration", value: "240ms", op: "set" });
    updates.push({
      type: "style",
      id: "styles.motion.easing",
      value: "cubic-bezier(.22,.61,.36,1)",
      op: "set",
    });
    updates.push({ type: "style", id: "styles.motion.hoverLift", value: true, op: "set" });
  }

  // Accent / primary color
  if (/\b(accent|primary|brand color|theme color)\b/.test(msg) || (/\bcolor\b/.test(msg) && /\b(site|whole|everything|global)\b/.test(msg))) {
    updates.push({ type: "theme", id: "theme.primary", value: color, op: "set" });
    updates.push({ type: "style", id: "styles.tokens.primary", value: color, op: "set" });
  }

  // Background
  if (/\bbackground\b/.test(msg) && !/\bhero\b/.test(msg)) {
    const bg = detectNamedColor(msg) || msg.match(/#([0-9a-f]{3,8})\b/i)?.[0];
    if (bg) {
      updates.push({ type: "theme", id: "theme.background", value: bg, op: "set" });
      updates.push({ type: "style", id: "styles.tokens.background", value: bg, op: "set" });
    }
  }

  // Fade-in sections
  if (/\bfade[- ]?in\b|\banimate\s+sections?\b|\bentrance\b/.test(msg)) {
    updates.push({
      type: "css",
      id: "styles.patches.section-fade",
      value: sanitizeCss(`
@keyframes aiFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
section{animation:aiFadeUp .55s cubic-bezier(.22,.61,.36,1) both}
@media (prefers-reduced-motion:reduce){section{animation:none}}
      `),
      op: "set",
    });
  }

  return updates.length ? updates : null;
}

function detectNamedColor(msg: string): string | null {
  const named: Record<string, string> = {
    black: "#0b0e14",
    white: "#ffffff",
    navy: "#0b1e3f",
    blue: "#2563eb",
    green: "#059669",
    purple: "#7c3aed",
    violet: "#7c3aed",
    red: "#dc2626",
    orange: "#ea580c",
    teal: "#0d9488",
    pink: "#db2777",
    gray: "#4b5563",
    grey: "#4b5563",
    gold: "#d97706",
    cream: "#faf6ef",
  };
  for (const [name, val] of Object.entries(named)) {
    if (new RegExp(`\\b${name}\\b`).test(msg)) return val;
  }
  return null;
}

/** Deep-set a dotted path into styles object */
export function setStylePath(styles: SiteStyles, path: string, value: unknown): SiteStyles {
  const clean = path.replace(/^styles\./, "");
  const parts = clean.split(".").filter(Boolean);
  const root: any = { ...styles };
  if (parts[0] === "customCss") {
    root.customCss =
      typeof value === "string" ? sanitizeCss(value) : String(value ?? "");
    return root;
  }
  if (parts[0] === "patches" && parts[1]) {
    root.patches = { ...(root.patches || {}) };
    if (value == null || value === "") delete root.patches[parts[1]];
    else root.patches[parts[1]] = sanitizeCss(String(value), MAX_PATCH);
    return root;
  }
  let cur: any = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    cur[p] = { ...(cur[p] || {}) };
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return root;
}
