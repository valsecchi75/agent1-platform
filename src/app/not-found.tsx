"use client";

import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[var(--bg-primary,#0a0a0a)] text-[var(--text-primary,#e8e8e8)]">
      <div className="text-center space-y-4">
        <p className="text-6xl font-bold opacity-20">404</p>
        <p className="text-lg opacity-60">Page not found</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 px-4 py-2 rounded bg-[var(--accent,#6366f1)] text-white text-sm hover:opacity-80 transition-opacity"
        >
          Go home
        </button>
      </div>
    </div>
  );
}
