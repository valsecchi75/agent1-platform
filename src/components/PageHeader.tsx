"use client";

import { Images, Heart, BarChart3, LogOut } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { BrandLogo } from "./settings/BrandLogo";
import { ThemeSwitcher } from "./settings/ThemeSwitcher";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function PageHeader() {
  const router = useRouter();
  const pathname = usePathname();

  const isGallery = pathname === "/gallery";
  const isLoved = pathname === "/loved";
  const isReports = pathname === "/reports";

  const navItems = [
    { path: "/gallery", icon: Images, label: "Gallery", active: isGallery },
    { path: "/loved", icon: Heart, label: "Loved", active: isLoved },
    { path: "/reports", icon: BarChart3, label: "Reports", active: isReports },
  ];

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    window.location.href = "/login";
  };

  return (
    <TooltipProvider delayDuration={300}>
    <header
      className="h-11 flex items-center justify-between px-4 shrink-0"
      style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--header-border)" }}
    >
      <div className="flex items-center gap-2">
        {/* Brand + Logo */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          title="Go to editor"
        >
          <BrandLogo variant="brand" height="h-3.5" />
          <span className="mx-1.5" style={{ color: "var(--border)" }}>|</span>
          <BrandLogo variant="wordmark" height="h-3.5" />
          <span
            className="text-[8px] font-medium tracking-wider uppercase px-1 py-0.5 rounded ml-1.5"
            style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
          >
            Alpha 0.9
          </span>
        </button>

        {/* Navigation */}
        <div className="flex items-center gap-1 ml-4 pl-4 border-l border-neutral-700/50">
          {navItems.map(({ path, icon: Icon, label, active }) => (
            <Tooltip key={path}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(path)}
                  className="relative"
                  style={{
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  <Icon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <ThemeSwitcher />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              className="text-[var(--text-secondary)]"
            >
              <span className="text-xs font-medium">Editor</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Go to editor</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-[var(--text-secondary)]"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Logout</TooltipContent>
        </Tooltip>
      </div>
    </header>
    </TooltipProvider>
  );
}
