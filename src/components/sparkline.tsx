import {cn} from "@/lib/utils";

/** A trend in a line, drawn as plain SVG: a list of forty clients should not start forty charts. */
export function Sparkline({values, className, strokeClassName = "stroke-accent"}: {values: number[]; className?: string; strokeClassName?: string}) {
  if (values.length < 2) return null;
  let width = 100;
  let height = 28;
  let max = Math.max(...values, 1);
  let step = width / (values.length - 1);
  let points = values.map((v, i) => `${(i * step).toFixed(2)},${(height - 2 - (v / max) * (height - 4)).toFixed(2)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn("h-7 w-24", className)} aria-hidden>
      <polyline points={points} fill="none" className={strokeClassName} strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
