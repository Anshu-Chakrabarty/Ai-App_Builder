// lib/template-ai/agents/pipeline.ts — NL → Prompt Interpreter → Plan → Edit → Validate
import type {
  SiteConfig,
  TemplateKnowledge,
  TemplateManifest,
} from "../types";
import type { AgentHistoryTurn, AgentWorkEntry } from "../agent-helpers";
import { understandIntent } from "./understand";
import { runPromptInterpreter, type StructuredInstruction } from "./interpreter";
import { planEdits } from "./plan";
import { editFromPlan } from "./edit";
import { validateAgainstPlan } from "./validate";
import type { EditPlan, IntentAction, PipelineResult, PipelineStageStatus } from "./types";

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
 * Full architecture:
 * 1. Natural Language Agent — intent
 * 2. Prompt Interpretation Layer (MIDDLE) — structured technical instruction
 * 3. Design Planning Agent — allowed IDs / merge instruction
 * 4. Code Editing Agent — apply instruction (local or Gemini)
 * 5. Validation Agent — intended-only changes
 */
export async function runEditPipeline(args: PipelineArgs): Promise<PipelineResult> {
  const stages: PipelineStageStatus[] = [
    { id: "understand", label: "Natural Language", status: "running" },
    { id: "interpret", label: "Prompt Interpreter", status: "pending" },
    { id: "plan", label: "Design Planning", status: "pending" },
    { id: "edit", label: "Code Editing", status: "pending" },
    { id: "validate", label: "Validation", status: "pending" },
  ];

  // 1) Natural Language
  let intent = understandIntent({
    prompt: args.prompt,
    config: args.config,
    activePageKey: args.activePageKey,
    history: args.history,
    workLog: args.workLog,
    target: args.target,
    images: args.images,
    manifest: args.manifest,
  });
  stages[0] = {
    id: "understand",
    label: "Natural Language",
    status: "done",
    detail: intent.summary.slice(0, 100),
  };

  // 2) Prompt Interpretation Layer (middle — always runs)
  stages[1] = { id: "interpret", label: "Prompt Interpreter", status: "running" };
  const instruction = await runPromptInterpreter({
    prompt: args.prompt,
    intent,
    config: args.config,
    manifest: args.manifest,
    activePageKey: args.activePageKey,
    images: args.images,
    history: args.history,
    workLog: args.workLog,
    idea: args.idea,
  });

  // Stick interpreter target onto intent for downstream
  if (instruction.target && !intent.target) {
    intent = { ...intent, target: instruction.target };
  }

  stages[1] = {
    id: "interpret",
    label: "Prompt Interpreter",
    status: "done",
    detail: `${instruction.source} · ${Math.round(instruction.confidence * 100)}% · ${
      instruction.needsModel ? "needs edit model" : "resolved"
    }`,
  };

  // 3) Design Planning
  stages[2] = { id: "plan", label: "Design Planning", status: "running" };
  let plan = planEdits({
    intent,
    prompt: args.prompt,
    config: args.config,
    manifest: args.manifest,
    knowledge: args.knowledge,
    activePageKey: instruction.page || args.activePageKey,
    images: args.images,
  });
  plan = mergePlanWithInstruction(plan, instruction);

  stages[2] = {
    id: "plan",
    label: "Design Planning",
    status: "done",
    detail: plan.resolvedUpdates
      ? `ready · ${plan.resolvedUpdates.length} update(s)`
      : `scoped · ${plan.allowedIds.slice(0, 6).join(", ") || "open"}`,
  };

  // 4) Code Editing
  stages[3] = { id: "edit", label: "Code Editing", status: "running" };
  const payload = await editFromPlan({
    prompt: args.prompt,
    intent,
    plan,
    config: args.config,
    manifest: args.manifest,
    knowledge: args.knowledge,
    activePageKey: instruction.page || args.activePageKey,
    idea: args.idea,
    history: args.history,
    workLog: args.workLog,
    images: args.images,
    compact: true,
    instruction,
  });
  stages[3] = {
    id: "edit",
    label: "Code Editing",
    status: "done",
    detail:
      plan.resolvedUpdates && !instruction.needsModel
        ? "applied instruction (no LLM edit)"
        : payload.mode === "answer"
          ? "answer only"
          : `${payload.updates.length} update(s)`,
  };

  // 5) Validation
  stages[4] = { id: "validate", label: "Validation", status: "running" };
  const validated = validateAgainstPlan({
    payload,
    plan,
    intent,
    manifest: args.manifest,
    config: args.config,
    prompt: args.prompt,
  });
  stages[4] = {
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
      instruction,
      stages,
      dropped: validated.dropped,
      warnings: validated.warnings,
    },
  };
}

function mergePlanWithInstruction(
  plan: EditPlan,
  instruction: StructuredInstruction
): EditPlan {
  const ids = [
    ...plan.allowedIds,
    ...instruction.actions.map((a) => a.id),
    ...(instruction.target?.id ? [instruction.target.id] : []),
    ...(instruction.resolvedUpdates || []).map((u) => u.id),
  ];

  const steps =
    instruction.actions.length > 0
      ? instruction.actions.map((a) => ({
          action: actionToIntent(a.type),
          ids: [a.id],
          rationale: a.note || `${a.type} → ${a.id}`,
        }))
      : plan.steps;

  const resolved =
    instruction.resolvedUpdates &&
    (!instruction.needsModel || instruction.resolvedUpdates.length > 0) &&
    !instruction.needsModel
      ? instruction.resolvedUpdates
      : plan.resolvedUpdates;

  return {
    ...plan,
    steps,
    allowedIds: [...new Set(ids.filter(Boolean))],
    constraints: [...new Set([...plan.constraints, ...instruction.constraints])],
    resolvedUpdates: resolved,
    assistantHint: instruction.assistantHint || plan.assistantHint,
  };
}

function actionToIntent(t: string): IntentAction {
  switch (t) {
    case "style_update":
      return "style";
    case "image_update":
      return "image";
    case "layout_update":
      return "layout";
    case "section_ops":
      return "hide-section";
    case "page_ops":
      return "page-add";
    case "button_update":
    case "form_update":
    case "copy_update":
      return "copy";
    default:
      return "copy";
  }
}
