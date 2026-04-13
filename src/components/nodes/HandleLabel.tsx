interface HandleLabelProps {
  /** Label text */
  label: string;
  /** Position of the associated handle as CSS (e.g., "35%", "20px") */
  top: string;
  /** Which side the handle is on */
  side: "left" | "right";
  /** Handle data type — determines color */
  type?: "image" | "text" | "3d";
  /** Opacity override (e.g., for optional handles) */
  opacity?: number;
}

/**
 * External label for a ReactFlow Handle.
 * Positioned outside the node boundary, aligned to the handle.
 * Visibility controlled by CSS class `.handle-labels-hidden` on <html>.
 */
export function HandleLabel({ label, top, side, type = "image", opacity = 1 }: HandleLabelProps) {
  const colorVar =
    type === "image" ? "var(--handle-color-image)" :
    type === "text" ? "var(--handle-color-text)" :
    "var(--handle-color-3d)";

  return (
    <div
      className={`handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none ${
        side === "left" ? "text-right" : ""
      }`}
      style={{
        ...(side === "left"
          ? { right: "calc(100% + 8px)" }
          : { left: "calc(100% + 8px)" }),
        top: `calc(${top} - 7px)`,
        color: colorVar,
        opacity,
        zIndex: 10,
      }}
    >
      {label}
    </div>
  );
}
