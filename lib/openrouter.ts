// lib/openrouter.ts — OpenRouter chat completions (OpenAI-compatible)
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
  return process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o";
}

/**
 * Call OpenRouter. Uses chat/completions so we can race it with Gemini.
 */
export async function generateViaOpenRouter(
  args: OpenRouterGenerateArgs
): Promise<OpenRouterGenerateResult> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");

  const model = openRouterModel();
  const maxTokens =
    typeof args.config?.maxOutputTokens === "number"
      ? args.config.maxOutputTokens
      : Number(process.env.OPENROUTER_MAX_TOKENS) || 4096;

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: args.contents }],
    max_tokens: maxTokens,
    temperature:
      typeof args.config?.temperature === "number" ? args.config.temperature : 0.4,
  };

  // Match Gemini JSON mode when callers request it
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
    throw new Error(
      `OpenRouter ${model} ${res.status}: ${raw.slice(0, 400)}`
    );
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`OpenRouter returned non-JSON: ${raw.slice(0, 200)}`);
  }

  const text =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    null;

  if (!text || (typeof text === "string" && !text.trim())) {
    throw new Error(
      `OpenRouter empty response: ${JSON.stringify(data?.error || data).slice(0, 300)}`
    );
  }

  return { text: typeof text === "string" ? text : String(text), provider: "openrouter" };
}

export function isOpenRouterError(err: unknown): boolean {
  return /openrouter/i.test(errMessage(err));
}
