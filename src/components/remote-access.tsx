import {useState} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {useTranslation} from "react-i18next";
import {Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, Select, Tag, Textarea, Tooltip} from "@yeahuz/kdsx-react";
import {Check, Copy, Monitor, MoreHorizontal, Plug} from "lucide-react";
import {createRemoteAccessMutation, deleteRemoteAccessMutation, logRemoteConnectionMutation, updateRemoteAccessMutation, type ClientDetail, type FleetNode, type RemoteAccess} from "@/api";
import type {RemoteApp} from "@/api/types";
import {FormDialog, FormField} from "@/components/form-dialog";
import {useToast} from "@/components/toaster";
import {formatRelative} from "@/lib/format";
import {appLabel, formatRemoteID, remoteApp, REMOTE_APPS} from "@/lib/remote-apps";
import {fleetNodeLabel} from "@/lib/fleet";

/**
 * Opens the entry's app on this computer pointed at the client's machine, and records who connected.
 * Each app has its own link scheme; with the app installed the browser hands the ID straight over.
 * An app with no link gets its ID copied instead, to paste into the app.
 */
export function useConnect() {
  let {t} = useTranslation();
  let toast = useToast();
  let queryClient = useQueryClient();
  let log = useMutation({...logRemoteConnectionMutation(), onSuccess: () => queryClient.invalidateQueries({predicate: (q) => (q.queryKey[0] as {_id?: string})?._id === "getClient"})});
  return (entry: RemoteAccess) => {
    log.mutate({body: {id: entry.id}});
    let link = remoteApp(entry.app).link;
    let attended = entry.unattended ? undefined : t("clients:remoteAttended", {defaultValue: "Someone at the client has to accept the connection."});
    if (link) {
      window.location.href = link(entry.remoteID);
      toast({tone: "success", title: t("clients:remoteOpening", {defaultValue: "Opening {{app}} · {{id}}", app: appLabel(entry), id: formatRemoteID(entry.remoteID)}), description: attended});
      return;
    }
    navigator.clipboard?.writeText(entry.remoteID);
    toast({
      tone: "success",
      title: t("clients:remoteCopied", {defaultValue: "ID copied · open {{app}} and paste it", app: appLabel(entry)}),
      description: attended,
    });
  };
}

export function CopyButton({value, label}: {value: string; label: string}) {
  let [copied, setCopied] = useState(false);
  return (
    <Tooltip content={copied ? "Copied" : label}>
      <Button
        type="button"
        size="xs"
        color="neutral"
        variant="ghost"
        icon
        aria-label={label}
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </Button>
    </Tooltip>
  );
}

export function RemoteAccessList({client, writes, nodes}: {client: ClientDetail; writes: boolean; nodes?: FleetNode[]}) {
  let {t} = useTranslation();
  let connect = useConnect();
  let [editing, setEditing] = useState<RemoteAccess>();
  let [showAll, setShowAll] = useState(false);
  let queryClient = useQueryClient();
  let toast = useToast();
  let remove = useMutation({
    ...deleteRemoteAccessMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({tone: "success", title: t("clients:remoteRemoved", {defaultValue: "Removed"})});
    },
  });

  if (!client.remoteAccess.length) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-on-surface-secondary text-sm">
          {t("clients:noRemoteAccess", {defaultValue: "No remote access saved yet. Add the till's AnyDesk or RustDesk ID at install so support can reach it without a trip."})}
        </p>
        {writes ? <RemoteAccessDialog client={client} nodes={nodes} /> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {(showAll ? client.remoteAccess : client.remoteAccess.slice(0, 4)).map((entry) => (
          <li key={entry.id} className="bg-surface-300 flex flex-wrap items-center gap-3 rounded-xl p-3">
            <span className="bg-surface-500 flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Monitor size={18} />
            </span>
            <span className="flex min-w-0 flex-1 basis-48 flex-col">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{entry.label}</span>
                {entry.unattended ? (
                  <Tag color="green">{t("clients:unattended", {defaultValue: "Unattended"})}</Tag>
                ) : (
                  <Tag color="neutral">{t("clients:needsAccept", {defaultValue: "Needs accept"})}</Tag>
                )}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-on-surface-secondary text-sm">{appLabel(entry)}</span>
                <span className="flex items-center gap-1">
                  <span className="font-mono text-lg tracking-wide whitespace-nowrap tabular-nums">{formatRemoteID(entry.remoteID)}</span>
                  <CopyButton value={entry.remoteID} label={t("clients:copyId", {defaultValue: "Copy ID"})} />
                </span>
              </span>
              <span className="text-on-surface-secondary text-xs">
                {[
                  entry.locationName,
                  entry.passwordNote ? t("clients:passwordIn", {defaultValue: "Password: {{where}}", where: entry.passwordNote}) : null,
                  entry.lastConnectedAt
                    ? t("clients:lastConnected", {
                        defaultValue: "Last connected {{when}}{{by}}",
                        when: formatRelative(entry.lastConnectedAt),
                        by: entry.lastConnectedBy ? ` by ${entry.lastConnectedBy.name}` : "",
                      })
                    : t("clients:neverConnected", {defaultValue: "Never connected from Helm"}),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {entry.note ? <span className="text-on-surface-secondary text-xs">{entry.note}</span> : null}
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-1">
              <Button size="sm" color="brand" onClick={() => connect(entry)}>
                <Plug size={14} className="mr-1" />
                {t("clients:connect", {defaultValue: "Connect"})}
              </Button>
              {writes ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" color="neutral" variant="ghost" icon aria-label={t("common:more", {defaultValue: "More"})}>
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(entry)}>{t("common:edit", {defaultValue: "Edit"})}</DropdownMenuItem>
                    <DropdownMenuItem className="text-error-bright" onSelect={() => remove.mutate({body: {id: entry.id}})}>
                      {t("common:remove", {defaultValue: "Remove"})}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {client.remoteAccess.length > 4 ? (
          <Button size="sm" color="neutral" variant="ghost" onClick={() => setShowAll((v) => !v)}>
            {showAll ? t("common:showLess", {defaultValue: "Show less"}) : t("clients:showAllMachines", {defaultValue: "Show all {{count}}", count: client.remoteAccess.length})}
          </Button>
        ) : null}
        {writes ? <RemoteAccessDialog client={client} nodes={nodes} /> : null}
      </div>
      {editing ? <RemoteAccessDialog client={client} nodes={nodes} entry={editing} onClose={() => setEditing(undefined)} /> : null}
      <p className="text-on-surface-secondary text-xs">
        {t("clients:remoteHint", {defaultValue: "Passwords are never stored in Helm — only where the team keeps them. Every connection is written to the activity log."})}
      </p>
    </div>
  );
}

function RemoteAccessDialog({client, nodes, entry, onClose}: {client: ClientDetail; nodes?: FleetNode[]; entry?: RemoteAccess; onClose?: () => void}) {
  let {t} = useTranslation();
  // The app picks how the ID is checked and what the field suggests.
  let [app, setApp] = useState<RemoteApp>(entry?.app ?? "anydesk");
  let info = remoteApp(app);
  let create = createRemoteAccessMutation();
  let update = updateRemoteAccessMutation();
  let get = (form: FormData, key: string) => ((form.get(key) as string | null) ?? "").trim();
  return (
    <FormDialog
      trigger={
        entry ? undefined : (
          <Button size="sm" color="neutral" className="max-w-fit">
            {t("clients:addRemote", {defaultValue: "Add remote access"})}
          </Button>
        )
      }
      open={entry ? true : undefined}
      onOpenChange={entry ? (open) => (open ? undefined : onClose?.()) : undefined}
      title={entry ? t("clients:editRemote", {defaultValue: "Edit {{label}}", label: entry.label}) : t("clients:addRemote", {defaultValue: "Add remote access"})}
      description={t("clients:addRemoteHint", {defaultValue: "The ID the app shows on the machine. Do not paste the password here."})}
      action={entry ? t("common:save", {defaultValue: "Save"}) : t("common:add", {defaultValue: "Add"})}
      success={entry ? t("clients:remoteSaved", {defaultValue: "Saved"}) : t("clients:remoteAdded", {defaultValue: "Remote access added"})}
      onSubmit={(form) => {
        let body = {
          label: get(form, "label"),
          app,
          remoteID: get(form, "remoteID").replace(/\s/g, ""),
          appName: app === "other" ? get(form, "appName") : undefined,
          locationID: get(form, "locationID") || undefined,
          nodeID: get(form, "nodeID") || undefined,
          unattended: form.get("unattended") === "on",
          passwordNote: get(form, "passwordNote"),
          note: get(form, "note"),
        };
        return entry ? update.mutationFn({body: {id: entry.id, ...body}}) : create.mutationFn({body: {clientID: client.id, ...body}});
      }}
    >
      <FormField label={t("clients:remoteApp", {defaultValue: "App"})} htmlFor="app">
        <div id="app" role="radiogroup" className="flex flex-wrap gap-2">
          {REMOTE_APPS.map((option) => (
            <button
              key={option.app}
              type="button"
              role="radio"
              aria-checked={app === option.app}
              onClick={() => setApp(option.app)}
              className={`h-9 rounded-full border px-3 text-sm transition-colors ${app === option.app ? "border-border-accent bg-surface-300" : "border-border-secondary text-on-surface-secondary"}`}
            >
              {option.app === "other" ? t("clients:otherApp", {defaultValue: "Other"}) : option.name}
            </button>
          ))}
        </div>
      </FormField>
      {app === "other" ? (
        <FormField label={t("clients:appName", {defaultValue: "Which app"})} htmlFor="appName">
          <Input id="appName" name="appName" required placeholder="Ammyy Admin, Chrome Remote Desktop…" defaultValue={entry?.appName} />
        </FormField>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("clients:remoteIdLabel", {defaultValue: "{{app}} ID", app: app === "other" ? t("clients:otherApp", {defaultValue: "Other"}) : info.name})} htmlFor="remoteID">
          <Input
            key={app}
            id="remoteID"
            name="remoteID"
            required
            inputMode={app === "anydesk" || app === "teamviewer" ? "numeric" : undefined}
            pattern={app === "anydesk" || app === "teamviewer" ? "[0-9 ]{9,13}" : undefined}
            placeholder={info.placeholder}
            defaultValue={entry && entry.app === app ? formatRemoteID(entry.remoteID) : undefined}
            autoFocus={!entry}
            className="font-mono"
          />
        </FormField>
        <FormField label={t("clients:machine", {defaultValue: "Machine"})} htmlFor="label">
          <Input id="label" name="label" required placeholder={t("clients:machinePlaceholder", {defaultValue: "Main hall · Till 1"})} defaultValue={entry?.label} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("clients:location", {defaultValue: "Location"})} htmlFor="locationID">
          <Select id="locationID" name="locationID" defaultValue={entry?.locationID ?? client.locations[0]?.id ?? ""}>
            <option value="">—</option>
            {client.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t("clients:installation", {defaultValue: "Installation (optional)"})} htmlFor="nodeID">
          <Select id="nodeID" name="nodeID" defaultValue={entry?.nodeID ?? ""}>
            <option value="">—</option>
            {nodes?.map((node) => (
              <option key={node.nodeID} value={node.nodeID}>
                {fleetNodeLabel(node)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="unattended" defaultChecked={entry?.unattended ?? true} className="accent-accent" />
        {t("clients:unattendedSet", {defaultValue: "Unattended access is set up (nobody has to accept)"})}
      </label>
      <FormField label={t("clients:passwordNote", {defaultValue: "Where the password is kept"})} htmlFor="passwordNote">
        <Input id="passwordNote" name="passwordNote" placeholder="Bitwarden → Clients → …" defaultValue={entry?.passwordNote} />
      </FormField>
      <FormField label={t("common:note", {defaultValue: "Note"})} htmlFor="note">
        <Textarea id="note" name="note" rows={2} defaultValue={entry?.note} placeholder={t("clients:remoteNotePlaceholder", {defaultValue: "Turns off at night, ask the manager first…"})} />
      </FormField>
    </FormDialog>
  );
}
