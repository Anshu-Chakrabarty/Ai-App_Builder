// lib/appbuilder/types.ts
export type WizardStepId =
  | "idea"
  | "features"
  | "setup"
  | "template"
  | "generate"
  // legacy steps (migrated via normalizeStep)
  | "stack"
  | "deploy"
  | "repository"
  | "cicd"
  | "preview"
  | "review";

export type ProjectStatus =
  | "draft"
  | "preview"
  | "deploying"
  | "live"
  | "failed"
  | "cancelled";

export type DeliveryMode =
  | "ai-only"
  | "ai-experts"
  | "expert-assisted"
  | "fully-managed";

export type FeatureItem = {
  id: string;
  name: string;
  description: string;
  category: "core" | "optional";
  icon: string;
  capabilities: string[];
  related: string[];
};

export type AppProject = {
  id: string;
  name: string;
  idea: string;
  requirementsText?: string;
  requirementsFileName?: string;
  status: ProjectStatus;
  updatedAt: number;
  createdAt: number;
  url?: string;
  tech: string[];
  step: WizardStepId;
  features: string[];
  removedFeatures: string[];
  stack: {
    frontend: string;
    backend: string;
    database: string;
    extras: string[];
  };
  deploy: {
    architecture: string;
    cloud: string;
    compute: string;
    domainMode: "have" | "purchase" | "none";
    domain: string;
    extras: string[];
    estimatedCost: string;
  };
  templateId: string | null;
  siteTemplateId?: string;
  repository: {
    provider: string;
    mode: "existing" | "new";
    repoName: string;
    description: string;
    visibility: "private" | "public";
    connectedRepo?: string;
  };
  cicd: {
    provider: string;
    pipelineType: string;
    triggers: string[];
    envStrategy: string;
    environments: string[];
    targetCloud: string;
    region: string;
    service: string;
    advanced: string[];
  };
  theme: {
    preset: string;
    primary: string;
    mode: "light" | "dark" | "system";
    layout: "default" | "compact" | "spacious";
    sidebar: "full" | "compact" | "hidden";
    toggles: {
      collapsible: boolean;
      rounded: boolean;
      breadcrumbs: boolean;
      animations: boolean;
    };
  };
  deliveryMode: DeliveryMode;
  helpAreas: string[];
  pricingPlan: "starter" | "professional" | "enterprise";
  amc: boolean;
  insights?: {
    complexity: string;
    timeline: string;
    modules: number;
    recommendedStack: string;
  };
  chat: { role: "user" | "assistant"; text: string }[];
  pages: { key: string; label: string }[];
  site?: {
    /** Legacy copy mirror of config.content for compatibility */
    copy: Record<string, any>;
    pages: {
      key: string;
      label: string;
      slug: string;
      designId?: string;
    }[];
    html: Record<string, string>;
    usedFallback: boolean;
    builtAt: number;
    /** Part 1: AI-ready template contract */
    manifest?: import("@/lib/template-ai").TemplateManifest;
    /** Only this changes on AI edits */
    config?: import("@/lib/template-ai").SiteConfig;
    /** Design DNA / component library */
    knowledge?: import("@/lib/template-ai").TemplateKnowledge;
    /** Bound HTML from ZIP/HTML ingest ({{bindings}}) */
    boundPages?: Record<string, string>;
    /** Ingested assets (path → data URL or CSS text) */
    assets?: Record<string, string>;
    /** How the AI-ready package was produced */
    source?: "zip" | "html" | "template";
  };
  artifacts?: {
    githubActions: string;
    dockerfile: string;
    readme: string;
  };
  deployProgress: {
    previewEnv: string;
    payment: string;
    prodBuild: string;
    deployment: string;
    goLive: string;
  };
};

/** Simplified 5-step flow */
export const WIZARD_STEPS: { id: WizardStepId; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "features", label: "Features" },
  { id: "setup", label: "Stack & Hosting" },
  { id: "template", label: "Template" },
  { id: "generate", label: "Generate" },
];

export function normalizeStep(step: WizardStepId): WizardStepId {
  if (step === "stack" || step === "deploy" || step === "repository" || step === "cicd") {
    return "setup";
  }
  if (step === "preview" || step === "review") return "generate";
  if (WIZARD_STEPS.some((s) => s.id === step)) return step;
  return "idea";
}
