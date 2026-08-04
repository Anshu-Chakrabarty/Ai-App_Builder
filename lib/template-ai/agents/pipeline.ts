// lib/template-ai/agents/pipeline.ts — Interpreter → Plan → Edit → Validate
import type {
  SiteConfig,
  TemplateKnowledge,
  TemplateManifest,
} from "../types";
import type { AgentHistoryTurn, AgentWorkEntry } from "../agent-helpers";
import { understandIntent } from "./understand";
import { interpretPrompt } from "./interpreter";
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
 * Efficient multi-agent pipeline:
 * 1. Natural Language — intent
 * 2. Prompt Interpreter — structured instruction (local, often skips Gemini)
 * 3. Design Planning — allowed IDs / resolved updates
 * 4. Code Editing — Gemini only when interpreter needsModel
 * 5. Validation — drop unintended changes
 */
export async function runEditPipeline(args: PipelineArgs): Promise<PipelineResult> {
  const stages: PipelineStageStatus[] = [
    { id: "understand", label: "Natural Language", status: "running" },
    { id: "plan", label: "Design Planning", status: "pending" },
    { id: "edit", label: "Code Editing", status: "pending" },
    { id: "validate", label: "Validation", status: "pending" },
  ];

  // 1) Natural Language
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

  // 2) Prompt Interpreter (local structured instruction)
  const instruction = interpretPrompt({
    prompt: args.prompt,
    intent,
    config: args.config,
    activePageKey: args.activePageKey,
    images: args.images,
  });

  // 3) Design Planning — merge interpreter output
  stages[1] = { id: "plan", label: "Design Planning", status: "running" };
  let plan = planEdits({
    intent,
    prompt: args.prompt,
    config: args.config,
    manifest: args.manifest,
    knowledge: args.knowledge,
    activePageKey: args.activePageKey,
    images: args.images,
  });

  // Interpreter wins when it fully resolved the edit (zero LLM)
  if (instruction.resolvedUpdates && !instruction.needsModel) {
    plan = {
      ...plan,
      resolvedUpdates: instruction.resolvedUpdates,
      assistantHint: instruction.assistantHint || plan.assistantHint,
      allowedIds: [
        ...new Set([
          ...plan.allowedIds,
          ...instruction.resolvedUpdates.map((u) => u.id),
          ...instruction.actions.map((a) => a.id),
        ]),
      ],
      constraints: [
        ...new Set([...plan.constraints, ...instruction.constraints]),
      ],
      steps:
        instruction.actions.length > 0
          ? instruction.actions.map((a) => ({
              action: (a.type.includes("style")
                ? "style"
                : a.type.includes("image")
                  ? "image"
                  : a.type.includes("layout")
                    ? "layout"
                    : a.type.includes("section")
                      ? "hide-section"
                      : a.type.includes("page")
                        ? "page-remove"
                        : "copy") as any,
              ids: [a.id],
              rationale: a.note || a.type,
            }))
          : plan.steps,
    };
  } else if (instruction.needsModel) {
    // Tighten plan with interpreter constraints + action ids
    const extraIds = instruction.actions.map((a) => a.id).filter(Boolean);
    plan = {
      ...plan,
      allowedIds: [...new Set([...plan.allowedIds, ...extraIds])],
      constraints: [
        ...new Set([...plan.constraints, ...instruction.constraints]),
      ],
    };
  }

  stages[1] = {
    id: "plan",
    label: "Design Planning",
    status: "done",
    detail: instruction.needsModel
      ? `model · ${plan.steps.map((s) => s.action).join(", ") || "edit"}`
      : `local · ${instruction.resolvedUpdates?.length || 0} update(s)`,
  };

  // 4) Code Editing — skip Gemini when resolved
  stages[2] = { id: "edit", label: "Code Editing", status: "running" };
  const payload = await editFromPlan({
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
    compact: true,
    instruction,
  });
  stages[2] = {
    id: "edit",
    label: "Code Editing",
    status: "done",
    detail:
      !instruction.needsModel && plan.resolvedUpdates
        ? "skipped LLM (interpreter)"
        : payload.mode === "answer"
          ? "answer only"
          : `${payload.updates.length} update(s)` +
            (payload.newPages?.length ? ` + ${payload.newPages.length} page(s)` : ""),
  };

  // 5) Validation
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
