import {useEffect, useState} from "react";
import {Link} from "@tanstack/react-router";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useTranslation} from "react-i18next";
import {Button, Tag} from "@yeahuz/kdsx-react";
import {Eye, ShieldAlert} from "lucide-react";
import {endSupportSessionMutation, listSupportSessionsOptions, type SignedInOperator, type SupportSession} from "@/api";
import {formatDateTime} from "@/lib/format";
import {can} from "@/permission";

function useMinutesLeft(expiresAt: string | undefined) {
  // The tick only re-renders; the time is read fresh each render, so every place that shows the
  // same session shows the same number.
  let [, setTick] = useState(0);
  useEffect(() => {
    let timer = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  return expiresAt ? Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 60000)) : 0;
}

function useEndSession() {
  let queryClient = useQueryClient();
  return useMutation({
    ...endSupportSessionMutation(),
    onSuccess: () => queryClient.invalidateQueries({predicate: (q) => ["listSupportSessions", "listActivity"].includes((q.queryKey[0] as {_id?: string})?._id ?? "")}),
  });
}

/**
 * While you are inside a client's dash, Helm says so on every page — the same courtesy the client
 * gets in their banner — with the way out one click away.
 */
export function ActiveSessionBanner({user}: {user: SignedInOperator}) {
  let {t} = useTranslation();
  let {data} = useQuery({...listSupportSessionsOptions({query: {active: true, operatorID: user.id}}), refetchInterval: 30_000, enabled: can(user, "client.impersonate")});
  let session = data?.sessions[0];
  let left = useMinutesLeft(session?.expiresAt);
  let end = useEndSession();
  if (!session || left === 0) return null;
  return (
    <div
      className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm ${session.mode === "full" ? "bg-error-low text-on-error-low" : "bg-bright-blue/15 text-on-surface-blue"}`}
    >
      <span className="flex items-center gap-2">
        {session.mode === "full" ? <ShieldAlert size={16} /> : <Eye size={16} />}
        <span>
          {t("clients:inSession", {defaultValue: "You are in {{client}}'s dash", client: session.clientName})} ·{" "}
          {session.mode === "full" ? t("clients:fullAccess", {defaultValue: "full access"}) : t("clients:readOnly", {defaultValue: "read-only"})} ·{" "}
          {t("clients:endsIn", {defaultValue: "ends in {{count}} min", count: left})}
        </span>
      </span>
      <span className="flex gap-2">
        <Button size="xs" color="neutral" asChild>
          <Link to="/clients/$id" params={{id: session.clientID}}>
            {t("clients:openClient", {defaultValue: "Client page"})}
          </Link>
        </Button>
        <Button size="xs" color="danger" loading={end.isPending} onClick={() => end.mutate({body: {id: session.id}})}>
          {t("clients:endNow", {defaultValue: "End now"})}
        </Button>
      </span>
    </div>
  );
}

export function SupportSessionList({clientID}: {clientID: string}) {
  let {t} = useTranslation();
  let {data} = useQuery({...listSupportSessionsOptions({query: {clientID}}), refetchInterval: 30_000});
  let end = useEndSession();
  if (!data) return null;
  if (!data.sessions.length) return <span className="text-on-surface-secondary text-sm">{t("clients:noSessions", {defaultValue: "Nobody has opened their dash from Helm."})}</span>;
  return (
    <ul className="flex flex-col gap-2">
      {data.sessions.slice(0, 4).map((session) => (
        <SessionRow key={session.id} session={session} onEnd={() => end.mutate({body: {id: session.id}})} />
      ))}
    </ul>
  );
}

function SessionRow({session, onEnd}: {session: SupportSession; onEnd: () => void}) {
  let {t} = useTranslation();
  let left = useMinutesLeft(session.expiresAt);
  let active = !session.endedAt && left > 0;
  return (
    <li className="flex items-start justify-between gap-2 text-sm">
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2">
          {session.operator.name}
          <Tag color={session.mode === "full" ? "red" : "blue"}>{session.mode === "full" ? t("clients:full", {defaultValue: "Full"}) : t("clients:readOnlyShort", {defaultValue: "Read-only"})}</Tag>
          {active ? <Tag color="green">{t("clients:live", {defaultValue: "Live · {{count}} min left", count: left})}</Tag> : null}
        </span>
        <span className="text-on-surface-secondary truncate text-xs">
          {formatDateTime(session.startedAt)} · {session.reason}
        </span>
      </span>
      {active ? (
        <Button size="xs" color="neutral" variant="ghost" onClick={onEnd}>
          {t("clients:end", {defaultValue: "End"})}
        </Button>
      ) : null}
    </li>
  );
}
