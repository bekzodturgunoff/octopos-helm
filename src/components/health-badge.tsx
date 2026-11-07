import {useTranslation} from "react-i18next";
import type {ClientHealth} from "@/api";
import {healthColor, healthLabel} from "@/lib/status";
import {cn} from "@/lib/utils";

let BAR: Record<"green" | "yellow" | "red", string> = {
  green: "bg-on-surface-green",
  yellow: "bg-on-surface-yellow",
  red: "bg-error-bright",
};

function band(score: number): "green" | "yellow" | "red" {
  return score >= 70 ? "green" : score >= 45 ? "yellow" : "red";
}

/** The score as a number in a ring of its grade's colour: the one glance a list row needs. */
export function HealthBadge({health, showLabel = false, className}: {health: ClientHealth; showLabel?: boolean; className?: string}) {
  let {t} = useTranslation();
  let color = healthColor(health.grade);
  let ring = color === "green" ? "border-on-surface-green text-on-surface-green" : color === "yellow" ? "border-on-surface-yellow text-on-surface-yellow" : "border-error-bright text-error-bright";
  return (
    <span className={cn("flex items-center gap-2", className)} title={healthLabel(t, health.grade)}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums", ring)}>{health.score}</span>
      {showLabel ? <span className="text-sm">{healthLabel(t, health.grade)}</span> : null}
    </span>
  );
}

/** What the score is made of, so "at risk" comes with the reason a call should start from. */
export function HealthBreakdown({health}: {health: ClientHealth}) {
  let {t} = useTranslation();
  let factors = [
    {key: "payment", label: t("clients:healthPayment", {defaultValue: "Payments"}), value: health.payment},
    {key: "fleet", label: t("clients:healthFleet", {defaultValue: "Installations"}), value: health.fleet},
    {key: "activity", label: t("clients:healthActivity", {defaultValue: "Activity"}), value: health.activity},
  ];
  return (
    <ul className="flex flex-col gap-3">
      {factors.map((factor) => (
        <li key={factor.key} className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-secondary">{factor.label}</span>
            <span className="tabular-nums">{factor.value}</span>
          </div>
          <div className="bg-surface-400 h-1.5 overflow-hidden rounded-full">
            <div className={cn("h-full rounded-full", BAR[band(factor.value)])} style={{width: `${Math.max(2, factor.value)}%`}} />
          </div>
        </li>
      ))}
    </ul>
  );
}
