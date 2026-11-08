import {useEffect, useRef} from "react";
import {useTranslation} from "react-i18next";
import {Ban, BellRing, CreditCard, Megaphone} from "lucide-react";
import type {DunningStep, DunningStepKind} from "@/api";
import {formatDate} from "@/lib/format";
import {cn} from "@/lib/utils";

let ICON: Record<DunningStepKind, React.ElementType> = {retry: CreditCard, reminder: BellRing, finalNotice: Megaphone, suspend: Ban};

export function stepLabel(t: ReturnType<typeof useTranslation>["t"], kind: DunningStepKind) {
  let defaults: Record<DunningStepKind, string> = {retry: "Card retry", reminder: "Reminder", finalNotice: "Final notice", suspend: "Suspend"};
  return t(`billing:step.${kind}`, {defaultValue: defaults[kind]});
}

/**
 * The chase as a row of stops: what already happened, what is next, what a promise has paused.
 * Used for the settings preview (no dates) and on each overdue account (with them).
 */
type TimelineStep = Pick<DunningStep, "kind" | "day" | "status"> & {at?: string};

export function DunningTimeline({steps, compact = false}: {steps: TimelineStep[]; compact?: boolean}) {
  let {t} = useTranslation();
  // The settings preview has no "now", so nothing is next there.
  let next = compact ? -1 : steps.findIndex((step) => step.status === "upcoming");
  let list = useRef<HTMLOListElement>(null);
  // On a phone the row scrolls; start it at what comes next rather than at the due date.
  useEffect(() => {
    let el = list.current;
    let target = el?.children[next + 1] as HTMLElement | undefined;
    if (!el || !target || next < 2 || el.scrollWidth <= el.clientWidth) return;
    let box = el.getBoundingClientRect();
    let step = target.getBoundingClientRect();
    el.scrollLeft += step.left + step.width / 2 - (box.left + box.width / 2);
  }, [next]);
  return (
    <>
      {compact ? <CompactSteps steps={steps} /> : null}
      <ol ref={list} className={cn("flex w-full items-start overflow-x-auto pb-1", {"max-sm:hidden": compact})}>
        <li className="flex min-w-12 flex-1 flex-col items-center gap-1 text-center">
          <span className="bg-surface-500 text-on-surface-secondary flex size-7 items-center justify-center rounded-full text-[10px] font-semibold">0</span>
          <span className="text-on-surface-secondary text-[11px] leading-tight">{t("billing:due", {defaultValue: "Due"})}</span>
        </li>
        {steps.map((step, i) => {
          let Icon = ICON[step.kind];
          let isNext = i === next;
          return (
            <li key={`${step.kind}-${step.day}-${i}`} className="relative flex min-w-12 flex-1 flex-col items-center gap-1 text-center">
              <span className="bg-border-secondary absolute top-3.5 right-1/2 -z-0 h-px w-full" />
              <span
                className={cn("relative z-10 flex size-7 items-center justify-center rounded-full", {
                  "bg-accent text-accent-emphasis": step.status === "done",
                  "bg-surface-500 text-on-surface-secondary line-through": step.status === "skipped",
                  "bg-bright-blue/20 text-on-surface-blue": step.status === "paused",
                  "ring-accent bg-surface-300 ring-2": isNext,
                  "bg-surface-400": step.status === "upcoming" && !isNext,
                  "text-error-bright": step.kind === "suspend" && step.status !== "done",
                })}
              >
                <Icon size={13} />
              </span>
              <span className={cn("text-[11px] leading-tight", isNext ? "font-semibold" : "text-on-surface-secondary")}>
                {stepLabel(t, step.kind)}
                <br />
                {compact || !step.at ? t("billing:dayN", {defaultValue: "day {{day}}", day: step.day}) : formatDate(step.at).replace(/, \d{4}$/, "")}
                {step.status === "paused" ? (
                  <>
                    <br />
                    <span className="text-on-surface-blue">{t("billing:paused", {defaultValue: "paused"})}</span>
                  </>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** The settings preview on a phone: the same steps as day-labelled chips that wrap instead of scroll. */
function CompactSteps({steps}: {steps: TimelineStep[]}) {
  let {t} = useTranslation();
  return (
    <ol className="flex flex-wrap gap-2 sm:hidden">
      {steps.map((step, i) => {
        let Icon = ICON[step.kind];
        return (
          <li key={`${step.kind}-${step.day}-${i}`} className={cn("bg-surface-400 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs", {"text-error-bright": step.kind === "suspend"})}>
            <Icon size={12} />
            <span className="tabular-nums">{t("billing:dayN", {defaultValue: "day {{day}}", day: step.day})}</span>
            <span className="text-on-surface-secondary">{stepLabel(t, step.kind)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Fills a template the way the server will, for the preview. */
export function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match);
}
