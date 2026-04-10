"use client";

import { useState, useEffect } from "react";
import { formatVersion, rawVersion, buildInfo, versionLabel } from "@/lib/appVersion";

export function AdminSystemInfo() {
  const bi = buildInfo();
  const [changelog, setChangelog] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [nodeCount, setNodeCount] = useState<number | null>(null);

  useEffect(() => {
    // Fetch active node types count
    fetch("/api/node-registry/active-types")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.types) setNodeCount(d.types.length); })
      .catch(() => {});
  }, []);

  const handleLoadChangelog = async () => {
    if (changelog) {
      setShowChangelog(!showChangelog);
      return;
    }
    try {
      const res = await fetch("/api/changelog");
      if (res.ok) {
        const data = await res.json();
        setChangelog(data.content || "Changelog not available.");
      } else {
        setChangelog("Could not load changelog.");
      }
    } catch {
      setChangelog("Could not load changelog.");
    }
    setShowChangelog(true);
  };

  const infoRows: { label: string; value: string }[] = [
    { label: "Version", value: `${formatVersion()} (${rawVersion()})` },
    { label: "Commit", value: bi.commit },
    { label: "Branch", value: bi.branch },
    { label: "Build Date", value: bi.date },
    ...(nodeCount !== null ? [{ label: "Active Node Types", value: String(nodeCount) }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* Version card */}
      <div
        className="p-4 rounded-lg"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <span
            className="text-lg font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            AGENT 1
          </span>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
          >
            {formatVersion()}
          </span>
        </div>

        <div className="space-y-1.5">
          {infoRows.map((row) => (
            <div key={row.label} className="flex items-center text-sm">
              <span
                className="w-36 flex-shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                {row.label}
              </span>
              <span
                className="font-mono text-xs"
                style={{ color: "var(--text-primary)" }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Changelog */}
      <div>
        <button
          onClick={handleLoadChangelog}
          className="text-sm font-medium transition-colors"
          style={{ color: "var(--accent)" }}
        >
          {showChangelog ? "Hide Changelog" : "View Changelog"}
        </button>

        {showChangelog && changelog && (
          <div
            className="mt-3 p-4 rounded-lg overflow-y-auto text-xs leading-relaxed"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              maxHeight: 400,
              color: "var(--text-secondary)",
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
            }}
          >
            {changelog}
          </div>
        )}
      </div>
    </div>
  );
}
