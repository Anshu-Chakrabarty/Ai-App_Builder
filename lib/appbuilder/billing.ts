// lib/appbuilder/billing.ts — first 5 sites free, then plans
export type AccountPlan = "free" | "starter" | "professional" | "enterprise";

export type AccountBilling = {
  plan: AccountPlan;
  /** Successful site builds counted on the free plan */
  freeGenerationsUsed: number;
  /** Total successful builds (all plans) */
  totalGenerations: number;
};

export const FREE_SITE_LIMIT = 5;

export const PLAN_DETAILS: Record<
  Exclude<AccountPlan, "free">,
  { name: string; price: number; blurb: string; sites: string }
> = {
  starter: {
    name: "Starter",
    price: 0,
    blurb: "First 5 website generations free — then upgrade for more.",
    sites: "5 sites free",
  },
  professional: {
    name: "Professional",
    price: 249,
    blurb: "Full AI generation, studio edits, CI/CD artifacts.",
    sites: "Unlimited sites",
  },
  enterprise: {
    name: "Enterprise",
    price: 499,
    blurb: "Priority generation, team seats, custom templates.",
    sites: "Unlimited + priority",
  },
};

const KEY = "appbuilder_billing_v1";

export function loadBilling(): AccountBilling {
  if (typeof window === "undefined") {
    return { plan: "free", freeGenerationsUsed: 0, totalGenerations: 0 };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { plan: "free", freeGenerationsUsed: 0, totalGenerations: 0 };
    const parsed = JSON.parse(raw) as AccountBilling;
    return {
      plan: parsed.plan || "free",
      freeGenerationsUsed: Number(parsed.freeGenerationsUsed) || 0,
      totalGenerations: Number(parsed.totalGenerations) || 0,
    };
  } catch {
    return { plan: "free", freeGenerationsUsed: 0, totalGenerations: 0 };
  }
}

export function saveBilling(b: AccountBilling) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(b));
}

/** Plans that share the first-5 free generation limit */
export function usesFreeQuota(b: AccountBilling): boolean {
  return b.plan === "free" || b.plan === "starter";
}

export function freeRemaining(b: AccountBilling): number {
  if (!usesFreeQuota(b)) return Infinity;
  return Math.max(0, FREE_SITE_LIMIT - b.freeGenerationsUsed);
}

/** Free/Starter: first 5 only. Pro/Enterprise: unlimited from first paid gen. */
export function canGenerateSite(b: AccountBilling): boolean {
  if (!usesFreeQuota(b)) return true;
  return b.freeGenerationsUsed < FREE_SITE_LIMIT;
}

export function recordSuccessfulGeneration(b: AccountBilling): AccountBilling {
  const next: AccountBilling = {
    ...b,
    totalGenerations: b.totalGenerations + 1,
    freeGenerationsUsed: usesFreeQuota(b)
      ? b.freeGenerationsUsed + 1
      : b.freeGenerationsUsed,
  };
  saveBilling(next);
  return next;
}

export function upgradePlan(
  b: AccountBilling,
  plan: Exclude<AccountPlan, "free">
): AccountBilling {
  const next: AccountBilling = { ...b, plan };
  saveBilling(next);
  return next;
}
