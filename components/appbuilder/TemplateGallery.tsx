"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogTemplate } from "@/lib/appbuilder/catalog";
import { TEMPLATE_CATEGORIES } from "@/lib/appbuilder/catalog";
import { recommendTemplatesForIdea } from "@/lib/appbuilder/domain-catalog";

type Props = {
  templates: CatalogTemplate[];
  selectedId?: string | null;
  onSelect: (t: CatalogTemplate) => void;
  /** Optional secondary action (e.g. ingest sample ZIP) */
  onUseSample?: (t: CatalogTemplate) => void;
  showSearch?: boolean;
  showCategories?: boolean;
  title?: string;
  subtitle?: string;
  /** User idea — ranks & filters to domain-relevant templates */
  idea?: string;
};

export function TemplateGallery({
  templates,
  selectedId,
  onSelect,
  onUseSample,
  showSearch = true,
  showCategories = true,
  title,
  subtitle,
  idea = "",
}: Props) {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<CatalogTemplate | null>(null);
  const [previewPageIdx, setPreviewPageIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const recommendation = useMemo(
    () => recommendTemplatesForIdea(templates, idea, { minScore: 6, limit: 32 }),
    [templates, idea]
  );

  const baseList = useMemo(() => {
    if (!idea.trim() || showAll) return templates;
    return recommendation.recommended.length ? recommendation.recommended : templates;
  }, [templates, idea, showAll, recommendation]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return baseList.filter((t) => {
      if (cat !== "all" && t.category !== cat) return false;
      if (!query) return true;
      const hay = `${t.name} ${t.description} ${t.stack.join(" ")} ${t.badge || ""} ${t.category} ${(t.keywords || []).join(" ")}`.toLowerCase();
      return hay.includes(query);
    });
  }, [baseList, cat, q]);

  useEffect(() => {
    setPreviewPageIdx(0);
  }, [preview?.id]);

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [preview]);

  const domainHint =
    idea.trim() && !showAll && recommendation.domainLabel
      ? `Showing ${recommendation.domainLabel} templates matched to your idea`
      : idea.trim() && !showAll
        ? "Top matches for your idea"
        : null;

  return (
    <div className="tmpl-gallery">
      {(title || subtitle) && (
        <div className="tmpl-gallery-head">
          {title ? <h2 className="tmpl-gallery-title">{title}</h2> : null}
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
      )}

      {idea.trim() ? (
        <div className="tmpl-recommend-bar">
          <div>
            <strong>{domainHint || "Templates for your project"}</strong>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
              Matched from your idea — not every template in the library.
            </p>
          </div>
          <button
            type="button"
            className={`chip ${showAll ? "on" : ""}`}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Show matched only" : `Browse all (${templates.length})`}
          </button>
        </div>
      ) : null}

      {showSearch && (
        <div className="tmpl-toolbar">
          <input
            className="tmpl-search"
            placeholder="Search by domain, name, or stack…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search templates"
          />
          <span className="tmpl-count muted">
            {filtered.length} template{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {showCategories && (
        <div className="chip-row tmpl-cats">
          {TEMPLATE_CATEGORIES.map((c) => {
            const count =
              c.id === "all"
                ? baseList.length
                : baseList.filter((t) => t.category === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                className={`chip ${cat === c.id ? "on" : ""}`}
                onClick={() => setCat(c.id)}
              >
                {c.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="tmpl-grid">
        {filtered.map((t) => {
          const selected = selectedId === t.id;
          const score = "score" in t ? (t as { score?: number }).score : 0;
          return (
            <article
              key={t.id}
              className={`tmpl-card ${selected ? "is-selected" : ""}`}
              style={{ ["--tmpl-accent" as string]: t.accent }}
            >
              <button
                type="button"
                className="tmpl-card-media"
                onClick={() => setPreview(t)}
                aria-label={`Preview ${t.name}`}
              >
                <div className="tmpl-browser">
                  <span /><span /><span />
                </div>
                <img src={t.previewImage} alt="" loading="lazy" />
                <div className="tmpl-media-shade" />
                <div className="tmpl-media-meta">
                  {t.badge ? <span className="tmpl-badge">{t.badge}</span> : null}
                  <strong>{t.name}</strong>
                </div>
                {selected ? <span className="tmpl-selected-pill">Selected</span> : null}
                {score && score >= 6 && !showAll ? (
                  <span className="tmpl-selected-pill" style={{ right: 10, left: "auto", top: 40 }}>
                    Best match
                  </span>
                ) : null}
              </button>

              <div className="tmpl-card-body">
                <p className="tmpl-desc">{t.description}</p>
                <div className="tmpl-tags">
                  {t.stack.slice(0, 3).map((s) => (
                    <span key={s} className="tmpl-tag">
                      {s}
                    </span>
                  ))}
                  <span className="tmpl-tag tmpl-tag-soft">{t.pages.length} pages</span>
                </div>
                <div className="tmpl-card-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setPreview(t)}>
                    Preview site
                  </button>
                  <button
                    type="button"
                    className={`btn ${selected ? "btn-soft" : "btn-primary"}`}
                    onClick={() => {
                      if (t.id === "starter-agency-sample" && onUseSample) {
                        onUseSample(t);
                        return;
                      }
                      onSelect(t);
                    }}
                  >
                    {selected ? "Selected ✓" : t.id === "starter-agency-sample" ? "Use sample" : "Use template"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="tmpl-empty muted">
          No templates match — try “Browse all” or another category.
        </div>
      ) : null}

      {preview ? (
        <TemplatePreviewModal
          template={preview}
          selected={selectedId === preview.id}
          pageIdx={previewPageIdx}
          onPageIdx={setPreviewPageIdx}
          onClose={() => setPreview(null)}
          onSelect={() => {
            if (preview.id === "starter-agency-sample" && onUseSample) {
              onUseSample(preview);
            } else {
              onSelect(preview);
            }
            setPreview(null);
          }}
        />
      ) : null}
    </div>
  );
}

function pageSections(pageName: string, index: number): string[] {
  const n = pageName.toLowerCase();
  if (/home|dashboard|landing/.test(n) || index === 0)
    return ["Nav", "Hero", "Feature grid", "Split story", "Gallery / proof", "CTA", "Footer"];
  if (/contact|book|reserv|inquiry|donate|ticket/.test(n))
    return ["Nav", "Page banner", "Contact form", "Map / hours", "Footer"];
  if (/about|mission|team|attorney|trainer|agent|speaker|specialist|provider/.test(n))
    return ["Nav", "Page banner", "Story", "Team grid", "Values", "Footer"];
  if (/shop|product|listing|room|menu|course|inventory|collection/.test(n))
    return ["Nav", "Filters", "Card grid", "Featured item", "CTA", "Footer"];
  if (/service|program|solution|practice|department|condition|treatment/.test(n))
    return ["Nav", "Page banner", "Service list", "Process steps", "FAQ", "Footer"];
  if (/pricing|membership|offer|finance/.test(n))
    return ["Nav", "Pricing cards", "Comparison", "FAQ", "Footer"];
  return ["Nav", "Page banner", "Content blocks", "Supporting media", "CTA", "Footer"];
}

function TemplatePreviewModal({
  template: t,
  selected,
  pageIdx,
  onPageIdx,
  onClose,
  onSelect,
}: {
  template: CatalogTemplate;
  selected: boolean;
  pageIdx: number;
  onPageIdx: (i: number) => void;
  onClose: () => void;
  onSelect: () => void;
}) {
  const page = t.pages[pageIdx] || t.pages[0] || "Home";
  const sections = pageSections(page, pageIdx);
  return (
    <div className="tmpl-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="tmpl-modal"
        style={{ ["--tmpl-accent" as string]: t.accent, maxWidth: 980 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tmpl-modal-top">
          <div>
            <div className="tmpl-badge">{t.badge || t.category}</div>
            <h3 style={{ margin: "8px 0 4px" }}>{t.name}</h3>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Full site structure · {t.pages.length} pages — click any page in the map
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="tmpl-site-structure">
          <aside className="tmpl-sitemap">
            <div className="tmpl-sitemap-title">Site map</div>
            {t.pages.map((p, i) => (
              <button
                key={p}
                type="button"
                className={`tmpl-sitemap-item ${i === pageIdx ? "on" : ""}`}
                onClick={() => onPageIdx(i)}
              >
                <span className="tmpl-sitemap-num">{i + 1}</span>
                {p}
              </button>
            ))}
          </aside>
          <div className="tmpl-modal-stage">
            <div className="tmpl-browser">
              <span /><span /><span />
              <em style={{ marginLeft: 10, fontSize: 11, opacity: 0.7, fontStyle: "normal" }}>
                {page.toLowerCase().replace(/\s+/g, "-")}.html
              </em>
            </div>
            <div className="tmpl-modal-page-label">
              {page}
              <span className="muted" style={{ fontWeight: 500, marginLeft: 8 }}>
                · page {pageIdx + 1}/{t.pages.length}
              </span>
            </div>
            <div className="tmpl-page-wire">
              <div
                className="tmpl-page-wire-hero"
                style={{ backgroundImage: `url(${t.previewImage})` }}
                aria-hidden
              />
              <ul className="tmpl-page-wire-sections">
                {sections.map((s) => (
                  <li key={s}>
                    <span className="tmpl-wire-bar" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: "10px 4px 0" }}>
              Structure for “{page}” — switch pages in the site map to see every route in this template.
            </p>
          </div>
        </div>

        <div className="tmpl-modal-body">
          <p>{t.description}</p>
          <div className="tmpl-tags" style={{ marginTop: 10 }}>
            {t.features.map((f) => (
              <span key={f} className="tmpl-tag">
                {f}
              </span>
            ))}
          </div>
          <div className="tmpl-card-actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Back
            </button>
            <button type="button" className={`btn ${selected ? "btn-soft" : "btn-primary"}`} onClick={onSelect}>
              {selected ? "Selected ✓" : "Use this template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
