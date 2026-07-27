"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppBuilder } from "@/lib/appbuilder/store";
import { TEMPLATES } from "@/lib/appbuilder/catalog";
import { TemplateGallery } from "@/components/appbuilder/TemplateGallery";
import type { RemoteTemplate } from "@/lib/appbuilder/remote-templates";

type SourceFilter = "ours" | "all" | "local" | "vercel" | "netlify" | "free-html" | "envato";

export default function TemplatesPage() {
  const router = useRouter();
  const { active, updateActive, newProject, setActiveId } = useAppBuilder();
  const [source, setSource] = useState<SourceFilter>("ours");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<RemoteTemplate[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ingestBusy, setIngestBusy] = useState(false);

  useEffect(() => {
    if (source === "ours") return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError("");
      try {
        const apiSource = source === "all" ? "all" : source;
        const params = new URLSearchParams({ source: apiSource });
        if (q.trim()) params.set("q", q.trim());
        const res = await fetch(`/api/appbuilder/templates?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load templates");
        if (!cancelled) {
          setItems(data.items || []);
          setNotes(data.meta?.notes || {});
          setCounts(data.meta?.counts || {});
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, q]);

  function ensureProject() {
    if (active) return active;
    const p = newProject();
    setActiveId(p.id);
    return p;
  }

  function useLocalTemplate(templateId: string, siteTemplateId?: string, accent?: string) {
    const proj = ensureProject();
    updateActive({
      templateId,
      siteTemplateId: siteTemplateId || undefined,
      theme: accent
        ? { ...proj.theme, primary: accent }
        : proj.theme,
    });
    router.push("/wizard");
  }

  async function useSampleZip() {
    const proj = ensureProject();
    setIngestBusy(true);
    try {
      const res = await fetch("/api/appbuilder/ingest-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sample: "starter-agency",
          brandName: proj.name !== "Untitled Application" ? proj.name : "Harbor Studio",
          accent: proj.theme?.primary || "#0F766E",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ingest failed");
      updateActive({
        siteTemplateId: data.siteTemplateId,
        templateId: "starter-agency-sample",
        name: proj.name === "Untitled Application" ? data.templateName || proj.name : proj.name,
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
      });
      router.push(`/studio/${proj.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Sample ingest failed");
    } finally {
      setIngestBusy(false);
    }
  }

  function useTemplate(t: RemoteTemplate) {
    if (t.source === "local") {
      useLocalTemplate(t.id);
      return;
    }
    window.open(t.url, "_blank", "noopener,noreferrer");
  }

  const filters: { id: SourceFilter; label: string }[] = [
    { id: "ours", label: `Visual gallery (${TEMPLATES.length})` },
    { id: "all", label: `Live catalogs (${Object.values(counts).reduce((a, b) => a + b, 0) || "…"})` },
    { id: "local", label: `AppBuilder API (${counts.local ?? "…"})` },
    { id: "vercel", label: `Vercel / GitHub (${counts.vercel ?? "…"})` },
    { id: "netlify", label: `Netlify (${counts.netlify ?? "…"})` },
    { id: "free-html", label: `Free HTML (${counts["free-html"] ?? "…"})` },
    { id: "envato", label: `ThemeForest (${counts.envato ?? "…"})` },
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <strong>Templates</strong>
          <div className="muted">
            Browse visual previews, pick a look, then continue in the wizard — or explore live catalogs
          </div>
        </div>
      </div>
      <div className="content">
        <div className="chip-row" style={{ marginBottom: 16 }}>
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip ${source === f.id ? "on" : ""}`}
              onClick={() => setSource(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {source === "ours" ? (
          <>
            {ingestBusy ? (
              <div className="banner" style={{ marginBottom: 14 }}>
                Ingesting sample template…
              </div>
            ) : null}
            <TemplateGallery
              templates={TEMPLATES}
              selectedId={active?.templateId}
              title="Choose a starting look"
              subtitle="Click Preview for a full mockup, or Use template to continue in the wizard."
              onSelect={(t) => useLocalTemplate(t.id, t.siteTemplateId, t.accent)}
              onUseSample={() => void useSampleZip()}
            />
          </>
        ) : (
          <>
            <div className="banner" style={{ marginBottom: 14, fontSize: 13 }}>
              <strong>Live catalogs:</strong> Vercel examples + Netlify + free HTML load via public
              APIs. ThemeForest needs <code>ENVATO_PERSONAL_TOKEN</code> for paid listings.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <input
                className="tmpl-search"
                style={{ flex: 1 }}
                placeholder="Search live catalogs…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {busy ? <div className="muted">Loading catalogs…</div> : null}
            {error ? <div className="banner">{error}</div> : null}

            <div className="tmpl-remote-grid">
              {items.map((t) => (
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
                      <span className="tmpl-tag tmpl-tag-soft">{t.category}</span>
                    </div>
                    {t.install ? (
                      <code style={{ fontSize: 11, color: "var(--mute)" }}>{t.install}</code>
                    ) : null}
                    <button type="button" className="btn btn-primary" onClick={() => useTemplate(t)}>
                      {t.source === "local" ? "Use Template" : "Open source →"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!busy && items.length === 0 ? (
              <div className="muted" style={{ marginTop: 16 }}>
                No templates in this filter.
              </div>
            ) : null}

            {notes.vercel ? (
              <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
                {notes.vercel}
              </p>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
