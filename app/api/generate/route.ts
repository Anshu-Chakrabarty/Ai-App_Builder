// app/api/generate/route.ts — prompt-driven sitemap + copy
import { NextResponse } from "next/server";
import { TEMPLATES } from "@/lib/templates";
import { slugForPage } from "@/lib/page-designs";
import { optionsForMissingPage } from "@/lib/custom-designs";
import {
  generateContentResilient,
  parseJsonLoose,
  QuotaExceededError,
} from "@/lib/gemini";
import { getGeminiClient } from "@/lib/llm-client";
import {
  HEALTHCARE_SYSTEM,
  buildHealthcareBrief,
} from "@/lib/healthcare-prompt";
import { parsePagesFromBrief } from "@/lib/page-request";
import { generatePageCopy } from "@/lib/generate-page-copy";
import type { PageDef } from "@/lib/types";

const ai = getGeminiClient();

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let text = "";
  try {
    const { templateId, details } = await req.json();

    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json({ error: "Unknown template." }, { status: 400 });
    }

    const promptText = (details?.prompt || details?.description || "").trim();
    if (!promptText) {
      return NextResponse.json(
        { error: "Describe your healthcare practice in one prompt." },
        { status: 400 }
      );
    }

    const plan = parsePagesFromBrief(promptText);
    const usePromptPages = plan.fromPrompt && plan.pages.length > 0;

    const resolved = usePromptPages
      ? plan.pages
      : template.pages.map((p) => ({
          label: p.label,
          key: p.key,
          design: undefined as undefined,
          sectionHints: undefined as string | undefined,
        }));

    const sectionHints = { ...plan.sectionHints };
    const detailsWithHints = {
      ...details,
      prompt: promptText,
      sectionHints,
    };

    let copy: Record<string, any> = {
      ...(template.fallback || {}),
    };
    const pages: PageDef[] = [];
    const pendingUnknown: { label: string; key: string }[] = [];

    const needsHome = resolved.some((p) => p.key === "home");
    const catalogOnly = resolved.filter((p) => p.key !== "home");

    // Always generate home-shaped root copy when Home is requested or when
    // falling back to the full template (template pages include home).
    if (needsHome || !usePromptPages) {
      const homeHints =
        sectionHints.home ||
        resolved.find((p) => p.key === "home")?.sectionHints ||
        "";

      const homePrompt =
        buildHealthcareBrief(detailsWithHints) +
        "\n\nTemplate: \"" +
        template.name +
        "\" (" +
        template.category +
        ").\n" +
        (usePromptPages
          ? "Generate ONLY the home / site-wide fields for this site. " +
            "Do not invent extra pages beyond what the brief lists.\n"
          : "Write patient-facing website copy for EVERY field.\n") +
        (homeHints
          ? "Home page must specifically cover these sections/topics: " +
            homeHints +
            "\nMap them into the schema fields that fit best " +
            "(e.g. specialties → services, featured doctors → providers, " +
            "emergency contact → contact/highlights, CTAs → hero.ctaText).\n"
          : "") +
        "Return JSON matching EXACTLY this schema (same keys, same array lengths):\n" +
        template.schema;

      const config = {
        systemInstruction: HEALTHCARE_SYSTEM,
        responseMimeType: "application/json" as const,
        temperature: 0.45,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      };

      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await generateContentResilient(ai, {
          contents: homePrompt,
          config: attempt === 1 ? { ...config, temperature: 0.25 } : config,
        });
        text = result.text ?? "";
        try {
          const generated = parseJsonLoose(text) as Record<string, any>;
          copy = { ...copy, ...generated };
          break;
        } catch (parseErr) {
          console.error(
            "generate raw model output (JSON parse failed):",
            text.slice(0, 500)
          );
          if (attempt === 1) throw parseErr;
        }
      }
    }

    if (needsHome || (!usePromptPages && template.pages.some((p) => p.key === "home"))) {
      if (!pages.some((p) => p.key === "home")) {
        pages.push({ key: "home", label: "Home", slug: slugForPage("home") });
      }
    }

    if (!usePromptPages) {
      // Classic path: full template sitemap
      for (const p of template.pages) {
        if (!pages.some((x) => x.key === p.key)) {
          pages.push({ ...p });
        }
      }
      return NextResponse.json({
        status: "ready",
        copy,
        pages,
        templateId: template.id,
        sectionHints,
        assistantMessage: `Your ${template.name} healthcare site is ready. Ask me to add pages like FAQ, Appointments, Insurance, or Care team — I’ll keep wording consistent with your practice.`,
      });
    }

    // Prompt-driven: only pages from the brief
    for (const req of catalogOnly) {
      if (req.design) {
        const pageCopy = await generatePageCopy({
          schema: req.design.schema,
          details: detailsWithHints,
          pageLabel: req.label,
          pageKey: req.key,
          template,
          copy,
          fallback: req.design.fallback,
          sectionHints: req.sectionHints || sectionHints[req.key],
        });
        copy[req.key] = pageCopy;
        pages.push({
          key: req.key,
          label: req.label,
          slug: slugForPage(req.key),
          designId: req.design.id,
        });
      } else {
        pendingUnknown.push({ label: req.label, key: req.key });
      }
    }

    // Ensure home is first if present
    pages.sort((a, b) => {
      if (a.key === "home") return -1;
      if (b.key === "home") return 1;
      return 0;
    });

    if (pendingUnknown.length > 0) {
      const [first, ...rest] = pendingUnknown;
      const readyLabels = pages.map((p) => p.label);
      return NextResponse.json({
        status: "need_design",
        copy,
        pages,
        templateId: template.id,
        sectionHints,
        options: optionsForMissingPage(),
        pendingPage: first,
        pendingQueue: rest,
        assistantMessage:
          (readyLabels.length
            ? `Built ${readyLabels.map((l) => `“${l}”`).join(", ")} from your prompt. `
            : "") +
          `I don’t have a built-in “${first.label}” layout. Pick a stored template or layout style and I’ll copy that design to create the page` +
          (sectionHints[first.key]
            ? ` covering: ${sectionHints[first.key]}.`
            : "."),
      });
    }

    return NextResponse.json({
      status: "ready",
      copy,
      pages,
      templateId: template.id,
      sectionHints,
      assistantMessage:
        `Your site is ready with exactly the pages from your prompt: ${pages
          .map((p) => p.label)
          .join(", ")}. Ask me to add more pages anytime — if I don’t have a layout, I’ll ask you to pick one.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("generate error:", message);
    if (text) console.error("generate raw model output:", text.slice(0, 2000));

    if (
      err instanceof QuotaExceededError ||
      /Quota exceeded|free_tier/i.test(message)
    ) {
      return NextResponse.json(
        {
          error:
            "Gemini free-tier quota exceeded. Wait for the daily reset, check https://ai.dev/rate-limit, or enable billing in Google AI Studio.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Generation failed. Please try again." },
      { status: 500 }
    );
  }
}
