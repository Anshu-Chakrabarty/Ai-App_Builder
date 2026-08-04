// lib/template-ai/index.ts — public API for the AI-ready template workflow
export type {
  TemplateManifest,
  SiteConfig,
  ConfigUpdate,
  AiUpdatePayload,
  TemplateKnowledge,
  EditableField,
  SectionDef,
  AiReadyPackage,
} from "./types";

export { analyzeTemplate, schemaStringToShape } from "./analyze";
export {
  applyUpdatesToConfig,
  configToCopy,
  getByPath,
  setByPath,
  listEditableCatalog,
  listSectionMap,
} from "./config";
export { renderSiteFromConfig } from "./render-site";
export { renderBoundPages } from "./render-bound";
export { runWebsiteAgent, materializeNewPages } from "./agent";
export type { AgentHistoryTurn, AgentWorkEntry } from "./agent";
export { runEditPipeline } from "./agents/pipeline";
export { interpretPrompt } from "./agents/interpreter";
export type { StructuredInstruction } from "./agents/interpreter";
export type {
  IntentPlan,
  EditPlan,
  PipelineResult,
  PipelineStageStatus,
} from "./agents/types";
export {
  stylesToCSS,
  sanitizeCss,
  isStyleIntent,
  resolveStyleUpdates,
} from "@/lib/site-styles";
export type { SiteStyles } from "@/lib/site-styles";
export { ingestZipBuffer, ingestHtmlString } from "./ingest/from-zip";
export { makeIngestStubTemplate } from "./stub-template";
