import {ArrowDown, ArrowUp} from "lucide-react";
import {Tag} from "@yeahuz/kdsx-react";
import {cn} from "@/lib/utils";

// The dash's DeltaChip, taking the server's ratio directly: Helm's metrics arrive already compared.
export function DeltaChip({ratio, lowerIsBetter = false}: {ratio: number; lowerIsBetter?: boolean}) {
  if (!Number.isFinite(ratio) || Math.abs(ratio) < 0.0005) return null;
  let isPositive = ratio > 0;
  let good = lowerIsBetter ? !isPositive : isPositive;
  let toneClass = good ? "bg-bright-green/15 text-on-surface-green" : "bg-error-bright/15 text-error-bright";
  let Icon = isPositive ? ArrowUp : ArrowDown;
  let pct = Math.abs(ratio) >= 10 ? `${Math.round(Math.abs(ratio) * 100)}%` : `${(Math.abs(ratio) * 100).toFixed(1)}%`;
  return (
    <Tag color="red" className={cn("inline-flex items-center gap-1 text-xs", toneClass)}>
      <Icon size={12} aria-hidden />
      {pct}
    </Tag>
  );
}
