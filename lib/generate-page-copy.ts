// lib/generate-page-copy.ts — shared page copy generation (OpenRouter / Gemini)
import { generateContentResilient, parseJsonLoose } from "@/lib/gemini";
import { getGeminiClient } from "@/lib/llm-client";
import {
  HEALTHCARE_SYSTEM,
  pageCopyPrompt,
  summarizeExistingCopy,
} from "@/lib/healthcare-prompt";

const ai = getGeminiClient();

export async function generatePageCopy(args: {
  schema: string;
  details: {
    brandName?: string;
    prompt?: string;
    description?: string;
    tone?: string;
    notes?: string;
    sectionHints?: Record<string, string>;
  };
  pageLabel: string;
  pageKey?: string;
  template: { name: string; category: string };
  copy: Record<string, any>;
  fallback?: Record<string, any>;
  sectionHints?: string;
}): Promise<Record<string, any>> {
  const hintsFromMap =
    args.pageKey && args.details.sectionHints
      ? args.details.sectionHints[args.pageKey]
      : undefined;
  const sectionHints = args.sectionHints || hintsFromMap;

  const prompt = pageCopyPrompt({
    details: args.details,
    pageLabel: args.pageLabel,
    templateName: args.template.name,
    templateCategory: args.template.category,
    schema: args.schema,
    existingSummary: summarizeExistingCopy(args.copy),
    sectionHints,
  });

  const config = {
    systemInstruction: HEALTHCARE_SYSTEM,
    responseMimeType: "application/json" as const,
    temperature: 0.35,
    maxOutputTokens: 4096,
    thinkingConfig: { thinkingBudget: 0 },
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await generateContentResilient(ai, {
        contents: prompt,
        config: attempt === 1 ? { ...config, temperature: 0.2 } : config,
      });
      const text = result.text ?? "";
      return parseJsonLoose(text) as Record<string, any>;
    } catch (err) {
      lastErr = err;
      console.error(
        `generatePageCopy attempt ${attempt + 1} failed for ${args.pageLabel}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (args.fallback) {
    console.warn(`Using fallback copy for "${args.pageLabel}"`);
    return { ...args.fallback };
  }

  throw lastErr;
}

export function customPageFallback(label: string) {
  return {
    heading: label,
    blurb: `Learn more about ${label.toLowerCase()} at our practice.`,
    sections: [
      {
        title: "Overview",
        body: "We are committed to clear communication and patient-centered care.",
      },
      {
        title: "What to expect",
        body: "Our team will guide you through each step with compassion and respect.",
      },
      {
        title: "Next steps",
        body: "Contact us to learn more or schedule a visit.",
      },
    ],
    cta: "Contact us",
  };
}
