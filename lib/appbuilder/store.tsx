"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppProject, WizardStepId } from "./types";
import { normalizeStep } from "./types";
import {
  createBlankProject,
  loadActiveId,
  loadProjects,
  saveActiveId,
  saveProjects,
} from "./project";
import { SEED_PROJECTS } from "./catalog";

type Ctx = {
  projects: AppProject[];
  active: AppProject | null;
  ready: boolean;
  setActiveId: (id: string | null) => void;
  upsert: (project: AppProject) => void;
  updateActive: (patch: Partial<AppProject> | ((p: AppProject) => AppProject)) => void;
  newProject: () => AppProject;
  deleteProject: (id: string) => void;
  goStep: (step: WizardStepId) => void;
};

const AppBuilderContext = createContext<Ctx | null>(null);

export function AppBuilderProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let list = loadProjects();
    if (!list.length) {
      // Seed demo list entries as lightweight drafts for the Projects page
      list = SEED_PROJECTS.map((s) =>
        createBlankProject({
          id: s.id,
          name: s.name,
          status: s.status,
          url: s.url,
          tech: s.tech,
          updatedAt: s.updatedAt,
          step: s.status === "draft" ? "idea" : "review",
        })
      );
      saveProjects(list);
    }
    setProjects(list);
    setActiveIdState(loadActiveId() || list[0]?.id || null);
    setReady(true);
  }, []);

  const persist = useCallback((next: AppProject[], id: string | null) => {
    setProjects(next);
    saveProjects(next);
    setActiveIdState(id);
    saveActiveId(id);
  }, []);

  const setActiveId = useCallback(
    (id: string | null) => {
      setActiveIdState(id);
      saveActiveId(id);
    },
    []
  );

  const upsert = useCallback(
    (project: AppProject) => {
      const next = [...projects];
      const i = next.findIndex((p) => p.id === project.id);
      const updated = { ...project, updatedAt: Date.now() };
      if (i >= 0) next[i] = updated;
      else next.unshift(updated);
      persist(next, updated.id);
    },
    [persist, projects]
  );

  const active = useMemo(
    () => projects.find((p) => p.id === activeId) || null,
    [projects, activeId]
  );

  const updateActive = useCallback(
    (patch: Partial<AppProject> | ((p: AppProject) => AppProject)) => {
      if (!active) return;
      const updated =
        typeof patch === "function"
          ? patch(active)
          : { ...active, ...patch, updatedAt: Date.now() };
      upsert(updated);
    },
    [active, upsert]
  );

  const newProject = useCallback(() => {
    const p = createBlankProject();
    persist([p, ...projects], p.id);
    return p;
  }, [persist, projects]);

  const deleteProject = useCallback(
    (id: string) => {
      const next = projects.filter((p) => p.id !== id);
      persist(next, next[0]?.id || null);
    },
    [persist, projects]
  );

  const goStep = useCallback(
    (step: WizardStepId) => {
      updateActive({ step: normalizeStep(step) });
    },
    [updateActive]
  );

  const value: Ctx = {
    projects,
    active,
    ready,
    setActiveId,
    upsert,
    updateActive,
    newProject,
    deleteProject,
    goStep,
  };

  return (
    <AppBuilderContext.Provider value={value}>{children}</AppBuilderContext.Provider>
  );
}

export function useAppBuilder() {
  const ctx = useContext(AppBuilderContext);
  if (!ctx) throw new Error("useAppBuilder must be used within AppBuilderProvider");
  return ctx;
}
