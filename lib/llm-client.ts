// lib/llm-client.ts — safe Gemini client (optional when OpenRouter is primary)
import { GoogleGenAI } from "@google/genai";

let cached: GoogleGenAI | null | undefined;

/**
 * Returns a Gemini client when GEMINI_API_KEY is set; otherwise a no-op stub
 * so OpenRouter-only setups don't crash on module load.
 */
export function getGeminiClient(): {
  models: {
    generateContent: (args: {
      model: string;
      contents: string;
      config?: Record<string, unknown>;
    }) => Promise<{ text?: string | null }>;
  };
} {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return {
      models: {
        async generateContent() {
          throw new Error("GEMINI_API_KEY is not set");
        },
      },
    };
  }
  if (cached === undefined) {
    try {
      cached = new GoogleGenAI({ apiKey: key });
    } catch (err) {
      console.error("GoogleGenAI init failed:", err);
      cached = null;
    }
  }
  if (!cached) {
    return {
      models: {
        async generateContent() {
          throw new Error("Gemini client failed to initialize");
        },
      },
    };
  }
  return cached;
}
