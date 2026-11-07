export type StatusColor = "neutral" | "yellow" | "green" | "blue" | "red";
import {cn} from "@/lib/utils";

const DOT: Record<StatusColor, string> = {
  neutral: "bg-on-surface-secondary",
  yellow: "bg-on-surface-yellow",
  green: "bg-on-surface-green",
  blue: "bg-on-surface-blue",
  red: "bg-error-bright",
};

/** Where something stands as a dot and plain words rather than a badge: lists read calmer, and colour
 *  is kept for what needs somebody. */
export function StatusText({color, children, className}: {color: StatusColor; children: React.ReactNode; className?: string}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", DOT[color])} />
      {children}
    </span>
  );
}
