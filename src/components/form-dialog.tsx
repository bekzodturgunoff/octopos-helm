import {
  Button,
  ErrorAlert,
  Label,
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@yeahuz/kdsx-react";
import {FormEvent, useState} from "react";
import {useTranslation} from "react-i18next";
import {useQueryClient} from "@tanstack/react-query";
import {useToast} from "@/components/toaster";
import {useStepUp} from "@/components/step-up";

/**
 * The dash's ReasonDialog, generalised: a trigger, a short form, one action. The dialog stays open
 * on a failure so the message can be read next to what caused it, and closes on success with a
 * toast — the only trace a closed dialog leaves.
 *
 * After any success every query is invalidated. An operator action rarely touches one thing — a
 * payment moves the client, the overdue list, the overview and the activity log at once — and
 * Helm's lists are small enough that refetching them is cheaper than keeping a map of who affects whom.
 */
export function FormDialog({
  trigger,
  title,
  description,
  action,
  danger,
  disabled,
  success,
  onSubmit,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  action: string;
  danger?: boolean;
  /** Keeps the action off until the form has what it needs. */
  disabled?: boolean;
  success: string;
  onSubmit: (data: FormData) => Promise<unknown>;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  let {t} = useTranslation();
  let toast = useToast();
  let queryClient = useQueryClient();
  let stepUp = useStepUp();
  let [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  let [pending, setPending] = useState(false);
  let [error, setError] = useState<string>();
  let open = controlledOpen ?? uncontrolledOpen;

  function setOpen(next: boolean) {
    if (!next) setError(undefined);
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    setPending(true);
    setError(undefined);
    try {
      let data = new FormData(e.target as HTMLFormElement);
      // A risky action the server wants confirmed asks for a code here and runs again.
      await stepUp(() => onSubmit(data));
      await queryClient.invalidateQueries();
      toast({tone: "success", title: success});
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      {trigger ? <ResponsiveDialogTrigger asChild>{trigger}</ResponsiveDialogTrigger> : null}
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          {description ? <ResponsiveDialogDescription>{description}</ResponsiveDialogDescription> : null}
        </ResponsiveDialogHeader>
        <form className="mt-3 flex flex-col gap-5" onSubmit={submit}>
          {error ? <ErrorAlert title={t("common:error", {defaultValue: "Error"})} message={error} /> : null}
          {children}
          <div className="flex flex-col gap-2">
            <Button size="lg" color={danger ? "danger" : "brand"} type="submit" loading={pending} disabled={pending || disabled}>
              {action}
            </Button>
            <Button size="lg" color="neutral" variant="ghost" type="button" onClick={() => setOpen(false)}>
              {t("common:cancel", {defaultValue: "Cancel"})}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/** A label over its control, the way every form in the dash lays one out. */
export function FormField({label, htmlFor, hint, children}: {label: string; htmlFor?: string; hint?: string; children: React.ReactNode}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <span className="text-on-surface-secondary text-xs">{hint}</span> : null}
    </div>
  );
}
