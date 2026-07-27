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
} from "./config";
export { renderSiteFromConfig } from "./render-site";
export { renderBoundPages } from "./render-bound";
export { runWebsiteAgent, materializeNewPages } from "./agent";
export { ingestZipBuffer, ingestHtmlString } from "./ingest/from-zip";
export { makeIngestStubTemplate } from "./stub-template";
