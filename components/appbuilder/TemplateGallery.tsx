"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogTemplate } from "@/lib/appbuilder/catalog";
import { TEMPLATE_CATEGORIES } from "@/lib/appbuilder/catalog";

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
}: Props) {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<CatalogTemplate | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return templates.filter((t) => {
      if (cat !== "all" && t.category !== cat) return false;
      if (!query) return true;
      const hay = `${t.name} ${t.description} ${t.stack.join(" ")} ${t.badge || ""} ${t.category}`.toLowerCase();
      return hay.includes(query);
    });
  }, [templates, cat, q]);

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

  return (
    <div className="tmpl-gallery">
      {(title || subtitle) && (
        <div className="tmpl-gallery-head">
          {title ? <h2 className="tmpl-gallery-title">{title}</h2> : null}
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
      )}

      {showSearch && (
        <div className="tmpl-toolbar">
          <input
            className="tmpl-search"
            placeholder="Search by name, stack, or style…"
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
                ? templates.length
                : templates.filter((t) => t.category === c.id).length;
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
                    Preview
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
        <div className="tmpl-empty muted">No templates match — try another category or search.</div>
      ) : null}

      {preview ? (
        <TemplatePreviewModal
          template={preview}
          selected={selectedId === preview.id}
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

function TemplatePreviewModal({
  template: t,
  selected,
  onClose,
  onSelect,
}: {
  template: CatalogTemplate;
  selected: boolean;
  onClose: () => void;
  onSelect: () => void;
}) {
  return (
    <div className="tmpl-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="tmpl-modal"
        style={{ ["--tmpl-accent" as string]: t.accent }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="tmpl-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="tmpl-modal-preview">
          <div className="tmpl-browser tmpl-browser-lg">
            <span /><span /><span />
            <div className="tmpl-url">{t.name.toLowerCase().replace(/\s+/g, "")}.app</div>
          </div>
          <div className="tmpl-mock">
            <img src={t.previewImage} alt={`${t.name} preview`} />
            <div className="tmpl-mock-ui">
              <div className="tmpl-mock-nav">
                <strong style={{ color: t.accent }}>{t.name}</strong>
                <div className="tmpl-mock-links">
                  {t.pages.slice(0, 4).map((p) => (
                    <span key={p}>{p}</span>
                  ))}
                </div>
              </div>
              <div className="tmpl-mock-hero">
                <div>
                  <div className="tmpl-mock-eyebrow">{t.badge || t.category}</div>
                  <h3>{t.description.split(".")[0]}.</h3>
                  <button type="button" className="tmpl-mock-cta" style={{ background: t.accent }}>
                    Get started
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="tmpl-modal-side">
          <div className="chip-row" style={{ marginBottom: 8 }}>
            <span className="chip on">{t.price}</span>
            <span className="chip">{t.source}</span>
            {t.badge ? <span className="chip">{t.badge}</span> : null}
          </div>
          <h2>{t.name}</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            {t.description}
          </p>

          <h3 style={{ marginTop: 18, fontSize: 14 }}>Tech stack</h3>
          <div className="tmpl-tags" style={{ marginTop: 8 }}>
            {t.stack.map((s) => (
              <span key={s} className="tmpl-tag">
                {s}
              </span>
            ))}
          </div>

          <h3 style={{ marginTop: 18, fontSize: 14 }}>Pages ({t.pages.length})</h3>
          <div className="chip-row" style={{ marginTop: 8 }}>
            {t.pages.map((p) => (
              <span key={p} className="chip on">
                {p}
              </span>
            ))}
          </div>

          <h3 style={{ marginTop: 18, fontSize: 14 }}>Includes</h3>
          <ul className="tmpl-feature-list">
            {t.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>

          <div className="tmpl-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={onSelect}>
              {selected ? "Selected ✓" : t.id === "starter-agency-sample" ? "Ingest sample" : "Use this template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
