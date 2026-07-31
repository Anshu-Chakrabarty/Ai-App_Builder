// lib/template-ai/agents/pipeline.ts — Natural Language → Plan → Edit → Validate
import type {
  SiteConfig,
  TemplateKnowledge,
  TemplateManifest,
} from "../types";
import type { AgentHistoryTurn, AgentWorkEntry } from "../agent-helpers";
import { understandIntent } from "./understand";
import { planEdits } from "./plan";
import { editFromPlan } from "./edit";
import { validateAgainstPlan } from "./validate";
import type { PipelineResult, PipelineStageStatus } from "./types";

export type PipelineArgs = {
  prompt: string;
  config: SiteConfig;
  manifest: TemplateManifest;
  knowledge: TemplateKnowledge;
  activePageKey: string;
  idea?: string;
  history?: AgentHistoryTurn[];
  workLog?: AgentWorkEntry[];
  target?: { id: string; kind?: string; label?: string } | null;
  images?: string[];
};

/**
 * Multi-agent edit pipeline (AppGenie-style specialized stages):
 * 1. Natural Language Agent — understands what the user wants
 * 2. Design Planning Agent — which components/properties change
 * 3. Code Editing Agent — implements config ID updates
 * 4. Validation Agent — keeps only intended changes
 */
export async function runEditPipeline(args: PipelineArgs): Promise<PipelineResult> {
  const stages: PipelineStageStatus[] = [
    { id: "understand", label: "Natural Language", status: "running" },
    { id: "plan", label: "Design Planning", status: "pending" },
    { id: "edit", label: "Code Editing", status: "pending" },
    { id: "validate", label: "Validation", status: "pending" },
  ];

  // 1) Natural Language Agent
  const intent = understandIntent({
    prompt: args.prompt,
    config: args.config,
    activePageKey: args.activePageKey,
    history: args.history,
    workLog: args.workLog,
    target: args.target,
    images: args.images,
  });
  stages[0] = {
    id: "understand",
    label: "Natural Language",
    status: "done",
    detail: intent.summary,
  };

  // 2) Design Planning Agent
  stages[1] = { id: "plan", label: "Design Planning", status: "running" };
  const plan = planEdits({
    intent,
    prompt: args.prompt,
    config: args.config,
    manifest: args.manifest,
    knowledge: args.knowledge,
    activePageKey: args.activePageKey,
    images: args.images,
  });
  stages[1] = {
    id: "plan",
    label: "Design Planning",
    status: "done",
    detail:
      plan.steps.map((s) => s.action).join(", ") ||
      plan.assistantHint?.slice(0, 80) ||
      "no steps",
  };

  // 3) Code Editing Agent
  stages[2] = { id: "edit", label: "Code Editing", status: "running" };
  let payload = await editFromPlan({
    prompt: args.prompt,
    intent,
    plan,
    config: args.config,
    manifest: args.manifest,
    knowledge: args.knowledge,
    activePageKey: args.activePageKey,
    idea: args.idea,
    history: args.history,
    workLog: args.workLog,
    images: args.images,
  });
  stages[2] = {
    id: "edit",
    label: "Code Editing",
    status: "done",
    detail:
      payload.mode === "answer"
        ? "answer only"
        : `${payload.updates.length} update(s)` +
          (payload.newPages?.length ? ` + ${payload.newPages.length} page(s)` : ""),
  };

  // 4) Validation Agent
  stages[3] = { id: "validate", label: "Validation", status: "running" };
  const validated = validateAgainstPlan({
    payload,
    plan,
    intent,
    manifest: args.manifest,
    config: args.config,
    prompt: args.prompt,
  });
  stages[3] = {
    id: "validate",
    label: "Validation",
    status: "done",
    detail: validated.dropped.length
      ? `kept ${validated.payload.updates.length}, dropped ${validated.dropped.length}`
      : `ok · ${validated.payload.updates.length} change(s)`,
  };

  return {
    ...validated.payload,
    pipeline: {
      intent,
      plan,
      stages,
      dropped: validated.dropped,
      warnings: validated.warnings,
    },
  };
}
