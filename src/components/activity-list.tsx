import {Link} from "@tanstack/react-router";
import {Bot, CreditCard, Server, User, Building2, StickyNote, LifeBuoy, Receipt, Users} from "lucide-react";
import type {ActivityCategory, ActivityEvent} from "@/api";
import {useTranslation} from "react-i18next";
import {cn} from "@/lib/utils";
import {formatDateTime} from "@/lib/format";

let CATEGORY_ICON: Partial<Record<ActivityCategory, React.ElementType>> = {payment: CreditCard, billing: Receipt, fleet: Server, note: StickyNote, support: LifeBuoy, team: Users};

let CATEGORIES: {value: ActivityCategory; label: string}[] = [
  {value: "payment", label: "Payments"},
  {value: "billing", label: "Billing"},
  {value: "support", label: "Support"},
  {value: "note", label: "Notes"},
  {value: "fleet", label: "Fleet"},
  {value: "client", label: "Changes"},
];

/** Chips over a timeline: everything, or one kind of thing. */
export function ActivityFilter({value, onChange, withTeam = false}: {value?: ActivityCategory; onChange: (value: ActivityCategory | undefined) => void; withTeam?: boolean}) {
  let {t} = useTranslation();
  let options = withTeam ? [...CATEGORIES, {value: "team" as const, label: "Team"}] : CATEGORIES;
  let chip = (active: boolean) => cn("rounded-full px-3 py-1.5 text-sm transition-colors", active ? "bg-accent text-accent-emphasis font-medium" : "bg-surface-300 hover:bg-surface-400");
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={chip(!value)} onClick={() => onChange(undefined)}>
        {t("common:all", {defaultValue: "All"})}
      </button>
      {options.map((option) => (
        <button key={option.value} type="button" className={chip(value === option.value)} onClick={() => onChange(value === option.value ? undefined : option.value)}>
          {t(`common:category.${option.value}`, {defaultValue: option.label})}
        </button>
      ))}
    </div>
  );
}

function iconFor(event: ActivityEvent) {
  let byCategory = CATEGORY_ICON[event.category];
  if (byCategory && event.actor.kind !== "client") return byCategory;
  if (event.actor.kind === "client") return Building2;
  if (event.actor.kind === "system") return Bot;
  return User;
}

/** A timeline: who, what, when. The audit log and a client's history are the same list, filtered. */
export function ActivityList({events, showClient = true}: {events: ActivityEvent[]; showClient?: boolean}) {
  return (
    <ol className="flex flex-col">
      {events.map((event, i) => {
        let Icon = iconFor(event);
        return (
          <li key={event.id} className="relative flex gap-3 pb-5">
            {i < events.length - 1 ? <span className="bg-border-secondary absolute top-9 bottom-0 left-[1.0625rem] w-px" /> : null}
            <span className="bg-surface-300 text-on-surface-secondary flex size-9 shrink-0 items-center justify-center rounded-full">
              <Icon size={16} />
            </span>
            <div className="flex min-w-0 flex-col pt-1">
              <span className="text-sm">
                <span className="font-medium">{event.actor.name}</span>
                {showClient && event.clientID ? (
                  <>
                    {" · "}
                    <Link to="/clients/$id" params={{id: event.clientID}} className="hover:underline">
                      {event.clientName}
                    </Link>
                  </>
                ) : null}
              </span>
              <span className="text-sm">{event.summary}</span>
              <span className="text-on-surface-secondary text-xs">
                {formatDateTime(event.createdAt)} · <code>{event.action}</code>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
