import {useMutation, useQueryClient} from "@tanstack/react-query";
import {useTranslation} from "react-i18next";
import {Check, Sparkles} from "lucide-react";
import {updateOnboardingStepMutation, type ClientOnboarding, type OnboardingStepKey, type OnboardingSummary} from "@/api";
import {useToast} from "@/components/toaster";
import {formatDate} from "@/lib/format";
import {cn} from "@/lib/utils";

export function onboardingStepLabel(t: ReturnType<typeof useTranslation>["t"], key: OnboardingStepKey) {
  let defaults: Record<OnboardingStepKey, string> = {
    signed: "Signed",
    installBooked: "Install booked",
    installed: "Tills installed",
    menuLoaded: "Menu loaded",
    staffAdded: "Staff accounts added",
    trained: "Staff trained",
    firstSale: "First sale",
    firstPayment: "First payment",
  };
  return t(`clients:onboardingStep.${key}`, {defaultValue: defaults[key]});
}

/** A thin bar and "3/8 · day 9", amber when behind pace. For list rows. */
export function OnboardingProgress({onboarding, className}: {onboarding: OnboardingSummary; className?: string}) {
  let {t} = useTranslation();
  let pct = Math.round((onboarding.done / onboarding.total) * 100);
  return (
    <span className={cn("flex items-center gap-2 text-xs", className)}>
      <span className="bg-surface-500 h-1.5 w-16 overflow-hidden rounded-full">
        <span className={cn("block h-full rounded-full", onboarding.stalled ? "bg-on-surface-yellow" : "bg-accent")} style={{width: `${pct}%`}} />
      </span>
      <span className={onboarding.stalled ? "text-on-surface-yellow" : "text-on-surface-secondary"}>
        {t("clients:onboardingShort", {defaultValue: "Onboarding {{done}}/{{total}} · day {{day}}", done: onboarding.done, total: onboarding.total, day: onboarding.day})}
      </span>
    </span>
  );
}

/**
 * The checklist on a client's page. Hand-ticked steps record who and when; first sale and first
 * payment tick themselves from what the client does, so the list cannot claim a sale that never was.
 */
export function OnboardingChecklist({clientID, onboarding, writes}: {clientID: string; onboarding: ClientOnboarding; writes: boolean}) {
  let {t} = useTranslation();
  let toast = useToast();
  let queryClient = useQueryClient();
  let update = useMutation({
    ...updateOnboardingStepMutation(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err) => toast({tone: "error", title: err.message}),
  });

  if (onboarding.completedAt) {
    return (
      <p className="text-on-surface-secondary flex items-center gap-2 text-sm">
        <Sparkles size={14} className="text-on-surface-accent" />
        {t("clients:onboarded", {defaultValue: "Onboarded {{date}} · first sale on day {{days}}", date: formatDate(onboarding.completedAt), days: onboarding.daysToFirstSale ?? "—"})}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <OnboardingProgress onboarding={onboarding} />
      {onboarding.stalled ? (
        <p className="text-on-surface-yellow text-xs">{t("clients:onboardingStalled", {defaultValue: "Behind pace — most clients are installed by day 7 and selling within a week of that."})}</p>
      ) : null}
      <ol className="flex flex-col">
        {onboarding.steps.map((step) => {
          let canTick = writes && !step.automatic;
          return (
            <li key={step.key} className="flex items-center gap-3 py-1.5">
              <button
                type="button"
                disabled={!canTick || update.isPending}
                onClick={() => update.mutate({body: {clientID, key: step.key, done: !step.done}})}
                aria-pressed={step.done}
                className={cn("border-border flex size-5 shrink-0 items-center justify-center rounded-md border", {
                  "bg-accent border-accent text-accent-emphasis": step.done,
                  "cursor-not-allowed opacity-70": !canTick,
                })}
              >
                {step.done ? <Check size={13} strokeWidth={3} /> : null}
              </button>
              <span className="flex min-w-0 flex-col">
                <span className={cn("text-sm", {"text-on-surface-secondary": step.done, "font-medium": step.key === onboarding.nextStep})}>{onboardingStepLabel(t, step.key)}</span>
                <span className="text-on-surface-secondary text-xs">
                  {step.done
                    ? [formatDate(step.doneAt), step.doneBy?.name].filter(Boolean).join(" · ")
                    : step.automatic
                      ? t("clients:automaticStep", {defaultValue: "Ticks itself when it happens"})
                      : step.key === onboarding.nextStep
                        ? t("clients:nextStep", {defaultValue: "Next"})
                        : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
