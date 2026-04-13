"use client";

import { useEffect, useState } from "react";
import {
  Server,
  RefreshCw,
  Clock,
  Cpu,
  Globe,
  Tag,
} from "lucide-react";
import { AdminNotification } from "./AdminNotification";

interface SystemInfo {
  version: string;
  uptime: number;
  environment: string;
  nodeVersion: string;
  platform: string;
}

export function AdminSystemTab() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [restartMessage, setRestartMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  const fetchSystemInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/system");
      if (!res.ok) throw new Error("Failed to fetch system info");
      const data = await res.json();
      setSystemInfo(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch system info"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRestartServer = async () => {
    if (
      !window.confirm(
        "This will restart the server. All active sessions will be briefly interrupted. Continue?"
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setRestartMessage(null);
      const res = await fetch("/api/admin/restart", { method: "POST" });
      if (!res.ok) throw new Error("Failed to restart server");

      setRestartMessage("Server is restarting... the page will reload shortly.");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to restart server"
      );
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-[var(--text-muted)]">
        Loading system info...
      </div>
    );
  }

  if (error && !systemInfo) {
    return <AdminNotification type="error" message={error} />;
  }

  if (!systemInfo) {
    return (
      <div className="py-8 text-center text-[var(--text-muted)]">
        No system info available
      </div>
    );
  }

  const formatUptime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${mins % 60}m`;
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    if (mins > 0) return `${mins}m ${Math.floor(seconds % 60)}s`;
    return `${Math.floor(seconds)}s`;
  };

  const infoItems = [
    { label: "Version", value: systemInfo.version, icon: Tag },
    { label: "Environment", value: systemInfo.environment, icon: Globe },
    { label: "Platform", value: systemInfo.platform, icon: Cpu },
    { label: "Node.js", value: systemInfo.nodeVersion, icon: Server },
    { label: "Uptime", value: formatUptime(systemInfo.uptime), icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <AdminNotification
          type="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {restartMessage && (
        <AdminNotification type="info" message={restartMessage} />
      )}

      {/* System info grid */}
      <div>
        <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          System Information
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {infoItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
              >
                <Icon className="w-4 h-4 text-[var(--text-muted)]" />
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    {item.label}
                  </p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {item.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Server management */}
      <div>
        <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Server Management
        </h4>
        <div
          className="p-4 rounded-lg"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Restart the server to apply configuration changes. Active sessions
            will reconnect automatically.
          </p>
          <button
            onClick={handleRestartServer}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 disabled:opacity-50"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background =
                "rgba(239, 68, 68, 0.18)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background =
                "rgba(239, 68, 68, 0.1)";
            }}
            aria-label="Restart server"
          >
            <RefreshCw
              className={`w-4 h-4 ${actionLoading ? "animate-spin" : ""}`}
            />
            {actionLoading ? "Restarting..." : "Restart Server"}
          </button>
        </div>
      </div>
    </div>
  );
}
