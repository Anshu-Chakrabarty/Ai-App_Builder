// lib/appbuilder/project.ts
import type { AppProject, WizardStepId } from "./types";
import { WIZARD_STEPS, normalizeStep } from "./types";
import { DEFAULT_PAGES, FEATURE_CATALOG } from "./catalog";

export function createBlankProject(partial?: Partial<AppProject>): AppProject {
  const id = partial?.id || `proj_${Date.now().toString(36)}`;
  const now = Date.now();
  return {
    id,
    name: partial?.name || "Untitled Application",
    idea: "",
    status: "draft",
    updatedAt: now,
    createdAt: now,
    tech: [],
    step: "idea",
    features: FEATURE_CATALOG.filter((f) => f.category === "core").map((f) => f.id),
    removedFeatures: [],
    stack: {
      frontend: "react",
      backend: "go",
      database: "postgres",
      extras: ["authentication"],
    },
    deploy: {
      architecture: "monolithic",
      cloud: "aws",
      compute: "ec2",
      domainMode: "none",
      domain: "",
      extras: ["monitoring"],
      estimatedCost: "$18 – $70",
    },
    templateId: "taskflow-pro",
    repository: {
      provider: "github",
      mode: "new",
      repoName: "task-management-app",
      description: "AI generated application",
      visibility: "private",
    },
    cicd: {
      provider: "github-actions",
      pipelineType: "Build, Test & Deploy",
      triggers: ["push-main", "pull-request"],
      envStrategy: "multi",
      environments: ["Development", "Staging", "Production"],
      targetCloud: "aws",
      region: "us-east-1",
      service: "Amazon EKS",
      advanced: ["sast", "tests", "docker", "notify", "rollback"],
    },
    theme: {
      preset: "royal",
      primary: "#7C3AED",
      mode: "dark",
      layout: "default",
      sidebar: "full",
      toggles: {
        collapsible: true,
        rounded: true,
        breadcrumbs: true,
        animations: true,
      },
    },
    deliveryMode: "ai-only",
    helpAreas: [],
    pricingPlan: "professional",
    amc: true,
    chat: [],
    workLog: [],
    siteHistory: [],
    pages: [...DEFAULT_PAGES],
    deployProgress: {
      previewEnv: "not_started",
      payment: "not_started",
      prodBuild: "not_started",
      deployment: "not_started",
      goLive: "not_started",
    },
    ...partial,
  };
}

export function inferNameFromIdea(idea: string): string {
  const m = idea.match(/(?:build|create|need)\s+(?:an?\s+)?([^.!?\n]{8,60})/i);
  if (m) {
    return m[1]
      .trim()
      .replace(/\bfor\b.*$/i, "")
      .replace(/\s+/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase())
      .slice(0, 48);
  }
  if (/hospital|hms|clinic/i.test(idea)) return "Hospital Management System";
  if (/ecommerce|e-commerce|shop/i.test(idea)) return "E-commerce Platform";
  if (/task|todo|kanban/i.test(idea)) return "Task Management Application";
  if (/crm/i.test(idea)) return "CRM System";
  return "AI Generated Application";
}

export function analyzeIdeaLocal(idea: string) {
  const lower = idea.toLowerCase();
  let features = FEATURE_CATALOG.filter((f) => f.category === "core").map((f) => f.id);
  const modules: string[] = [];

  if (/hospital|patient|clinic|doctor|hms/i.test(lower)) {
    modules.push(
      "Patient Management",
      "Appointment Booking",
      "Doctor Management",
      "Billing & Invoicing",
      "Pharmacy Management",
      "Lab Management",
      "EMR / Records",
      "Staff & Roles"
    );
    features = ["auth", "dashboard", "team", "calendar", "notifications", "activity", "files", "reports"];
  } else if (/food|delivery|restaurant|cafe|dining|menu|meal/i.test(lower)) {
    modules.push(
      "Restaurant Listings",
      "Menu View",
      "Shopping Cart",
      "Checkout",
      "Order Tracking",
      "User Profile"
    );
    features = ["auth"];
  } else if (/ecommerce|shop|store|cart/i.test(lower)) {
    modules.push(
      "Product Catalog",
      "Cart & Checkout",
      "Payments",
      "Orders",
      "Inventory",
      "Customer Accounts",
      "Admin Dashboard"
    );
    features = ["auth"];
  } else if (/crm|sales|lead/i.test(lower)) {
    modules.push("Leads", "Contacts", "Deals Pipeline", "Tasks", "Email", "Reports");
  } else {
    modules.push(
      "User Authentication",
      "Task Management",
      "Project Management",
      "Team Collaboration",
      "Notifications",
      "Analytics Dashboard"
    );
  }

  const complexity = modules.length > 10 ? "High" : modules.length > 6 ? "Medium" : "Low";
  const timeline =
    complexity === "High" ? "10–14 weeks" : complexity === "Medium" ? "6–8 weeks" : "3–5 weeks";

  return {
    modules,
    features,
    insights: {
      complexity,
      timeline,
      modules: modules.length,
      recommendedStack: /hospital|clinic/i.test(lower) ? "MERN Stack" : "React + Go + PostgreSQL",
    },
    pages: [
      { key: "dashboard", label: "Dashboard" },
      ...modules.slice(0, 6).map((m) => ({
        key: m.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24),
        label: m.split(" ")[0],
      })),
    ],
  };
}

export function stepIndex(step: WizardStepId): number {
  const id = normalizeStep(step);
  return WIZARD_STEPS.findIndex((s) => s.id === id);
}

export function nextStep(step: WizardStepId): WizardStepId | null {
  const order = WIZARD_STEPS.map((s) => s.id);
  const i = order.indexOf(normalizeStep(step));
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

export function prevStep(step: WizardStepId): WizardStepId | null {
  const order = WIZARD_STEPS.map((s) => s.id);
  const i = order.indexOf(normalizeStep(step));
  return i > 0 ? order[i - 1] : null;
}

const STORAGE_KEY = "appbuilder_projects_v1";
const ACTIVE_KEY = "appbuilder_active_v1";

/** Drop heavy fields so undo history doesn't blow past localStorage quotas. */
function slimSiteSnapshot(site: NonNullable<AppProject["site"]>): NonNullable<AppProject["site"]> {
  return {
    copy: site.copy,
    pages: site.pages,
    html: {}, // re-rendered on restore — never persist full HTML copies
    usedFallback: site.usedFallback,
    builtAt: site.builtAt,
    manifest: site.manifest,
    config: site.config,
    knowledge: site.knowledge,
    boundPages: site.boundPages,
    // assets are often data-URLs — omit from history to save quota
    source: site.source,
  };
}

function slimProject(p: AppProject): AppProject {
  return {
    ...p,
    chat: (p.chat || []).slice(-60).map((c) => ({
      role: c.role,
      text: String(c.text || "").slice(0, 1600),
    })),
    workLog: (p.workLog || []).slice(-30),
    siteHistory: (p.siteHistory || []).slice(-4).map((h) => ({
      at: h.at,
      label: h.label,
      site: slimSiteSnapshot(h.site),
    })),
  };
}

function aggressiveSlim(p: AppProject): AppProject {
  const base = slimProject(p);
  if (!base.site) return { ...base, siteHistory: [] };
  return {
    ...base,
    siteHistory: [],
    site: {
      ...base.site,
      // Keep html for active preview, but drop bound asset blobs if present
      assets: undefined,
    },
  };
}

export function loadProjects(): AppProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppProject[]) : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: AppProject[]) {
  if (typeof window === "undefined") return;
  const slimmed = projects.map(slimProject);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slimmed));
    return;
  } catch (err) {
    console.warn("localStorage save failed, retrying with aggressive slim:", err);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slimmed.map(aggressiveSlim)));
  } catch (err) {
    console.error("localStorage full — project edits may not persist:", err);
  }
}

export function loadActiveId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}
