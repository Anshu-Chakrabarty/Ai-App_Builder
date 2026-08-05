// lib/gemini.ts — shared helpers for Gemini routes (+ OpenRouter dual passthrough)
import {
  generateViaOpenRouter,
  hasOpenRouterKey,
} from "@/lib/openrouter";

export function extractJsonObject(raw: string): string {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = text.indexOf("{");
  if (start === -1) throw new Error("Model did not return JSON.");

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  throw new Error("Model returned incomplete JSON.");
}

export function parseJsonLoose(text: string): unknown {
  return JSON.parse(extractJsonObject(text));
}

/**
 * Prefer current free-tier models. Override with GEMINI_MODEL in .env.local.
 * gemini-2.5-flash is retired for many new accounts (404 NOT_FOUND).
 */
const RETIRED_MODELS = /^(gemini-2\.5-flash|gemini-2\.0-flash|gemini-1\.5-flash)$/i;

function pickDefaultModel(): string {
  const preferred = process.env.GEMINI_MODEL?.trim();
  if (preferred && !RETIRED_MODELS.test(preferred)) return preferred;
  return "gemini-3.1-flash-lite";
}

export const MODEL = pickDefaultModel();

const DEFAULT_FALLBACKS = [
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
] as const;

export const MODEL_CANDIDATES: string[] = [
  MODEL,
  ...DEFAULT_FALLBACKS.filter((m) => m !== MODEL && !RETIRED_MODELS.test(m)),
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Model removed / wrong id — skip without treating as quota. */
export function isModelUnavailableError(err: unknown): boolean {
  const message = errMessage(err);
  return /404|NOT_FOUND|no longer available|not found|is not found/i.test(
    message
  );
}

/** Soft capacity / short-lived rate limits worth retrying. */
export function isTransientModelError(err: unknown): boolean {
  const message = errMessage(err);
  if (isHardQuotaError(err)) return false;
  if (isModelUnavailableError(err)) return false;
  return /503|UNAVAILABLE|high demand|RESOURCE_EXHAUSTED|429|overloaded|try again|retry in/i.test(
    message
  );
}

/**
 * Free-tier daily/minute quota gone (often "limit: 0") — do not keep hammering.
 */
export function isHardQuotaError(err: unknown): boolean {
  const message = errMessage(err);
  return (
    /Quota exceeded|free_tier|GenerateRequestsPerDay|limit:\s*0/i.test(message) &&
    /RESOURCE_EXHAUSTED|429|Quota exceeded/i.test(message)
  );
}

export function retryDelayMs(err: unknown): number {
  const message = errMessage(err);
  const match = message.match(/retry in ([\d.]+)\s*s/i);
  if (match) {
    return Math.min(15_000, Math.ceil(parseFloat(match[1]) * 1000) + 250);
  }
  return 1200;
}

export class QuotaExceededError extends Error {
  constructor(message?: string) {
    super(
      message ||
        "Gemini free-tier quota exceeded. Check https://ai.dev/rate-limit, wait for reset, or enable billing / set GEMINI_MODEL to a model with remaining quota."
    );
    this.name = "QuotaExceededError";
  }
}

type GenerateContentArgs = {
  model: string;
  contents: string;
  config?: Record<string, unknown>;
};

type GenerateContentResult = { text?: string | null; provider?: string };

type GenAiClient = {
  models: {
    generateContent: (args: GenerateContentArgs) => Promise<GenerateContentResult>;
  };
};

function configForModel(
  model: string,
  config?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!config) return config;
  // Thinking settings are mainly for Gemini 2.5+/3.x; keep them on flash family.
  if (/gemini-2\.5|gemini-3/i.test(model)) return config;
  const { thinkingConfig: _omit, ...rest } = config;
  return rest;
}

/** openrouter | both | gemini — default openrouter when key exists (skip flaky Gemini quota) */
function llmStrategy(): "both" | "openrouter" | "gemini" {
  const raw = (process.env.LLM_STRATEGY || "").trim().toLowerCase();
  if (raw === "both" || raw === "race" || raw === "parallel") return "both";
  if (raw === "openrouter" || raw === "or") return "openrouter";
  if (raw === "gemini" || raw === "google") return "gemini";
  // Prefer OpenRouter-only when configured — more reliable than racing Gemini free-tier
  return hasOpenRouterKey() ? "openrouter" : "gemini";
}

async function generateViaGemini(
  ai: GenAiClient,
  args: { contents: string; config?: Record<string, unknown> }
): Promise<GenerateContentResult> {
  let lastErr: unknown;
  let sawHardQuota = false;

  for (const model of MODEL_CANDIDATES) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await sleep(retryDelayMs(lastErr));
        const result = await ai.models.generateContent({
          model,
          contents: args.contents,
          config: configForModel(model, args.config),
        });
        return { ...result, provider: `gemini:${model}` };
      } catch (err) {
        lastErr = err;
        console.error(
          `Gemini ${model} attempt ${attempt + 1} failed:`,
          errMessage(err).slice(0, 400)
        );

        if (isHardQuotaError(err)) {
          sawHardQuota = true;
          break;
        }

        if (!isTransientModelError(err)) {
          break;
        }
      }
    }
    console.warn(`Falling back from ${model}`);
  }

  if (sawHardQuota) {
    throw new QuotaExceededError(errMessage(lastErr).slice(0, 500));
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr ?? "Generation failed"));
}

/**
 * Call LLM with dual passthrough when OpenRouter is configured:
 * - both (default): race OpenRouter + Gemini — first success wins (lower latency)
 * - openrouter: OpenRouter first, Gemini fallback
 * - gemini: Gemini only (legacy)
 */
export async function generateContentResilient(
  ai: GenAiClient,
  args: { contents: string; config?: Record<string, unknown> }
): Promise<GenerateContentResult> {
  const strategy = llmStrategy();
  const useOr = hasOpenRouterKey() && strategy !== "gemini";

  if (useOr && strategy === "both") {
    const errors: string[] = [];
    try {
      const winner = await Promise.any([
        generateViaOpenRouter(args)
          .then((r) => {
            console.info(`LLM via OpenRouter (${r.provider})`);
            return { text: r.text, provider: r.provider };
          })
          .catch((err) => {
            errors.push(`openrouter: ${errMessage(err).slice(0, 180)}`);
            throw err;
          }),
        generateViaGemini(ai, args)
          .then((r) => {
            console.info(`LLM via ${r.provider || "gemini"}`);
            return r;
          })
          .catch((err) => {
            errors.push(`gemini: ${errMessage(err).slice(0, 180)}`);
            throw err;
          }),
      ]);
      return winner;
    } catch (agg) {
      const detail =
        errors.join(" | ") ||
        (agg instanceof Error ? agg.message : String(agg));
      throw new Error(`Both LLM providers failed: ${detail}`);
    }
  }

  if (useOr && strategy === "openrouter") {
    try {
      const r = await generateViaOpenRouter(args);
      console.info("LLM via OpenRouter");
      return { text: r.text, provider: r.provider };
    } catch (err) {
      // Auto-fallback to Gemini when a key exists (unless explicitly disabled)
      const allowGeminiFallback =
        process.env.LLM_GEMINI_FALLBACK !== "0" &&
        Boolean(process.env.GEMINI_API_KEY?.trim());
      if (!allowGeminiFallback) {
        throw err instanceof Error
          ? err
          : new Error(String(err ?? "OpenRouter failed"));
      }
      console.warn(
        "OpenRouter failed, falling back to Gemini:",
        errMessage(err).slice(0, 300)
      );
    }
  }

  return generateViaGemini(ai, args);
}

export const COPYWRITER_SYSTEM =
  "You are an expert brand strategist and web copywriter. " +
  "Return ONLY a JSON object matching the schema you are given — same keys, same array lengths. " +
  "Fill EVERY field with polished, specific, believable copy tailored to the business. " +
  "Keep strings concise; match the requested tone. Never use lorem ipsum or the word 'placeholder'.";
