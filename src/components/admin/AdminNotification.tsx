"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

export type NotificationType = "error" | "success" | "warning" | "info";

interface AdminNotificationProps {
  type: NotificationType;
  message: string;
  /** Auto-dismiss after ms (0 = never). Default: 0 for errors, 4000 for others */
  autoDismissMs?: number;
  onDismiss?: () => void;
}

const config: Record<
  NotificationType,
  {
    icon: typeof AlertCircle;
    bg: string;
    border: string;
    text: string;
    iconColor: string;
    defaultAutoDismiss: number;
  }
> = {
  error: {
    icon: AlertCircle,
    bg: "rgba(239, 68, 68, 0.08)",
    border: "rgba(239, 68, 68, 0.2)",
    text: "var(--text-primary)",
    iconColor: "#ef4444",
    defaultAutoDismiss: 0,
  },
  warning: {
    icon: AlertTriangle,
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(245, 158, 11, 0.2)",
    text: "var(--text-primary)",
    iconColor: "#f59e0b",
    defaultAutoDismiss: 5000,
  },
  success: {
    icon: CheckCircle2,
    bg: "rgba(34, 197, 94, 0.08)",
    border: "rgba(34, 197, 94, 0.2)",
    text: "var(--text-primary)",
    iconColor: "#22c55e",
    defaultAutoDismiss: 3000,
  },
  info: {
    icon: Info,
    bg: "rgba(99, 102, 241, 0.08)",
    border: "rgba(99, 102, 241, 0.2)",
    text: "var(--text-primary)",
    iconColor: "#6366f1",
    defaultAutoDismiss: 5000,
  },
};

// Human-readable error rewrites
function humanizeError(msg: string): string {
  if (msg.includes("Cannot delete department with active members")) {
    const match = msg.match(/\((\d+) users?\)/);
    const count = match ? parseInt(match[1]) : 0;
    return `This department still has ${count} active ${count === 1 ? "member" : "members"}. Move or remove them first before deleting.`;
  }
  if (msg.includes("UNIQUE constraint") || msg.includes("already exists")) {
    return "That name is already taken. Please choose a different one.";
  }
  if (msg.includes("not found")) {
    return "This item could not be found — it may have already been deleted.";
  }
  if (msg.includes("required")) {
    return msg; // validation messages are already clear
  }
  if (msg.includes("Failed to fetch") || msg.includes("Internal error")) {
    return "Something went wrong connecting to the server. Please try again in a moment.";
  }
  return msg;
}

export function AdminNotification({
  type,
  message,
  autoDismissMs,
  onDismiss,
}: AdminNotificationProps) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const c = config[type];
  const Icon = c.icon;
  const dismissTime = autoDismissMs ?? c.defaultAutoDismiss;

  useEffect(() => {
    setVisible(true);
    setExiting(false);
  }, [message]);

  useEffect(() => {
    if (dismissTime > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, dismissTime);
      return () => clearTimeout(timer);
    }
  }, [dismissTime, message]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 200);
  };

  if (!visible || !message) return null;

  const friendlyMessage = humanizeError(message);

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateY(-4px)" : "translateY(0)",
        backdropFilter: "blur(8px)",
      }}
      role={type === "error" ? "alert" : "status"}
    >
      <Icon
        className="w-4 h-4 mt-0.5 shrink-0"
        style={{ color: c.iconColor }}
      />
      <p className="flex-1 leading-relaxed">{friendlyMessage}</p>
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="shrink-0 p-0.5 rounded-md transition-colors hover:bg-white/10"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
        </button>
      )}
    </div>
  );
}
