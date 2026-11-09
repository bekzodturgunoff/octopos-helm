import {useEffect, useRef, useState} from "react";
import {useNavigate} from "@tanstack/react-router";
import {useTranslation} from "react-i18next";
import {ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle} from "@yeahuz/kdsx-react";

let JUMPS: {key: string; to: string; label: string}[] = [
  {key: "o", to: "/", label: "Overview"},
  {key: "c", to: "/clients", label: "Clients"},
  {key: "b", to: "/billing", label: "Billing"},
  {key: "d", to: "/billing/overdue", label: "Overdue"},
  {key: "r", to: "/billing/reports", label: "Reports"},
  {key: "f", to: "/fleet", label: "Fleet"},
  {key: "t", to: "/tasks", label: "Tasks"},
  {key: "a", to: "/administration/announcements", label: "Announcements"},
  {key: "s", to: "/settings", label: "Settings"},
];

function typing(target: EventTarget | null) {
  let el = target as HTMLElement | null;
  return Boolean(el?.closest("input, textarea, select, [contenteditable=true], [role=dialog]"));
}

/**
 * Gmail-style: "g" then a letter jumps to a section, "/" puts the cursor in the page's search,
 * "?" shows this list. Nothing fires while typing or inside a dialog.
 */
export function Shortcuts() {
  let {t} = useTranslation();
  let navigate = useNavigate();
  let [open, setOpen] = useState(false);
  let pendingG = useRef<number | undefined>(undefined);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key === "/") {
        let input = document.querySelector<HTMLInputElement>("main input[type=text]:not([disabled]), .max-w-7xl input:not([type]):not([disabled]), .max-w-7xl input[type=text]:not([disabled])");
        if (input) {
          e.preventDefault();
          input.focus();
          input.select();
        }
        return;
      }
      if (pendingG.current !== undefined) {
        window.clearTimeout(pendingG.current);
        pendingG.current = undefined;
        let jump = JUMPS.find((j) => j.key === e.key.toLowerCase());
        if (jump) {
          e.preventDefault();
          navigate({to: jump.to});
        }
        return;
      }
      if (e.key === "g") pendingG.current = window.setTimeout(() => (pendingG.current = undefined), 1200);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  let row = (keys: string[], label: string) => (
    <li key={label} className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span>{label}</span>
      <span className="flex gap-1">
        {keys.map((k) => (
          <kbd key={k} className="border-border-secondary bg-surface-300 min-w-6 rounded-md border px-1.5 py-0.5 text-center text-xs">
            {k}
          </kbd>
        ))}
      </span>
    </li>
  );

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("common:shortcuts", {defaultValue: "Keyboard shortcuts"})}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          <ul>
            {row(["⌘", "K"], t("common:shortcutSearch", {defaultValue: "Search everything"}))}
            {row(["/"], t("common:shortcutFocus", {defaultValue: "Search this page"}))}
            {row(["N"], t("common:shortcutNewTask", {defaultValue: "New task (on Tasks)"}))}
            {row(["?"], t("common:shortcutHelp", {defaultValue: "This list"}))}
          </ul>
          <ul>{JUMPS.map((jump) => row(["G", jump.key.toUpperCase()], t(`common:page.${jump.label}`, {defaultValue: jump.label})))}</ul>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
