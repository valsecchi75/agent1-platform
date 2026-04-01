"use client";

import { useState, useEffect } from "react";

/**
 * Dark overlay that fades out after navigating from login.
 * Ensures a smooth dissolve — no flash of UI elements.
 */
export function DashboardEntrance() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("agent1-transition") === "pending") {
        setShow(true);
        localStorage.removeItem("agent1-transition");
        const t = setTimeout(() => setShow(false), 1500);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore
    }
  }, []);

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
