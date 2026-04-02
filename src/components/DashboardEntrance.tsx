"use client";

import { useState, useEffect } from "react";

/**
 * Dark overlay that fades out after navigating from login.
 * Ensures a smooth dissolve — no flash of UI elements.
 *
 * NOTE: Two separate effects are intentional.
 * React Strict Mode (dev) runs effects twice on mount and cancels timers
 * in the cleanup of the first run. Splitting into two effects means the
 * hide-timer is set in response to a *state change* (show → true), which
 * happens after mount and is NOT doubled by Strict Mode.
 */
export function DashboardEntrance() {
  const [show, setShow] = useState(false);

  // Effect 1: check localStorage flag — no timer, no cleanup needed.
  useEffect(() => {
    try {
      if (localStorage.getItem("agent1-transition") === "pending") {
        localStorage.removeItem("agent1-transition");
        setShow(true);
      }
    } catch {
      // ignore
    }
  }, []);

  // Effect 2: when overlay becomes visible, schedule its removal.
  // This effect runs in response to `show` changing to true (a re-render
  // after mount), so React Strict Mode does NOT double-invoke it.
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 1500);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "#0a0e14",
        pointerEvents: "none",
        animation: "dashboard-entrance-fade 1s ease-out 0.3s forwards",
        opacity: 1,
      }}
    />
  );
}
