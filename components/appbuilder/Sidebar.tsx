"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppBuilder } from "@/lib/appbuilder/store";
import { loadUser, type AppUser } from "@/lib/appbuilder/auth";

const MAIN = [
  { href: "/projects", label: "Dashboard", icon: "▦" },
  { href: "/projects", label: "Projects", icon: "▣", match: "/projects" },
  { href: "/templates", label: "Templates", icon: "◈" },
  { href: "/agents", label: "AI Agents", icon: "✦" },
  { href: "/activity", label: "Activity & Jobs", icon: "↻" },
  { href: "/notifications", label: "Notifications", icon: "🔔", badge: 3 },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { projects, active, newProject, setActiveId, deleteProject } = useAppBuilder();
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    setUser(loadUser());
    const refresh = () => setUser(loadUser());
    window.addEventListener("storage", refresh);
    window.addEventListener("appbuilder-auth", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("appbuilder-auth", refresh);
    };
  }, []);

  function closeMobileNav() {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1100px)").matches) {
      window.dispatchEvent(new Event("appbuilder-close-sidebar"));
    }
  }

  function startNew() {
    const p = newProject();
    setActiveId(p.id);
    closeMobileNav();
    router.push("/wizard");
  }

  const recent = projects.slice(0, 5);

  return (
    <aside className="sidebar">
      <Link href="/projects" className="brand" onClick={closeMobileNav}>
        <div className="brand-mark">AB</div>
        <div>
          AppBuilder AI
          <div style={{ fontSize: 11, color: "var(--mute)", fontWeight: 500 }}>
            Build apps with AI agents
          </div>
        </div>
      </Link>

      <button type="button" className="btn btn-primary btn-block" onClick={startNew}>
        + New Project
      </button>

      <div className="nav-section">
        <div className="nav-label">Main</div>
        {MAIN.map((item) => {
          const activeNav =
            item.label === "Projects"
              ? pathname.startsWith("/projects") ||
                pathname.startsWith("/wizard") ||
                pathname.startsWith("/studio")
              : pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`nav-item ${activeNav ? "active" : ""}`}
              onClick={closeMobileNav}
            >
              <span>{item.icon}</span>
              {item.label}
              {item.badge ? <span className="badge">{item.badge}</span> : null}
            </Link>
          );
        })}
      </div>

      <div className="nav-section">
        <div className="nav-label">Recent Projects</div>
        {recent.map((p) => (
          <div
            key={p.id}
            className={`nav-item recent-project ${active?.id === p.id ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 6 }}
          >
            <button
              type="button"
              style={{
                flex: 1,
                textAlign: "left",
                background: "transparent",
                border: "none",
                color: "inherit",
                font: "inherit",
                padding: "8px 6px",
                cursor: "pointer",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              onClick={() => {
                setActiveId(p.id);
                closeMobileNav();
                router.push(
                  p.site || (p.step === "review" && p.status !== "draft")
                    ? `/studio/${p.id}`
                    : "/wizard"
                );
              }}
            >
              {p.name}
            </button>
            <button
              type="button"
              title={`Delete ${p.name}`}
              aria-label={`Delete ${p.name}`}
              className="recent-del"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete “${p.name}”?`)) deleteProject(p.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="nav-section">
        <div className="nav-label">Support</div>
        <Link href="/docs" className="nav-item" onClick={closeMobileNav}>
          Documentation
        </Link>
        <Link href="/support" className="nav-item" onClick={closeMobileNav}>
          Contact Support
        </Link>
      </div>

      <div className="ai-card">
        <h4>AI Assistant</h4>
        <p>Ask me anything about your project, stack, or deployment choices.</p>
        <button
          type="button"
          className="btn btn-soft btn-block"
          onClick={() => {
            closeMobileNav();
            router.push("/wizard");
          }}
        >
          Ask AI
        </button>
      </div>

      <div className="user-chip">
        <div className="avatar">{user?.avatarInitials || "?"}</div>
        <div className="meta">
          <strong>{user?.name || "Guest"}</strong>
          <span>{user ? `${user.plan} plan` : "Not signed in"}</span>
        </div>
      </div>
    </aside>
  );
}
