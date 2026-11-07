import {useMutation, useQueryClient, type Query} from "@tanstack/react-query";
import {addDays, nextMonday, setHours, setMinutes, startOfDay} from "date-fns";
import {listOperatorsOptions, updateTaskMutation, type Operator, type SignedInOperator, type Task, type UpdateTaskData} from "@/api";
import {useToast} from "@/components/toaster";

function queryID(query: Query) {
  return (query.queryKey[0] as {_id?: string} | undefined)?._id;
}

let isTaskList = (query: Query) => queryID(query) === "listTasks";
let isTaskQuery = (query: Query) => ["listTasks", "getTaskCounts"].includes(queryID(query) ?? "");

function patch(task: Task, body: UpdateTaskData, me: SignedInOperator, team: Operator[] | undefined): Task {
  let next: Task = {...task};
  if (body.title !== undefined) next.title = body.title;
  if (body.description !== undefined) next.description = body.description || undefined;
  if (body.kind) next.kind = body.kind;
  if (body.priority) next.priority = body.priority;
  if (body.dueAt !== undefined) next.dueAt = body.dueAt ?? undefined;
  if (body.assigneeID !== undefined) {
    let operator = body.assigneeID === me.id ? me : team?.find((o) => o.id === body.assigneeID);
    next.assignee = operator ? {id: operator.id, name: `${operator.firstName} ${operator.lastName}`} : undefined;
  }
  if (body.status && body.status !== task.status) {
    next.status = body.status;
    next.completedAt = body.status === "done" ? new Date().toISOString() : undefined;
    next.completedBy = body.status === "done" ? {id: me.id, name: `${me.firstName} ${me.lastName}`} : undefined;
  }
  return next;
}

/**
 * Changing a task where it sits. The change is written into every task list in the cache at once
 * and the lists are not re-read: a task ticked in "Mine" or un-ticked in "Done" stays put, crossed
 * out or restored, instead of vanishing from under the pointer. The lists are only marked stale, so
 * they re-sort the next time they are opened. A failure puts every list back as it was.
 */
export function useUpdateTask(me: SignedInOperator) {
  let queryClient = useQueryClient();
  let toast = useToast();
  return useMutation({
    ...updateTaskMutation(),
    onMutate: async ({body}) => {
      await queryClient.cancelQueries({predicate: isTaskList});
      let team = queryClient.getQueryData(listOperatorsOptions().queryKey)?.operators;
      let snapshots = queryClient.getQueriesData<{tasks: Task[]}>({predicate: isTaskList});
      for (let [key, data] of snapshots) {
        if (data) queryClient.setQueryData(key, {tasks: data.tasks.map((task) => (task.id === body.id ? patch(task, body, me, team) : task))});
      }
      return {snapshots};
    },
    onError: (err, _vars, context) => {
      for (let [key, data] of context?.snapshots ?? []) queryClient.setQueryData(key, data);
      toast({tone: "error", title: err.message});
    },
    onSuccess: (task) => {
      for (let [key, data] of queryClient.getQueriesData<{tasks: Task[]}>({predicate: isTaskList})) {
        if (data) queryClient.setQueryData(key, {tasks: data.tasks.map((t) => (t.id === task.id ? task : t))});
      }
      queryClient.invalidateQueries({predicate: isTaskQuery, refetchType: "none"});
      queryClient.invalidateQueries({predicate: (query) => queryID(query) === "getTaskCounts"});
    },
  });
}

/** The day a snooze moves a task to, at the end of the working day so it reads as "that day". */
export function snoozeTo(target: "today" | "tomorrow" | "nextWeek" | "inThreeDays") {
  let today = startOfDay(new Date());
  let day = target === "today" ? today : target === "tomorrow" ? addDays(today, 1) : target === "inThreeDays" ? addDays(today, 3) : nextMonday(today);
  return setMinutes(setHours(day, 18), 0).toISOString();
}
