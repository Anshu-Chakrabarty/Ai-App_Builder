"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppBuilder } from "@/lib/appbuilder/store";
import type { ProjectStatus } from "@/lib/appbuilder/types";
import {
  FREE_SITE_LIMIT,
  freeRemaining,
  loadBilling,
  upgradePlan,
  usesFreeQuota,
  type AccountBilling,
  type AccountPlan,
} from "@/lib/appbuilder/billing";
import { FreeQuotaBadge, PlansModal } from "@/components/appbuilder/PlansModal";

function statusLabel(s: ProjectStatus) {
  switch (s) {
    case "live":
      return "Live / Production";
    case "deploying":
      return "Deploying";
    case "preview":
      return "Preview Ready";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Draft";
  }
}

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, ready, newProject, setActiveId, deleteProject } = useAppBuilder();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [billing, setBilling] = useState<AccountBilling>({
    plan: "free",
    freeGenerationsUsed: 0,
    totalGenerations: 0,
  });
  const [showPlans, setShowPlans] = useState(false);

  function confirmDelete(id: string, name: string) {
    if (
      !window.confirm(
        `Delete “${name}”? This removes it from your workspace and cannot be undone.`
      )
    ) {
      return;
    }
    deleteProject(id);
  }

  useEffect(() => {
    setBilling(loadBilling());
  }, []);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        (p.url || "").toLowerCase().includes(q.toLowerCase());
      const matchS = status === "all" || p.status === status;
      return matchQ && matchS;
    });
  }, [projects, q, status]);

  const summary = useMemo(
    () => ({
      total: projects.length,
      live: projects.filter((p) => p.status === "live").length,
      preview: projects.filter((p) => p.status === "preview").length,
      deploying: projects.filter((p) => p.status === "deploying").length,
    }),
    [projects]
  );

  if (!ready) return <div className="content">Loading workspace…</div>;

  return (
    <>
      <div className="topbar">
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>My Projects</div>
          <div className="muted">
            First {FREE_SITE_LIMIT} website generations free — then choose a plan
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <FreeQuotaBadge billing={billing} />
          <button type="button" className="btn btn-soft" onClick={() => setShowPlans(true)}>
            Plans
          </button>
          <div className="avatar">A</div>
        </div>
      </div>

      <PlansModal
        billing={billing}
        open={showPlans}
        onClose={() => setShowPlans(false)}
        onSelectPlan={(plan: Exclude<AccountPlan, "free">) => {
          setBilling(upgradePlan(loadBilling(), plan));
          setShowPlans(false);
        }}
      />

      <div className="content">
        <div className="grid-2">
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <input
                className="chat-input"
                style={{ minHeight: 42, flex: 1 }}
                placeholder="Search projects…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: "0 12px",
                }}
              >
                <option value="all">All statuses</option>
                <option value="live">Live</option>
                <option value="preview">Preview</option>
                <option value="draft">Draft</option>
                <option value="failed">Failed</option>
              </select>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const p = newProject();
                  setActiveId(p.id);
                  router.push("/wizard");
                }}
              >
                + New Project
              </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <div className="muted">{p.url || "Not published"}</div>
                      </td>
                      <td>
                        <span className={`status ${p.status}`}>{statusLabel(p.status)}</span>
                      </td>
                      <td className="muted">{new Date(p.updatedAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-soft"
                            onClick={() => {
                              setActiveId(p.id);
                              router.push(p.site ? `/studio/${p.id}` : "/wizard");
                            }}
                          >
                            {p.site ? "Open Studio" : "Continue"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ color: "#fca5a5", borderColor: "rgba(239,68,68,.35)" }}
                            onClick={() => confirmDelete(p.id, p.name)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div className="card">
              <h3>Free quota</h3>
              <div className="stat" style={{ marginBottom: 10 }}>
                <div className="k">Sites remaining</div>
                <div className="v">
                  {usesFreeQuota(billing)
                    ? `${freeRemaining(billing)} / ${FREE_SITE_LIMIT}`
                    : "Unlimited"}
                </div>
              </div>
              <div className="progress" style={{ marginBottom: 12 }}>
                <i
                  style={{
                    width: usesFreeQuota(billing)
                      ? `${(freeRemaining(billing) / FREE_SITE_LIMIT) * 100}%`
                      : "100%",
                  }}
                />
              </div>
              <button
                type="button"
                className="btn btn-soft btn-block"
                onClick={() => setShowPlans(true)}
              >
                {usesFreeQuota(billing) ? "Upgrade plan" : "Change plan"}
              </button>
            </div>
            <div className="card">
              <h3>Summary</h3>
              <div className="stat-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="stat">
                  <div className="k">Total</div>
                  <div className="v">{summary.total}</div>
                </div>
                <div className="stat">
                  <div className="k">Live</div>
                  <div className="v">{summary.live}</div>
                </div>
                <div className="stat">
                  <div className="k">Preview</div>
                  <div className="v">{summary.preview}</div>
                </div>
                <div className="stat">
                  <div className="k">Deploying</div>
                  <div className="v">{summary.deploying}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
