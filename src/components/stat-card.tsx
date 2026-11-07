import type {ReactNode} from "react";

type Props = {
  label: string;
  hint?: string;
  value: string;
  ratio?: number;
  // Names what the ratio is a share of, so it cannot be read as a change.
  ratioLabel?: string;
  delta?: ReactNode;
  /** A way onward from the number, e.g. a link to the list it counts. */
  action?: ReactNode;
};

export function StatCard({label, hint, value, ratio, ratioLabel, delta, action}: Props) {
  return (
    <li className="bg-surface-300 flex w-full flex-col gap-2 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {delta}
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {ratio !== undefined ? (
          <span className="text-on-surface-secondary text-sm">
            <span className="tabular-nums">{ratio}%</span>
            {ratioLabel ? ` ${ratioLabel}` : null}
          </span>
        ) : null}
      </div>
      {hint ? <span className="text-on-surface-secondary text-xs">{hint}</span> : null}
      {action ? <span className="mt-auto pt-1 text-sm">{action}</span> : null}
    </li>
  );
}
