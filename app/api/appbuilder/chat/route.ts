// app/api/appbuilder/chat/route.ts
import { NextResponse } from "next/server";
import { generateContentResilient } from "@/lib/gemini";
import { getGeminiClient } from "@/lib/llm-client";

const ai = getGeminiClient();

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = String(body.message || "").trim();
    const context = body.context || {};
    if (!message) {
      return NextResponse.json({ error: "Empty message." }, { status: 400 });
    }

    const system = [
      "You are AppBuilder AI assistant inside a multi-step app builder.",
      "Be concise, practical, and specific to the user's project context.",
      "Help with features, tech stack, deployment, templates, CI/CD, and UI customization.",
      "Do not invent that real cloud resources were provisioned.",
    ].join(" ");

    try {
      const result = await generateContentResilient(ai, {
        contents:
          `Context JSON:\n${JSON.stringify(context).slice(0, 4000)}\n\nUser: ${message}`,
        config: {
          systemInstruction: system,
          temperature: 0.4,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      return NextResponse.json({
        reply: result.text || "I can help refine features, stack, or deployment choices.",
      });
    } catch {
      // Deterministic offline replies for demo fidelity
      const lower = message.toLowerCase();
      let reply =
        "AI is temporarily unavailable. Based on your current setup: keep core features, React + Go + PostgreSQL on AWS is a solid default, and you can change any choice later in the wizard.";
      if (/auth|authentication|team/i.test(lower)) {
        reply =
          "User Authentication is the foundation for Team Management. Roles (Admin/Manager/Member) gate project membership, task assignment, and notification preferences. Enable email verification for production security.";
      } else if (/color|theme|dark|button/i.test(lower)) {
        reply =
          "I can update theme tokens: primary color, dark/light mode, sidebar density, and rounded corners. Describe the change and apply it in Preview & Customize.";
      } else if (/deploy|aws|cost/i.test(lower)) {
        reply =
          "For most apps start with Monolithic + AWS EC2/Beanstalk (~$18–70/mo). Add autoscaling and monitoring when traffic grows. Microservices fit larger teams with independent scaling needs.";
      }
      return NextResponse.json({ reply, source: "local" });
    }
  } catch (err) {
    console.error("chat error", err);
    return NextResponse.json({ error: "Chat failed." }, { status: 500 });
  }
}
