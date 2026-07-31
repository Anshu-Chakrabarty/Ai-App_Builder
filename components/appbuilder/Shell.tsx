"use client";

import { useEffect, useState } from "react";
import { AppBuilderProvider } from "@/lib/appbuilder/store";
import { AppSidebar } from "./Sidebar";
import { ProfileMenu } from "./ProfileMenu";

const SIDEBAR_KEY = "appbuilder_sidebar_open_v1";
const MOBILE_MQ = "(max-width: 1100px)";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const apply = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      try {
        const raw = localStorage.getItem(SIDEBAR_KEY);
        if (mobile) {
          // Phones: closed by default (open only if user saved "1")
          setOpen(raw === "1");
        } else {
          setOpen(raw !== "0");
        }
      } catch {
        setOpen(!mobile);
      }
    };
    apply();
    setReady(true);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    function close() {
      setOpen(false);
      try {
        if (window.matchMedia(MOBILE_MQ).matches) {
          localStorage.setItem(SIDEBAR_KEY, "0");
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("appbuilder-close-sidebar", close);
    return () => window.removeEventListener("appbuilder-close-sidebar", close);
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

  const collapsed = ready && !open;

  return (
    <AppBuilderProvider>
      <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
        <AppSidebar />
        {ready && open && isMobile ? (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Close menu"
            onClick={() => {
              setOpen(false);
              try {
                localStorage.setItem(SIDEBAR_KEY, "0");
              } catch {
                /* ignore */
              }
            }}
          />
        ) : null}
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
