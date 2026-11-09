import {FormEvent, useState} from "react";
import {Button, CheckboxCard, CheckboxGroup, ErrorAlert, FixedFooter, Input, RadioCard, Tag} from "@yeahuz/kdsx-react";
import {Check, KeyRound, Lock, Search, ShieldCheck} from "lucide-react";
import {useTranslation} from "react-i18next";
import type {AccessCapability, AccessResource, Capability, Permission, PermissionScope} from "@/api";

export let SCOPE_PRIORITY: PermissionScope[] = ["all", "assigned"];

export function maxScope(scopes: PermissionScope[] | undefined): PermissionScope | undefined {
  if (!scopes || scopes.length === 0) return undefined;
  return SCOPE_PRIORITY.find((s) => scopes.includes(s)) ?? scopes[0];
}

export function scopeLabel(t: ReturnType<typeof useTranslation>["t"], scope: PermissionScope) {
  return scope === "all" ? t("access:scope.all", {defaultValue: "All clients"}) : t("access:scope.assigned", {defaultValue: "Assigned clients"});
}

/** The dash's CapabilityScopes: how far a granted capability reaches, as radio cards under it. */
export function CapabilityScopes({capability, value, onChange, name}: {capability: AccessCapability; value?: PermissionScope; onChange: (scope: PermissionScope) => void; name: string}) {
  let {t} = useTranslation();
  if (capability.scopes.length === 0) return null;
  let descriptions: Record<PermissionScope, string> = {
    all: t("access:scope.allDescription", {defaultValue: "Every client"}),
    assigned: t("access:scope.assignedDescription", {defaultValue: "Only clients they are account manager for"}),
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-on-surface-secondary px-1 text-xs font-medium">{t("access:scope", {defaultValue: "Scope"})}</span>
      <ul className="flex flex-wrap gap-1.5">
        {capability.scopes.map((scope) => (
          <li key={scope} className="flex-1 basis-52">
            <RadioCard wrapperClassname="h-full" className="h-full" name={name} value={scope} checked={value === scope} onChange={() => onChange(scope)}>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{scopeLabel(t, scope)}</span>
                <span className="text-on-surface-secondary text-xs">{descriptions[scope]}</span>
              </span>
            </RadioCard>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A role's permissions as tags, with the scope after a capability that has one. */
export function PermissionTags({permissions, resources}: {permissions: Permission[]; resources: AccessResource[]}) {
  let {t} = useTranslation();
  let names = new Map(resources.flatMap((r) => r.capabilities).map((c) => [c.value, c.name]));
  return (
    <ul className="flex flex-wrap gap-2">
      {permissions.map((permission) => (
        <li key={permission.capability}>
          <Tag color="neutral" className="font-normal">
            <span className="flex items-center gap-1.5">
              {permission.capability === "*" ? t("access:fullAccess", {defaultValue: "Full access"}) : (names.get(permission.capability) ?? permission.capability)}
              {permission.scope ? <span className="text-on-surface-secondary text-xs font-normal">· {scopeLabel(t, permission.scope)}</span> : null}
            </span>
          </Tag>
        </li>
      ))}
    </ul>
  );
}

/**
 * The dash's permission screen, shared by "edit permissions" and the new-role flow: full access at
 * the top, a search, then each group of capabilities as checkbox cards with their scope beneath.
 */
export function PermissionsEditor({
  title,
  resources,
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
}: {
  title: React.ReactNode;
  resources: AccessResource[];
  initial: Permission[];
  submitLabel: string;
  pending?: boolean;
  error?: string;
  onSubmit: (permissions: Permission[]) => void;
}) {
  let {t} = useTranslation();
  let allCapabilities = resources.flatMap((r) => r.capabilities);
  let capabilityMap = new Map(allCapabilities.map((c) => [c.value, c]));

  let [selected, setSelected] = useState(() => {
    let map = new Map<Capability, PermissionScope | undefined>();
    for (let p of initial) if (p.capability !== "*") map.set(p.capability, p.scope ?? maxScope(capabilityMap.get(p.capability)?.scopes));
    return map;
  });
  let [fullAccess, setFullAccess] = useState(() => initial.some((p) => p.capability === "*"));
  let [search, setSearch] = useState("");

  let q = search.trim().toLowerCase();
  let visibleGroups = resources
    .map((group) =>
      !q || group.name.toLowerCase().includes(q) ? group : {...group, capabilities: group.capabilities.filter((c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q))},
    )
    .filter((group) => group.capabilities.length);

  let permissionCount = fullAccess ? allCapabilities.length : selected.size;

  // Doing something needs seeing it first: "Manage clients" without "View clients" would give a role
  // a button on a page it cannot open. So ticking a write ticks its read, and unticking a read
  // unticks what depends on it.
  let readOf = (value: Capability) => {
    let read = `${value.split(".")[0]}.read` as Capability;
    return read !== value && capabilityMap.has(read) ? read : undefined;
  };
  let toggle = (value: Capability) =>
    setSelected((prev) => {
      let next = new Map(prev);
      if (next.has(value)) {
        next.delete(value);
        for (let other of [...next.keys()]) if (readOf(other) === value) next.delete(other);
      } else {
        next.set(value, maxScope(capabilityMap.get(value)?.scopes));
        let read = readOf(value);
        if (read && !next.has(read)) next.set(read, next.get(value) ?? maxScope(capabilityMap.get(read)?.scopes));
      }
      return next;
    });

  let setScope = (value: Capability, scope: PermissionScope) => setSelected((prev) => new Map(prev).set(value, scope));

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (fullAccess) return onSubmit([{capability: "*"}]);
    onSubmit([...selected].map(([capability, scope]) => (scope ? {capability, scope} : {capability})));
  }

  return (
    <form className="mx-auto flex w-full flex-col px-4 sm:max-w-3xl" onSubmit={submit}>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {error ? <ErrorAlert message={error} title={t("common:error", {defaultValue: "Error"})} /> : null}
        <div className="flex items-center gap-2">
          <span className="text-on-surface-secondary text-sm">{t("access:permissions", {defaultValue: "Permissions"})}</span>
          <span className="bg-neutral-active text-on-surface-accent rounded-md px-1.5 text-xs font-medium">{permissionCount}</span>
        </div>
      </div>
      <div className="mt-8 mb-28 flex flex-col gap-3 sm:mb-8">
        <div className="bg-surface-300 border-border-secondary flex cursor-pointer items-center gap-3 rounded-xl border p-4" onClick={() => setFullAccess((v) => !v)}>
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors ${fullAccess ? "bg-dark-green-surface text-on-dark-green-surface" : "bg-neutral-active"}`}>
            <ShieldCheck size={20} />
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium">{t("access:fullAccess", {defaultValue: "Full access"})}</span>
            <span className="text-on-surface-secondary text-xs">{t("access:allResources", {defaultValue: "Everything in Helm, including capabilities added later"})}</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFullAccess((v) => !v);
            }}
            aria-pressed={fullAccess}
            className={`border-border text-surface flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border duration-200 ${fullAccess ? "bg-dark-green-surface border-border-bright" : ""}`}
          >
            <Check size={14} strokeWidth={3} className={`duration-200 ${fullAccess ? "scale-100" : "scale-0"}`} />
          </button>
        </div>

        {!fullAccess && (
          <>
            <Input
              type="text"
              placeholder={`${t("access:permissions", {defaultValue: "Permissions"})}…`}
              startAdornment={<Search size={16} className="text-on-surface-secondary" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {visibleGroups.length === 0 ? (
              <div className="border-border-secondary text-on-surface-secondary flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-sm">
                {t("common:noResults", {defaultValue: "Nothing found"})}
              </div>
            ) : (
              visibleGroups.map((group) => {
                let hasAnySelected = group.capabilities.some((c) => selected.has(c.value));
                return (
                  <section key={group.code} className="bg-surface-300 flex flex-col gap-4 rounded-xl p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          hasAnySelected ? "bg-dark-green-surface text-on-dark-green-surface" : "bg-neutral-active text-on-surface-secondary"
                        }`}
                      >
                        {hasAnySelected ? <KeyRound size={16} /> : <Lock size={16} />}
                      </div>
                      <span className="truncate text-sm font-medium">{t(`access:resource.${group.code}`, {defaultValue: group.name})}</span>
                    </div>
                    <CheckboxGroup>
                      <ul className="flex flex-col gap-2">
                        {group.capabilities.map((cap) => (
                          <li key={cap.value}>
                            <div className="flex flex-col gap-2">
                              <CheckboxCard name={group.code} value={cap.value} checked={selected.has(cap.value)} onChange={() => toggle(cap.value)}>
                                <span className="flex flex-col gap-0.5">
                                  <span>{cap.name}</span>
                                  {cap.description ? <span className="text-on-surface-secondary text-xs">{cap.description}</span> : null}
                                </span>
                              </CheckboxCard>
                              {selected.has(cap.value) && (
                                <CapabilityScopes name={`scope.${cap.value}`} capability={cap} value={selected.get(cap.value)} onChange={(scope) => setScope(cap.value, scope)} />
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CheckboxGroup>
                  </section>
                );
              })
            )}
          </>
        )}
      </div>

      <FixedFooter className="z-20 px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:static sm:px-0">
        <Button size="lg" color="brand" className="w-full" variant="fill" disabled={pending || permissionCount === 0} loading={pending}>
          {submitLabel}
        </Button>
      </FixedFooter>
    </form>
  );
}
