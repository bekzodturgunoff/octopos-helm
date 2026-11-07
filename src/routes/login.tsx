import {createFileRoute} from "@tanstack/react-router";
import {Input, Button, ErrorAlert, Label, PasswordInput} from "@yeahuz/kdsx-react";
import {FormEvent, useState} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {useTranslation} from "react-i18next";
import {signInOperatorMutation, verifyTwoFactorMutation, type SignInResult} from "@/api";
import {saveSession} from "@/constants";
import {useTheme} from "@/theme-provider";

export let Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): {redirect?: string} => {
    return {
      redirect: (search?.redirect as string) || "/",
    };
  },
  component: Login,
});

function Login() {
  let {redirect} = Route.useSearch();
  let navigate = Route.useNavigate();
  let {t} = useTranslation();
  let {theme} = useTheme();
  let queryClient = useQueryClient();
  let mock = import.meta.env.VITE_API_MOCK === "on";
  let [challengeID, setChallengeID] = useState<string>();
  let finish = (result: SignInResult) => {
    if (result.twoFactorRequired) {
      setChallengeID(result.challengeID);
      return;
    }
    queryClient.clear();
    saveSession(result.sessionID);
    navigate({to: result.operator.mustSetUpTwoFactor ? "/settings/security" : redirect || "/"});
  };
  let {mutate: signIn, isPending, error} = useMutation({...signInOperatorMutation(), onSuccess: finish});
  let verify = useMutation({...verifyTwoFactorMutation(), onSuccess: finish});

  function onCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let code = String(new FormData(e.target as HTMLFormElement).get("code")).replace(/\s/g, "");
    verify.mutate({body: {challengeID: challengeID!, code}});
  }

  if (challengeID) {
    return (
      <main className="flex min-h-svh items-center justify-center p-4">
        <form className="flex w-full max-w-md flex-col gap-5" onSubmit={onCode}>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{t("common:twoFactorTitle", {defaultValue: "Two-factor code"})}</h1>
            <p className="text-on-surface-secondary text-sm">{t("common:twoFactorHint", {defaultValue: "Open your authenticator app and enter the 6-digit code for Octopos Helm."})}</p>
          </div>
          {verify.error ? <ErrorAlert message={verify.error.message} title={t("common:error", {defaultValue: "Error"})} /> : null}
          <Input
            size="lg"
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
          <Button size="lg" loading={verify.isPending} disabled={verify.isPending}>
            {t("common:verify", {defaultValue: "Verify"})}
          </Button>
          <Button type="button" size="lg" color="neutral" variant="ghost" onClick={() => setChallengeID(undefined)}>
            {t("common:back", {defaultValue: "Back"})}
          </Button>
          {mock ? <p className="text-on-surface-secondary text-xs">{t("common:mockCode", {defaultValue: "Demo mode: 123456 works, or the real code if you set up two-factor yourself."})}</p> : null}
        </form>
      </main>
    );
  }

  function onLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let data = new FormData(e.target as HTMLFormElement);
    signIn({
      body: {
        email: data.get("email") as string,
        password: data.get("password") as string,
      },
    });
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col gap-5">
        <div className="flex items-center text-2xl font-semibold tracking-tighter">
          <img src={theme === "dark" ? "/logo/logo_light.png" : "/logo/logo_dark.png"} alt="Octopos logo" className="mr-2 h-8 w-auto" />
          Octopos Helm
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("common:signInTitle", {defaultValue: "Sign in to the console"})}</h1>
          <p className="text-on-surface-secondary text-sm">{t("common:signInHint", {defaultValue: "For the Octopos team only. Clients sign in to their own dash."})}</p>
        </div>
        {error ? <ErrorAlert message={error.message} title={t("common:error", {defaultValue: "Error"})} /> : null}
        <form className="flex flex-col gap-5" onSubmit={onLogin}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("common:email", {defaultValue: "Email"})}</Label>
            <Input size="lg" id="email" name="email" type="email" autoComplete="username" required defaultValue={mock ? "bekzod@octopos.uz" : undefined} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("common:password", {defaultValue: "Password"})}</Label>
            <PasswordInput size="lg" id="password" name="password" autoComplete="current-password" required defaultValue={mock ? "demo" : undefined} />
          </div>
          <Button size="lg" disabled={isPending} loading={isPending}>
            {t("common:signIn", {defaultValue: "Sign in"})}
          </Button>
        </form>
        {mock ? (
          <p className="text-on-surface-secondary text-xs">
            {t("common:mockSignInHint", {
              defaultValue:
                "Demo mode: any password works. Try dilnoza@ (manager, has two-factor), jasur@ (support), madina@ (finance, has two-factor) or aziz@ (account manager) @octopos.uz to see each role's view.",
            })}
          </p>
        ) : null}
      </div>
    </main>
  );
}
