// lib/template-ai/agents/types.ts — multi-agent edit pipeline contracts
import type { AiUpdatePayload, ConfigUpdate } from "../types";

export type IntentKind = "answer" | "mutate" | "clarify";
export type IntentScope = "field" | "section" | "page" | "site";
export type IntentAction =
  | "copy"
  | "image"
  | "layout"
  | "theme"
  | "style"
  | "page-add"
  | "page-remove"
  | "hide-section"
  | "show-section"
  | "question";

export type ContinuityMode = "follow-up" | "new-topic" | "standalone";

/** Natural Language Agent output */
export type IntentPlan = {
  kind: IntentKind;
  scope: IntentScope;
  actions: IntentAction[];
  continuity: ContinuityMode;
  /** Resolved target (explicit, sticky follow-up, or inferred) */
  target: { id: string; kind?: string; label?: string } | null;
  /** Plain-language restatement of what the user wants */
  summary: string;
  /** Notes for downstream agents */
  notes: string[];
  /** True when layout/gallery/image/style can skip the LLM editor */
  fastPath?: "layout" | "gallery-card" | "image-upload" | "style" | null;
};

export type EditPlanStep = {
  action: IntentAction | "mutate";
  ids: string[];
  rationale: string;
};

/** Design Planning Agent output */
export type EditPlan = {
  steps: EditPlanStep[];
  /** IDs the Code Editing Agent may touch */
  allowedIds: string[];
  constraints: string[];
  /** Optional variant hints from knowledge */
  variants: string[];
  /** When set, editor may skip Gemini and use these updates */
  resolvedUpdates?: ConfigUpdate[];
  assistantHint?: string;
};

export type PipelineStageId =
  | "understand"
  | "interpret"
  | "plan"
  | "edit"
  | "validate";

export type PipelineStageStatus = {
  id: PipelineStageId;
  label: string;
  status: "pending" | "running" | "done" | "skipped";
  detail?: string;
};

/** Full pipeline result (extends AiUpdatePayload) */
export type PipelineResult = AiUpdatePayload & {
  pipeline: {
    intent: IntentPlan;
    plan: EditPlan;
    instruction?: import("./interpreter").StructuredInstruction;
    stages: PipelineStageStatus[];
    dropped: ConfigUpdate[];
    warnings: string[];
  };
};
