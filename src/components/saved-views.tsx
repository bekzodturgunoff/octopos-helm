import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {Link, useLocation} from "@tanstack/react-router";
import {useTranslation} from "react-i18next";
import {Button, Input} from "@yeahuz/kdsx-react";
import {Bookmark, Pin, PinOff, Trash2, Users} from "lucide-react";
import {createSavedViewMutation, deleteSavedViewMutation, listSavedViewsOptions, updateSavedViewMutation, type SavedView, type SignedInOperator} from "@/api";
import {FormDialog, FormField} from "@/components/form-dialog";
import {cn} from "@/lib/utils";

function clean(search: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(search).filter(([key, value]) => key !== "page" && value !== undefined && value !== "" && value !== null)) as SavedView["search"];
}

/** "Save view" on a filtered list. Only offered once there is something to save. */
export function SaveViewButton({path, search}: {path: SavedView["path"]; search: Record<string, unknown>}) {
  let {t} = useTranslation();
  let {mutationFn} = createSavedViewMutation();
  let params = clean(search);
  if (!Object.keys(params).length) return null;
  return (
    <FormDialog
      trigger={
        <Button size="sm" color="neutral" variant="outline">
          <Bookmark size={14} className="mr-1" />
          {t("common:saveView", {defaultValue: "Save view"})}
        </Button>
      }
      title={t("common:saveView", {defaultValue: "Save view"})}
      description={t("common:saveViewHint", {defaultValue: "Keeps these filters one click away, in the sidebar."})}
      action={t("common:save", {defaultValue: "Save"})}
      success={t("common:viewSaved", {defaultValue: "View saved to the sidebar"})}
      onSubmit={(form) => mutationFn({body: {name: String(form.get("name")), path, search: params, pinned: true, shared: form.get("shared") === "on"}})}
    >
      <FormField label={t("common:name", {defaultValue: "Name"})} htmlFor="name">
        <Input id="name" name="name" required autoFocus placeholder={t("common:viewNamePlaceholder", {defaultValue: "e.g. My Scale clients renewing soon"})} />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="shared" className="accent-accent" />
        {t("common:shareView", {defaultValue: "Share with the whole team"})}
      </label>
    </FormDialog>
  );
}

/** Pinned views in the sidebar, under the sections, active when the URL matches. */
export function SavedViewsNav({user}: {user: SignedInOperator}) {
  let {t} = useTranslation();
  let location = useLocation();
  let queryClient = useQueryClient();
  let {data} = useQuery({...listSavedViewsOptions(), staleTime: 60_000});
  let refresh = () => queryClient.invalidateQueries({predicate: (q) => (q.queryKey[0] as {_id?: string})?._id === "listSavedViews"});
  let update = useMutation({...updateSavedViewMutation(), onSuccess: refresh});
  let remove = useMutation({...deleteSavedViewMutation(), onSuccess: refresh});
  let pinned = data?.views.filter((v) => v.pinned) ?? [];
  let others = data?.views.filter((v) => !v.pinned) ?? [];
  if (!data?.views.length) return null;

  let current = new URLSearchParams(location.searchStr);
  let isActive = (view: SavedView) =>
    location.pathname === view.path &&
    Object.entries(view.search).every(([key, value]) => current.get(key) === String(value)) &&
    [...current.keys()].filter((k) => k !== "page").length === Object.keys(view.search).length;

  let row = (view: SavedView) => (
    <li key={view.id} className="group flex items-center">
      <Link
        to={view.path}
        search={view.search as never}
        className={cn("hover:bg-neutral flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm", {"text-on-surface-accent font-semibold": isActive(view)})}
      >
        {view.shared ? <Users size={14} className="shrink-0 opacity-70" /> : <Bookmark size={14} className="shrink-0 opacity-70" />}
        <span className="truncate">{view.name}</span>
      </Link>
      {view.owner.id === user.id ? (
        <span className="flex opacity-0 group-hover:opacity-100">
          <button
            type="button"
            aria-label={view.pinned ? t("common:unpin", {defaultValue: "Unpin"}) : t("common:pin", {defaultValue: "Pin"})}
            className="hover:text-on-surface-accent p-1"
            onClick={() => update.mutate({body: {id: view.id, pinned: !view.pinned}})}
          >
            {view.pinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
          <button type="button" aria-label={t("common:delete", {defaultValue: "Delete"})} className="hover:text-error-bright p-1" onClick={() => remove.mutate({body: {id: view.id}})}>
            <Trash2 size={13} />
          </button>
        </span>
      ) : null}
    </li>
  );

  return (
    <div className="mt-6 flex flex-col gap-1">
      <span className="text-on-surface-secondary px-3 text-xs font-medium">{t("common:savedViews", {defaultValue: "Saved views"})}</span>
      <ul className="flex flex-col">{pinned.map(row)}</ul>
      {others.length ? (
        <details className="px-3">
          <summary className="text-on-surface-secondary cursor-pointer py-1 text-xs">{t("common:moreViews", {defaultValue: "{{count}} more", count: others.length})}</summary>
          <ul className="-mx-3 flex flex-col">{others.map(row)}</ul>
        </details>
      ) : null}
    </div>
  );
}
