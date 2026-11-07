import {Command} from "cmdk";
import {Dispatch, ReactNode, SetStateAction, useEffect, useState} from "react";
import {useNavigate} from "@tanstack/react-router";
import {useTranslation} from "react-i18next";
import {useQuery} from "@tanstack/react-query";
import {ChevronRight, Search} from "lucide-react";
import {listClientsOptions, SignedInOperator} from "@/api";
import {useDebounced} from "@/hooks";
import {can, canAny} from "@/permission";
import {SEARCH_PAGES, SECTIONS, SECTION_LABEL} from "@/lib/search-pages";

let groupClass = "**:[cmdk-group-heading]:text-on-surface-secondary **:[cmdk-group-heading]:px-3 **:[cmdk-group-heading]:py-2 **:[cmdk-group-heading]:text-xs **:[cmdk-group-heading]:font-medium";
let rowClass = "group aria-selected:bg-surface-300 flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5";

const FOUND = 6;

// The dash's palette, pointed at clients: a name, a slug, an owner or a phone number finds them.
export function CommandPalette({user, open, onOpenChange}: {user: SignedInOperator; open: boolean; onOpenChange: Dispatch<SetStateAction<boolean>>}) {
  let {t} = useTranslation();
  let navigate = useNavigate();
  let [search, setSearch] = useState("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange((open) => !open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  let settled = useDebounced(search);
  let question = settled.trim();
  let readsClients = open && question.length >= 2 && can(user, "client.read");
  let clients = useQuery({...listClientsOptions({query: {q: question, pageSize: FOUND}}), enabled: readsClients, staleTime: 30_000});

  let pages = SEARCH_PAGES.filter((page) => !page.capabilities?.length || canAny(user, ...page.capabilities));

  let go = (where: () => void) => {
    where();
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={t("common:search", {defaultValue: "Search"})}
      overlayClassName="fixed inset-0 z-40 bg-black/50"
      contentClassName="fixed top-[12%] left-1/2 z-50 w-[92%] max-w-xl -translate-x-1/2"
      className="bg-surface text-on-surface border-border-secondary shadow-modal overflow-hidden rounded-2xl border"
    >
      <div className="border-b-border-secondary flex items-center gap-3 border-b px-4">
        <Search size={18} className="text-on-surface-secondary shrink-0" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder={t("common:searchPlaceholder", {defaultValue: "Search clients, phone numbers, pages…"})}
          className="placeholder:text-on-surface-secondary h-14 w-full bg-transparent text-base outline-none"
        />
        <kbd className="border-border-secondary text-on-surface-secondary rounded-md border px-2 py-1 text-xs">Esc</kbd>
      </div>
      <Command.List className="max-h-88 overflow-y-auto p-2">
        <Command.Empty className="text-on-surface-secondary py-8 text-center text-sm">{t("common:noResults", {defaultValue: "Nothing found"})}</Command.Empty>
        {readsClients && clients.data?.items.length ? (
          <Command.Group heading={t("clients:clients", {defaultValue: "Clients"})} className={groupClass}>
            {clients.data.items.map((client) => (
              <FoundRow
                key={client.id}
                query={search}
                value={`client:${client.id}`}
                title={client.name}
                subtitle={[client.subscription?.plan.name, client.owner.phone].filter(Boolean).join(" · ")}
                onSelect={() => go(() => navigate({to: "/clients/$id", params: {id: client.id}}))}
              />
            ))}
          </Command.Group>
        ) : null}
        {SECTIONS.map((section) => {
          let items = pages.filter((page) => page.section === section);
          if (!items.length) return null;
          return (
            <Command.Group key={section} heading={t(`common:section.${section}`, {defaultValue: SECTION_LABEL[section]})} className={groupClass}>
              {items.map((page) => {
                let label = t(`common:page.${page.label}`, {defaultValue: page.label});
                return (
                  <Command.Item key={page.label} value={`${label} ${page.to}`} onSelect={() => go(() => navigate({to: page.to, search: page.search}))} className={rowClass}>
                    <span>{highlight(label, search)}</span>
                    <ChevronRight size={18} className="text-on-surface-accent shrink-0 opacity-0 group-aria-selected:opacity-100" />
                  </Command.Item>
                );
              })}
            </Command.Group>
          );
        })}
      </Command.List>
      <div className="border-t-border-secondary text-on-surface-secondary flex items-center gap-4 border-t px-4 py-2.5 text-xs">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          {t("common:toNavigate", {defaultValue: "to navigate"})}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd>
          {t("common:toSelect", {defaultValue: "to select"})}
        </span>
      </div>
    </Command.Dialog>
  );
}

function FoundRow({value, query, title, subtitle, onSelect}: {value: string; query: string; title: string; subtitle: string; onSelect: () => void}) {
  return (
    <Command.Item value={value} keywords={[query]} onSelect={onSelect} className={rowClass}>
      <span className="min-w-0 truncate">{highlight(title, query)}</span>
      <span className="text-on-surface-secondary flex shrink-0 items-center gap-2 text-xs">
        {subtitle}
        <ChevronRight size={18} className="text-on-surface-accent shrink-0 opacity-0 group-aria-selected:opacity-100" />
      </span>
    </Command.Item>
  );
}

function Kbd({children}: {children: ReactNode}) {
  return <kbd className="border-border-secondary bg-surface-300 rounded-md border px-1.5 py-0.5 leading-none">{children}</kbd>;
}

function highlight(text: string, query: string) {
  let q = query.trim();
  let i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-dark-green-surface text-on-dark-green-surface rounded-sm px-0.5">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}
