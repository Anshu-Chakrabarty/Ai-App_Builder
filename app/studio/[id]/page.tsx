"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppBuilder } from "@/lib/appbuilder/store";
import { THEME_PRESETS } from "@/lib/appbuilder/catalog";
import type { DesignOption } from "@/lib/types";

type PendingPage = { label: string; key: string };

export default function StudioPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");
  const { projects, ready, setActiveId, updateActive } = useAppBuilder();
  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [pageKey, setPageKey] = useState("home");
  const [history, setHistory] = useState<string[]>([]);
  const [previewTick, setPreviewTick] = useState(0);
  const [assistantNote, setAssistantNote] = useState("");
  const [designOptions, setDesignOptions] = useState<DesignOption[] | null>(null);
  const [pendingPage, setPendingPage] = useState<PendingPage | null>(null);
  const [pendingQueue, setPendingQueue] = useState<PendingPage[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    if (project) {
      setActiveId(project.id);
      const first = project.site?.pages?.[0]?.key || project.pages[0]?.key || "home";
      setPageKey(first);
      setTitleDraft(project.name);
    }
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  if (!ready) return <div className="content">Loading studio…</div>;
  if (!project) {
    return (
      <div className="content">
        <p className="muted">Project not found.</p>
        <button type="button" className="btn btn-primary" onClick={() => router.push("/projects")}>
          Back to projects
        </button>
      </div>
    );
  }

  const sitePages = project.site?.pages || [];
  const activePage = sitePages.find((p) => p.key === pageKey) || sitePages[0];
  const html =
    (activePage && project.site?.html?.[activePage.slug]) ||
    `<!doctype html><html><body style="font-family:sans-serif;padding:40px;background:#111;color:#eee">
      <h1>No generated site yet</h1>
      <p>Go to Generate and click <strong>Confirm & Generate Site</strong>.</p>
    </body></html>`;

  const previewKey = `${project.site?.builtAt || 0}-${pageKey}-${previewTick}-${
    activePage?.slug || ""
  }-${(html || "").length}`;

  async function applyChange(opts?: {
    selectedDesignId?: string;
    pending?: PendingPage;
    queue?: PendingPage[];
    message?: string;
  }) {
    const proj = project;
    const message = opts?.message ?? prompt;
    if ((!message.trim() && !opts?.selectedDesignId) || !proj?.site) return;
    setBusy(true);
    setAssistantNote("");
    try {
      const res = await fetch("/api/appbuilder/modify-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: [proj.idea, proj.requirementsText].filter(Boolean).join("\n\n"),
          siteTemplateId: proj.siteTemplateId,
          brandName: proj.name,
          accent: proj.theme.primary,
          copy: proj.site.config?.content || proj.site.copy,
          pages: proj.site.pages,
          pageKey: activePage?.key || "home",
          instruction: message || `Build page: ${opts?.pending?.label || ""}`,
          selectedDesignId: opts?.selectedDesignId,
          pendingPage: opts?.pending || pendingPage,
          pendingQueue: opts?.queue ?? pendingQueue,
          manifest: proj.site.manifest,
          config: proj.site.config,
          knowledge: proj.site.knowledge,
          boundPages: proj.site.boundPages,
          assets: proj.site.assets,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Modify failed");

      updateActive({
        site: {
          ...proj.site,
          copy: data.copy,
          pages: data.pages || proj.site.pages,
          html: data.html,
          usedFallback: false,
          builtAt: Date.now(),
          manifest: data.manifest || proj.site.manifest,
          config: data.config || proj.site.config,
          knowledge: data.knowledge || proj.site.knowledge,
          boundPages: data.boundPages || proj.site.boundPages,
          assets: data.assets || proj.site.assets,
        },
        pages: (data.pages || proj.site.pages).map((p: { key: string; label: string }) => ({
          key: p.key,
          label: p.label,
        })),
        chat: [
          ...proj.chat,
          ...(message.trim() ? [{ role: "user" as const, text: message }] : []),
          { role: "assistant" as const, text: data.assistantMessage || "Updated." },
        ],
      });

      setPreviewTick((t) => t + 1);
      setAssistantNote(data.assistantMessage || "Updated.");
      if (message.trim()) {
        setHistory((h) => [`${new Date().toLocaleTimeString()}: ${message.slice(0, 72)}`, ...h]);
      }
      setPrompt("");

      if (data.status === "need_design") {
        setDesignOptions(data.options || []);
        setPendingPage(data.pendingPage || null);
        setPendingQueue(data.pendingQueue || []);
      } else {
        setDesignOptions(null);
        setPendingPage(null);
        setPendingQueue([]);
      }

      if (data.newPageKey) setPageKey(data.newPageKey);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Modify failed";
      setAssistantNote(text);
      updateActive({
        chat: [
          ...(project?.chat || []),
          { role: "assistant", text },
        ],
      });
    } finally {
      setBusy(false);
    }
  }

  function downloadSite() {
    const proj = project;
    if (!proj?.site?.html) return;
    const entries = Object.entries(proj.site.html);
    entries.forEach(([slug, content], i) => {
      setTimeout(() => {
        const blob = new Blob([content], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = slug;
        a.click();
        URL.revokeObjectURL(url);
      }, i * 200);
    });
    if (proj.artifacts) {
      const files = [
        { name: "ci-cd.yml", body: proj.artifacts.githubActions },
        { name: "Dockerfile", body: proj.artifacts.dockerfile },
        { name: "README.md", body: proj.artifacts.readme },
      ];
      files.forEach((f, i) => {
        setTimeout(() => {
          const blob = new Blob([f.body], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = f.name;
          a.click();
          URL.revokeObjectURL(url);
        }, (entries.length + i) * 200);
      });
    }
  }

  async function regenerate() {
    setBusy(true);
    try {
      const res = await fetch("/api/appbuilder/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Build failed");
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
        artifacts: data.artifacts,
        status: "preview",
      });
      setPageKey(data.pages?.[0]?.key || "home");
      setPreviewTick((t) => t + 1);
      setAssistantNote(data.message || "Site regenerated.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Regenerate failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          {editingTitle ? (
            <form
              style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 0 }}
              onSubmit={(e) => {
                e.preventDefault();
                const next = titleDraft.trim() || "Untitled Application";
                updateActive({ name: next });
                setEditingTitle(false);
              }}
            >
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  const next = titleDraft.trim() || "Untitled Application";
                  updateActive({ name: next });
                  setEditingTitle(false);
                }}
                placeholder="Site title"
                style={{
                  flex: 1,
                  minWidth: 120,
                  maxWidth: 360,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--accent)",
                  background: "var(--bg)",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTitleDraft(project.name);
                setEditingTitle(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 700,
                fontSize: 15,
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "text",
                maxWidth: "100%",
              }}
              title="Click to rename"
            >
              <strong
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {project.name}
              </strong>
              <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>
                edit
              </span>
            </button>
          )}
          <span className={`status ${project.status}`}>{project.status}</span>
          {project.site?.usedFallback ? (
            <span className="chip" style={{ marginLeft: 4 }}>
              Sample copy (AI quota/offline)
            </span>
          ) : project.site ? (
            <span className="chip on" style={{ marginLeft: 4 }}>
              Live generated site
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={() => router.push("/wizard")}>
            Wizard
          </button>
          <button
            type="button"
            className="btn btn-soft"
            disabled={!project.site}
            onClick={() => setFullscreen(true)}
          >
            Full screen
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={regenerate}>
            Regenerate Site
          </button>
          <button type="button" className="btn btn-soft" onClick={downloadSite} disabled={!project.site}>
            Download Site + CI/CD
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              updateActive({
                status: "live",
                deployProgress: {
                  previewEnv: "done",
                  payment: "done",
                  prodBuild: "done",
                  deployment: "done",
                  goLive: "done",
                },
              })
            }
          >
            Mark Live
          </button>
        </div>
      </div>

      <div className="content">
        {!project.site && (
          <div className="banner" style={{ marginBottom: 12 }}>
            No site built yet. Open Generate → Confirm & Generate Site.
          </div>
        )}

        <div className="grid-2">
          <div>
            <div
              className="tabs"
              style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1 }}>
                {(sitePages.length ? sitePages : project.pages).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={`tab ${pageKey === p.key ? "active" : ""}`}
                    onClick={() => setPageKey(p.key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "8px 12px", whiteSpace: "nowrap" }}
                disabled={!project.site}
                onClick={() => setFullscreen(true)}
              >
                ⛶ Full screen
              </button>
            </div>
            <div className="preview-frame" style={{ minHeight: 560, padding: 0 }}>
              <iframe
                key={previewKey}
                title="Site preview"
                srcDoc={html}
                style={{ width: "100%", height: 560, border: "none", background: "#fff" }}
              />
            </div>
            {project.requirementsFileName ? (
              <div className="muted" style={{ marginTop: 8 }}>
                Requirements source: {project.requirementsFileName}
              </div>
            ) : null}
          </div>

          <div className="card">
            <h3>AI prompt</h3>
            <p className="muted" style={{ marginBottom: 8 }}>
              AI Website Agent for <strong>{activePage?.label || pageKey}</strong>. Edits{" "}
              <code>config</code> by field IDs (template code never changes). Ask to change copy,
              hide sections, upgrade theme, or create pages from the component library.
            </p>
            <textarea
              className="chat-input"
              placeholder='Ask anything… e.g. "Delete the form on home", "Add a Book Now button under the hero", "Make it more premium", "What pages do I have?"'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={!!designOptions}
            />
            <div className="chip-row" style={{ margin: "10px 0" }}>
              {[
                "Make the headline shorter",
                "Delete the form on this page",
                "Add a Book Now button under the hero",
                "Upgrade the look to feel more premium",
                "Add a Partners page",
                "What can you change on this site?",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  disabled={!!designOptions}
                  onClick={() => setPrompt(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            {assistantNote ? (
              <div className="banner" style={{ marginBottom: 12, fontSize: 13 }}>
                {assistantNote}
              </div>
            ) : null}

            {designOptions && pendingPage ? (
              <div style={{ marginBottom: 14 }}>
                <h3 style={{ marginBottom: 8 }}>
                  Pick a design for “{pendingPage.label}”
                </h3>
                <p className="muted" style={{ marginBottom: 10 }}>
                  No exact template — copy one of these layouts:
                </p>
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    maxHeight: 280,
                    overflow: "auto",
                    paddingRight: 4,
                  }}
                >
                  {designOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="choice"
                      disabled={busy}
                      style={{ textAlign: "left" }}
                      onClick={() =>
                        applyChange({
                          selectedDesignId: opt.id,
                          pending: pendingPage,
                          queue: pendingQueue,
                          message: `Use ${opt.label} for ${pendingPage.label}`,
                        })
                      }
                    >
                      <strong>{opt.label}</strong>
                      <span>{opt.description}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setDesignOptions(null);
                    setPendingPage(null);
                    setPendingQueue([]);
                  }}
                >
                  Cancel design pick
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={busy || !project.site || !prompt.trim()}
                onClick={() => applyChange()}
              >
                {busy ? "Thinking…" : "Send prompt"}
              </button>
            )}

            <h3 style={{ marginTop: 16 }}>Theme accent (re-render on regenerate)</h3>
            <div className="chip-row">
              {THEME_PRESETS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`chip ${project.theme.preset === t.id ? "on" : ""}`}
                  onClick={() =>
                    updateActive({
                      theme: { ...project.theme, preset: t.id, primary: t.color },
                    })
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>

            <h3 style={{ marginTop: 16 }}>Change history</h3>
            {history.length === 0 ? (
              <div className="muted">No AI edits yet.</div>
            ) : (
              history.map((h) => (
                <div key={h} className="muted" style={{ marginBottom: 6 }}>
                  {h}
                </div>
              ))
            )}

            {project.artifacts && (
              <>
                <h3 style={{ marginTop: 16 }}>Deploy artifacts</h3>
                <div className="muted">
                  GitHub Actions + Dockerfile + README download with the site.
                </div>
                <pre className="code-block" style={{ maxHeight: 160 }}>
                  {project.artifacts.githubActions.slice(0, 500)}…
                </pre>
              </>
            )}
          </div>
        </div>
      </div>

      {fullscreen && project.site ? (
        <div className="site-fullscreen" role="dialog" aria-label="Full screen site preview">
          <div className="site-fullscreen-bar">
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <strong style={{ whiteSpace: "nowrap" }}>{project.name}</strong>
              <div className="tabs" style={{ margin: 0, flexWrap: "wrap" }}>
                {sitePages.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={`tab ${pageKey === p.key ? "active" : ""}`}
                    onClick={() => setPageKey(p.key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>
                Esc to exit
              </span>
              <button type="button" className="btn btn-primary" onClick={() => setFullscreen(false)}>
                Exit full screen
              </button>
            </div>
          </div>
          <iframe
            key={`fs-${previewKey}`}
            title="Full screen site"
            srcDoc={html}
            className="site-fullscreen-frame"
          />
        </div>
      ) : null}
    </>
  );
}
