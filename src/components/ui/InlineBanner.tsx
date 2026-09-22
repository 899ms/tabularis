import type { ReactNode } from "react";
import clsx from "clsx";

export type InlineBannerTone = "amber" | "red" | "green" | "neutral";

const TONE_CLASS: Record<InlineBannerTone, string> = {
  amber: "bg-amber-900/20 border-amber-700/40 text-amber-300",
  red: "bg-red-900/20 border-red-700/40 text-red-300",
  green: "bg-emerald-900/20 border-emerald-700/40 text-emerald-300",
  neutral: "bg-base border-default text-secondary",
};

/** Compact notice row used inside install dialogs: icon on the left, text on the right. */
export function InlineBanner({
  tone,
  icon,
  role,
  children,
}: {
  tone: InlineBannerTone;
  icon: ReactNode;
  role?: "status" | "alert";
  children: ReactNode;
}) {
  return (
    <div role={role} className={clsx("rounded-lg border p-3 flex gap-2 text-xs", TONE_CLASS[tone])}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
