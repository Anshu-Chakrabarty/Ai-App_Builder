"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppBuilder } from "@/lib/appbuilder/store";
import { THEME_PRESETS } from "@/lib/appbuilder/catalog";
import type { DesignOption } from "@/lib/types";
import {
  StudioPromptPanel,
  type StudioTarget,
} from "@/components/appbuilder/StudioPromptPanel";
import { injectPreviewSelectScript } from "@/lib/studio/preview-select";

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
  const [target, setTarget] = useState<StudioTarget | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [pipelineStages, setPipelineStages] = useState<
    | {
        id: string;
        label: string;
        status: "pending" | "running" | "done" | "skipped";
        detail?: string;
      }[]
    | null
  >(null);

  // Show 4-agent pipeline progress while a Studio edit runs
  useEffect(() => {
    if (!busy) return;
    setPipelineStages([
      { id: "understand", label: "Natural Language", status: "running" },
      { id: "plan", label: "Design Planning", status: "pending" },
      { id: "edit", label: "Code Editing", status: "pending" },
      { id: "validate", label: "Validation", status: "pending" },
    ]);
  }, [busy]);

  function sanitizeChatText(text: string): string {
    return String(text || "")
      .replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/g, "[image]")
      .slice(0, 2000);
  }

  async function undoLastChange() {
    const hist = project?.siteHistory || [];
    if (!hist.length || !project?.site) return;
    const last = hist[hist.length - 1];
    setBusy(true);
    setAssistantNote("Restoring previous design…");
    try {
      const res = await fetch("/api/appbuilder/modify-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: [project.idea, project.requirementsText].filter(Boolean).join("\n\n"),
          siteTemplateId: project.siteTemplateId,
          brandName: project.name,
          accent: project.theme.primary,
          copy: last.site.config?.content || last.site.copy || {},
          pages: last.site.pages || project.site.pages,
          pageKey: pageKey || "home",
          instruction: "Restore previous design",
          restoreSnapshot: true,
          manifest: last.site.manifest || project.site.manifest,
          config: last.site.config || project.site.config,
          knowledge: last.site.knowledge || project.site.knowledge,
          boundPages: last.site.boundPages || project.site.boundPages,
          assets: project.site.assets,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore failed");
      updateActive({
        site: {
          ...project.site,
          copy: data.copy,
          pages: data.pages || last.site.pages,
          html: data.html,
          usedFallback: false,
          builtAt: Date.now(),
          manifest: data.manifest || last.site.manifest,
          config: data.config || last.site.config,
          knowledge: data.knowledge || last.site.knowledge,
          boundPages: data.boundPages || project.site.boundPages,
        },
        pages: (data.pages || last.site.pages || []).map((p: { key: string; label: string }) => ({
          key: p.key,
          label: p.label,
        })),
        siteHistory: hist.slice(0, -1),
        chat: [
          ...(project.chat || []),
          { role: "assistant" as const, text: `Restored previous design (${last.label}).` },
        ],
        workLog: [
          ...(project.workLog || []),
          {
            at: Date.now(),
            prompt: "undo",
            summary: `Restored: ${last.label}`,
            ops: ["undo"],
          },
        ].slice(-40),
      });
      setPreviewTick((t) => t + 1);
      setAssistantNote(`Restored previous design (${last.label}).`);
    } catch (err) {
      setAssistantNote(err instanceof Error ? err.message : "Undo failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (project) {
      setActiveId(project.id);
      const first = project.site?.pages?.[0]?.key || project.pages[0]?.key || "home";
      setPageKey(first);
      setTitleDraft(project.name);
    }
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTarget(null);
  }, [pageKey]);

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

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data) return;
      if (e.data.type === "studio-navigate" && e.data.slug) {
        const slug = String(e.data.slug).replace(/^\.\//, "");
        const pages = project?.site?.pages || [];
        const hit =
          pages.find((p) => p.slug === slug || p.slug === slug.replace(/^\//, "")) ||
          pages.find((p) => p.key === slug.replace(/\.html$/i, ""));
        if (hit) {
          setPageKey(hit.key);
          setAssistantNote(`Browsing “${hit.label}” — full site structure`);
        }
        return;
      }
      if (e.data.type !== "studio-select" || !e.data.target) return;
      const t = e.data.target as StudioTarget;
      setTarget(t);
      setAssistantNote(`Selected “${t.label}” — describe the change or upload an image.`);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [project?.site?.pages]);

  // Auto-heal broken preview HTML or dead gallery image URLs (e.g. Detail 404)
  useEffect(() => {
    const site = project?.site;
    if (!site?.html || !site.config || !project) return;
    const ideaText = [project.idea, project.requirementsText, project.name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const broken = Object.values(site.html).some((h) =>
      /<p>Render error<\/p>/i.test(String(h || ""))
    );
    const mediaBlob =
      String(site.config.media?.hero || "") +
      (site.config.media?.gallery || []).join(" ") +
      Object.values(site.html || {}).join(" ").slice(0, 50000);
    const deadGallery = /photo-1581595220892-b245d5c2e3e8|photo-1523050854058-8df90110c9f1/.test(
      mediaBlob
    );
    const mediaCat = String(site.config.media?.category || "");
    const wantFood = /food|delivery|restaurant|cafe|dining|menu|meal/.test(ideaText);
    const wrongDomain =
      wantFood &&
      (mediaCat === "healthcare" || mediaCat === "dental");
    if (!broken && !deadGallery && !wrongDomain) return;
    let cancelled = false;
    const proj = project;
    (async () => {
      setAssistantNote(
        deadGallery
          ? "Fixing gallery images that failed to load…"
          : wrongDomain
            ? "Updating imagery to match your idea…"
            : "Repairing broken Home preview…"
      );
      setBusy(true);
      try {
        const res = await fetch("/api/appbuilder/modify-site", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idea: [proj.idea, proj.requirementsText].filter(Boolean).join("\n\n"),
            siteTemplateId: wrongDomain ? "ecommerce" : proj.siteTemplateId,
            brandName: proj.name,
            accent: proj.theme.primary,
            copy: site.config?.content || site.copy || {},
            pages: site.pages,
            pageKey: "home",
            instruction: "",
            rerenderOnly: true,
            manifest: site.manifest,
            config: site.config,
            knowledge: site.knowledge,
            boundPages: site.boundPages,
            assets: site.assets,
          }),
        });
        const data = await res.json();
        if (cancelled || !res.ok) return;
        updateActive({
          site: {
            ...site,
            copy: data.copy,
            pages: data.pages || site.pages,
            html: data.html,
            usedFallback: site.usedFallback,
            builtAt: Date.now(),
            manifest: data.manifest || site.manifest,
            config: data.config || site.config,
            knowledge: data.knowledge || site.knowledge,
          },
          ...(wrongDomain ? { siteTemplateId: "ecommerce" } : {}),
        });
        setPreviewTick((t) => t + 1);
        setAssistantNote(data.assistantMessage || "Gallery images repaired.");
      } catch {
        if (!cancelled) {
          setAssistantNote("Couldn’t auto-fix images — click Regenerate Site.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.site?.builtAt]);

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
  const rawHtml =
    (activePage && project.site?.html?.[activePage.slug]) ||
    `<!doctype html><html><body style="font-family:sans-serif;padding:40px;background:#111;color:#eee">
      <h1>No generated site yet</h1>
      <p>Go to Generate and click <strong>Confirm & Generate Site</strong>.</p>
    </body></html>`;
  const html = injectPreviewSelectScript(rawHtml, target?.id);

  const previewKey = `${project.site?.builtAt || 0}-${pageKey}-${previewTick}-${
    activePage?.slug || ""
  }-${(html || "").length}-${target?.id || ""}`;

  async function applyChange(opts?: {
    selectedDesignId?: string;
    pending?: PendingPage;
    queue?: PendingPage[];
    message?: string;
  }) {
    const proj = project;
    const message = opts?.message ?? prompt;
    if ((!message.trim() && !opts?.selectedDesignId && images.length === 0) || !proj?.site) return;

    // Local undo / restore — no API round-trip
    if (/^\s*(undo|go back|restore|revert|previous design)\b/i.test(message.trim())) {
      if ((proj.siteHistory || []).length) {
        undoLastChange();
        setPrompt("");
      } else {
        setAssistantNote("Nothing to undo yet — make an edit first.");
      }
      return;
    }

    setBusy(true);
    setAssistantNote("");
    try {
      // Snapshot config only (not full HTML) so localStorage doesn't break
      const snapLabel = (message.trim() || "edit").slice(0, 64);
      const priorSite = {
        copy: structuredClone(proj.site.copy),
        pages: structuredClone(proj.site.pages),
        html: {} as Record<string, string>,
        usedFallback: proj.site.usedFallback,
        builtAt: proj.site.builtAt,
        manifest: proj.site.manifest,
        config: structuredClone(proj.site.config),
        knowledge: proj.site.knowledge,
        boundPages: proj.site.boundPages,
        source: proj.site.source,
      };
      const scoped =
        target && message.trim()
          ? `[Target: ${target.label} (${target.id}, ${target.kind})]\n${message}`
          : message;
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
          instruction: scoped || `Build page: ${opts?.pending?.label || ""}`,
          selectedDesignId: opts?.selectedDesignId,
          pendingPage: opts?.pending || pendingPage,
          pendingQueue: opts?.queue ?? pendingQueue,
          manifest: proj.site.manifest,
          config: proj.site.config,
          knowledge: proj.site.knowledge,
          boundPages: proj.site.boundPages,
          assets: proj.site.assets,
          history: (proj.chat || []).slice(-40),
          workLog: (proj.workLog || []).slice(-20),
          target: (() => {
            const explicit = target
              ? { id: target.id, kind: target.kind, label: target.label }
              : null;
            if (explicit) return explicit;
            const msg = message.trim();
            if (
              msg &&
              (/\b(make it|change it|update it|fix it|tweak it|refine it|try again)\b/i.test(msg) ||
                /^(shorter|longer|warmer|cooler|more|less|ok|okay|yes)[.!]?$/i.test(msg)) &&
              !/\b(now |separately|new request|forget|start over|switch to)\b/i.test(msg)
            ) {
              return proj.lastStudioTarget || null;
            }
            return null;
          })(),
          images: images.length ? images : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Modify failed");

      if (data.pipeline?.stages?.length) {
        setPipelineStages(data.pipeline.stages);
      }

      const nextPages = data.pages || proj.site.pages;
      const userText = sanitizeChatText(
        (message.trim() || "Apply uploaded image") +
          (target ? ` → ${target.label}` : "") +
          (images.length ? ` [${images.length} image]` : "")
      );
      updateActive({
        site: {
          ...proj.site,
          copy: data.copy,
          pages: nextPages,
          html: data.html,
          usedFallback: false,
          builtAt: Date.now(),
          manifest: data.manifest || proj.site.manifest,
          config: data.config || proj.site.config,
          knowledge: data.knowledge || proj.site.knowledge,
          boundPages: data.boundPages || proj.site.boundPages,
          assets: data.assets || proj.site.assets,
        },
        pages: nextPages.map((p: { key: string; label: string }) => ({
          key: p.key,
          label: p.label,
        })),
        siteHistory: [
          ...(proj.siteHistory || []),
          { at: Date.now(), label: snapLabel, site: priorSite },
        ].slice(-10),
        chat: [
          ...proj.chat,
          ...(message.trim() || images.length
            ? [{ role: "user" as const, text: userText }]
            : []),
          {
            role: "assistant" as const,
            text: sanitizeChatText(data.assistantMessage || "Updated."),
          },
        ].slice(-120),
        lastStudioTarget: target
          ? { id: target.id, kind: target.kind, label: target.label }
          : proj.lastStudioTarget || null,
        workLog: [
          ...(proj.workLog || []),
          ...(data.workEntry
            ? [data.workEntry]
            : message.trim() || images.length
              ? [
                  {
                    at: Date.now(),
                    prompt: message || "uploaded image",
                    summary: data.assistantMessage || "Updated",
                    ops: (data.updates || []).map(
                      (u: { op?: string; id?: string }) => `${u.op || "set"}:${u.id || ""}`
                    ),
                  },
                ]
              : []),
        ].slice(-40),
      });

      setPreviewTick((t) => t + 1);
      setAssistantNote(data.assistantMessage || "Updated.");
      if (message.trim() || images.length) {
        setHistory((h) => [
          `${new Date().toLocaleTimeString()}: ${data.assistantMessage?.slice(0, 72) || message.slice(0, 72)}`,
          ...h,
        ]);
      }
      setPrompt("");
      setImages([]);

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
      if (data.newPageKey === "home" || !nextPages.some((p: { key: string }) => p.key === pageKey)) {
        setPageKey(data.newPageKey || "home");
      }
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
      setTimeout(() => setPipelineStages(null), 2400);
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
                {(sitePages.length ? sitePages : project.pages).map((p, i) => (
                  <button
                    key={p.key}
                    type="button"
                    className={`tab ${pageKey === p.key ? "active" : ""}`}
                    onClick={() => setPageKey(p.key)}
                    title={`Page ${i + 1} of ${(sitePages.length ? sitePages : project.pages).length}`}
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
            {(sitePages.length ? sitePages : project.pages).length > 0 ? (
              <div className="studio-sitemap-strip">
                <span className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Site structure
                </span>
                <ol className="studio-sitemap-list">
                  {(sitePages.length ? sitePages : project.pages).map((p, i) => (
                    <li key={p.key}>
                      <button
                        type="button"
                        className={pageKey === p.key ? "on" : ""}
                        onClick={() => setPageKey(p.key)}
                      >
                        <em>{i + 1}</em>
                        {p.label}
                        <span className="muted">
                          {"slug" in p && typeof p.slug === "string" ? p.slug : `${p.key}.html`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="muted" style={{ fontSize: 11, margin: "6px 0 0" }}>
                  Click any page above — or use nav links inside the preview — to browse the whole site.
                </p>
              </div>
            ) : null}
            <div className="preview-frame" style={{ minHeight: 560, padding: 0, position: "relative" }}>
              <iframe
                key={previewKey}
                title="Site preview"
                srcDoc={html}
                style={{ width: "100%", height: 560, border: "none", background: "#fff" }}
              />
              <div
                className="muted"
                style={{
                  position: "absolute",
                  left: 10,
                  bottom: 10,
                  fontSize: 11,
                  background: "rgba(255,255,255,.92)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "5px 8px",
                  pointerEvents: "none",
                }}
              >
                Click a section to select it · Alt+click for a field/image · links still work
              </div>
            </div>
            {project.requirementsFileName ? (
              <div className="muted" style={{ marginTop: 8 }}>
                Requirements source: {project.requirementsFileName}
              </div>
            ) : null}
          </div>

          <div className="card">
            <StudioPromptPanel
              prompt={prompt}
              onPromptChange={setPrompt}
              busy={busy}
              disabled={!!designOptions}
              pageKey={activePage?.key || pageKey}
              pageLabel={activePage?.label || pageKey}
              manifest={project.site?.manifest}
              target={target}
              onTargetChange={setTarget}
              images={images}
              onImagesChange={setImages}
              onSend={() => applyChange()}
              chat={project.chat || []}
              canUndo={!!(project.siteHistory && project.siteHistory.length)}
              onUndo={undoLastChange}
              onClearChat={() => {
                updateActive({ chat: [], workLog: [] });
                setAssistantNote("Chat cleared — site design unchanged.");
              }}
              pipelineStages={pipelineStages}
            />

            {assistantNote ? (
              <div className="banner" style={{ margin: "12px 0", fontSize: 13 }}>
                {assistantNote}
              </div>
            ) : null}

            {(project.workLog?.length || 0) > 0 ? (
              <details style={{ marginTop: 12 }}>
                <summary className="muted" style={{ cursor: "pointer", fontSize: 13 }}>
                  Work log ({project.workLog!.length}) — AI continuity
                </summary>
                <div style={{ display: "grid", gap: 8, maxHeight: 180, overflow: "auto", marginTop: 8 }}>
                  {project.workLog!
                    .slice()
                    .reverse()
                    .slice(0, 10)
                    .map((w, i) => (
                      <div
                        key={`w-${w.at}-${i}`}
                        className="muted"
                        style={{
                          fontSize: 12,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid var(--line)",
                          background: "var(--bg)",
                        }}
                      >
                        <strong style={{ color: "var(--text)" }}>{w.summary}</strong>
                        <div style={{ marginTop: 4, opacity: 0.85 }}>
                          {new Date(w.at).toLocaleString()} · “{w.prompt.slice(0, 72)}
                          {w.prompt.length > 72 ? "…" : ""}”
                        </div>
                      </div>
                    ))}
                </div>
              </details>
            ) : null}

            {designOptions && pendingPage ? (
              <div style={{ marginBottom: 14, marginTop: 12 }}>
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
            ) : null}

            <h3 style={{ marginTop: 16 }}>Theme accent</h3>
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
