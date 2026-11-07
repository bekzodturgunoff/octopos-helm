import {useState} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {useTranslation} from "react-i18next";
import {Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, Select, Tag, Textarea, Tooltip} from "@yeahuz/kdsx-react";
import {Check, Copy, Monitor, MoreHorizontal, Plug} from "lucide-react";
import {createRemoteAccessMutation, deleteRemoteAccessMutation, logRemoteConnectionMutation, updateRemoteAccessMutation, type ClientDetail, type FleetNode, type RemoteAccess} from "@/api";
import {FormDialog, FormField} from "@/components/form-dialog";
import {useToast} from "@/components/toaster";
import {formatAnydesk, formatRelative} from "@/lib/format";
import {fleetNodeLabel} from "@/lib/fleet";

/**
 * Opens AnyDesk on this computer pointed at the client's machine, and records who connected. The
 * `anydesk:` link is AnyDesk's own; with it installed the browser hands the ID straight over.
 */
export function useConnect() {
  let {t} = useTranslation();
  let toast = useToast();
  let queryClient = useQueryClient();
  let log = useMutation({...logRemoteConnectionMutation(), onSuccess: () => queryClient.invalidateQueries({predicate: (q) => (q.queryKey[0] as {_id?: string})?._id === "getClient"})});
  return (entry: RemoteAccess) => {
    log.mutate({body: {id: entry.id}});
    window.location.href = `anydesk:${entry.anydeskID}`;
    toast({
      tone: "success",
      title: t("clients:anydeskOpening", {defaultValue: "Opening AnyDesk · {{id}}", id: formatAnydesk(entry.anydeskID)}),
      description: entry.unattended ? undefined : t("clients:anydeskAttended", {defaultValue: "Someone at the client has to accept the connection."}),
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
        <p className="text-on-surface-secondary text-sm">{t("clients:noRemoteAccess", {defaultValue: "No AnyDesk IDs saved yet. Add one at install so support can reach the till without a trip."})}</p>
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
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{entry.label}</span>
                {entry.unattended ? (
                  <Tag color="green">{t("clients:unattended", {defaultValue: "Unattended"})}</Tag>
                ) : (
                  <Tag color="neutral">{t("clients:needsAccept", {defaultValue: "Needs accept"})}</Tag>
                )}
              </span>
              <span className="flex items-center gap-1">
                <span className="font-mono text-lg tracking-wide tabular-nums">{formatAnydesk(entry.anydeskID)}</span>
                <CopyButton value={entry.anydeskID} label={t("clients:copyId", {defaultValue: "Copy ID"})} />
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
            <span className="flex shrink-0 items-center gap-1">
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
  let create = createRemoteAccessMutation();
  let update = updateRemoteAccessMutation();
  let get = (form: FormData, key: string) => ((form.get(key) as string | null) ?? "").trim();
  return (
    <FormDialog
      trigger={
        entry ? undefined : (
          <Button size="sm" color="neutral" className="max-w-fit">
            {t("clients:addAnydesk", {defaultValue: "Add AnyDesk ID"})}
          </Button>
        )
      }
      open={entry ? true : undefined}
      onOpenChange={entry ? (open) => (open ? undefined : onClose?.()) : undefined}
      title={entry ? t("clients:editAnydesk", {defaultValue: "Edit {{label}}", label: entry.label}) : t("clients:addAnydesk", {defaultValue: "Add AnyDesk ID"})}
      description={t("clients:addAnydeskHint", {defaultValue: "The 9 or 10 digit ID AnyDesk shows on the machine. Do not paste the password here."})}
      action={entry ? t("common:save", {defaultValue: "Save"}) : t("common:add", {defaultValue: "Add"})}
      success={entry ? t("clients:anydeskSaved", {defaultValue: "Saved"}) : t("clients:anydeskAdded", {defaultValue: "AnyDesk ID added"})}
      onSubmit={(form) => {
        let body = {
          label: get(form, "label"),
          anydeskID: get(form, "anydeskID").replace(/\s/g, ""),
          locationID: get(form, "locationID") || undefined,
          nodeID: get(form, "nodeID") || undefined,
          unattended: form.get("unattended") === "on",
          passwordNote: get(form, "passwordNote"),
          note: get(form, "note"),
        };
        return entry ? update.mutationFn({body: {id: entry.id, ...body}}) : create.mutationFn({body: {clientID: client.id, ...body}});
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("clients:anydeskId", {defaultValue: "AnyDesk ID"})} htmlFor="anydeskID">
          <Input
            id="anydeskID"
            name="anydeskID"
            required
            inputMode="numeric"
            pattern="[0-9 ]{9,13}"
            placeholder="123 456 789"
            defaultValue={entry ? formatAnydesk(entry.anydeskID) : undefined}
            autoFocus
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
