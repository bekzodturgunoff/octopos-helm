import {FormEvent, Suspense, useEffect, useRef, useState} from "react";
import {useMutation, useQuery, useQueryClient, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {Button, Input, Select, Tabs, TabsList, TabsTrigger} from "@yeahuz/kdsx-react";
import {CheckCheck, Inbox, ListTodo, Plus, Search} from "lucide-react";
import {useTranslation} from "react-i18next";
import {isToday, isYesterday, startOfDay} from "date-fns";
import {createTaskMutation, getTaskCountsOptions, listTasksOptions, type ListTasksQuery, type Task, type TaskKind, type TaskPriority} from "@/api";
import {PageHeader} from "@/components/page-header";
import {TaskList, kindLabel, priorityLabel} from "@/components/task-list";
import {NewTaskDialog} from "@/components/client-actions";
import {FilterSelect} from "@/components/filter-bar";
import {EmptyState} from "@/components/empty-state";
import {SectionHeader} from "@/components/form-section";
import {ListSkeleton} from "@/components/skeletons";
import {useToast} from "@/components/toaster";
import {useDebounced} from "@/hooks";
import {daysUntil} from "@/lib/format";
import {snoozeTo} from "@/lib/tasks";
import {can, Can} from "@/permission";
import {cn} from "@/lib/utils";

type View = "mine" | "team" | "unassigned" | "done";
type Search = {view?: View; q?: string; priority?: TaskPriority; kind?: TaskKind};

export let Route = createFileRoute("/_auth/tasks")({
  beforeLoad: () => ({backLink: {to: "/"}}),
  validateSearch: (search: Record<string, unknown>): Search => ({
    view: (search.view as View) || undefined,
    q: (search.q as string) || undefined,
    priority: (search.priority as TaskPriority) || undefined,
    kind: (search.kind as TaskKind) || undefined,
  }),
  component: Tasks,
});

function Tasks() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let search = Route.useSearch();
  let view = search.view ?? "mine";
  let navigate = Route.useNavigate();
  let {data: counts} = useQuery(getTaskCountsOptions());
  let [q, setQ] = useState(search.q ?? "");
  let settled = useDebounced(q, 250);
  let [creating, setCreating] = useState(false);

  useEffect(() => {
    if ((settled || undefined) === search.q) return;
    navigate({search: (prev) => ({...prev, q: settled || undefined}), replace: true});
  }, [settled, search.q, navigate]);

  // "n" opens a new task from anywhere on the page, unless somebody is typing.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      let target = e.target as HTMLElement;
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey || target.closest("input, textarea, select, [contenteditable]")) return;
      if (!can(user, "task.write")) return;
      e.preventDefault();
      setCreating(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [user]);

  let tab = (value: View, label: string, count?: number) => (
    <TabsTrigger value={value} className="gap-1.5">
      {label}
      {count ? <span className="bg-neutral-active text-on-surface-secondary rounded-md px-1.5 text-xs tabular-nums">{count}</span> : null}
    </TabsTrigger>
  );

  return (
    <div className="flex flex-col gap-8 px-4">
      <PageHeader
        title={t("common:tasks", {defaultValue: "Tasks"})}
        subtitle={
          counts && (counts.overdue || counts.dueToday)
            ? [
                counts.overdue ? t("common:overdueCount", {defaultValue: "{{count}} overdue", count: counts.overdue}) : null,
                counts.dueToday ? t("common:dueTodayCount", {defaultValue: "{{count}} due today", count: counts.dueToday}) : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : t("common:tasksHint", {defaultValue: "Follow-ups, calls and installs, each tied to the client it is about."})
        }
      >
        <Can subject={user} capability="task.write">
          <NewTaskDialog
            open={creating}
            onOpenChange={setCreating}
            trigger={
              <Button size="sm" color="brand">
                {t("common:newTask", {defaultValue: "New task"})} <kbd className="ml-1 hidden rounded border border-current/30 px-1 text-[10px] opacity-70 sm:inline">N</kbd>
              </Button>
            }
          />
        </Can>
      </PageHeader>

      <Can subject={user} capability="task.write">
        <QuickAdd />
      </Can>

      <div className="flex flex-col gap-3">
        <Tabs value={view} onValueChange={(value) => navigate({search: (prev) => ({...prev, view: value === "mine" ? undefined : (value as View)}), replace: true})}>
          <TabsList className="overflow-x-auto">
            {tab("mine", t("common:myTasks", {defaultValue: "Mine"}), counts?.mine)}
            {tab("team", t("common:teamTasks", {defaultValue: "Everyone"}), counts?.everyone)}
            {tab("unassigned", t("common:unassignedTasks", {defaultValue: "Unassigned"}), counts?.unassigned)}
            {tab("done", t("common:doneTasks", {defaultValue: "Done"}))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("common:searchTasks", {defaultValue: "Search tasks or clients"})}
            startAdornment={<Search size={16} className="text-on-surface-secondary" />}
          />
          <div className="flex gap-2">
            <FilterSelect
              label={t("common:anyPriority", {defaultValue: "Any priority"})}
              value={search.priority}
              onChange={(priority) => navigate({search: (prev) => ({...prev, priority: priority as TaskPriority | undefined}), replace: true})}
              options={(["high", "normal", "low"] as TaskPriority[]).map((value) => ({value, label: priorityLabel(t, value)}))}
            />
            <FilterSelect
              label={t("common:anyKind", {defaultValue: "Any kind"})}
              value={search.kind}
              onChange={(kind) => navigate({search: (prev) => ({...prev, kind: kind as TaskKind | undefined}), replace: true})}
              options={(["followUp", "call", "payment", "install", "other"] as TaskKind[]).map((value) => ({value, label: kindLabel(t, value)}))}
            />
          </div>
        </div>
      </div>

      <Suspense fallback={<ListSkeleton rows={6} />}>
        {/* Keyed by view so each tab starts with fresh placements. */}
        <TaskGroups key={view} view={view} search={search} />
      </Suspense>
    </div>
  );
}

/**
 * One line, Enter, done: a task for yourself without a dialog. The due date is the only thing worth
 * choosing up front; everything else can be set by clicking the task.
 */
function QuickAdd() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let toast = useToast();
  let queryClient = useQueryClient();
  let [due, setDue] = useState<"today" | "tomorrow" | "nextWeek" | "none">("today");
  let create = useMutation({
    ...createTaskMutation(),
    onSuccess: (task) => {
      // Into the lists it belongs in, rather than re-reading them: a re-read would also drop the
      // tasks just ticked off, which stay visible until the page is next opened.
      let mine = listTasksOptions({query: queryFor("mine", user.id, {})}).queryKey;
      let everyone = listTasksOptions({query: queryFor("team", user.id, {})}).queryKey;
      for (let key of [mine, everyone]) queryClient.setQueryData(key, (data: {tasks: Task[]} | undefined) => (data ? {tasks: [task, ...data.tasks]} : data));
      queryClient.invalidateQueries({predicate: (query) => (query.queryKey[0] as {_id?: string})?._id === "listTasks", refetchType: "none"});
      queryClient.invalidateQueries({predicate: (query) => (query.queryKey[0] as {_id?: string})?._id === "getTaskCounts"});
      toast({tone: "success", title: t("common:taskAdded", {defaultValue: "Added: {{title}}", title: task.title})});
    },
    onError: (err) => toast({tone: "error", title: err.message}),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let form = e.target as HTMLFormElement;
    let title = (new FormData(form).get("title") as string).trim();
    if (!title) return;
    create.mutate({body: {title, kind: "followUp", priority: "normal", assigneeID: user.id, dueAt: due === "none" ? undefined : snoozeTo(due)}}, {onSuccess: () => form.reset()});
  }

  return (
    <form onSubmit={onSubmit} className="bg-surface-300 flex flex-col gap-2 rounded-xl p-2 sm:flex-row sm:items-center">
      <Input
        name="title"
        className="flex-1"
        placeholder={t("common:quickAdd", {defaultValue: "Add a task for yourself and press Enter"})}
        startAdornment={<Plus size={16} className="text-on-surface-secondary" />}
        autoComplete="off"
      />
      <div className="flex gap-2">
        <Select aria-label={t("common:due", {defaultValue: "Due"})} value={due} onChange={(e) => setDue(e.target.value as typeof due)} className="w-auto min-w-32">
          <option value="today">{t("common:today", {defaultValue: "Today"})}</option>
          <option value="tomorrow">{t("common:tomorrow", {defaultValue: "Tomorrow"})}</option>
          <option value="nextWeek">{t("common:nextWeek", {defaultValue: "Next week"})}</option>
          <option value="none">{t("common:noDate", {defaultValue: "No date"})}</option>
        </Select>
        <Button size="sm" color="brand" loading={create.isPending} disabled={create.isPending}>
          {t("common:add", {defaultValue: "Add"})}
        </Button>
      </div>
    </form>
  );
}

function queryFor(view: View, userID: string, search: Search): ListTasksQuery {
  let base: ListTasksQuery = {q: search.q, priority: search.priority, kind: search.kind};
  switch (view) {
    case "mine":
      return {...base, status: "open", assigneeID: userID};
    case "unassigned":
      return {...base, status: "open", unassigned: true};
    case "done":
      return {...base, status: "done"};
    default:
      return {...base, status: "open"};
  }
}

type Group = {key: string; title: string; tone?: "late" | "today"; tasks: Task[]};

function openGroups(t: ReturnType<typeof useTranslation>["t"], tasks: Task[], place: (task: Task, key: string) => string): Group[] {
  // Overdue, today, tomorrow, this week, later, someday: the order a day is actually worked in.
  let groups: Group[] = [
    {key: "late", title: t("common:overdue", {defaultValue: "Overdue"}), tone: "late", tasks: []},
    {key: "today", title: t("common:today", {defaultValue: "Today"}), tone: "today", tasks: []},
    {key: "tomorrow", title: t("common:tomorrow", {defaultValue: "Tomorrow"}), tasks: []},
    {key: "week", title: t("common:thisWeek", {defaultValue: "This week"}), tasks: []},
    {key: "later", title: t("common:later", {defaultValue: "Later"}), tasks: []},
    {key: "someday", title: t("common:noDueDate", {defaultValue: "No due date"}), tasks: []},
  ];
  for (let task of tasks) {
    // A task ticked here keeps its place in the group it was in until the list is opened again.
    let days = task.dueAt ? daysUntil(task.dueAt) : undefined;
    let natural = days === undefined ? "someday" : days < 0 ? "late" : days === 0 ? "today" : days === 1 ? "tomorrow" : days <= 7 ? "week" : "later";
    let key = place(task, natural);
    groups.find((group) => group.key === key)!.tasks.push(task);
  }
  return groups.filter((group) => group.tasks.length);
}

function doneGroups(t: ReturnType<typeof useTranslation>["t"], tasks: Task[], place: (task: Task, key: string) => string): Group[] {
  let groups = new Map<string, Group>();
  for (let task of tasks) {
    let key = place(task, startOfDay(new Date(task.completedAt ?? task.createdAt)).toISOString());
    let at = new Date(key);
    let title = isToday(at)
      ? t("common:today", {defaultValue: "Today"})
      : isYesterday(at)
        ? t("common:yesterday", {defaultValue: "Yesterday"})
        : at.toLocaleDateString("en", {weekday: "long", day: "numeric", month: "long"});
    if (!groups.has(key)) groups.set(key, {key, title, tasks: []});
    groups.get(key)!.tasks.push(task);
  }
  return [...groups.values()];
}

function TaskGroups({view, search}: {view: View; search: Search}) {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let {data} = useSuspenseQuery(listTasksOptions({query: queryFor(view, user.id, search)}));
  let filtered = Boolean(search.q || search.priority || search.kind);
  // Where each task was first drawn. Ticking, un-ticking or snoozing changes the dates a task is
  // grouped by; without this it would jump to another section, under the pointer, mid-click.
  let placements = useRef(new Map<string, string>());
  let place = (task: Task, natural: string) => {
    let known = placements.current.get(task.id);
    if (known) return known;
    placements.current.set(task.id, natural);
    return natural;
  };

  if (!data.tasks.length) {
    if (filtered) return <EmptyState icon={Search} title={t("common:noTasksMatch", {defaultValue: "No tasks match"})} />;
    if (view === "done") return <EmptyState icon={CheckCheck} title={t("common:nothingDone", {defaultValue: "Nothing finished yet"})} />;
    if (view === "unassigned") return <EmptyState icon={Inbox} title={t("common:triageEmpty", {defaultValue: "Every task has an owner"})} />;
    return (
      <EmptyState
        icon={ListTodo}
        title={t("common:inboxZero", {defaultValue: "Nothing to do"})}
        description={t("common:inboxZeroHint", {defaultValue: "Tasks assigned to you appear here, soonest first."})}
      />
    );
  }

  let groups = view === "done" ? doneGroups(t, data.tasks, place) : openGroups(t, data.tasks, place);
  let open = data.tasks.filter((task) => task.status === "open").length;

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-2">
          <SectionHeader
            title={
              <span className={cn({"text-error-bright": group.tone === "late", "text-on-surface-accent": group.tone === "today"})}>
                {group.title} · {group.tasks.length}
              </span>
            }
          />
          <TaskList tasks={group.tasks} />
        </section>
      ))}
      {view !== "done" && open === 0 ? (
        <p className="text-on-surface-secondary text-center text-sm">{t("common:allTicked", {defaultValue: "All ticked off. They move to Done when you next open this list."})}</p>
      ) : null}
    </div>
  );
}
