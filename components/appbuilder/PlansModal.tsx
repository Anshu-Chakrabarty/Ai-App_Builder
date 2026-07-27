"use client";

import {
  FREE_SITE_LIMIT,
  PLAN_DETAILS,
  type AccountBilling,
  type AccountPlan,
  freeRemaining,
  upgradePlan,
  usesFreeQuota,
} from "@/lib/appbuilder/billing";

export function PlansModal({
  billing,
  open,
  onClose,
  onSelectPlan,
}: {
  billing: AccountBilling;
  open: boolean;
  onClose: () => void;
  onSelectPlan: (plan: Exclude<AccountPlan, "free">) => void;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.65)",
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 820, width: "100%", maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="page-title" style={{ fontSize: 24 }}>
          {usesFreeQuota(billing) && freeRemaining(billing) <= 0
            ? "Free limit reached — choose a plan"
            : "Upgrade for premium generation"}
        </h2>
        <p className="page-sub">
          <strong>Starter is $0</strong> for your first{" "}
          <strong>{FREE_SITE_LIMIT} website generations</strong>. Professional / Enterprise apply
          from the <strong>first</strong> paid generation after that.
        </p>
        <div className="choice-grid">
          {(Object.keys(PLAN_DETAILS) as Array<keyof typeof PLAN_DETAILS>).map((key) => {
            const p = PLAN_DETAILS[key];
            const priceLabel = p.price === 0 ? "$0" : `$${p.price}`;
            return (
              <button
                key={key}
                type="button"
                className={`choice ${billing.plan === key ? "selected" : ""}`}
                onClick={() => onSelectPlan(key)}
              >
                <strong>
                  {p.name} · {priceLabel}
                </strong>
                <span>
                  {p.sites}
                  <br />
                  {p.blurb}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

export function FreeQuotaBadge({ billing }: { billing: AccountBilling }) {
  if (!usesFreeQuota(billing)) {
    return (
      <span className="chip on">
        {billing.plan} plan · unlimited
      </span>
    );
  }
  const left = freeRemaining(billing);
  return (
    <span className={`chip ${left <= 1 ? "" : "on"}`}>
      {billing.plan === "starter" ? "Starter" : "Free"} sites left: {left}/{FREE_SITE_LIMIT}
    </span>
  );
}

export { upgradePlan };
