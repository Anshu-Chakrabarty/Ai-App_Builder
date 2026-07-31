// app/api/appbuilder/analyze/route.ts
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import {
  generateContentResilient,
  parseJsonLoose,
} from "@/lib/gemini";
import { analyzeIdeaLocal } from "@/lib/appbuilder/project";
import { FEATURE_CATALOG } from "@/lib/appbuilder/catalog";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { idea } = await req.json();
    const text = String(idea || "").trim();
    if (!text) {
      return NextResponse.json({ error: "Describe your application idea." }, { status: 400 });
    }

    const local = analyzeIdeaLocal(text);
    const featureIds = FEATURE_CATALOG.map((f) => f.id).join(", ");

    try {
      const prompt = [
        "You are AppBuilder AI. Analyze this application idea and return ONLY JSON:",
        '{"name":"","summary":"","modules":["..."],"featureIds":["..."],"complexity":"Low|Medium|High","timeline":"","recommendedStack":"","pages":[{"key":"","label":""}]}',
        "featureIds must be a subset of: " + featureIds,
        "Idea:",
        text,
      ].join("\n");

      const result = await generateContentResilient(ai, {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.35,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      const parsed = parseJsonLoose(result.text ?? "") as any;
      return NextResponse.json({
        source: "ai",
        name: parsed.name || local.insights.recommendedStack,
        summary: parsed.summary || `I understood your request and recommended ${parsed.modules?.length || local.modules.length} modules.`,
        modules: Array.isArray(parsed.modules) && parsed.modules.length ? parsed.modules : local.modules,
        features:
          Array.isArray(parsed.featureIds) && parsed.featureIds.length
            ? parsed.featureIds
            : local.features,
        insights: {
          complexity: parsed.complexity || local.insights.complexity,
          timeline: parsed.timeline || local.insights.timeline,
          modules: (parsed.modules || local.modules).length,
          recommendedStack: parsed.recommendedStack || local.insights.recommendedStack,
        },
        pages:
          Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : local.pages,
      });
    } catch {
      return NextResponse.json({
        source: "local",
        name: analyzeIdeaLocal(text).insights.recommendedStack,
        summary:
          "I analyzed your idea offline (AI model unavailable) and prepared recommended modules.",
        modules: local.modules,
        features: local.features,
        insights: local.insights,
        pages: local.pages,
      });
    }
  } catch (err) {
    console.error("analyze error", err);
    return NextResponse.json({ error: "Analysis failed." }, { status: 500 });
  }
}
