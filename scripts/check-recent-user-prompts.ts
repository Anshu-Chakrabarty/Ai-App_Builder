/**
 * Re-check Studio prompts the user reported failing recently.
 * Run: npx tsx scripts/check-recent-user-prompts.ts
 */
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
import type { ConfigUpdate, SiteConfig } from "../lib/template-ai/types";

const STOCK =
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=900&q=80&auto=format&fit=crop";

const RECENT = [
  {
    id: "compound-6-cards-images-3x3",
    prompt:
      "in this area their are 4 cards ....make it 6 cards and also modify the cards with images and text and make it align as 3 by 3 - Services at a glance",
    target: null as { id: string; kind: string; label: string } | null,
    seed6: false,
    expect: (cfg: SiteConfig, html: string, updates: ConfigUpdate[]) => {
      const n = (cfg.content.services || []).length;
      const cards = (html.match(/class="service-card"/g) || []).length;
      const cols = cfg.layout?.serviceColumns;
      const hasImg = (cfg.content.services || []).some((s: any) => s?.image);
      const hidden = cfg.sectionState?.["home.services"]?.visible === false;
      const fails: string[] = [];
      if (n < 6) fails.push(`services len=${n} want >=6`);
      if (cards < 6) fails.push(`html cards=${cards} want >=6`);
      if (cols !== 3) fails.push(`serviceColumns=${cols} want 3`);
      if (!hasImg) fails.push("no card images");
      if (hidden) fails.push("services section hidden");
      if (!html.includes("Services at a glance")) fails.push("section heading missing");
      if (!updates.length) fails.push("no updates");
      return fails;
    },
  },
  {
    id: "remove-three-cards-no-select",
    prompt: "remove three cards from Services at a glance",
    target: null,
    seed6: true,
    expect: (cfg, html, updates) => {
      const n = (cfg.content.services || []).length;
      const cards = (html.match(/class="service-card"/g) || []).length;
      const hidden = cfg.sectionState?.["home.services"]?.visible === false;
      const fails: string[] = [];
      if (n !== 3) fails.push(`services len=${n} want 3`);
      if (cards !== 3) fails.push(`html cards=${cards} want 3`);
      if (hidden) fails.push("BUG: whole section hidden");
      if (!html.includes("Services at a glance")) fails.push("section gone from HTML");
      if (updates.some((u) => u.op === "hide_section")) fails.push("hide_section in updates");
      return fails;
    },
  },
  {
    id: "remove-three-cards-selected",
    prompt: "remove three cards",
    target: { id: "home.services", kind: "section", label: "Services at a glance" },
    seed6: true,
    expect: (cfg, html, updates) => {
      const n = (cfg.content.services || []).length;
      const hidden = cfg.sectionState?.["home.services"]?.visible === false;
      const fails: string[] = [];
      if (n !== 3) fails.push(`services len=${n} want 3`);
      if (hidden) fails.push("BUG: whole section hidden");
      if (updates.some((u) => u.op === "hide_section")) fails.push("hide_section in updates");
      return fails;
    },
  },
  {
    id: "named-3-columns",
    prompt: "Align Services at a glance into 3 columns",
    target: null,
    seed6: false,
    expect: (cfg) => {
      const fails: string[] = [];
      if (cfg.layout?.serviceColumns !== 3) fails.push(`cols=${cfg.layout?.serviceColumns}`);
      return fails;
    },
  },
  {
    id: "make-it-6-named",
    prompt: "make it 6 cards with images and text - Services at a glance",
    target: null,
    seed6: false,
    expect: (cfg, html) => {
      const n = (cfg.content.services || []).length;
      const cards = (html.match(/class="service-card"/g) || []).length;
      const fails: string[] = [];
      if (n < 6) fails.push(`len=${n}`);
      if (cards < 6) fails.push(`html=${cards}`);
      return fails;
    },
  },
];

async function main() {
  const template = pickSiteTemplate("Fort Hospital clinic healthcare");
  const { manifest, config: base } = analyzeTemplate({
    template,
    pages: template.pages,
    content: { ...(template.fallback || {}) },
    brandName: "Fort Hospital",
    accent: "#1B4F72",
    idea: "Fort Hospital",
  });

  console.log("Re-checking your recent Studio prompts against current code:\n");
  let pass = 0;
  let fail = 0;

  for (const c of RECENT) {
    const start = structuredClone(base) as SiteConfig;
    if (!start.media) {
      start.media = {
        hero: STOCK,
        gallery: [STOCK, STOCK, STOCK, STOCK],
        category: "healthcare",
        split: STOCK,
        banner: STOCK,
      };
    }
    if (c.seed6) {
      start.content.services = Array.from({ length: 6 }).map((_, i) => ({
        name: `Service ${i + 1}`,
        desc: `Desc ${i + 1}`,
        image: STOCK,
      }));
    }

    const intent = understandIntent({
      prompt: c.prompt,
      config: start,
      activePageKey: "home",
      target: c.target,
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
      (/\bcards?\b/i.test(c.prompt) && /\b(image|photo|column|grid|align|remove|delete)\b/i.test(c.prompt))
    ) {
      const forced = buildCardListUpdates({
        prompt: c.prompt,
        config: start,
        target: c.target || intent.target || inst.target || null,
      });
      updates = updates.filter((u) => u.op !== "hide_section");
      for (const f of forced) {
        if (!updates.some((u) => u.id === f.id)) updates.push(f);
      }
    }
    const next = applyUpdatesToConfig(start, updates, manifest);
    const htmlMap = renderSiteFromConfig({
      template,
      manifest,
      config: next,
      knowledge: analyzeTemplate({
        template,
        pages: template.pages,
        content: { ...(template.fallback || {}) },
        brandName: "Fort Hospital",
        accent: "#1B4F72",
        idea: "Fort Hospital",
      }).knowledge,
    });
    const html = htmlMap["index.html"] || Object.values(htmlMap)[0] || "";
    const fails = c.expect(next, html, updates);
    const resolved = intent.target?.id || inst.target?.id || "(none)";
    if (fails.length) {
      fail++;
      console.log(`FAIL  ${c.id}`);
      console.log(`      prompt: ${c.prompt.slice(0, 90)}…`);
      console.log(`      resolved target: ${resolved}`);
      fails.forEach((f) => console.log(`      - ${f}`));
    } else {
      pass++;
      console.log(`PASS  ${c.id}  (target→ ${resolved})`);
    }
  }

  console.log(`\n${pass}/${pass + fail} of your recent prompts now pass.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
