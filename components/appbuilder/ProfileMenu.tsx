"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadUser,
  loginWithEmail,
  logout,
  type AppUser,
} from "@/lib/appbuilder/auth";
import { useRouter } from "next/navigation";

export function ProfileMenu() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [open, setOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(loadUser());
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    const next = loginWithEmail(email, name);
    setUser(next);
    setShowLogin(false);
    setOpen(false);
    setEmail("");
    setName("");
  }

  function handleLogout() {
    logout();
    setUser(null);
    setOpen(false);
  }

  return (
    <div className="profile-menu" ref={ref}>
      <button
        type="button"
        className="profile-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="avatar">{user?.avatarInitials || "?"}</div>
        <div className="profile-trigger-meta">
          <strong>{user ? user.name : "Guest"}</strong>
          <span>{user ? `${user.plan} · signed in` : "Sign in to sync"}</span>
        </div>
        <span className="profile-caret">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="profile-dropdown" role="menu">
          {user ? (
            <>
              <div className="profile-dropdown-head">
                <div className="avatar">{user.avatarInitials}</div>
                <div>
                  <strong>{user.name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {user.email}
                  </div>
                  <span className="chip on" style={{ marginTop: 6 }}>
                    {user.plan}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="profile-item"
                onClick={() => {
                  setOpen(false);
                  router.push("/projects");
                }}
              >
                My projects
              </button>
              <button
                type="button"
                className="profile-item"
                onClick={() => {
                  setOpen(false);
                  router.push("/templates");
                }}
              >
                Browse templates
              </button>
              <button
                type="button"
                className="profile-item"
                onClick={() => {
                  setOpen(false);
                  router.push("/docs");
                }}
              >
                Account & docs
              </button>
              <div className="profile-sep" />
              <button type="button" className="profile-item danger" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <div className="profile-dropdown-head">
                <div>
                  <strong>Welcome</strong>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Sign in to save projects and unlock plan syncing.
                  </div>
                </div>
              </div>
              {!showLogin ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    style={{ marginBottom: 8 }}
                    onClick={() => setShowLogin(true)}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    onClick={() => {
                      const u = loginWithEmail("demo@appbuilder.ai", "Demo User");
                      setUser(u);
                      setOpen(false);
                    }}
                  >
                    Continue as demo
                  </button>
                </>
              ) : (
                <form onSubmit={handleLogin} className="profile-login-form">
                  <label>
                    Name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Work email
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                    />
                  </label>
                  <button type="submit" className="btn btn-primary btn-block">
                    Continue
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    onClick={() => setShowLogin(false)}
                  >
                    Back
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
