import {createContext, FormEvent, useCallback, useContext, useMemo, useRef, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {useTranslation} from "react-i18next";
import {Button, ErrorAlert, Input, PasswordInput, ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogHeader, ResponsiveDialogTitle} from "@yeahuz/kdsx-react";
import {ShieldCheck} from "lucide-react";
import {ApiError, getSignedInOperatorOptions, setStepUp, stepUpMutation} from "@/api";
import {getSession} from "@/constants";

type Run = <T>(action: () => Promise<T>) => Promise<T>;

let StepUpContext = createContext<Run | null>(null);

/**
 * The second look before an action that is hard to take back. Any call the server answers with
 * 428 opens this, asks for a fresh code (or the password, for someone without two-factor), and
 * runs the call again with the five-minute token. Nothing has to know in advance which actions
 * are risky — the server decides, the same way for every client.
 */
export function StepUpProvider({children}: {children: React.ReactNode}) {
  let {t} = useTranslation();
  let [open, setOpen] = useState(false);
  let [error, setError] = useState<string>();
  let [pending, setPending] = useState(false);
  let waiter = useRef<{resolve: () => void; reject: (err: unknown) => void}>(undefined);
  // Read from the cache when asked, not subscribed: a second observer on this query at start-up
  // cancelled the sign-in check in the route guard and logged everyone out on reload.
  let queryClient = useQueryClient();
  let usesCode = Boolean(getSession() && queryClient.getQueryData(getSignedInOperatorOptions().queryKey)?.twoFactorEnabled);

  let ask = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        waiter.current = {resolve, reject};
        setError(undefined);
        setOpen(true);
      }),
    [],
  );

  let run = useCallback<Run>(
    async (action) => {
      try {
        return await action();
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 428) throw err;
        await ask();
        return action();
      }
    },
    [ask],
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    let form = new FormData(e.target as HTMLFormElement);
    setPending(true);
    setError(undefined);
    try {
      let result = await stepUpMutation().mutationFn({body: usesCode ? {code: String(form.get("code")).replace(/\s/g, "")} : {password: String(form.get("password"))}});
      setStepUp(result.token, result.expiresAt);
      setOpen(false);
      waiter.current?.resolve();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  function onOpenChange(next: boolean) {
    if (next) return;
    setOpen(false);
    waiter.current?.reject(new Error(t("common:notConfirmed", {defaultValue: "Not confirmed — nothing was changed."})));
  }

  let value = useMemo(() => run, [run]);

  return (
    <StepUpContext.Provider value={value}>
      {children}
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="flex items-center gap-2">
              <ShieldCheck size={18} /> {t("common:confirmItsYou", {defaultValue: "Confirm it is you"})}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {usesCode
                ? t("common:stepUpCode", {defaultValue: "This is hard to undo. Enter the 6-digit code from your authenticator app. It covers the next five minutes."})
                : t("common:stepUpPassword", {defaultValue: "This is hard to undo. Type your password to go on. It covers the next five minutes."})}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <form className="mt-3 flex flex-col gap-4" onSubmit={onSubmit}>
            {error ? <ErrorAlert title={t("common:error", {defaultValue: "Error"})} message={error} /> : null}
            {usesCode ? (
              <Input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                required
                autoFocus
                placeholder="123 456"
                className="text-center font-mono text-2xl tracking-[0.4em]"
              />
            ) : (
              <PasswordInput name="password" autoComplete="current-password" required autoFocus />
            )}
            <Button size="lg" loading={pending} disabled={pending}>
              {t("common:confirm", {defaultValue: "Confirm"})}
            </Button>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </StepUpContext.Provider>
  );
}

export function useStepUp() {
  let context = useContext(StepUpContext);
  if (context == null) throw new Error("useStepUp() must be used within StepUpProvider");
  return context;
}
