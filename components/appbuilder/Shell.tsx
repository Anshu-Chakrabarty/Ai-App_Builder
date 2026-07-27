"use client";

import { useEffect, useState } from "react";
import { AppBuilderProvider } from "@/lib/appbuilder/store";
import { AppSidebar } from "./Sidebar";
import { ProfileMenu } from "./ProfileMenu";

const SIDEBAR_KEY = "appbuilder_sidebar_open_v1";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_KEY);
      // Default open; only collapse if user explicitly saved "0"
      if (raw === "0") setOpen(false);
      else setOpen(true);
    } catch {
      setOpen(true);
    }
    setReady(true);
  }, []);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <AppBuilderProvider>
      <div className={`app-shell ${ready && !open ? "sidebar-collapsed" : ""}`}>
        <AppSidebar />
        <button
          type="button"
          className="sidebar-toggle"
          onClick={toggle}
          aria-label={open ? "Close menu" : "Open menu"}
          title={open ? "Close menu" : "Open menu"}
        >
          {open ? "‹" : "›"}
        </button>
        <div className="main">
          <div className="shell-profile-slot">
            <ProfileMenu />
          </div>
          {children}
        </div>
      </div>
    </AppBuilderProvider>
  );
}
