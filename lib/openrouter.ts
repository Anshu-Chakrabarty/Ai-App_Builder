// lib/openrouter.ts — OpenRouter chat completions with model fallbacks
export type OpenRouterGenerateArgs = {
  contents: string;
  config?: Record<string, unknown>;
};

export type OpenRouterGenerateResult = { text?: string | null; provider: "openrouter" };

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function hasOpenRouterKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function openRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini";
}

/** Preferred model first, then cheaper/reliable fallbacks */
function openRouterModelCandidates(): string[] {
  const preferred = openRouterModel();
  const extras = [
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
    "google/gemini-2.0-flash-001",
    "meta-llama/llama-3.3-70b-instruct",
    "openai/gpt-4o",
  ];
  return [preferred, ...extras.filter((m) => m !== preferred)];
}

async function callOpenRouterModel(
  key: string,
  model: string,
  args: OpenRouterGenerateArgs
): Promise<OpenRouterGenerateResult> {
  const maxTokens =
    typeof args.config?.maxOutputTokens === "number"
      ? args.config.maxOutputTokens
      : Number(process.env.OPENROUTER_MAX_TOKENS) || 4096;

  const messages: Array<{ role: string; content: string }> = [];
  const system = args.config?.systemInstruction;
  if (typeof system === "string" && system.trim()) {
    messages.push({ role: "system", content: system });
  }
  messages.push({ role: "user", content: args.contents });

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: Math.min(maxTokens, 8192),
    temperature:
      typeof args.config?.temperature === "number" ? args.config.temperature : 0.4,
  };

  if (args.config?.responseMimeType === "application/json") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME || "AppBuilder AI",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`OpenRouter ${model} ${res.status}: ${raw.slice(0, 400)}`);
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`OpenRouter returned non-JSON: ${raw.slice(0, 200)}`);
  }

  const text =
    data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? null;

  if (!text || (typeof text === "string" && !text.trim())) {
    throw new Error(
      `OpenRouter empty response: ${JSON.stringify(data?.error || data).slice(0, 300)}`
    );
  }

  return {
    text: typeof text === "string" ? text : String(text),
    provider: "openrouter",
  };
}

/**
 * Call OpenRouter. Tries preferred model, then fallbacks (quota / model errors).
 */
export async function generateViaOpenRouter(
  args: OpenRouterGenerateArgs
): Promise<OpenRouterGenerateResult> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");

  let lastErr: unknown;
  for (const model of openRouterModelCandidates()) {
    try {
      const result = await callOpenRouterModel(key, model, args);
      if (model !== openRouterModel()) {
        console.info(`OpenRouter fell back to ${model}`);
      }
      return result;
    } catch (err) {
      lastErr = err;
      console.warn(`OpenRouter ${model} failed:`, errMessage(err).slice(0, 240));
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr ?? "OpenRouter failed"));
}

export function isOpenRouterError(err: unknown): boolean {
  return /openrouter/i.test(errMessage(err));
}
