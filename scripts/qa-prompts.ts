/**
 * Prompt QA — records failing Studio prompts and asserts card/image edits land in HTML.
 * Run: npx tsx scripts/qa-prompts.ts
 */
import { interpretPrompt } from "../lib/template-ai/agents/interpreter";
import { understandIntent } from "../lib/template-ai/agents/understand";
import { applyUpdatesToConfig } from "../lib/template-ai/config";
import { buildCardListUpdates, detectCardCountRequest } from "../lib/template-ai/list-cards";
import { patchCardSectionsInHtml } from "../lib/template-ai/html-card-patch";
import { isLayoutIntent } from "../lib/template-ai/agent-helpers";

type Case = {
  name: string;
  prompt: string;
  target?: { id: string; kind: string; label: string };
  expectCards: number;
  expectImages: boolean;
  expectCols?: number;
};

const CASES: Case[] = [
  {
    name: "6 cards + images + 3-col (typo-heavy user prompt)",
    prompt:
      "in this area their are 4 cards ....make it 6 cards and also modify the cards with images and text and make it align as 3 by 3 - Services at a glance",
    target: {
      id: "home.highlights",
      kind: "section",
      label: "Services at a glance section",
    },
    expectCards: 6,
    expectImages: true,
    expectCols: 3,
  },
  {
    name: "make it 6 cards with images",
    prompt: "make it 6 cards with images and text - Services at a glance",
    target: { id: "home.services", kind: "section", label: "Services" },
    expectCards: 6,
    expectImages: true,
    expectCols: 3,
  },
  {
    name: "align 3 columns only should NOT wipe cards",
    prompt: "align this section in a 3-column row",
    target: { id: "home.services", kind: "section", label: "Services at a glance" },
    expectCards: 4,
    expectImages: false,
    expectCols: 3,
  },
];

function baseConfig() {
  return {
    brandName: "Fort Hospital",
    accent: "#1B4F72",
    pages: [
      { key: "home", label: "Home", slug: "index.html" },
      { key: "services", label: "Services", slug: "services.html" },
    ],
    content: {
      hero: { title: "Care", subtitle: "Sub", ctaText: "Go" },
      services: [
        { name: "Patient Scheduling", desc: "A" },
        { name: "Task & Project Management", desc: "B" },
        { name: "Clinical Analytics", desc: "C" },
        { name: "Secure File Repository", desc: "D" },
      ],
    },
    layout: {},
    styles: {},
    updatedAt: Date.now(),
  } as any;
}

function stubHtml(n: number) {
  const cards = Array.from({ length: n })
    .map(
      (_, i) =>
        `<a class="old-card" href="#"><div>Card ${i + 1}</div><div>Desc</div></a>`
    )
    .join("");
  return `<!doctype html><html><head></head><body>
  <section class="wrap" data-ai-section="highlights" data-ai-id="home.highlights">
    <div class="eyebrow">Care pathways</div>
    <h2>Services at a glance</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${cards}</div>
  </section>
  <section data-ai-section="features" id="features"><h2>Designed with icons</h2></section>
  </body></html>`;
}

let failed = 0;

for (const c of CASES) {
  const config = baseConfig();
  const intent = understandIntent({
    prompt: c.prompt,
    config,
    activePageKey: "home",
    target: c.target || null,
  });
  const inst = interpretPrompt({
    prompt: c.prompt,
    intent,
    config,
    manifest: {
      editableFields: [],
      sections: [],
      pages: [],
      version: 1,
      templateId: "clinic",
      templateName: "x",
      category: "y",
      brandBinding: "",
      accentBinding: "",
      bindings: {},
      createdAt: 0,
    } as any,
    activePageKey: "home",
  });

  let updates = [...(inst.resolvedUpdates || [])];
  const req = detectCardCountRequest(c.prompt);
  const forced = buildCardListUpdates({
    prompt: c.prompt,
    config,
    target: c.target,
  });
  if (forced.length) {
    const hasList = updates.some((u) => u.id === "services" || u.type === "list");
    if (!hasList) updates = [...forced, ...updates];
    else {
      for (const f of forced) {
        if (!updates.some((u) => u.id === f.id)) updates.push(f);
      }
    }
  }

  // For layout-only case, ensure columns still apply
  if (c.name.includes("align 3") && !updates.some((u) => u.id.includes("Columns"))) {
    updates.push({
      type: "layout",
      id: "layout.serviceColumns",
      value: 3,
      op: "set",
    });
  }

  const next = applyUpdatesToConfig(config, updates, { editableFields: [] } as any);
  const list = next.content.services || [];
  const html = patchCardSectionsInHtml(stubHtml(4), next);
  const cardCount = (html.match(/class="service-card"/g) || []).length;
  const imgCount = (html.match(/<img /g) || []).length;

  const checks: string[] = [];
  if (c.expectCards && list.length !== c.expectCards)
    checks.push(`config services=${list.length} want ${c.expectCards}`);
  if (c.expectCards && cardCount !== c.expectCards)
    checks.push(`html cards=${cardCount} want ${c.expectCards}`);
  if (c.expectImages && imgCount < c.expectCards)
    checks.push(`html images=${imgCount} want >=${c.expectCards}`);
  if (c.expectCols && next.layout?.serviceColumns !== c.expectCols)
    checks.push(`cols=${next.layout?.serviceColumns} want ${c.expectCols}`);
  if (c.name.includes("6 cards") && isLayoutIntent(c.prompt))
    checks.push("isLayoutIntent should be false for card-count prompts");

  if (checks.length) {
    failed++;
    console.error(`FAIL  ${c.name}`);
    checks.forEach((x) => console.error(`  - ${x}`));
    console.error(`  updates:`, updates.map((u) => u.id).join(", "));
    console.error(`  cardReq:`, req);
  } else {
    console.log(`PASS  ${c.name} (cards=${cardCount}, imgs=${imgCount})`);
  }
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nAll prompt QA cases passed.");
