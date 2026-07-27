// lib/appbuilder/auth.ts — client-side session (demo auth; swap for NextAuth later)
export type AppUser = {
  id: string;
  name: string;
  email: string;
  plan: "starter" | "professional" | "enterprise";
  avatarInitials: string;
};

const KEY = "appbuilder_auth_v1";

export function loadUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

export function saveUser(user: AppUser | null) {
  if (typeof window === "undefined") return;
  if (!user) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("appbuilder-auth"));
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function loginWithEmail(email: string, name?: string): AppUser {
  const clean = email.trim().toLowerCase();
  const display =
    name?.trim() ||
    clean
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "User";
  const user: AppUser = {
    id: "u_" + btoa(clean).replace(/=+/g, "").slice(0, 12),
    name: display,
    email: clean,
    plan: "professional",
    avatarInitials: initialsFromName(display),
  };
  saveUser(user);
  return user;
}

export function logout(): void {
  saveUser(null);
}
