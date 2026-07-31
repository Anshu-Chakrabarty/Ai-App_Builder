"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WizardStepper } from "@/components/appbuilder/Stepper";
import { TemplateGallery } from "@/components/appbuilder/TemplateGallery";
import { useAppBuilder } from "@/lib/appbuilder/store";
import {
  ARCHITECTURES,
  BACKENDS,
  CICD_ADVANCED,
  CICD_PROVIDERS,
  CLOUDS,
  COMPUTE_OPTIONS,
  DATABASES,
  DEPLOY_EXTRAS,
  FEATURE_CATALOG,
  FRONTENDS,
  GIT_PROVIDERS,
  MOCK_REPOS,
  PRICING,
  QUICK_IDEAS,
  STACK_EXTRAS,
  TEMPLATES,
  ALL_TEMPLATES,
  THEME_PRESETS,
} from "@/lib/appbuilder/catalog";
import {
  inferNameFromIdea,
  nextStep,
  prevStep,
} from "@/lib/appbuilder/project";
import { normalizeStep } from "@/lib/appbuilder/types";
import type { AppProject } from "@/lib/appbuilder/types";
import { buildDockerfile, buildGithubActionsYaml, buildReadme } from "@/lib/appbuilder/artifacts";
import {
  FREE_SITE_LIMIT,
  canGenerateSite,
  freeRemaining,
  loadBilling,
  recordSuccessfulGeneration,
  upgradePlan,
  usesFreeQuota,
  type AccountBilling,
  type AccountPlan,
} from "@/lib/appbuilder/billing";
import { FreeQuotaBadge, PlansModal } from "@/components/appbuilder/PlansModal";

export default function WizardPage() {
  const router = useRouter();
  const { active, ready, updateActive, goStep, newProject, setActiveId } =
    useAppBuilder();
  const [busy, setBusy] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [featureQuery, setFeatureQuery] = useState("");
  const [featureTab, setFeatureTab] = useState<"all" | "core" | "optional">("all");
  const [selectedFeature, setSelectedFeature] = useState("auth");
  const [templateTab, setTemplateTab] = useState<"ours" | "third" | "upload">("ours");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [remoteTemplates, setRemoteTemplates] = useState<
    { id: string; name: string; description: string; url: string; framework: string; source: string }[]
  >([]);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [previewTab, setPreviewTab] = useState("live");
  const [billing, setBilling] = useState<AccountBilling>({
    plan: "free",
    freeGenerationsUsed: 0,
    totalGenerations: 0,
  });
  const [showPlans, setShowPlans] = useState(false);

  useEffect(() => {
    setBilling(loadBilling());
  }, []);

  useEffect(() => {
    if (templateTab !== "third") return;
    let cancelled = false;
    (async () => {
      setRemoteBusy(true);
      try {
        const res = await fetch("/api/appbuilder/templates?source=vercel");
        const data = await res.json();
        if (!cancelled) setRemoteTemplates(data.items || []);
      } catch {
        if (!cancelled) setRemoteTemplates([]);
      } finally {
        if (!cancelled) setRemoteBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateTab]);

  useEffect(() => {
    if (ready && !active) {
      const p = newProject();
      setActiveId(p.id);
    }
  }, [ready, active, newProject, setActiveId]);

  useEffect(() => {
    if (active && normalizeStep(active.step) !== active.step) {
      updateActive({ step: normalizeStep(active.step) });
    }
  }, [active?.id, active?.step]); // eslint-disable-line react-hooks/exhaustive-deps

  const project = active;
  const step = project ? normalizeStep(project.step) : "idea";

  const selectedFeat = FEATURE_CATALOG.find((f) => f.id === selectedFeature) || FEATURE_CATALOG[0];

  const filteredFeatures = useMemo(() => {
    return FEATURE_CATALOG.filter((f) => {
      const tabOk =
        featureTab === "all" ||
        (featureTab === "core" && f.category === "core") ||
        (featureTab === "optional" && f.category === "optional");
      const qOk =
        !featureQuery ||
        f.name.toLowerCase().includes(featureQuery.toLowerCase()) ||
        f.description.toLowerCase().includes(featureQuery.toLowerCase());
      return tabOk && qOk;
    });
  }, [featureQuery, featureTab]);

  async function analyzeIdea() {
    if (!project) return;
    const ideaText = [project.idea, project.requirementsText].filter(Boolean).join("\n\n");
    if (!ideaText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/appbuilder/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: ideaText }),
      });
      const data = await res.json();
      const keepName =
        project.name &&
        !project.name.startsWith("Untitled") &&
        project.name.trim().length > 0;
      updateActive({
        name: keepName ? project.name : inferNameFromIdea(project.idea || ideaText),
        features: data.features || project.features,
        insights: data.insights,
        pages: data.pages || project.pages,
        chat: [
          ...project.chat,
          { role: "user", text: project.idea || `Requirements: ${project.requirementsFileName}` },
          {
            role: "assistant",
            text:
              (data.summary || "Here’s what I understood.") +
              "\n\nRecommended modules: " +
              (data.modules || []).join(", "),
          },
        ],
      });
    } finally {
      setBusy(false);
    }
  }

  async function askAi(message: string, contextExtra?: Record<string, unknown>) {
    if (!message.trim() || !project) return;
    setBusy(true);
    setChatInput("");
    updateActive({
      chat: [...project.chat, { role: "user", text: message }],
    });
    try {
      const res = await fetch("/api/appbuilder/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context: {
            name: project.name,
            step: project.step,
            features: project.features,
            stack: project.stack,
            deploy: project.deploy,
            selectedFeature,
            ...contextExtra,
          },
        }),
      });
      const data = await res.json();
      updateActive((p) => ({
        ...p,
        chat: [...p.chat, { role: "assistant", text: data.reply || "…" }],
      }));
    } finally {
      setBusy(false);
    }
  }

  function continueNext() {
    if (!project) return;
    const n = nextStep(project.step);
    if (n) goStep(n);
    else router.push(`/studio/${project.id}`);
  }

  function goBack() {
    if (!project) return;
    const p = prevStep(project.step);
    if (p) goStep(p);
    else router.push("/projects");
  }

  async function buildRealSite() {
    if (!project) return;
    if (!project.idea.trim() && !project.requirementsText?.trim()) {
      updateActive({
        chat: [
          ...project.chat,
          {
            role: "assistant",
            text: "Add an idea or upload a requirements file before generating.",
          },
        ],
      });
      return;
    }

    const latest = loadBilling();
    setBilling(latest);
    if (!canGenerateSite(latest)) {
      setShowPlans(true);
      return;
    }

    setBusy(true);
    const resolvedName = project.name.startsWith("Untitled")
      ? inferNameFromIdea(project.idea || project.requirementsText || "")
      : project.name;
    const projectForBuild = { ...project, name: resolvedName };
    updateActive({
      status: "deploying",
      deployProgress: {
        previewEnv: "running",
        payment: "done",
        prodBuild: "running",
        deployment: "pending",
        goLive: "pending",
      },
      name: resolvedName,
    });
    try {
      const res = await fetch("/api/appbuilder/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: projectForBuild }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Build failed");

      setBilling(recordSuccessfulGeneration(loadBilling()));

      updateActive({
        siteTemplateId: data.siteTemplateId,
        site: {
          copy: data.copy,
          pages: data.pages,
          html: data.html,
          usedFallback: !!data.usedFallback,
          builtAt: Date.now(),
          manifest: data.manifest,
          config: data.config,
          knowledge: data.knowledge,
          boundPages: data.boundPages,
          assets: data.assets,
          source: data.source || "template",
        },
        pages: (data.pages || []).map((p: { key: string; label: string }) => ({
          key: p.key,
          label: p.label,
        })),
        artifacts: data.artifacts || {
          githubActions: buildGithubActionsYaml(project),
          dockerfile: buildDockerfile(project),
          readme: buildReadme(project),
        },
        status: "preview",
        url: `${project.repository.repoName || "app"}.appbuilder.local`,
        tech: [
          project.stack.frontend,
          project.stack.backend,
          project.stack.database,
          project.deploy.cloud,
        ],
        deployProgress: {
          previewEnv: "done",
          payment: "done",
          prodBuild: "done",
          deployment: "done",
          goLive: "pending",
        },
        chat: [
          ...project.chat,
          {
            role: "assistant",
            text: data.message || "Your site is ready in Studio.",
          },
        ],
      });
      router.push(`/studio/${project.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Build failed";
      updateActive({
        status: "failed",
        deployProgress: {
          previewEnv: "failed",
          payment: "done",
          prodBuild: "failed",
          deployment: "pending",
          goLive: "pending",
        },
        chat: [
          ...project.chat,
          { role: "assistant", text: `Generation failed: ${msg}` },
        ],
      });
    } finally {
      setBusy(false);
    }
  }

  async function ingestUploadedTemplate(file?: File, sample?: string) {
    if (!project) return;
    setUploadBusy(true);
    setUploadMsg("");
    try {
      let res: Response;
      if (sample) {
        res = await fetch("/api/appbuilder/ingest-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sample,
            brandName: project.name !== "Untitled Application" ? project.name : undefined,
            accent: project.theme?.primary,
          }),
        });
      } else if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("brandName", project.name !== "Untitled Application" ? project.name : "Your Brand");
        form.append("accent", project.theme?.primary || "#2563EB");
        res = await fetch("/api/appbuilder/ingest-template", { method: "POST", body: form });
      } else {
        throw new Error("Choose a file or sample");
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ingest failed");

      updateActive({
        siteTemplateId: data.siteTemplateId,
        templateId: data.siteTemplateId,
        name:
          project.name === "Untitled Application"
            ? data.templateName || project.name
            : project.name,
        site: {
          copy: data.copy,
          pages: data.pages,
          html: data.html,
          usedFallback: false,
          builtAt: Date.now(),
          manifest: data.manifest,
          config: data.config,
          knowledge: data.knowledge,
          boundPages: data.boundPages,
          assets: data.assets,
          source: data.source,
        },
        pages: (data.pages || []).map((p: { key: string; label: string }) => ({
          key: p.key,
          label: p.label,
        })),
        status: "preview",
        chat: [
          ...project.chat,
          {
            role: "assistant",
            text:
              data.message ||
              "Template ingested and made AI-ready (manifest + bindings + knowledge).",
          },
        ],
      });
      setUploadMsg(`Ready: ${data.templateName || "uploaded template"} (${(data.pages || []).length} pages). Open Studio to edit.`);
      setBilling(recordSuccessfulGeneration(loadBilling()));
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  function selectPlan(plan: Exclude<AccountPlan, "free">) {
    const next = upgradePlan(loadBilling(), plan);
    setBilling(next);
    updateActive({ pricingPlan: plan });
    setShowPlans(false);
  }

  const computeOpts = COMPUTE_OPTIONS[project?.deploy.cloud || "aws"] || COMPUTE_OPTIONS.aws;
  const tmpl =
    ALL_TEMPLATES.find((t) => t.id === project?.templateId) ||
    TEMPLATES.find((t) => t.id === project?.templateId) ||
    ALL_TEMPLATES[0] ||
    TEMPLATES[0];
  const genPrice = PRICING.generation[project?.pricingPlan || "professional"].price;
  const amcPrice = project?.amc ? PRICING.amc[project.pricingPlan] : 0;

  if (!ready || !project) {
    return <div className="content">Starting wizard…</div>;
  }

  return (
    <>
      <div className="topbar">
        <WizardStepper current={step} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <FreeQuotaBadge billing={billing} />
          {usesFreeQuota(billing) ? (
            <button type="button" className="btn btn-soft" onClick={() => setShowPlans(true)}>
              View plans
            </button>
          ) : null}
          <span className="muted">{project.name}</span>
          <div className="avatar">A</div>
        </div>
      </div>

      <PlansModal
        billing={billing}
        open={showPlans}
        onClose={() => setShowPlans(false)}
        onSelectPlan={selectPlan}
      />

      <div className="content">
        {step === "idea" && (
          <IdeaStep
            project={project}
            busy={busy}
            updateActive={updateActive}
            analyzeIdea={analyzeIdea}
            askAi={askAi}
            chatInput={chatInput}
            setChatInput={setChatInput}
          />
        )}

        {step === "features" && (
          <div className="grid-3">
            <div className="card">
              <h2 className="page-title" style={{ fontSize: 22 }}>
                Features for {project.name}
              </h2>
              <div className="stat-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className="stat">
                  <div className="k">Selected</div>
                  <div className="v" style={{ color: "var(--ok)" }}>
                    {project.features.length}
                  </div>
                </div>
                <div className="stat">
                  <div className="k">Optional</div>
                  <div className="v" style={{ color: "var(--info)" }}>
                    {FEATURE_CATALOG.filter((f) => f.category === "optional").length}
                  </div>
                </div>
                <div className="stat">
                  <div className="k">Removed</div>
                  <div className="v" style={{ color: "var(--danger)" }}>
                    {project.removedFeatures.length}
                  </div>
                </div>
              </div>
              <div className="tabs">
                {(["all", "core", "optional"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`tab ${featureTab === t ? "active" : ""}`}
                    onClick={() => setFeatureTab(t)}
                  >
                    {t === "all" ? `All (${FEATURE_CATALOG.length})` : t}
                  </button>
                ))}
              </div>
              <input
                className="chat-input"
                style={{ minHeight: 40, marginBottom: 10 }}
                placeholder="Search features…"
                value={featureQuery}
                onChange={(e) => setFeatureQuery(e.target.value)}
              />
              <div style={{ maxHeight: 420, overflow: "auto" }}>
                {filteredFeatures.map((f) => {
                  const on = project.features.includes(f.id);
                  return (
                    <label key={f.id} className="check-row" style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          setSelectedFeature(f.id);
                          updateActive({
                            features: on
                              ? project.features.filter((x) => x !== f.id)
                              : [...project.features, f.id],
                            removedFeatures: on
                              ? [...new Set([...project.removedFeatures, f.id])]
                              : project.removedFeatures.filter((x) => x !== f.id),
                          });
                        }}
                      />
                      <div
                        style={{ flex: 1 }}
                        onClick={() => setSelectedFeature(f.id)}
                      >
                        <strong>
                          {f.icon} {f.name}{" "}
                          <span className="tag">{f.category}</span>
                        </strong>
                        <div className="muted">{f.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <h3>
                {selectedFeat.icon} {selectedFeat.name}
              </h3>
              <p className="muted">{selectedFeat.description}</p>
              <h3 style={{ marginTop: 14 }}>Key capabilities</h3>
              <ul className="muted" style={{ paddingLeft: 18 }}>
                {selectedFeat.capabilities.map((c) => (
                  <li key={c} style={{ marginBottom: 6 }}>
                    {c}
                  </li>
                ))}
              </ul>
              <h3 style={{ marginTop: 14 }}>Related features</h3>
              <div className="chip-row">
                {selectedFeat.related.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="chip on"
                    onClick={() => setSelectedFeature(r)}
                  >
                    {FEATURE_CATALOG.find((f) => f.id === r)?.name || r}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    updateActive({
                      features: project.features.filter((x) => x !== selectedFeat.id),
                      removedFeatures: [...new Set([...project.removedFeatures, selectedFeat.id])],
                    })
                  }
                >
                  Remove Feature
                </button>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() =>
                    askAi(`Suggest improvements for ${selectedFeat.name}`)
                  }
                >
                  Modify with AI
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Ask AI about this feature</h3>
              <div style={{ maxHeight: 280, overflow: "auto", marginBottom: 10 }}>
                {project.chat.slice(-6).map((m, i) => (
                  <div key={i} className={`bubble ${m.role}`}>
                    {m.text}
                  </div>
                ))}
              </div>
              <div className="chip-row" style={{ marginBottom: 10 }}>
                {["How does this relate to Team Management?", "Security considerations?", "Can you suggest improvements?"].map(
                  (s) => (
                    <button key={s} type="button" className="chip" onClick={() => askAi(s)}>
                      {s}
                    </button>
                  )
                )}
              </div>
              <textarea
                className="chat-input"
                placeholder="Ask anything…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary btn-block"
                style={{ marginTop: 8 }}
                disabled={busy}
                onClick={() => askAi(chatInput)}
              >
                Send
              </button>
            </div>
          </div>
        )}

        {step === "setup" && (
          <>
            <h1 className="page-title">Stack & hosting (keep it simple)</h1>
            <p className="page-sub">
              Pick frontend, backend, database, and a cloud. Repo + CI/CD files are generated
              automatically when you build the site.
            </p>
            <div className="grid-2">
              <div style={{ display: "grid", gap: 14 }}>
                <div className="card">
                  <h3>Frontend</h3>
                  <div className="choice-grid">
                    {FRONTENDS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`choice ${project.stack.frontend === f.id ? "selected" : ""}`}
                        onClick={() =>
                          updateActive({ stack: { ...project.stack, frontend: f.id } })
                        }
                      >
                        <strong>
                          {f.name}
                          {f.recommended ? <span className="tag">Recommended</span> : null}
                        </strong>
                        <span>{f.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <h3>Backend</h3>
                  <div className="choice-grid">
                    {BACKENDS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`choice ${project.stack.backend === f.id ? "selected" : ""}`}
                        onClick={() =>
                          updateActive({ stack: { ...project.stack, backend: f.id } })
                        }
                      >
                        <strong>
                          {f.name}
                          {f.recommended ? <span className="tag">Recommended</span> : null}
                        </strong>
                        <span>{f.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <h3>Database</h3>
                  <div className="choice-grid">
                    {[...DATABASES.relational, ...DATABASES.nosql].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`choice ${project.stack.database === d.id ? "selected" : ""}`}
                        onClick={() =>
                          updateActive({ stack: { ...project.stack, database: d.id } })
                        }
                      >
                        <strong>{d.name}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <div className="card">
                  <h3>Cloud</h3>
                  <div className="choice-grid">
                    {CLOUDS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`choice ${project.deploy.cloud === c.id ? "selected" : ""}`}
                        onClick={() =>
                          updateActive({
                            deploy: {
                              ...project.deploy,
                              cloud: c.id,
                              compute: (COMPUTE_OPTIONS[c.id] || [])[0]?.id || "ec2",
                              estimatedCost: c.price,
                            },
                            cicd: { ...project.cicd, targetCloud: c.id },
                          })
                        }
                      >
                        <strong>{c.name}</strong>
                        <span>{c.price}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <h3>Architecture</h3>
                  <div className="choice-grid">
                    {ARCHITECTURES.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={`choice ${project.deploy.architecture === a.id ? "selected" : ""}`}
                        onClick={() =>
                          updateActive({
                            deploy: { ...project.deploy, architecture: a.id },
                          })
                        }
                      >
                        <strong>
                          {a.name}
                          {a.recommended ? <span className="tag">Recommended</span> : null}
                        </strong>
                        <span>{a.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <h3>Summary</h3>
                  <div className="muted">
                    {project.stack.frontend} · {project.stack.backend} · {project.stack.database}
                  </div>
                  <div className="muted">
                    {project.deploy.cloud} · {project.deploy.architecture}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}



        {step === "template" && (
          <>
            <h1 className="page-title">Choose Template</h1>
            <p className="page-sub">
              Pick any template below — click a card to select it. Use categories to filter, or browse
              live Vercel examples under Third Party.
            </p>
            <div className="tabs">
              <button
                type="button"
                className={`tab ${templateTab === "ours" ? "active" : ""}`}
                onClick={() => setTemplateTab("ours")}
              >
                Our Templates ({ALL_TEMPLATES.length})
              </button>
              <button
                type="button"
                className={`tab ${templateTab === "third" ? "active" : ""}`}
                onClick={() => setTemplateTab("third")}
              >
                Third Party (live)
              </button>
              <button
                type="button"
                className={`tab ${templateTab === "upload" ? "active" : ""}`}
                onClick={() => setTemplateTab("upload")}
              >
                Custom Upload
              </button>
            </div>

            {templateTab === "upload" && (
              <div className="card" style={{ marginBottom: 14 }}>
                <p className="muted" style={{ marginBottom: 12 }}>
                  Upload an HTML file or ZIP starter. We’ll parse pages, assign editable IDs, replace
                  content with bindings, and save default config — template structure stays intact.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <label className="btn btn-ghost" style={{ cursor: uploadBusy ? "wait" : "pointer" }}>
                    {uploadBusy ? "Ingesting…" : "Choose .zip / .html"}
                    <input
                      type="file"
                      accept=".zip,.html,.htm,application/zip,text/html"
                      hidden
                      disabled={uploadBusy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void ingestUploadedTemplate(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={uploadBusy}
                    onClick={() => void ingestUploadedTemplate(undefined, "starter-agency")}
                  >
                    Use sample: Starter Agency
                  </button>
                  {project.site?.source === "zip" || project.site?.source === "html" ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => router.push(`/studio/${project.id}`)}
                    >
                      Open in Studio
                    </button>
                  ) : null}
                </div>
                {uploadMsg ? (
                  <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
                    {uploadMsg}
                  </p>
                ) : null}
              </div>
            )}

            {templateTab === "ours" && (
              <TemplateGallery
                templates={ALL_TEMPLATES}
                selectedId={project.templateId}
                idea={[project.idea, project.requirementsText].filter(Boolean).join("\n")}
                title="Browse templates"
                subtitle="Domain-matched to your idea — preview the full site map, then select."
                onSelect={(t) =>
                  updateActive({
                    templateId: t.id,
                    siteTemplateId: t.siteTemplateId || undefined,
                    theme: {
                      ...project.theme,
                      primary: t.accent || project.theme.primary,
                    },
                  })
                }
                onUseSample={() => void ingestUploadedTemplate(undefined, "starter-agency")}
              />
            )}

            {templateTab === "third" && (
              <div style={{ marginBottom: 16 }}>
                {remoteBusy ? (
                  <div className="muted">Loading Vercel / GitHub templates…</div>
                ) : (
                  <div className="tmpl-remote-grid">
                    {remoteTemplates.map((t) => (
                      <div key={t.id} className="tmpl-remote-card">
                        <div className="tmpl-remote-cover">
                          <span className="tmpl-badge" style={{ background: "rgba(255,255,255,.18)" }}>
                            {t.source}
                          </span>
                          <strong style={{ display: "block", marginTop: 8 }}>{t.name}</strong>
                        </div>
                        <div className="tmpl-remote-body">
                          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                            {t.description}
                          </p>
                          <div className="tmpl-tags">
                            <span className="tmpl-tag">{t.framework}</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")}
                          >
                            Open source →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!remoteBusy && remoteTemplates.length === 0 ? (
                  <div className="muted">No remote templates loaded. Check network or try again.</div>
                ) : null}
                <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                  Third-party cards open the source repo. For in-app generation, pick a template under{" "}
                  <strong>Our Templates</strong>.
                </p>
              </div>
            )}
          </>
        )}



        {step === "generate" && (
          <>
            <h1 className="page-title">Generate your website</h1>
            <p className="page-sub">
              Starter is $0 for {FREE_SITE_LIMIT} sites. You have{" "}
              <strong>
                {usesFreeQuota(billing) ? freeRemaining(billing) : "unlimited"}
              </strong>{" "}
              left
              {usesFreeQuota(billing) ? "" : ` on ${billing.plan}`}. Paid plans apply from the first
              paid generation.
            </p>
            <div className="grid-2">
              <div style={{ display: "grid", gap: 14 }}>
                <div className="card">
                  <h3>Application Summary</h3>
                  <div className="stat-row">
                    <div className="stat">
                      <div className="k">Features</div>
                      <div className="v">{project.features.length}</div>
                    </div>
                    <div className="stat">
                      <div className="k">Pages</div>
                      <div className="v">{project.pages.length}</div>
                    </div>
                    <div className="stat">
                      <div className="k">Frontend</div>
                      <div className="v" style={{ fontSize: 14 }}>
                        {project.stack.frontend}
                      </div>
                    </div>
                    <div className="stat">
                      <div className="k">Backend</div>
                      <div className="v" style={{ fontSize: 14 }}>
                        {project.stack.backend}
                      </div>
                    </div>
                  </div>
                  <div className="muted">
                    DB {project.stack.database} · {project.deploy.cloud} · {tmpl.name} ·{" "}
                    {project.deploy.architecture}
                  </div>
                </div>

                <div className="card">
                  <h3>What will be generated automatically</h3>
                  <div className="chip-row">
                    {[
                      "Requirements Document",
                      "Database Schema",
                      "API Documentation",
                      "Source Code",
                      "UI Components",
                      "Deployment Scripts",
                      "Test Cases",
                      "Admin Panel",
                      "CI/CD Pipeline",
                      "Cloud Infrastructure",
                      "Security Configuration",
                      "User Documentation",
                    ].map((x) => (
                      <span key={x} className="chip on">
                        {x}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <h3>AI Generation Workflow</h3>
                  <div className="muted">
                    Requirements Agent → Architecture Agent → Code Generation Agent → Testing
                    Agent → Deployment Agent → Documentation Agent
                  </div>
                  <div className="stat" style={{ marginTop: 10 }}>
                    <div className="k">Estimated generation time</div>
                    <div className="v" style={{ fontSize: 16 }}>
                      15–30 minutes · Fully automated
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3>Pricing</h3>
                  {usesFreeQuota(billing) ? (
                    <div className="muted" style={{ marginBottom: 12 }}>
                      Starter ($0): {freeRemaining(billing)} of {FREE_SITE_LIMIT} website generations
                      remaining. After that, pick Professional or Enterprise — paid plans apply from
                      the first paid generation.
                    </div>
                  ) : (
                    <div className="muted" style={{ marginBottom: 12 }}>
                      You’re on the <strong>{billing.plan}</strong> plan — generate anytime.
                    </div>
                  )}
                  <div className="choice-grid">
                    {(Object.keys(PRICING.generation) as Array<keyof typeof PRICING.generation>).map(
                      (k) => (
                        <button
                          key={k}
                          type="button"
                          className={`choice ${project.pricingPlan === k ? "selected" : ""}`}
                          onClick={() => {
                            updateActive({ pricingPlan: k });
                            setBilling(upgradePlan(loadBilling(), k));
                          }}
                        >
                          <strong>
                            {PRICING.generation[k].name} ·{" "}
                            {PRICING.generation[k].price === 0
                              ? "$0"
                              : `$${PRICING.generation[k].price}`}
                          </strong>
                          <span>
                            {k === "starter"
                              ? `${FREE_SITE_LIMIT} free generations`
                              : "Starts from first generation on this plan"}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                  {usesFreeQuota(billing) && freeRemaining(billing) <= 0 ? (
                    <button
                      type="button"
                      className="btn btn-soft btn-block"
                      style={{ marginTop: 12 }}
                      onClick={() => setShowPlans(true)}
                    >
                      Unlock with a plan
                    </button>
                  ) : null}
                </div>

                <div className="card">
                  <h3>Launch options</h3>
                  <div className="choice-grid">
                    <div className="choice selected">
                      <strong>Interactive Preview · $9</strong>
                      <span>Mock data · read-only · 24h expiry · Recommended</span>
                    </div>
                    <div className="choice">
                      <strong>Publish Full Application · ${genPrice}</strong>
                      <span>Source code · production deploy · SSL · support</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ position: "sticky", top: 80, alignSelf: "start" }}>
                <h3>Order Summary</h3>
                <div className="muted">Plan: {PRICING.generation[project.pricingPlan].name}</div>
                <div className="muted">Generation: ${genPrice}</div>
                <div className="muted">AMC: ${amcPrice}</div>
                <div className="stat" style={{ marginTop: 10 }}>
                  <div className="k">Today’s payment</div>
                  <div className="v">${genPrice}</div>
                </div>
                <div className="muted" style={{ margin: "12px 0" }}>
                  Source code ownership · Automatic deployment · Free SSL
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={busy}
                  onClick={buildRealSite}
                >
                  {busy ? "Generating site…" : "Confirm & Generate Site →"}
                </button>
                <div style={{ marginTop: 14 }}>
                  <h3>Deployment status</h3>
                  {Object.entries(project.deployProgress).map(([k, v]) => (
                    <div key={k} className="muted" style={{ marginBottom: 4 }}>
                      {k}: {v}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="footer-bar">
        <button type="button" className="btn btn-ghost" onClick={goBack}>
          Back
        </button>
        <span className="muted">You can change these settings later in project settings.</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={continueNext}>
            Skip for now
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => {
              if (step === "idea" && (project.idea.trim() || project.requirementsText) && !project.insights) {
                analyzeIdea().then(continueNext);
              } else if (step === "generate") {
                buildRealSite();
              } else {
                continueNext();
              }
            }}
          >
            {busy
              ? "Working…"
              : step === "generate"
                ? canGenerateSite(billing)
                  ? "Generate website →"
                  : "Choose a plan to continue →"
                : "Continue →"}
          </button>
        </div>
      </div>
    </>
  );
}

function IdeaStep({
  project,
  busy,
  updateActive,
  analyzeIdea,
  askAi,
  chatInput,
  setChatInput,
}: {
  project: AppProject;
  busy: boolean;
  updateActive: (p: Partial<AppProject> | ((x: AppProject) => AppProject)) => void;
  analyzeIdea: () => Promise<void>;
  askAi: (m: string) => Promise<void>;
  chatInput: string;
  setChatInput: (s: string) => void;
}) {
  return (
    <>
      <h1 className="page-title">Describe Idea & Delivery</h1>
      <p className="page-sub">
        Set your site title, describe what to build, attach requirements, then continue.
      </p>

      <div className="card" style={{ marginBottom: 14 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--mute)" }}>
            Site / project title
          </span>
          <input
            value={project.name === "Untitled Application" ? "" : project.name}
            onChange={(e) =>
              updateActive({
                name: e.target.value.trim() ? e.target.value : "Untitled Application",
              })
            }
            placeholder="e.g. Willow Primary Care, Harbor Homes, TaskFlow…"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--bg)",
              fontSize: 16,
              fontWeight: 700,
            }}
          />
        </label>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          This name appears in the nav, Studio, downloads, and generated site branding.
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div style={{ maxHeight: 320, overflow: "auto", marginBottom: 12 }}>
            {project.chat.length === 0 ? (
              <div className="bubble assistant">
                Hi! Describe your application idea. Example: “I need a hospital management system
                for a multi-speciality hospital.”
              </div>
            ) : (
              project.chat.map((m, i) => (
                <div key={i} className={`bubble ${m.role}`}>
                  {m.text}
                </div>
              ))
            )}
          </div>
          {project.insights && (
            <div className="stat-row">
              <div className="stat">
                <div className="k">Complexity</div>
                <div className="v" style={{ fontSize: 15 }}>
                  {project.insights.complexity}
                </div>
              </div>
              <div className="stat">
                <div className="k">Timeline</div>
                <div className="v" style={{ fontSize: 15 }}>
                  {project.insights.timeline}
                </div>
              </div>
              <div className="stat">
                <div className="k">Modules</div>
                <div className="v">{project.insights.modules}</div>
              </div>
              <div className="stat">
                <div className="k">Stack</div>
                <div className="v" style={{ fontSize: 13 }}>
                  {project.insights.recommendedStack}
                </div>
              </div>
            </div>
          )}
          <textarea
            className="chat-input"
            placeholder="Ask anything or describe your idea…"
            value={project.idea}
            onChange={(e) => updateActive({ idea: e.target.value })}
          />
          <div className="chip-row" style={{ margin: "10px 0" }}>
            {QUICK_IDEAS.map((q) => (
              <button
                key={q}
                type="button"
                className="chip"
                onClick={() => updateActive({ idea: q })}
              >
                {q}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={analyzeIdea}>
              Analyze with AI
            </button>
            <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
              Attach Requirements File
              <input
                type="file"
                accept=".txt,.md,.csv,.json,.text,text/plain"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  updateActive({
                    requirementsText: text,
                    requirementsFileName: file.name,
                    idea: project.idea || `Build from requirements file: ${file.name}`,
                    chat: [
                      ...project.chat,
                      {
                        role: "user",
                        text: `Attached requirements: ${file.name} (${text.length} chars)`,
                      },
                      {
                        role: "assistant",
                        text: `Loaded “${file.name}”. I’ll use this document when generating your site. Click Analyze with AI, then continue the wizard.`,
                      },
                    ],
                  });
                }}
              />
            </label>
            {project.requirementsFileName ? (
              <span className="chip on">📄 {project.requirementsFileName}</span>
            ) : null}
          </div>

          <h3 style={{ marginTop: 20 }}>Delivery mode</h3>
          <div className="choice-grid">
            {(
              [
                ["ai-only", "AI Only", "Recommended"],
                ["ai-experts", "AI + On-Demand Experts", ""],
                ["expert-assisted", "Expert Assisted", ""],
                ["fully-managed", "Fully Managed", ""],
              ] as const
            ).map(([id, label, tag]) => (
              <button
                key={id}
                type="button"
                className={`choice ${project.deliveryMode === id ? "selected" : ""}`}
                onClick={() => updateActive({ deliveryMode: id })}
              >
                <strong>
                  {label}
                  {tag ? <span className="tag">{tag}</span> : null}
                </strong>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div className="card">
            <h3>Project Insights</h3>
            <div className="muted" style={{ marginBottom: 8 }}>
              Understanding your requirements…
            </div>
            <div className="progress" style={{ marginBottom: 12 }}>
              <i style={{ width: project.insights ? "100%" : "45%" }} />
            </div>
            {project.insights ? (
              <>
                <div className="muted">Complexity: {project.insights.complexity}</div>
                <div className="muted">Timeline: {project.insights.timeline}</div>
                <div className="muted">Modules: {project.insights.modules}</div>
                <div className="muted">Stack: {project.insights.recommendedStack}</div>
              </>
            ) : (
              <div className="muted">Run Analyze with AI to populate insights.</div>
            )}
          </div>
          <div className="card">
            <h3>What you get</h3>
            <div className="muted">● AI-powered application generation</div>
            <div className="muted">● Live preview & studio editing</div>
            <div className="muted">● CI/CD + multi-cloud deploy config</div>
            <div className="muted">● Audit logs & activity tracking</div>
          </div>
          <div className="card">
            <h3>Need help deciding?</h3>
            <textarea
              className="chat-input"
              placeholder="Ask AI assistant…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-soft btn-block"
              style={{ marginTop: 8 }}
              disabled={busy}
              onClick={() => askAi(chatInput)}
            >
              Chat with AI Assistant
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function LivePreview({ project }: { project: AppProject }) {
  return (
    <div className="preview-app">
      <div className="preview-nav">
        <div style={{ fontWeight: 800, marginBottom: 12, padding: "0 8px" }}>
          {project.name.split(" ")[0] || "App"}
        </div>
        {project.pages.map((p, i) => (
          <div key={p.key} className={`item ${i === 0 ? "active" : ""}`}>
            {p.label}
          </div>
        ))}
      </div>
      <div className="preview-body">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong>Dashboard</strong>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: "8px 12px", background: project.theme.primary }}
          >
            + Create Task
          </button>
        </div>
        <div className="kpi-grid">
          {[
            ["128", "Total Tasks"],
            ["34", "In Progress"],
            ["12", "Overdue"],
            ["82", "Completed"],
          ].map(([n, l]) => (
            <div key={l} className="kpi">
              <div className="n" style={{ color: project.theme.primary }}>
                {n}
              </div>
              <div className="l">{l}</div>
            </div>
          ))}
        </div>
        <div className="chart-row">
          <div className="chart-box">
            <div className="muted">Task Overview</div>
            <div className="fake-line" style={{ ["--accent" as string]: project.theme.primary }} />
          </div>
          <div className="chart-box">
            <div className="muted">Tasks by Priority</div>
            <div className="fake-donut" style={{ ["--accent" as string]: project.theme.primary }} />
          </div>
        </div>
      </div>
    </div>
  );
}
