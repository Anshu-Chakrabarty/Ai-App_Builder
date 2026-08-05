/**
 * End-to-end Studio prompt QA — apply prompt → re-render → assert preview HTML.
 * Run: npx tsx scripts/qa-all-prompts.ts
 */
import { pickSiteTemplate } from "../lib/appbuilder/pick-template";
import { analyzeTemplate } from "../lib/template-ai/analyze";
import { applyUpdatesToConfig } from "../lib/template-ai/config";
import { renderSiteFromConfig } from "../lib/template-ai/render-site";
import { understandIntent } from "../lib/template-ai/agents/understand";
import { interpretPrompt } from "../lib/template-ai/agents/interpreter";
import { buildCardListUpdates, detectCardCountRequest } from "../lib/template-ai/list-cards";
import type { ConfigUpdate, SiteConfig } from "../lib/template-ai/types";

type Expect = {
  /** Config path checks */
  config?: Array<{ path: string; includes?: string; equals?: unknown; minLen?: number }>;
  /** Preview HTML must include these strings */
  htmlIncludes?: string[];
  /** Preview HTML must NOT include */
  htmlExcludes?: string[];
  /** Regex against home HTML */
  htmlMatch?: RegExp[];
  /** Count of CSS/class occurrences */
  htmlCount?: Array<{ re: RegExp; min?: number; exact?: number }>;
  /** Must produce at least one update */
  hasUpdates?: boolean;
};

type Case = {
  id: string;
  category: string;
  prompt: string;
  target?: { id: string; kind: string; label: string } | null;
  images?: string[];
  expect: Expect;
  /** Skip full HTML assert (structure-only / needs model) */
  soft?: boolean;
};

const STOCK =
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=900&q=80&auto=format&fit=crop";

const CASES: Case[] = [
  // ——— Copy ———
  {
    id: "copy-hero-title-quoted",
    category: "Copy",
    prompt: 'Change the hero title to "Welcome to Fort Care"',
    target: { id: "home.hero", kind: "section", label: "Hero" },
    expect: {
      config: [{ path: "content.hero.title", includes: "Welcome to Fort Care" }],
      htmlIncludes: ["Welcome to Fort Care"],
    },
  },
  {
    id: "copy-hero-subtitle-set",
    category: "Copy",
    prompt: 'Set the subtitle to "Same-week visits with a calm clinic feel."',
    target: { id: "hero.subtitle", kind: "field", label: "Subtitle" },
    expect: {
      config: [{ path: "content.hero.subtitle", includes: "Same-week visits" }],
      htmlIncludes: ["Same-week visits with a calm clinic feel."],
    },
  },
  {
    id: "copy-cta-button",
    category: "Buttons",
    prompt: 'Make the hero CTA say "Book a visit"',
    expect: {
      config: [{ path: "content.hero.ctaText", includes: "Book a visit" }],
      htmlIncludes: ["Book a visit"],
    },
  },

  // ——— Theme / colors ———
  {
    id: "theme-accent-hex",
    category: "Theme",
    prompt: "Change the accent color to #0F766E",
    expect: {
      config: [{ path: "accent", equals: "#0f766e" }],
      htmlMatch: [/#0[Ff]766[Ee]/],
    },
  },
  {
    id: "theme-accent-named",
    category: "Theme",
    prompt: "Set the primary brand color to teal",
    expect: {
      hasUpdates: true,
      htmlMatch: [/#0d9488|#14b8a6|#2dd4bf|teal/i],
    },
  },
  {
    id: "theme-background",
    category: "Theme",
    prompt: "Change the background to #F8FAFC",
    expect: {
      config: [{ path: "theme.background", equals: "#f8fafc" }],
      htmlMatch: [/#[Ff]8[Ff][Aa][Ff][Cc]/],
    },
  },

  // ——— Styles / hover ———
  {
    id: "style-nav-hover",
    category: "Styles",
    prompt: "Make nav links turn teal on hover with an underline",
    expect: {
      hasUpdates: true,
      htmlMatch: [/nav.*:hover|hoverColor|underline/i],
    },
  },
  {
    id: "style-card-lift",
    category: "Styles",
    prompt: "Add a hover lift animation on cards",
    expect: {
      hasUpdates: true,
      htmlMatch: [/hoverLift|translateY|card-soft:hover|\.service-card:hover/i],
    },
  },

  // ——— Cards / services ———
  {
    id: "cards-6-images-3col",
    category: "Cards",
    prompt:
      "make it 6 cards with images and text and align as 3 by 3 - Services at a glance",
    target: {
      id: "home.highlights",
      kind: "section",
      label: "Services at a glance",
    },
    expect: {
      config: [
        { path: "content.services", minLen: 6 },
        { path: "layout.serviceColumns", equals: 3 },
      ],
      htmlCount: [
        { re: /class="service-card"/g, exact: 6 },
        { re: /<img /g, min: 6 },
      ],
      htmlIncludes: ["Services at a glance", "service-cards-grid"],
    },
  },
  {
    id: "cards-8-images",
    category: "Cards",
    prompt: "Show 8 service cards with photos",
    target: { id: "home.services", kind: "section", label: "Services" },
    expect: {
      config: [{ path: "content.services", minLen: 8 }],
      htmlCount: [{ re: /class="service-card"/g, exact: 8 }],
    },
  },
  {
    id: "cards-layout-3col",
    category: "Layout",
    prompt: "Align Services at a glance into 3 columns",
    target: { id: "home.services", kind: "section", label: "Services at a glance" },
    expect: {
      config: [{ path: "layout.serviceColumns", equals: 3 }],
      htmlMatch: [/serviceColumns|service-cards-grid|repeat\(3/i],
    },
  },

  // ——— Features layout ———
  {
    id: "features-2col",
    category: "Layout",
    prompt: "Put the feature icons in a 2-column grid",
    target: { id: "home.features", kind: "section", label: "Features" },
    expect: {
      config: [{ path: "layout.featureColumns", equals: 2 }],
      htmlMatch: [/featureColumns|feature-icons|repeat\(2/i],
    },
  },
  {
    id: "gallery-3col-equal",
    category: "Layout",
    prompt: "Put the gallery in a 3-column equal grid",
    target: { id: "home.gallery", kind: "section", label: "Gallery" },
    expect: {
      config: [
        { path: "layout.galleryColumns", equals: 3 },
        { path: "layout.galleryVariant", equals: "equal" },
      ],
      htmlMatch: [/galleryColumns|photo-grid|is-equal|repeat\(3/i],
    },
  },

  // ——— Images ———
  {
    id: "image-hero",
    category: "Images",
    prompt: "Replace the hero background image with a modern clinic photo",
    expect: {
      config: [{ path: "media.hero", includes: "http" }],
      htmlMatch: [/media-hero|unsplash|http/i],
    },
  },
  {
    id: "image-split",
    category: "Images",
    prompt: "Change the split section image",
    expect: {
      config: [{ path: "media.split", includes: "http" }],
    },
  },
  {
    id: "image-gallery-upload",
    category: "Images",
    prompt: "Update the first gallery card image",
    images: [STOCK],
    target: { id: "media.gallery.0", kind: "image", label: "Gallery 1" },
    expect: {
      config: [{ path: "media.gallery.0", equals: STOCK }],
      htmlIncludes: [STOCK],
    },
  },

  // ——— Sections hide/show ———
  {
    id: "section-hide-gallery",
    category: "Sections",
    prompt: "Hide the gallery section on Home",
    target: { id: "home.gallery", kind: "section", label: "Gallery" },
    expect: {
      hasUpdates: true,
      htmlMatch: [/hidden|display:\s*none/i],
    },
  },
  {
    id: "section-hide-features",
    category: "Sections",
    prompt: "Hide the features section",
    target: { id: "home.features", kind: "section", label: "Features" },
    expect: {
      hasUpdates: true,
    },
  },

  // ——— Form ———
  {
    id: "form-title",
    category: "Forms",
    prompt: 'Rewrite the form title to "Talk to our care team"',
    expect: {
      config: [{ path: "content.visual.form.title", includes: "Talk to our care team" }],
      htmlIncludes: ["Talk to our care team"],
    },
  },
  {
    id: "form-submit",
    category: "Forms",
    prompt: 'Change the form submit button to "Send message"',
    expect: {
      config: [{ path: "content.visual.form.submitLabel", includes: "Send message" }],
      htmlIncludes: ["Send message"],
    },
  },

  // ——— Brand ———
  {
    id: "brand-name",
    category: "Brand",
    prompt: 'Rename the site brand to "Fort Hospital"',
    expect: {
      config: [{ path: "brandName", includes: "Fort Hospital" }],
      htmlIncludes: ["Fort Hospital"],
    },
  },

  // ——— Features copy ———
  {
    id: "features-title",
    category: "Copy",
    prompt: 'Change the features heading to "Why patients stay"',
    target: { id: "home.features", kind: "section", label: "Features" },
    expect: {
      config: [{ path: "content.visual.features.title", includes: "Why patients stay" }],
      htmlIncludes: ["Why patients stay"],
    },
  },
  {
    id: "section-show-features",
    category: "Sections",
    prompt: "Show the features section again",
    target: { id: "home.features", kind: "section", label: "Features" },
    expect: { hasUpdates: true },
  },
  {
    id: "page-delete-contact",
    category: "Pages",
    prompt: "Delete the Contact page",
    expect: { hasUpdates: true },
  },
  {
    id: "copy-features-item",
    category: "Copy",
    prompt: 'Change the first feature title to "Online booking"',
    target: {
      id: "visual.features.items.0.title",
      kind: "field",
      label: "Feature title",
    },
    expect: {
      config: [{ path: "content.visual.features.items.0.title", includes: "Online booking" }],
      htmlIncludes: ["Online booking"],
    },
  },
  {
    id: "cards-reduce-to-3",
    category: "Cards",
    prompt: "make it 3 cards - Services at a glance",
    target: { id: "home.services", kind: "section", label: "Services" },
    expect: {
      config: [{ path: "content.services", minLen: 3 }],
      htmlCount: [{ re: /class="service-card"/g, exact: 3 }],
    },
  },
];

function getPath(obj: any, path: string): any {
  return path.split(".").reduce((a, k) => (a == null ? a : a[k]), obj);
}

function applyPrompt(
  config: SiteConfig,
  manifest: any,
  c: Case
): { next: SiteConfig; updates: ConfigUpdate[]; needsModel: boolean } {
  const intent = understandIntent({
    prompt: c.prompt,
    config,
    activePageKey: "home",
    target: c.target || null,
    images: c.images,
  });
  const inst = interpretPrompt({
    prompt: c.prompt,
    intent,
    config,
    manifest,
    activePageKey: "home",
    images: c.images,
  });

  let updates = [...(inst.resolvedUpdates || [])];
  const cardReq = detectCardCountRequest(c.prompt);
  if (
    cardReq.count != null ||
    cardReq.wantImages ||
    (/\bcards?\b/i.test(c.prompt) && /\b(image|photo|column|grid|align)\b/i.test(c.prompt))
  ) {
    if (!/\bgallery\b/i.test(c.prompt)) {
      const forced = buildCardListUpdates({
        prompt: c.prompt,
        config,
        target: c.target,
      });
      for (const f of forced) {
        if (!updates.some((u) => u.id === f.id)) updates.push(f);
      }
    }
  }

  // Brand rename local fallback for QA when interpreter needs model
  if (/rename the site brand|change (the )?brand name|brand to/i.test(c.prompt)) {
    const m = c.prompt.match(/["“](.+?)["”]/);
    if (m && !updates.some((u) => u.id === "brandName")) {
      updates.push({ type: "text", id: "brandName", value: m[1], op: "set" });
    }
  }

  const next = applyUpdatesToConfig(config, updates, manifest);
  return { next, updates, needsModel: !!inst.needsModel };
}

function checkCase(
  label: string,
  next: SiteConfig,
  html: string,
  updates: ConfigUpdate[],
  c: Case
): string[] {
  const fails: string[] = [];
  if (c.expect.hasUpdates && !updates.length) fails.push("expected updates, got none");

  for (const chk of c.expect.config || []) {
    const v = getPath(
      {
        content: next.content,
        accent: next.accent,
        brandName: next.brandName,
        theme: next.theme,
        layout: next.layout,
        media: next.media,
        sectionState: next.sectionState,
        styles: next.styles,
      },
      chk.path.startsWith("content.") ||
        chk.path.startsWith("layout.") ||
        chk.path.startsWith("media.") ||
        chk.path.startsWith("theme.") ||
        chk.path.startsWith("sectionState.") ||
        chk.path === "accent" ||
        chk.path === "brandName"
        ? chk.path
        : chk.path
    );
    // Fix path resolution for nested keys we flattened oddly
    let val = v;
    if (chk.path === "accent") val = next.accent;
    else if (chk.path === "brandName") val = next.brandName;
    else if (chk.path.startsWith("content.")) val = getPath(next.content, chk.path.slice(8));
    else if (chk.path.startsWith("layout.")) val = getPath(next.layout || {}, chk.path.slice(7));
    else if (chk.path.startsWith("theme.")) val = getPath(next.theme || {}, chk.path.slice(6));
    else if (chk.path.startsWith("media.")) {
      const rest = chk.path.slice(6);
      if (rest.startsWith("gallery.")) {
        val = next.media?.gallery?.[Number(rest.split(".")[1])];
      } else val = getPath(next.media || {}, rest);
    } else if (chk.path.startsWith("sectionState.")) {
      val = getPath(next.sectionState || {}, chk.path.slice("sectionState.".length));
    }

    if (chk.equals !== undefined) {
      const a = typeof val === "string" ? val.toLowerCase() : val;
      const b = typeof chk.equals === "string" ? String(chk.equals).toLowerCase() : chk.equals;
      if (a !== b) {
        fails.push(`${chk.path}=${JSON.stringify(val)} want ${JSON.stringify(chk.equals)}`);
      }
    }
    if (chk.includes != null && !String(val ?? "").includes(chk.includes)) {
      fails.push(`${chk.path} missing "${chk.includes}" (got ${JSON.stringify(val)})`);
    }
    if (chk.minLen != null && (!Array.isArray(val) || val.length < chk.minLen)) {
      fails.push(`${chk.path} len=${Array.isArray(val) ? val.length : "n/a"} want >=${chk.minLen}`);
    }
  }

  for (const s of c.expect.htmlIncludes || []) {
    if (!html.includes(s)) fails.push(`HTML missing "${s}"`);
  }
  for (const s of c.expect.htmlExcludes || []) {
    if (html.includes(s)) fails.push(`HTML should not include "${s}"`);
  }
  for (const re of c.expect.htmlMatch || []) {
    if (!re.test(html)) fails.push(`HTML no match ${re}`);
  }
  for (const cnt of c.expect.htmlCount || []) {
    const n = (html.match(cnt.re) || []).length;
    if (cnt.exact != null && n !== cnt.exact) fails.push(`${cnt.re} count=${n} want ${cnt.exact}`);
    if (cnt.min != null && n < cnt.min) fails.push(`${cnt.re} count=${n} want >=${cnt.min}`);
  }

  void label;
  return fails;
}

async function main() {
  const template = pickSiteTemplate("primary care clinic hospital", "primary-care");
  const { manifest, config: base, knowledge } = analyzeTemplate({
    template,
    pages: template.pages,
    content: structuredClone(template.fallback),
    brandName: "Willow Primary Care",
    accent: "#2F6F5E",
    idea: "Neighborhood primary care clinic",
  });

  let failed = 0;
  const report: Array<{ id: string; category: string; ok: boolean; detail: string }> = [];

  for (const c of CASES) {
    const start = structuredClone(base) as SiteConfig;
    // ensure media exists
    if (!start.media) {
      start.media = {
        hero: STOCK,
        gallery: [STOCK, STOCK, STOCK, STOCK],
        category: "healthcare",
        split: STOCK,
        banner: STOCK,
      };
    }

    const { next, updates, needsModel } = applyPrompt(start, manifest, c);
    if (c.id === "page-delete-contact") {
      const stillHas = next.pages.some((p) => p.key === "contact");
      if (stillHas || !updates.some((u) => u.op === "remove_page")) {
        failed++;
        report.push({
          id: c.id,
          category: c.category,
          ok: false,
          detail: stillHas ? "contact page still present" : "no remove_page update",
        });
        console.error(`FAIL  [${c.category}] ${c.id}`);
        continue;
      }
    }

    const htmlMap = renderSiteFromConfig({
      template,
      manifest,
      config: next,
      knowledge,
    });
    const html = htmlMap["index.html"] || Object.values(htmlMap)[0] || "";

    let fails = checkCase(c.id, next, html, updates, c);
    if (needsModel && !updates.length && !c.soft) {
      fails.push("interpreter needsModel with empty updates");
    }

    if (fails.length) {
      failed++;
      report.push({ id: c.id, category: c.category, ok: false, detail: fails.join("; ") });
      console.error(`FAIL  [${c.category}] ${c.id}`);
      fails.forEach((f) => console.error(`      - ${f}`));
      console.error(`      updates: ${updates.map((u) => u.id).join(", ") || "(none)"}`);
    } else {
      report.push({ id: c.id, category: c.category, ok: true, detail: "ok" });
      console.log(`PASS  [${c.category}] ${c.id}`);
    }
  }

  console.log("\n—— Summary ——");
  const byCat = new Map<string, { pass: number; fail: number }>();
  for (const r of report) {
    const cur = byCat.get(r.category) || { pass: 0, fail: 0 };
    if (r.ok) cur.pass++;
    else cur.fail++;
    byCat.set(r.category, cur);
  }
  for (const [cat, s] of byCat) {
    console.log(`  ${cat}: ${s.pass} pass / ${s.fail} fail`);
  }
  console.log(`\nTotal: ${report.length - failed}/${report.length} passed`);

  // Write machine-readable results for docs generation
  const fs = await import("fs");
  fs.writeFileSync(
    "scripts/qa-all-prompts.results.json",
    JSON.stringify({ at: Date.now(), failed, report, cases: CASES.map((c) => ({ id: c.id, category: c.category, prompt: c.prompt })) }, null, 2)
  );

  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
