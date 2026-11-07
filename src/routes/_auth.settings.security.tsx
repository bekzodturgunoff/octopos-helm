import {FormEvent, useEffect, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {Alert, AlertDescription, AlertTitle, Button, ErrorAlert, Input, Label, Tag} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";
import QRCode from "qrcode";
import {
  disableTwoFactorMutation,
  enableTwoFactorMutation,
  getSecuritySettingsOptions,
  getSignedInOperatorOptions,
  setupTwoFactorMutation,
  updateSecuritySettingsMutation,
  type SecuritySettings,
  type TwoFactorSetup,
} from "@/api";
import {Section} from "@/components/field";
import {CopyButton} from "@/components/remote-access";
import {useToast} from "@/components/toaster";
import {useStepUp} from "@/components/step-up";
import {formatDateTime} from "@/lib/format";
import {can} from "@/permission";

export let Route = createFileRoute("/_auth/settings/security")({
  beforeLoad: () => ({backLink: {to: "/settings"}}),
  component: Security,
});

function Security() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  return (
    <div className="flex flex-col gap-10 px-4 lg:max-w-2xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("settings:security", {defaultValue: "Security"})}</h1>
        <p className="text-on-surface-secondary text-sm">
          {t("settings:securityHint", {defaultValue: "Helm can see every client's money and open every client's dash. A password alone is not enough for that."})}
        </p>
      </div>
      {user.mustSetUpTwoFactor ? (
        <Alert variant="destructive">
          <AlertTitle>{t("settings:requiredTitle", {defaultValue: "Two-factor is required"})}</AlertTitle>
          <AlertDescription>{t("settings:requiredHint", {defaultValue: "An owner has made two-factor sign-in required for the team. Set it up to continue using Helm."})}</AlertDescription>
        </Alert>
      ) : null}
      <TwoFactor />
      {can(user, "team.write") ? <TeamSecurity /> : null}
    </div>
  );
}

function TwoFactor() {
  let {t} = useTranslation();
  let toast = useToast();
  let queryClient = useQueryClient();
  let {data: me} = useQuery(getSignedInOperatorOptions());
  let [setup, setSetup] = useState<TwoFactorSetup>();
  let [qr, setQr] = useState<string>();
  let [recovery, setRecovery] = useState<string[]>();
  let start = useMutation({...setupTwoFactorMutation(), onSuccess: setSetup});
  let enable = useMutation({
    ...enableTwoFactorMutation(),
    onSuccess: (result) => {
      setRecovery(result.recoveryCodes);
      setSetup(undefined);
      queryClient.invalidateQueries();
    },
  });
  let disable = useMutation({
    ...disableTwoFactorMutation(),
    onSuccess: () => {
      toast({tone: "success", title: t("settings:twoFactorOff", {defaultValue: "Two-factor turned off"})});
      queryClient.invalidateQueries();
    },
  });

  useEffect(() => {
    if (!setup) return;
    QRCode.toDataURL(setup.otpauthURL, {margin: 1, width: 220}).then(setQr);
  }, [setup]);

  let code = (e: FormEvent<HTMLFormElement>) => String(new FormData(e.target as HTMLFormElement).get("code")).replace(/\s/g, "");

  return (
    <Section
      title={t("settings:twoFactor", {defaultValue: "Two-factor sign-in"})}
      action={me?.twoFactorEnabled ? <Tag color="green">{t("settings:on", {defaultValue: "On"})}</Tag> : <Tag color="neutral">{t("settings:off", {defaultValue: "Off"})}</Tag>}
    >
      {recovery ? (
        <div className="bg-surface-300 flex flex-col gap-3 rounded-xl p-4">
          <p className="font-medium">{t("settings:recoveryTitle", {defaultValue: "Two-factor is on. Save these recovery codes now."})}</p>
          <p className="text-on-surface-secondary text-sm">{t("settings:recoveryHint", {defaultValue: "Each one signs you in once if you lose your phone. They are shown only this once."})}</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
            {recovery.map((c) => (
              <li key={c} className="bg-surface-500 rounded-md px-2 py-1 text-center">
                {c}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <CopyButton value={recovery.join("\n")} label={t("settings:copyCodes", {defaultValue: "Copy codes"})} />
            <Button size="sm" color="neutral" onClick={() => setRecovery(undefined)}>
              {t("settings:savedThem", {defaultValue: "I have saved them"})}
            </Button>
          </div>
        </div>
      ) : me?.twoFactorEnabled ? (
        <form className="flex flex-col gap-3 sm:max-w-sm" onSubmit={(e) => (e.preventDefault(), disable.mutate({body: {code: code(e)}}))}>
          <p className="text-on-surface-secondary text-sm">
            {t("settings:twoFactorOnHint", {defaultValue: "You are asked for a code from your authenticator app when you sign in, and again before actions that are hard to undo."})}
          </p>
          {disable.error ? <ErrorAlert title={t("common:error", {defaultValue: "Error"})} message={disable.error.message} /> : null}
          <Label htmlFor="disable-code">{t("settings:turnOffWithCode", {defaultValue: "To turn it off, enter a current code"})}</Label>
          <div className="flex gap-2">
            <Input id="disable-code" name="code" inputMode="numeric" maxLength={7} required placeholder="123 456" className="font-mono" />
            <Button size="sm" color="danger" variant="outline" loading={disable.isPending}>
              {t("settings:turnOff", {defaultValue: "Turn off"})}
            </Button>
          </div>
        </form>
      ) : setup ? (
        <form className="flex flex-col gap-4" onSubmit={(e) => (e.preventDefault(), enable.mutate({body: {code: code(e)}}))}>
          <ol className="text-on-surface-secondary list-decimal space-y-1 pl-5 text-sm">
            <li>{t("settings:step1", {defaultValue: "Open Google Authenticator, 1Password, Authy or any authenticator app."})}</li>
            <li>{t("settings:step2", {defaultValue: "Scan this code, or type the key below."})}</li>
            <li>{t("settings:step3", {defaultValue: "Enter the 6-digit code it shows."})}</li>
          </ol>
          <div className="flex flex-wrap items-center gap-4">
            {qr ? (
              <img src={qr} alt={t("settings:qrAlt", {defaultValue: "QR code for your authenticator app"})} className="size-44 rounded-lg bg-white p-1" />
            ) : (
              <div className="bg-surface-300 size-44 animate-pulse rounded-lg" />
            )}
            <div className="flex flex-col gap-1">
              <span className="text-on-surface-secondary text-xs">{t("settings:setupKey", {defaultValue: "Set-up key"})}</span>
              <span className="flex items-center gap-1 font-mono text-sm break-all">
                {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
                <CopyButton value={setup.secret} label={t("settings:copyKey", {defaultValue: "Copy key"})} />
              </span>
            </div>
          </div>
          {enable.error ? <ErrorAlert title={t("common:error", {defaultValue: "Error"})} message={enable.error.message} /> : null}
          <div className="flex gap-2 sm:max-w-sm">
            <Input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus placeholder="123 456" className="font-mono" />
            <Button size="sm" loading={enable.isPending}>
              {t("settings:turnOn", {defaultValue: "Turn on"})}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-on-surface-secondary text-sm">
            {t("settings:twoFactorOffHint", {defaultValue: "Add a code from your phone to your password, so a leaked password is not enough to get in."})}
          </p>
          <Button size="sm" loading={start.isPending} onClick={() => start.mutate({body: {}})}>
            {t("settings:setUp", {defaultValue: "Set up two-factor"})}
          </Button>
        </div>
      )}
    </Section>
  );
}

function TeamSecurity() {
  let {t} = useTranslation();
  let toast = useToast();
  let stepUp = useStepUp();
  let queryClient = useQueryClient();
  let {data} = useQuery(getSecuritySettingsOptions());
  let [draft, setDraft] = useState<SecuritySettings>();
  let [error, setError] = useState<string>();
  let [pending, setPending] = useState(false);
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);
  if (!draft) return null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      let saved = await stepUp(() => updateSecuritySettingsMutation().mutationFn({body: draft!}));
      queryClient.setQueryData(getSecuritySettingsOptions().queryKey, saved);
      toast({tone: "success", title: t("settings:teamSecuritySaved", {defaultValue: "Team security saved"})});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Section title={t("settings:teamSecurity", {defaultValue: "For the whole team"})}>
        {error ? <ErrorAlert title={t("common:error", {defaultValue: "Error"})} message={error} /> : null}
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="accent-accent mt-1" checked={draft.requireTwoFactor} onChange={(e) => setDraft({...draft, requireTwoFactor: e.target.checked})} />
          <span className="flex flex-col">
            <span>{t("settings:require2fa", {defaultValue: "Require two-factor for everyone"})}</span>
            <span className="text-on-surface-secondary text-xs">
              {t("settings:require2faHint", {defaultValue: "Anyone without it is sent to set it up at their next sign-in, and cannot use Helm until they do."})}
            </span>
          </span>
        </label>
        <div className="flex flex-col gap-2 sm:max-w-xs">
          <Label htmlFor="idle">{t("settings:idleTimeout", {defaultValue: "Sign out after idle (hours)"})}</Label>
          <Input id="idle" type="number" min={1} max={72} value={draft.idleTimeoutHours} onChange={(e) => setDraft({...draft, idleTimeoutHours: Number(e.target.value)})} />
        </div>
        {data?.updatedAt ? (
          <p className="text-on-surface-secondary text-xs">
            {t("common:lastChanged", {defaultValue: "Last changed {{when}} by {{name}}", when: formatDateTime(data.updatedAt), name: data.updatedBy?.name ?? "—"})}
          </p>
        ) : null}
        <div>
          <Button size="sm" loading={pending}>
            {t("common:saveChanges", {defaultValue: "Save changes"})}
          </Button>
        </div>
      </Section>
    </form>
  );
}
