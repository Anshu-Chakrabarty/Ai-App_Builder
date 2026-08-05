/**
 * Generate a real site from a prompt, then prove Studio edit prompts change preview HTML.
 *
 * Output folder: docs/prompt-verify/
 *   - 00-generation-prompt.txt
 *   - baseline/config.json + home.html + services-snippet.html
 *   - after-<id>/… + report.md (for Claude or humans)
 *
 * Run: npx tsx scripts/generate-and-verify-prompts.ts
 */
import fs from "fs";
import path from "path";
import { pickSiteTemplate } from "../lib/appbuilder/pick-template";
import { analyzeTemplate } from "../lib/template-ai/analyze";
import { applyUpdatesToConfig } from "../lib/template-ai/config";
import { renderSiteFromConfig } from "../lib/template-ai/render-site";
import { understandIntent } from "../lib/template-ai/agents/understand";
import { interpretPrompt } from "../lib/template-ai/agents/interpreter";
import {
  buildCardListUpdates,
  detectCardCountRequest,
  isCardRemoveOrResizePrompt,
} from "../lib/template-ai/list-cards";
import type { ConfigUpdate, SiteConfig, TemplateManifest } from "../lib/template-ai/types";
import type { Template } from "../lib/types";

const OUT = path.join(process.cwd(), "docs", "prompt-verify");

const GENERATION_PROMPT = `Fort Hospital — a modern multi-specialty clinic website.

Home Page with hero banner, emergency contact, specialties, featured doctors, testimonials, and CTAs.
Include a "Services at a glance" section with service cards.
About Us (Vision, Mission, Management).
Departments (Cardiology, Neurology, Orthopaedics, Pediatrics).

Brand: Fort Hospital
Tone: calm, trustworthy, clinical but warm
Accent: teal / deep blue
`;

const STOCK =
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=900&q=80&auto=format&fit=crop";

type EditCase = {
  id: string;
  prompt: string;
  target?: { id: string; kind: string; label: string } | null;
  /** Seed N service cards before applying (for remove tests) */
  seedServices?: number;
};

const EDIT_PROMPTS: EditCase[] = [
  {
    id: "01-six-cards-images-3col",
    prompt:
      "in this area their are 4 cards ....make it 6 cards and also modify the cards with images and text and make it align as 3 by 3 - Services at a glance",
    target: null,
  },
  {
    id: "02-remove-three-named",
    prompt: "remove three cards from Services at a glance",
    target: null,
    seedServices: 6,
  },
  {
    id: "03-remove-three-selected",
    prompt: "remove three cards",
    target: { id: "home.services", kind: "section", label: "Services at a glance" },
    seedServices: 6,
  },
  {
    id: "04-align-3-columns-named",
    prompt: "Align Services at a glance into 3 columns",
    target: null,
  },
  {
    id: "05-hero-title-named",
    prompt: 'Change the hero title to "Care close to home"',
    target: null,
  },
  {
    id: "06-hide-gallery-named",
    prompt: "hide the gallery section",
    target: null,
  },
  {
    id: "07-accent-teal",
    prompt: "Change the accent color to #0F766E",
    target: null,
  },
];

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function write(file: string, content: string) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, "utf8");
}

function homeHtml(htmlMap: Record<string, string>): string {
  return htmlMap["index.html"] || Object.values(htmlMap)[0] || "";
}

function servicesSnippet(html: string): string {
  const m =
    html.match(
      /<section[^>]*(?:services|home\.services|service-cards)[^>]*>[\s\S]*?<\/section>/i
    ) ||
    html.match(/Services at a glance[\s\S]{0,4000}/i);
  if (!m) return "(Services section not found in HTML)";
  const raw = m[0];
  return raw.length > 6000 ? raw.slice(0, 6000) + "\n<!-- truncated -->" : raw;
}

function metrics(cfg: SiteConfig, html: string) {
  const services = Array.isArray(cfg.content?.services) ? cfg.content.services : [];
  return {
    brandName: cfg.brandName,
    accent: cfg.accent,
    heroTitle: cfg.content?.hero?.title ?? null,
    serviceCount: services.length,
    serviceCardsInHtml: (html.match(/class="service-card"/g) || []).length,
    servicesWithImages: services.filter((s: any) => !!s?.image).length,
    serviceColumns: cfg.layout?.serviceColumns ?? null,
    galleryHidden: cfg.sectionState?.["home.gallery"]?.visible === false,
    servicesHidden: cfg.sectionState?.["home.services"]?.visible === false,
    hasServicesHeading: html.includes("Services at a glance"),
    hasHeroTitleInHtml: cfg.content?.hero?.title
      ? html.includes(String(cfg.content.hero.title))
      : null,
  };
}

function applyEdit(
  config: SiteConfig,
  manifest: TemplateManifest,
  c: EditCase
): { next: SiteConfig; updates: ConfigUpdate[]; targetId: string } {
  const start = structuredClone(config) as SiteConfig;
  if (c.seedServices) {
    start.content.services = Array.from({ length: c.seedServices }).map((_, i) => ({
      name: `Service ${i + 1}`,
      desc: `Description for service ${i + 1}`,
      image: STOCK,
    }));
  }

  const intent = understandIntent({
    prompt: c.prompt,
    config: start,
    activePageKey: "home",
    target: c.target || null,
    manifest,
  });
  const inst = interpretPrompt({
    prompt: c.prompt,
    intent,
    config: start,
    manifest,
    activePageKey: "home",
  });

  let updates = [...(inst.resolvedUpdates || [])];
  const cardReq = detectCardCountRequest(c.prompt);
  if (
    cardReq.count != null ||
    cardReq.removeDelta != null ||
    isCardRemoveOrResizePrompt(c.prompt) ||
    (/\bcards?\b/i.test(c.prompt) &&
      /\b(image|photo|column|grid|align|remove|delete)\b/i.test(c.prompt))
  ) {
    const forced = buildCardListUpdates({
      prompt: c.prompt,
      config: start,
      target: c.target || intent.target || inst.target || null,
    });
    updates = updates.filter(
      (u) => !(u.op === "hide_section" || (u.type === "section" && u.value === false))
    );
    for (const f of forced) {
      if (!updates.some((u) => u.id === f.id)) updates.push(f);
    }
    if (forced.length) {
      updates = [...forced, ...updates.filter((u) => !forced.some((f) => f.id === u.id))];
    }
  }

  const next = applyUpdatesToConfig(start, updates, manifest);
  return {
    next,
    updates,
    targetId: intent.target?.id || inst.target?.id || "(none)",
  };
}

function render(
  template: Template,
  manifest: TemplateManifest,
  config: SiteConfig,
  knowledge: any
) {
  return renderSiteFromConfig({ template, manifest, config, knowledge });
}

function slimConfig(cfg: SiteConfig) {
  return {
    brandName: cfg.brandName,
    accent: cfg.accent,
    theme: cfg.theme,
    layout: cfg.layout,
    sectionState: cfg.sectionState,
    pages: cfg.pages,
    media: cfg.media
      ? {
          category: cfg.media.category,
          hero: cfg.media.hero,
          galleryCount: cfg.media.gallery?.length || 0,
        }
      : null,
    content: {
      hero: cfg.content?.hero,
      services: cfg.content?.services,
      visual: {
        gallery: cfg.content?.visual?.gallery,
        features: {
          title: cfg.content?.visual?.features?.title,
          itemCount: cfg.content?.visual?.features?.items?.length,
        },
      },
    },
  };
}

async function main() {
  ensureDir(OUT);
  // wipe previous run outputs except keep folder
  for (const name of fs.readdirSync(OUT)) {
    const p = path.join(OUT, name);
    fs.rmSync(p, { recursive: true, force: true });
  }

  write(path.join(OUT, "00-generation-prompt.txt"), GENERATION_PROMPT.trim() + "\n");

  const template = pickSiteTemplate(GENERATION_PROMPT);
  const pages = template.pages?.length
    ? template.pages
    : [{ key: "home", label: "Home", slug: "index.html" }];

  const { manifest, config: analyzed, knowledge } = analyzeTemplate({
    template,
    pages,
    content: { ...(template.fallback || {}) },
    brandName: "Fort Hospital",
    accent: "#1B4F72",
    idea: GENERATION_PROMPT,
  });

  const baseline: SiteConfig = {
    ...analyzed,
    brandName: "Fort Hospital",
    accent: "#1B4F72",
    media: analyzed.media || {
      hero: STOCK,
      gallery: [STOCK, STOCK, STOCK, STOCK],
      category: "healthcare",
      split: STOCK,
      banner: STOCK,
    },
  };

  // Ensure baseline has exactly 4 service cards (typical starting state)
  if (!Array.isArray(baseline.content.services) || baseline.content.services.length < 4) {
    baseline.content.services = [
      { name: "Patient Scheduling", desc: "Book visits online or by phone." },
      { name: "Primary Care", desc: "Same-week appointments with continuity." },
      { name: "Diagnostics", desc: "On-site labs and imaging." },
      { name: "Care Navigation", desc: "Guidance from intake through recovery." },
    ];
  } else {
    baseline.content.services = baseline.content.services.slice(0, 4).map((s: any) => ({
      name: s.name,
      desc: s.desc || s.body || "",
    }));
  }

  const baselineHtmlMap = render(template, manifest, baseline, knowledge);
  const baselineHtml = homeHtml(baselineHtmlMap);
  const baselineMetrics = metrics(baseline, baselineHtml);

  const baseDir = path.join(OUT, "baseline");
  write(path.join(baseDir, "config.json"), JSON.stringify(slimConfig(baseline), null, 2));
  write(path.join(baseDir, "home.html"), baselineHtml);
  write(path.join(baseDir, "services-snippet.html"), servicesSnippet(baselineHtml));
  write(path.join(baseDir, "metrics.json"), JSON.stringify(baselineMetrics, null, 2));

  const rows: Array<{
    id: string;
    prompt: string;
    targetId: string;
    before: ReturnType<typeof metrics>;
    after: ReturnType<typeof metrics>;
    updateIds: string[];
    pass: boolean;
    notes: string[];
  }> = [];

  for (const c of EDIT_PROMPTS) {
    // Each edit starts from a fresh baseline (or seeded), independent
    const { next, updates, targetId } = applyEdit(baseline, manifest, c);
    const htmlMap = render(template, manifest, next, knowledge);
    const html = homeHtml(htmlMap);
    const beforeCfg = c.seedServices
      ? (() => {
          const s = structuredClone(baseline) as SiteConfig;
          s.content.services = Array.from({ length: c.seedServices! }).map((_, i) => ({
            name: `Service ${i + 1}`,
            desc: `Description for service ${i + 1}`,
            image: STOCK,
          }));
          return s;
        })()
      : baseline;
    const beforeHtml = homeHtml(render(template, manifest, beforeCfg, knowledge));
    const beforeM = metrics(beforeCfg, beforeHtml);
    const afterM = metrics(next, html);

    const notes: string[] = [];
    let pass = true;

    if (c.id.includes("six-cards")) {
      if (afterM.serviceCount < 6) {
        pass = false;
        notes.push(`serviceCount ${afterM.serviceCount} < 6`);
      }
      if (afterM.serviceCardsInHtml < 6) {
        pass = false;
        notes.push(`HTML cards ${afterM.serviceCardsInHtml} < 6`);
      }
      if (afterM.servicesWithImages < 6) {
        pass = false;
        notes.push(`images ${afterM.servicesWithImages} < 6`);
      }
      if (afterM.serviceColumns !== 3) {
        pass = false;
        notes.push(`columns ${afterM.serviceColumns} !== 3`);
      }
      if (afterM.servicesHidden) {
        pass = false;
        notes.push("services section hidden");
      }
    }
    if (c.id.includes("remove-three")) {
      if (afterM.serviceCount !== 3) {
        pass = false;
        notes.push(`serviceCount ${afterM.serviceCount} !== 3`);
      }
      if (afterM.servicesHidden) {
        pass = false;
        notes.push("BUG: whole section hidden");
      }
      if (!afterM.hasServicesHeading) {
        pass = false;
        notes.push("Services heading missing");
      }
    }
    if (c.id.includes("align-3")) {
      if (afterM.serviceColumns !== 3) {
        pass = false;
        notes.push(`columns ${afterM.serviceColumns}`);
      }
    }
    if (c.id.includes("hero-title")) {
      if (afterM.heroTitle !== "Care close to home") {
        pass = false;
        notes.push(`heroTitle=${afterM.heroTitle}`);
      }
      if (!html.includes("Care close to home")) {
        pass = false;
        notes.push("hero title missing in HTML");
      }
    }
    if (c.id.includes("hide-gallery")) {
      if (!afterM.galleryHidden) {
        pass = false;
        notes.push("gallery not hidden in config");
      }
    }
    if (c.id.includes("accent")) {
      if (String(afterM.accent).toLowerCase() !== "#0f766e") {
        pass = false;
        notes.push(`accent=${afterM.accent}`);
      }
    }

    const dir = path.join(OUT, `after-${c.id}`);
    write(path.join(dir, "prompt.txt"), c.prompt + "\n");
    write(path.join(dir, "config.json"), JSON.stringify(slimConfig(next), null, 2));
    write(path.join(dir, "home.html"), html);
    write(path.join(dir, "services-snippet.html"), servicesSnippet(html));
    write(
      path.join(dir, "metrics.json"),
      JSON.stringify({ before: beforeM, after: afterM, targetId, updates: updates.map((u) => ({ id: u.id, op: u.op, type: u.type })) }, null, 2)
    );

    rows.push({
      id: c.id,
      prompt: c.prompt,
      targetId,
      before: beforeM,
      after: afterM,
      updateIds: updates.map((u) => u.id),
      pass,
      notes,
    });
  }

  // Claude-facing package
  const report: string[] = [];
  report.push(`# Prompt verification report`);
  report.push(``);
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push(`Template engine: \`${template.id}\` (${template.name})`);
  report.push(``);
  report.push(`## Generation prompt`);
  report.push(``);
  report.push("```");
  report.push(GENERATION_PROMPT.trim());
  report.push("```");
  report.push(``);
  report.push(`## Baseline (before any Studio edits)`);
  report.push(``);
  report.push("```json");
  report.push(JSON.stringify(baselineMetrics, null, 2));
  report.push("```");
  report.push(``);
  report.push(`Baseline Services snippet is in \`baseline/services-snippet.html\`.`);
  report.push(``);
  report.push(`## Edit prompts — did preview HTML actually change?`);
  report.push(``);

  let passed = 0;
  for (const r of rows) {
    if (r.pass) passed++;
    report.push(`### ${r.pass ? "✅ PASS" : "❌ FAIL"} — ${r.id}`);
    report.push(``);
    report.push(`**Prompt:**`);
    report.push(``);
    report.push("```");
    report.push(r.prompt);
    report.push("```");
    report.push(``);
    report.push(`Resolved target: \`${r.targetId}\``);
    report.push(`Update IDs: ${r.updateIds.join(", ") || "(none)"}`);
    report.push(``);
    report.push(`| Metric | Before | After |`);
    report.push(`|--------|--------|-------|`);
    const keys = Object.keys(r.before) as (keyof typeof r.before)[];
    for (const k of keys) {
      report.push(`| ${k} | ${JSON.stringify(r.before[k])} | ${JSON.stringify(r.after[k])} |`);
    }
    if (r.notes.length) {
      report.push(``);
      report.push(`Notes: ${r.notes.join("; ")}`);
    }
    report.push(``);
    report.push(`Files: \`after-${r.id}/home.html\`, \`after-${r.id}/services-snippet.html\``);
    report.push(``);
  }

  report.push(`## Summary`);
  report.push(``);
  report.push(`**${passed}/${rows.length} prompts produced real config + HTML changes.**`);
  report.push(``);
  report.push(`## How to check in Claude`);
  report.push(``);
  report.push(`1. Open \`baseline/services-snippet.html\` and one \`after-*/services-snippet.html\`.`);
  report.push(`2. Paste both into Claude with: *"Did the edit prompt change the HTML as claimed?"*`);
  report.push(`3. Or paste this whole \`REPORT.md\` and ask Claude to confirm each PASS/FAIL row.`);
  report.push(``);

  write(path.join(OUT, "REPORT.md"), report.join("\n"));

  // Compact Claude pack: one file with generation + key snippets
  const claudePack: string[] = [];
  claudePack.push(`# Claude check pack — Fort Hospital prompt edits`);
  claudePack.push(``);
  claudePack.push(`You are verifying whether Studio edit prompts actually mutate website HTML.`);
  claudePack.push(``);
  claudePack.push(`## Site generation prompt`);
  claudePack.push("```");
  claudePack.push(GENERATION_PROMPT.trim());
  claudePack.push("```");
  claudePack.push(``);
  claudePack.push(`## Baseline metrics`);
  claudePack.push("```json");
  claudePack.push(JSON.stringify(baselineMetrics, null, 2));
  claudePack.push("```");
  claudePack.push(``);
  claudePack.push(`## Baseline Services HTML snippet`);
  claudePack.push("```html");
  claudePack.push(servicesSnippet(baselineHtml));
  claudePack.push("```");
  claudePack.push(``);

  for (const r of rows.slice(0, 3)) {
    const snip = fs.readFileSync(
      path.join(OUT, `after-${r.id}`, "services-snippet.html"),
      "utf8"
    );
    claudePack.push(`## After: ${r.id} — ${r.pass ? "PASS" : "FAIL"}`);
    claudePack.push(``);
    claudePack.push(`Prompt: \`${r.prompt}\``);
    claudePack.push(``);
    claudePack.push(`Metrics after: \`\`\`json\n${JSON.stringify(r.after, null, 2)}\n\`\`\``);
    claudePack.push(``);
    claudePack.push("```html");
    claudePack.push(snip);
    claudePack.push("```");
    claudePack.push(``);
  }

  claudePack.push(`## Ask Claude`);
  claudePack.push(``);
  claudePack.push(
    `For each edit: did service card count / images / columns / heading visibility change vs baseline? Answer PASS or FAIL with evidence from the HTML.`
  );
  write(path.join(OUT, "CLAUDE-CHECK.md"), claudePack.join("\n"));

  console.log(`Wrote verification pack → ${OUT}`);
  console.log(`Template: ${template.id}`);
  console.log(`Baseline services: ${baselineMetrics.serviceCount} cards`);
  console.log(`Result: ${passed}/${rows.length} edit prompts PASS`);
  for (const r of rows) {
    console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.id}  → target ${r.targetId}`);
  }
  console.log(`\nOpen: docs/prompt-verify/REPORT.md`);
  console.log(`Claude pack: docs/prompt-verify/CLAUDE-CHECK.md`);

  if (passed < rows.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
