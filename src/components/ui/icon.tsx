"use client"

import type { LucideIcon } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════
// AGENT 1 — Unified Icon System
//
// Two usage modes:
// 1. Lucide icons (standard UI):
//    <Icon icon={Settings} size="md" />
//
// 2. Custom domain icons (node types, eyewear-specific):
//    <Icon name="generate-image" size="md" />
//
// All icons respect currentColor and theme automatically.
// ═══════════════════════════════════════════════════════════

// Size presets matching existing usage patterns
const sizeMap = {
  xs: "w-3 h-3",       // 12px — tiny badges
  sm: "w-3.5 h-3.5",   // 14px — compact buttons
  md: "w-4 h-4",       // 16px — standard (most used)
  lg: "w-5 h-5",       // 20px — prominent actions
  xl: "w-6 h-6",       // 24px — hero/headers
} as const

type IconSize = keyof typeof sizeMap

// ── Custom SVG Icon Registry ──
// Domain-specific icons from /public/icons/
// These are the node-type icons unique to AGENT 1
const CUSTOM_ICON_NAMES = [
  "add",
  "annotation",
  "api-key",
  "array",
  "audio-input",
  "conditional-switch",
  "delete",
  "download",
  "ease-curve",
  "generate-3d",
  "generate-audio",
  "generate-image",
  "generate-video",
  "glb-viewer",
  "image-compare",
  "image-input",
  "llm-generate",
  "magic-wand",
  "output-gallery",
  "output",
  "prompt-constructor",
  "prompt",
  "router",
  "save",
  "search",
  "settings",
  "split-grid",
  "star",
  "switch",
  "video-frame-grab",
  "video-stitch",
  "video-trim",
] as const

type CustomIconName = (typeof CUSTOM_ICON_NAMES)[number]

// ── Props ──

interface IconPropsBase {
  size?: IconSize
  className?: string
  /** Accessible label — adds aria-label and role="img" */
  label?: string
}

interface LucideIconProps extends IconPropsBase {
  /** Lucide icon component */
  icon: LucideIcon
  name?: never
}

interface CustomIconProps extends IconPropsBase {
  /** Custom domain icon name from /public/icons/ */
  name: CustomIconName
  icon?: never
}

type IconProps = LucideIconProps | CustomIconProps

/**
 * Unified Icon component for AGENT 1.
 *
 * @example
 * // Lucide icon (standard UI)
 * import { Settings, Save, Play } from "lucide-react"
 * <Icon icon={Settings} size="md" />
 *
 * @example
 * // Custom domain icon (node types)
 * <Icon name="generate-image" size="md" />
 */
const Icon = React.forwardRef<HTMLElement, IconProps>(
  ({ size = "md", className, label, ...props }, ref) => {
    const sizeClass = sizeMap[size]
    const ariaProps = label
      ? { "aria-label": label, role: "img" as const }
      : { "aria-hidden": true as const }

    if ("icon" in props && props.icon) {
      const LucideComponent = props.icon
      return (
        <LucideComponent
          ref={ref as React.Ref<SVGSVGElement>}
          className={cn(sizeClass, "shrink-0", className)}
          strokeWidth={1.5}
          {...ariaProps}
        />
      )
    }

    if ("name" in props && props.name) {
      return (
        <span
          ref={ref as React.Ref<HTMLSpanElement>}
          className={cn(
            sizeClass,
            "shrink-0 inline-flex items-center justify-center",
            // CSS mask technique: renders SVG as currentColor
            "[mask-size:contain] [mask-repeat:no-repeat] [mask-position:center]",
            "bg-current",
            className
          )}
          style={{
            maskImage: `url(/icons/${props.name}.svg)`,
            WebkitMaskImage: `url(/icons/${props.name}.svg)`,
          }}
          {...ariaProps}
        />
      )
    }

    return null
  }
)
Icon.displayName = "Icon"

// ── Lucide Icon Re-exports ──
// Centralized imports for the most commonly used icons across AGENT 1.
// Import from here instead of directly from lucide-react for consistency.
export {
  // Navigation & Layout
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  MoreHorizontal,
  MoreVertical,
  ArrowLeft,
  ArrowRight,

  // Actions
  Plus,
  Minus,
  Check,
  Copy,
  Trash2,
  Edit3,
  Download,
  Upload,
  ExternalLink,
  Link,
  Unlink,
  RotateCcw,
  RefreshCw,

  // Media
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Image,
  Video,
  Film,
  Camera,
  Mic,

  // Files & Data
  File,
  FileText,
  FolderOpen,
  Folder,
  Save,
  Archive,

  // UI & Interface
  Settings,
  Search,
  Filter,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Key,
  Keyboard,
  MessageSquare,
  Info,
  AlertTriangle,
  AlertCircle,
  HelpCircle,

  // Layout & Grid
  LayoutGrid,
  Grid3X3,
  Maximize2,
  Minimize2,
  Columns,
  Rows,

  // Shapes & Design
  Circle,
  Square as SquareIcon,
  Triangle,
  Star,
  Sparkles,
  Wand2,
  Palette,
  Brush,
  Pen,

  // Workflow & Logic
  GitBranch,
  GitMerge,
  Workflow,
  Zap,
  Bot,
  Brain,
  Cpu,

  // 3D & Spatial
  Box,
  Layers,
  Move3D,
  RotateCw,

  // Theme
  Sun,
  Moon,

  // Status
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react"

export { Icon, sizeMap, CUSTOM_ICON_NAMES }
export type { IconProps, IconSize, CustomIconName }
