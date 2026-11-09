import {useEffect, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useTranslation} from "react-i18next";
import {Button, ErrorAlert} from "@yeahuz/kdsx-react";
import {Check, ExternalLink, Send} from "lucide-react";
import QRCode from "qrcode";
import {createTelegramLinkCodeMutation, getTelegramLinkOptions, unlinkTelegramMutation, type TelegramLinkCode} from "@/api";
import {useToast} from "@/components/toaster";

/**
 * Linking Telegram without typing a username: Helm makes a one-time link, the person opens it (or
 * scans it from their phone) and presses Start, and the bot tells the server who pressed it. Helm
 * just waits for the link to show up as connected.
 */
export function TelegramConnect() {
  let {t} = useTranslation();
  let toast = useToast();
  let queryClient = useQueryClient();
  let [pending, setPending] = useState<TelegramLinkCode>();
  let [qr, setQr] = useState<string>();
  // While a link is open, ask every 3 seconds whether Start was pressed.
  let {data: link} = useQuery({...getTelegramLinkOptions(), refetchInterval: pending ? 3000 : false});

  let create = useMutation({
    ...createTelegramLinkCodeMutation(),
    onSuccess: (code) => {
      setPending(code);
      QRCode.toDataURL(code.url, {margin: 1, width: 200}).then(setQr);
    },
  });
  let unlink = useMutation({
    ...unlinkTelegramMutation(),
    onSuccess: (saved) => {
      queryClient.setQueryData(getTelegramLinkOptions().queryKey, saved);
      toast({tone: "success", title: t("settings:telegramDisconnected", {defaultValue: "Telegram disconnected"})});
    },
  });

  let connected = link?.connected;
  useEffect(() => {
    if (!pending || !connected) return;
    setPending(undefined);
    setQr(undefined);
    toast({tone: "success", title: t("settings:telegramConnected", {defaultValue: "Telegram connected"})});
  }, [connected, pending, toast, t]);

  // A link lasts ten minutes; after that it is dead and the button comes back.
  useEffect(() => {
    if (!pending) return;
    let timer = setTimeout(() => setPending(undefined), Date.parse(pending.expiresAt) - Date.now());
    return () => clearTimeout(timer);
  }, [pending]);

  if (!link) return <div className="bg-surface-300 h-24 animate-pulse rounded-xl" />;

  if (link.connected) {
    return (
      <div className="bg-surface-300 flex flex-wrap items-center gap-3 rounded-xl p-4">
        <div className="bg-dark-green-surface text-on-dark-green-surface flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Check size={20} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium">{t("settings:telegramConnectedAs", {defaultValue: "Connected as {{name}}", name: link.username ?? link.firstName})}</span>
          <span className="text-on-surface-secondary text-xs">{t("settings:telegramConnectedHint", {defaultValue: "Your digest and personal alerts come from @octopos_helm_bot."})}</span>
        </div>
        <Button type="button" size="sm" color="neutral" loading={unlink.isPending} onClick={() => unlink.mutate({body: {}})}>
          {t("settings:telegramDisconnect", {defaultValue: "Disconnect"})}
        </Button>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="bg-surface-300 flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center">
        {qr ? <img src={qr} alt={t("settings:telegramQrAlt", {defaultValue: "QR code that opens the bot"})} className="size-40 shrink-0 self-center rounded-lg bg-white p-1" /> : null}
        <div className="flex flex-col gap-3">
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
            <li>{t("settings:telegramStep1", {defaultValue: "Open the link, or scan the code with your phone."})}</li>
            <li>{t("settings:telegramStep2", {defaultValue: "Press Start in the bot."})}</li>
            <li>{t("settings:telegramStep3", {defaultValue: "Come back here. It connects on its own."})}</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" color="brand" asChild>
              <a href={pending.url} target="_blank" rel="noreferrer">
                <Send size={14} /> {t("settings:telegramOpen", {defaultValue: "Open Telegram"})} <ExternalLink size={12} />
              </a>
            </Button>
            <Button type="button" size="sm" color="neutral" variant="ghost" onClick={() => setPending(undefined)}>
              {t("common:cancel", {defaultValue: "Cancel"})}
            </Button>
          </div>
          <span className="text-on-surface-secondary animate-pulse text-xs">
            {t("settings:telegramWaiting", {defaultValue: "Waiting for you to press Start… The link works once, for 10 minutes."})}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-300 flex flex-col gap-3 rounded-xl p-4">
      {create.error ? <ErrorAlert title={t("common:error", {defaultValue: "Error"})} message={create.error.message} /> : null}
      <span className="text-sm">
        {t("settings:telegramIntro", {defaultValue: "Connect your Telegram to get your morning digest, your tasks and alerts about your clients from @octopos_helm_bot."})}
      </span>
      <Button type="button" size="sm" color="brand" className="self-start" loading={create.isPending} onClick={() => create.mutate({body: {}})}>
        <Send size={14} /> {t("settings:telegramConnect", {defaultValue: "Connect Telegram"})}
      </Button>
    </div>
  );
}
