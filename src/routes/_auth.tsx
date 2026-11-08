import {createFileRoute, Link, Outlet, redirect, useMatches} from "@tanstack/react-router";
import {Button, Tag, Tooltip} from "@yeahuz/kdsx-react";
import {Menu, X, House, BadgeDollarSign, ChevronRight, ArrowLeft, Search, Users, Server, ListTodo, Megaphone, Building2, FileChartColumn} from "lucide-react";
import {useQuery} from "@tanstack/react-query";
import {NavLink} from "@/components/nav-link";
import {CommandPalette} from "@/components/command-palette";
import {useEffect, useState} from "react";
import {cn} from "@/lib/utils";
import {Show} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";
import {useTheme} from "@/theme-provider";
import {ApiError, getSignedInOperatorOptions, getTaskCountsOptions, SignedInOperator} from "@/api";
import {Can, CanAny} from "@/permission";
import {getSession} from "@/constants";
import {ActiveSessionBanner} from "@/components/support-session";
import {Shortcuts} from "@/components/shortcuts";

export let Route = createFileRoute("/_auth")({
  component: Layout,
  beforeLoad: async ({location, context}) => {
    let redirectToLogin = () =>
      redirect({
        to: "/login",
        search: {redirect: location.href},
      });

    if (!getSession()) throw redirectToLogin();

    let user: SignedInOperator;
    try {
      user = await context.queryClient.ensureQueryData(getSignedInOperatorOptions());
    } catch (err) {
      // A network failure is not a signed-out operator: let the error page say so instead of
      // bouncing to a login that would fail the same way.
      if (err instanceof TypeError) throw err;
      if (err instanceof ApiError && err.status >= 500) throw err;
      throw redirectToLogin();
    }
    // The team requires two-factor and this operator has none: set-up is the only page open to them.
    if (user.mustSetUpTwoFactor && location.pathname !== "/settings/security") throw redirect({to: "/settings/security"});
    return {user};
  },
});

let navButtonClass = "text-on-surface hover:bg-neutral w-full justify-start font-normal";
let navLinkClass = "flex items-center gap-4";
let navActiveProps = {className: "font-semibold text-on-surface-accent"};
let barLinkClass = "hover:bg-surface-300 press-row active:bg-surface-400 relative flex h-16 w-full flex-col items-center justify-center gap-1";

function Layout() {
  let {user} = Route.useRouteContext();
  let matches = useMatches();
  let match = matches[matches.length - 1];
  let [open, setOpen] = useState(false);
  let [searchOpen, setSearchOpen] = useState(false);
  let {t} = useTranslation();
  let {theme} = useTheme();
  let mock = import.meta.env.VITE_API_MOCK === "on";

  // What is on my plate: the header's one number, so nobody has to open Tasks to find out.
  let {data: taskCounts} = useQuery({...getTaskCountsOptions(), staleTime: 60_000});
  let dueCount = (taskCounts?.overdue ?? 0) + (taskCounts?.dueToday ?? 0);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="max-w-8xl mx-auto flex">
      <CommandPalette user={user} open={searchOpen} onOpenChange={setSearchOpen} />
      <Shortcuts />
      <div className={cn("fixed inset-0 z-20 h-full w-full -translate-x-full bg-black/60 lg:hidden", {"translate-x-0": open})} onClick={() => setOpen(false)}>
        <Button color="neutral" icon={true} size="lg" className={cn("bg-surface absolute top-6 left-64 ml-2")} onClick={() => setOpen(false)}>
          <X size={20} />
        </Button>
      </div>
      <aside
        className={cn("bg-surface fixed top-0 left-0 z-20 flex h-screen w-full max-w-64 -translate-x-full flex-col px-4 py-1.5 duration-300 lg:sticky lg:translate-x-0", {"translate-x-0": open})}
        onClick={(e) => {
          // A tap on a link in the drawer is a decision made; close it so the page is seen.
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        <div className="flex h-32 shrink-0 items-center justify-center">
          <Link to="/" className="flex items-center text-2xl font-semibold tracking-tighter">
            <img src={`${import.meta.env.BASE_URL}logo/${theme === "dark" ? "logo_light" : "logo_dark"}.png`} alt="Octopos logo" className="mr-2 h-8 w-auto" />
            Helm
          </Link>
        </div>
        <nav className="min-h-0 w-full flex-1 overflow-y-auto">
          <ul className="flex flex-col gap-1">
            <li>
              <Button color="neutral" variant="ghost" size="lg" className={navButtonClass} asChild>
                <NavLink to="/" className={navLinkClass} activeProps={navActiveProps} activeOptions={{exact: true}}>
                  <House className="shrink-0" size={16} /> <span>{t("common:overview", {defaultValue: "Overview"})}</span>
                </NavLink>
              </Button>
            </li>
            <Can subject={user} capability="client.read">
              <li>
                <Button color="neutral" variant="ghost" size="lg" className={navButtonClass} asChild>
                  <NavLink to="/clients" className={navLinkClass} activeProps={navActiveProps}>
                    <Users className="shrink-0" size={16} /> <span>{t("clients:clients", {defaultValue: "Clients"})}</span>
                  </NavLink>
                </Button>
              </li>
            </Can>
            <Can subject={user} capability="billing.read">
              <li>
                <Button color="neutral" variant="ghost" size="lg" className={navButtonClass} asChild>
                  <NavLink to="/billing" className={navLinkClass} activeProps={navActiveProps}>
                    <BadgeDollarSign className="shrink-0" size={16} /> <span>{t("billing:billing", {defaultValue: "Billing"})}</span>
                  </NavLink>
                </Button>
              </li>
            </Can>
            <Can subject={user} capability="billing.read">
              <li>
                <Button color="neutral" variant="ghost" size="lg" className={navButtonClass} asChild>
                  <NavLink to="/reports" className={navLinkClass} activeProps={navActiveProps}>
                    <FileChartColumn className="shrink-0" size={16} /> <span>{t("reports:reports", {defaultValue: "Reports"})}</span>
                  </NavLink>
                </Button>
              </li>
            </Can>
            <Can subject={user} capability="fleet.read">
              <li>
                <Button color="neutral" variant="ghost" size="lg" className={navButtonClass} asChild>
                  <NavLink to="/fleet" className={navLinkClass} activeProps={navActiveProps}>
                    <Server className="shrink-0" size={16} /> <span>{t("fleet:fleet", {defaultValue: "Fleet"})}</span>
                  </NavLink>
                </Button>
              </li>
            </Can>
            <li>
              <Button color="neutral" variant="ghost" size="lg" className={navButtonClass} asChild>
                <NavLink to="/tasks" className={navLinkClass} activeProps={navActiveProps}>
                  <ListTodo className="shrink-0" size={16} /> <span>{t("common:tasks", {defaultValue: "Tasks"})}</span>
                  {dueCount ? <span className="bg-accent text-accent-emphasis ml-auto rounded-full px-2 text-xs font-semibold tabular-nums">{dueCount}</span> : null}
                </NavLink>
              </Button>
            </li>
            <Can subject={user} capability="announcement.write">
              <li>
                <Button color="neutral" variant="ghost" size="lg" className={navButtonClass} asChild>
                  <NavLink to="/announcements" className={navLinkClass} activeProps={navActiveProps}>
                    <Megaphone className="shrink-0" size={16} /> <span>{t("common:announcements", {defaultValue: "Announcements"})}</span>
                  </NavLink>
                </Button>
              </li>
            </Can>
            <CanAny subject={user} capabilities={["team.read", "role.read", "audit.read", "client.read"]}>
              <li>
                <Button color="neutral" variant="ghost" size="lg" className={navButtonClass} asChild>
                  <NavLink to="/administration" className={navLinkClass} activeProps={navActiveProps}>
                    <Building2 className="shrink-0" size={16} /> <span>{t("team:administration", {defaultValue: "Administration"})}</span>
                  </NavLink>
                </Button>
              </li>
            </CanAny>
          </ul>
        </nav>
        {mock ? (
          <div className="border-border-secondary text-on-surface-secondary mb-4 rounded-lg border p-3 text-xs">
            {t("common:mockNotice", {defaultValue: "Demo data. Every change lives in this tab until it reloads. Set VITE_API_MOCK to empty to use the API."})}
          </div>
        ) : null}
      </aside>
      <div className="mx-auto w-full max-w-7xl min-w-0">
        <div className="bg-surface sticky top-0 z-[15] flex h-24 items-center px-4 sm:h-32">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-4">
              <Button size="lg" className="hidden sm:inline-flex lg:hidden" icon={true} color="neutral" variant="fill" onClick={() => setOpen(true)}>
                <Menu size={20} />
              </Button>
              {match && match.context.backLink ? (
                <Button size="lg" icon={true} color="neutral" variant="fill" asChild>
                  <Link {...match.context.backLink}>
                    <ArrowLeft size={20} />
                  </Link>
                </Button>
              ) : null}
              {mock ? (
                <Tag color="yellow" className="hidden sm:inline-flex">
                  {t("common:demoData", {defaultValue: "Demo data"})}
                </Tag>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Tooltip content={t("common:searchShortcut", {defaultValue: "Search  ⌘K"})}>
                <Button size="lg" icon={true} color="neutral" variant="fill" onClick={() => setSearchOpen(true)} aria-label={t("common:search", {defaultValue: "Search"})}>
                  <Search size={20} />
                </Button>
              </Tooltip>
              <Tooltip content={t("common:dueTasks", {defaultValue: "{{count}} of your tasks overdue or due today", count: dueCount})}>
                <Button size="lg" icon={true} color="neutral" variant="fill" asChild aria-label={t("common:tasks", {defaultValue: "Tasks"})}>
                  <Link to="/tasks" className="relative">
                    <ListTodo size={20} />
                    {dueCount ? <span className="bg-error-bright absolute top-2 right-2 size-2 rounded-full" /> : null}
                  </Link>
                </Button>
              </Tooltip>
              <Show when={user}>
                <NavLink to="/settings" className="hover:bg-neutral flex cursor-pointer items-center gap-2 rounded-lg p-2">
                  <div className="bg-neutral hover:bg-neutral-active flex h-11 w-11 items-center justify-center rounded-full tracking-tighter uppercase">
                    {user.firstName.slice(0, 1)}
                    {user.lastName.slice(0, 1)}
                  </div>
                  <span className="hidden flex-col leading-tight sm:flex">
                    <span>
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="text-on-surface-secondary text-xs">{user.role.name}</span>
                  </span>
                  <ChevronRight size={20} className="transition-transform duration-200" />
                </NavLink>
              </Show>
            </div>
          </div>
        </div>
        <div className="px-4">
          <ActiveSessionBanner user={user} />
        </div>
        {/* Room for whichever is taller on a phone: the tab bar, or a page's Save bar over it. */}
        <div className="pb-[calc(max(var(--fixed-footer-height,0px),4.25rem+env(safe-area-inset-bottom,0px))+1.5rem)] md:pb-16">
          <Outlet />
        </div>
        {/* The dash's bar, class for class. */}
        <div className="bg-surface-200 fixed right-0 bottom-0 left-0 z-10 flex h-[calc(4rem+env(safe-area-inset-bottom,0px))] items-center justify-center pb-[env(safe-area-inset-bottom,0px)] sm:hidden">
          <ul className="flex w-full items-center">
            <li className="w-full">
              <NavLink to="/" className={barLinkClass} activeProps={navActiveProps} activeOptions={{exact: true}}>
                <House size={16} />
                <span className="text-sm">{t("common:overview", {defaultValue: "Overview"})}</span>
              </NavLink>
            </li>
            <Can subject={user} capability="client.read">
              <li className="w-full">
                <NavLink to="/clients" className={barLinkClass} activeProps={navActiveProps}>
                  <Users size={16} />
                  <span className="text-sm">{t("clients:clients", {defaultValue: "Clients"})}</span>
                </NavLink>
              </li>
            </Can>
            <Can subject={user} capability="billing.read">
              <li className="w-full">
                <NavLink to="/billing" className={barLinkClass} activeProps={navActiveProps}>
                  <BadgeDollarSign size={16} />
                  <span className="text-sm">{t("billing:billing", {defaultValue: "Billing"})}</span>
                </NavLink>
              </li>
            </Can>
            <Can subject={user} capability="fleet.read">
              <li className="w-full">
                <NavLink to="/fleet" className={barLinkClass} activeProps={navActiveProps}>
                  <Server size={16} />
                  <span className="text-sm">{t("fleet:fleet", {defaultValue: "Fleet"})}</span>
                </NavLink>
              </li>
            </Can>
            <li className="w-full">
              <button type="button" onClick={() => setOpen(true)} className={barLinkClass}>
                <Menu size={16} />
                <span className="text-sm">{t("common:more", {defaultValue: "More"})}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
