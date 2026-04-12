"use client";

import { GalleryCard } from "./GalleryCard";
import { DbGeneration } from "@/lib/db-types";

interface GalleryGridProps {
  generations: DbGeneration[];
  onLoveToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenLightbox: (generation: DbGeneration) => void;
}

function formatDateHeader(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Compare only the date part (YYYY-MM-DD)
  const dateOnlyStr = dateString.split("T")[0];
  const todayStr = today.toISOString().split("T")[0];
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (dateOnlyStr === todayStr) return "Today";
  if (dateOnlyStr === yesterdayStr) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function GalleryGrid({
  generations,
  onLoveToggle,
  onDelete,
  onOpenLightbox,
}: GalleryGridProps) {
  if (generations.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            No generations yet
          </p>
          <p style={{ color: "var(--text-secondary)" }}>
            Run a workflow to see your outputs here
          </p>
        </div>
      </div>
    );
  }

  // Group generations by date
  const groupedByDate = generations.reduce(
    (acc, gen) => {
      const date = gen.created_at.split("T")[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(gen);
      return acc;
    },
    {} as Record<string, DbGeneration[]>
  );

  // Sort dates in descending order (newest first)
  const sortedDates = Object.keys(groupedByDate).sort().reverse();

  return (
    <div className="px-4 pb-4">
      {sortedDates.map((date) => (
        <div key={date}>
          {/* Date header */}
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-3 mt-6 first:mt-0 sticky top-0 z-10 py-2"
            style={{
              color: "var(--text-secondary)",
            }}
          >
            {formatDateHeader(date)}
          </h2>

          {/* Masonry grid for this date */}
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3">
            {groupedByDate[date].map((gen) => (
              <GalleryCard
                key={gen.id}
                generation={gen}
                onLoveToggle={onLoveToggle}
                onDelete={onDelete}
                onOpenLightbox={onOpenLightbox}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
