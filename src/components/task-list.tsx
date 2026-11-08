import {useState} from "react";
import {getRouteApi, Link} from "@tanstack/react-router";
import {useQuery} from "@tanstack/react-query";
import {useTranslation} from "react-i18next";
import {Button, DateInput, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, Select, Textarea} from "@yeahuz/kdsx-react";
import {AlarmClock, Building2, Check, MoreHorizontal, Phone, Receipt, Wrench, ListTodo, AlignLeft} from "lucide-react";
import {listOperatorsOptions, type Task, type TaskKind, type TaskPriority} from "@/api";
import {FormDialog, FormField} from "@/components/form-dialog";
import {useToast} from "@/components/toaster";
import {snoozeTo, useUpdateTask} from "@/lib/tasks";
import {daysUntil, formatDateTime, formatDue} from "@/lib/format";
import {cn} from "@/lib/utils";

let authRoute = getRouteApi("/_auth");

let KIND_ICON: Record<TaskKind, React.ElementType> = {
  followUp: ListTodo,
  call: Phone,
  payment: Receipt,
  install: Wrench,
  other: ListTodo,
};

export function kindLabel(t: ReturnType<typeof useTranslation>["t"], kind: TaskKind) {
  let defaults: Record<TaskKind, string> = {followUp: "Follow-up", call: "Call", payment: "Payment", install: "Install", other: "Other"};
  return t(`common:taskKind.${kind}`, {defaultValue: defaults[kind]});
}

export function priorityLabel(t: ReturnType<typeof useTranslation>["t"], priority: TaskPriority) {
  let defaults: Record<TaskPriority, string> = {high: "High", normal: "Normal", low: "Low"};
  return t(`common:priority.${priority}`, {defaultValue: defaults[priority]});
}

/**
 * Tasks with a tick, a menu and a click-to-edit. Ticking changes the row where it is — crossed out
 * in an open list, restored in "Done" — and offers Undo; the list re-sorts the next time it opens.
 */
export function TaskList({tasks, compact = false}: {tasks: Task[]; compact?: boolean}) {
  let [editing, setEditing] = useState<Task>();
  return (
    <>
      <ul className="flex flex-col gap-1">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} compact={compact} onEdit={() => setEditing(task)} />
        ))}
      </ul>
      {editing ? <EditTaskDialog task={editing} onClose={() => setEditing(undefined)} /> : null}
    </>
  );
}

function TaskRow({task, compact, onEdit}: {task: Task; compact: boolean; onEdit: () => void}) {
  let {t} = useTranslation();
  let {user} = authRoute.useRouteContext();
  let toast = useToast();
  let update = useUpdateTask(user);
  let done = task.status === "done";
  let late = !done && task.dueAt ? daysUntil(task.dueAt) < 0 : false;
  let today = !done && task.dueAt ? daysUntil(task.dueAt) === 0 : false;
  let KindIcon = KIND_ICON[task.kind];

  // Through the mutation's promise, not mutate's callbacks: those belong to this row, and a row can
  // be re-rendered elsewhere by the time the answer comes back. The toast must not depend on it.
  function announce(body: Parameters<typeof update.mutateAsync>[0]["body"], message: string, undo: Parameters<typeof update.mutateAsync>[0]["body"]) {
    update
      .mutateAsync({body})
      .then(() =>
        toast({
          tone: "success",
          title: message,
          action: {label: t("common:undo", {defaultValue: "Undo"}), onClick: () => update.mutateAsync({body: undo}).catch(() => {})},
        }),
      )
      .catch(() => {});
  }

  function toggle() {
    let next: Task["status"] = done ? "open" : "done";
    announce(
      {id: task.id, status: next},
      next === "done" ? t("common:taskDone", {defaultValue: "Done: {{title}}", title: task.title}) : t("common:taskReopened", {defaultValue: "Reopened: {{title}}", title: task.title}),
      {id: task.id, status: task.status},
    );
  }

  function quick(body: Parameters<typeof update.mutateAsync>[0]["body"], message: string) {
    announce(body, message, {
      id: task.id,
      ...("dueAt" in body ? {dueAt: task.dueAt ?? null} : {}),
      ...("assigneeID" in body ? {assigneeID: task.assignee?.id ?? null} : {}),
      ...("priority" in body ? {priority: task.priority} : {}),
    });
  }

  return (
    <li className={cn("group hover:bg-surface-300 flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors")}>
      <button
        type="button"
        aria-label={done ? t("common:reopen", {defaultValue: "Reopen"}) : t("common:markDone", {defaultValue: "Mark done"})}
        aria-pressed={done}
        onClick={toggle}
        // The pseudo-element widens the tap target to 40px without moving the box.
        className={cn(
          "border-border hover:border-accent relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors before:absolute before:-inset-2.5 before:content-['']",
          {
            "bg-accent border-accent text-accent-emphasis": done,
            "border-error-bright": late,
          },
        )}
      >
        <Check size={14} strokeWidth={3} className={cn("duration-200", done ? "scale-100" : "scale-0")} />
      </button>
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 cursor-pointer flex-col text-left">
        <span className={cn("transition-colors", {"text-on-surface-secondary line-through": done})}>
          {task.priority === "high" && !done ? <span className="text-error-bright mr-1 font-semibold">!</span> : null}
          {task.title}
        </span>
        {task.description && !compact ? (
          <span className="text-on-surface-secondary flex items-start gap-1 truncate text-sm">
            <AlignLeft size={12} className="mt-1 shrink-0" />
            <span className="truncate">{task.description}</span>
          </span>
        ) : null}
        <span className="text-on-surface-secondary flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm">
          <span className="flex items-center gap-1">
            <KindIcon size={12} /> {kindLabel(t, task.kind)}
          </span>
          {!compact && task.clientID ? (
            <Link to="/clients/$id" params={{id: task.clientID}} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 hover:underline">
              <Building2 size={12} /> {task.clientName}
            </Link>
          ) : null}
          {task.assignee ? (
            <span>{task.assignee.id === user.id ? t("common:you", {defaultValue: "You"}) : task.assignee.name}</span>
          ) : (
            <span className="text-on-surface-yellow">{t("common:unassigned", {defaultValue: "Unassigned"})}</span>
          )}
          {done ? (
            <span>{t("common:completedBy", {defaultValue: "done by {{name}} · {{when}}", name: task.completedBy?.name ?? "—", when: formatDateTime(task.completedAt)})}</span>
          ) : task.dueAt ? (
            <span className={cn({"text-error-bright": late, "text-on-surface-accent": today})}>
              {late
                ? t("common:overdueWhen", {defaultValue: "overdue · was due {{when}}", when: formatDue(task.dueAt)})
                : t("common:dueWhen", {defaultValue: "due {{when}}", when: formatDue(task.dueAt)})}
            </span>
          ) : (
            <span>{t("common:noDueDate", {defaultValue: "no due date"})}</span>
          )}
        </span>
      </button>
      {!done ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="xs" color="neutral" variant="ghost" icon aria-label={t("common:more", {defaultValue: "More"})} className="shrink-0 opacity-60 group-hover:opacity-100">
              <MoreHorizontal size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>{t("common:edit", {defaultValue: "Edit"})}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => quick({id: task.id, dueAt: snoozeTo("tomorrow")}, t("common:snoozedTomorrow", {defaultValue: "Moved to tomorrow"}))}>
              <AlarmClock size={14} className="mr-2" /> {t("common:snoozeTomorrow", {defaultValue: "Tomorrow"})}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => quick({id: task.id, dueAt: snoozeTo("inThreeDays")}, t("common:snoozedThree", {defaultValue: "Moved 3 days out"}))}>
              <AlarmClock size={14} className="mr-2" /> {t("common:snoozeThree", {defaultValue: "In 3 days"})}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => quick({id: task.id, dueAt: snoozeTo("nextWeek")}, t("common:snoozedNextWeek", {defaultValue: "Moved to next Monday"}))}>
              <AlarmClock size={14} className="mr-2" /> {t("common:snoozeNextWeek", {defaultValue: "Next Monday"})}
            </DropdownMenuItem>
            {task.assignee?.id !== user.id ? (
              <DropdownMenuItem onSelect={() => quick({id: task.id, assigneeID: user.id}, t("common:assignedToYou", {defaultValue: "Assigned to you"}))}>
                {t("common:assignToMe", {defaultValue: "Assign to me"})}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => quick({id: task.id, assigneeID: null}, t("common:unassignedDone", {defaultValue: "Back to the unassigned queue"}))}>
                {t("common:unassign", {defaultValue: "Unassign"})}
              </DropdownMenuItem>
            )}
            {task.priority !== "high" ? (
              <DropdownMenuItem onSelect={() => quick({id: task.id, priority: "high"}, t("common:markedUrgent", {defaultValue: "Marked high priority"}))}>
                {t("common:markUrgent", {defaultValue: "Mark high priority"})}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => quick({id: task.id, priority: "normal"}, t("common:markedNormal", {defaultValue: "Back to normal priority"}))}>
                {t("common:markNormal", {defaultValue: "Normal priority"})}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}

function EditTaskDialog({task, onClose}: {task: Task; onClose: () => void}) {
  let {t} = useTranslation();
  let {user} = authRoute.useRouteContext();
  let update = useUpdateTask(user);
  let {data} = useQuery(listOperatorsOptions());
  let text = (form: FormData, key: string) => ((form.get(key) as string | null) ?? "").trim();
  return (
    <FormDialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("common:editTask", {defaultValue: "Edit task"})}
      description={t("common:taskCreatedBy", {defaultValue: "Created by {{name}} · {{when}}", name: task.createdBy.name, when: formatDateTime(task.createdAt)})}
      action={t("common:save", {defaultValue: "Save"})}
      success={t("common:taskSaved", {defaultValue: "Task saved"})}
      onSubmit={(form) =>
        update.mutateAsync({
          body: {
            id: task.id,
            title: text(form, "title"),
            description: text(form, "description"),
            kind: text(form, "kind") as TaskKind,
            priority: text(form, "priority") as TaskPriority,
            assigneeID: text(form, "assigneeID") || null,
            dueAt: text(form, "dueAt") ? new Date(`${text(form, "dueAt")}T18:00:00`).toISOString() : null,
          },
        })
      }
    >
      <FormField label={t("common:title", {defaultValue: "Title"})} htmlFor="title">
        <Input id="title" name="title" required defaultValue={task.title} />
      </FormField>
      <FormField label={t("common:details", {defaultValue: "Details"})} htmlFor="description">
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={task.description}
          placeholder={t("common:detailsPlaceholder", {defaultValue: "What was promised, who to call, what to bring…"})}
        />
      </FormField>
      <TaskFields task={task} operators={data?.operators.filter((o) => o.status === "active") ?? []} />
      {task.clientID ? (
        <Link to="/clients/$id" params={{id: task.clientID}} className="text-on-surface-accent text-sm hover:underline" onClick={onClose}>
          {t("common:openClient", {defaultValue: "Open {{name}}", name: task.clientName})}
        </Link>
      ) : null}
    </FormDialog>
  );
}

/** Kind, priority, assignee and due date — shared by the edit dialog and the new-task dialog. */
export function TaskFields({task, operators}: {task?: Partial<Task>; operators: {id: string; firstName: string; lastName: string}[]}) {
  let {t} = useTranslation();
  let dueDefault = task ? (task.dueAt ? toDateInput(task.dueAt) : "") : toDateInput(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("common:kind", {defaultValue: "Kind"})} htmlFor="kind">
          <Select id="kind" name="kind" defaultValue={task?.kind ?? "followUp"}>
            {(["followUp", "call", "payment", "install", "other"] as TaskKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {kindLabel(t, kind)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t("common:priorityLabel", {defaultValue: "Priority"})} htmlFor="priority">
          <Select id="priority" name="priority" defaultValue={task?.priority ?? "normal"}>
            {(["high", "normal", "low"] as TaskPriority[]).map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabel(t, priority)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("common:assignee", {defaultValue: "Assignee"})} htmlFor="assigneeID">
          <Select id="assigneeID" name="assigneeID" defaultValue={task?.assignee?.id ?? ""} key={operators.length}>
            <option value="">{t("common:unassigned", {defaultValue: "Unassigned"})}</option>
            {operators.map((o) => (
              <option key={o.id} value={o.id}>
                {o.firstName} {o.lastName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t("common:due", {defaultValue: "Due"})} htmlFor="dueAt">
          <DateInput id="dueAt" name="dueAt" defaultValue={dueDefault} />
        </FormField>
      </div>
    </>
  );
}

function toDateInput(iso: string) {
  let d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
