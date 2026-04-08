"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════
 *  Unified Dialog System
 *  ─────────────────────────────────────────────────────
 *  Size variants:  sm (480px)  md (560px)  lg (720px)  xl (1024px)  full (95vw)
 *  All modals MUST use these primitives for consistency.
 *
 *  Layout convention (flex column):
 *    DialogContent          — outer shell (size, bg, border, shadow)
 *      DialogHeader         — fixed top (title, subtitle, close)
 *      DialogTabs           — optional tab bar
 *      DialogBody           — scrollable content area
 *      DialogFooter         — fixed bottom (action buttons)
 * ═══════════════════════════════════════════════════════ */

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

// ── Overlay ──────────────────────────────────────────

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[9998] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// ── Size map ─────────────────────────────────────────

const sizeClasses = {
  sm:   "max-w-[480px]",
  md:   "max-w-[560px]",
  lg:   "max-w-[720px]",
  xl:   "max-w-[1024px]",
  full: "max-w-[95vw]",
} as const


export type DialogSize = keyof typeof sizeClasses

// ── Content (outer shell) ────────────────────────────

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: DialogSize
  /** Hide the default close button (e.g. when header has its own) */
  hideClose?: boolean
}

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, size = "md", hideClose = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // positioning
        "modal-glow fixed left-[50%] top-[50%] z-[9999] translate-x-[-50%] translate-y-[-50%]",
        // sizing
        "w-full", sizeClasses[size], "max-h-[85vh]",
        // layout
        "flex flex-col",
        // visual
        "border border-[var(--modal-border)] bg-[var(--modal-bg)] shadow-2xl rounded-xl",
        // animation
        "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="absolute right-5 top-5 rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors focus:outline-none disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

// ── Header ───────────────────────────────────────────

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "shrink-0 px-6 pt-6 pb-0",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

// ── Title ────────────────────────────────────────────

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold text-[var(--text-primary)]", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

// ── Description ──────────────────────────────────────

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-xs text-[var(--text-muted)] mt-1", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

// ── Tabs ─────────────────────────────────────────────
// Unified tab bar for modals with multiple sections.

interface DialogTabsProps {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
  className?: string
}

function DialogTabs({ tabs, active, onChange, className }: DialogTabsProps) {
  return (
    <div className={cn("shrink-0 flex gap-1 px-6 pt-4 pb-0", className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              isActive
                ? "bg-[var(--surface-3)] text-[var(--text-primary)] font-medium"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]/50"
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
DialogTabs.displayName = "DialogTabs"

// ── Body (scrollable content) ────────────────────────

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex-1 min-h-0 overflow-y-auto px-6 py-5",
      className
    )}
    {...props}
  />
)
DialogBody.displayName = "DialogBody"

// ── Footer ───────────────────────────────────────────

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-[var(--border)]",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

// ── Standard action buttons ──────────────────────────

interface DialogButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost"
}

function DialogButton({ variant = "secondary", className, ...props }: DialogButtonProps) {
  return (
    <button
      className={cn(
        "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
        variant === "primary" && "bg-[var(--accent)] text-[var(--btn-primary-text)] hover:opacity-90",
        variant === "secondary" && "bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-hover)] border border-[var(--border)]",
        variant === "ghost" && "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        className
      )}
      {...props}
    />
  )
}
DialogButton.displayName = "DialogButton"

// ── Separator ────────────────────────────────────────

function DialogSeparator({ className }: { className?: string }) {
  return <div className={cn("h-px bg-[var(--border)] mx-6", className)} />
}
DialogSeparator.displayName = "DialogSeparator"

// ── Exports ──────────────────────────────────────────

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogTabs,
  DialogButton,
  DialogSeparator,
}
