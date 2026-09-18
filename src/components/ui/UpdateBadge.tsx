interface UpdateBadgeProps {
  count: number;
  tooltip: string;
  className?: string;
}

export function UpdateBadge({
  count,
  tooltip,
  className = "",
}: UpdateBadgeProps) {
  if (count === 0) return null;
  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex shrink-0 items-center justify-center min-w-4 h-4 rounded-full border px-1 text-[10px] font-semibold leading-none ${className}`}
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--accent-success) 14%, var(--bg-elevated))",
        borderColor:
          "color-mix(in srgb, var(--accent-success) 28%, var(--bg-elevated))",
        // CanvasText follows the theme's color-scheme, including muted palettes.
        color: "color-mix(in srgb, var(--accent-success) 35%, CanvasText)",
      }}
    >
      {count}
    </span>
  );
}
