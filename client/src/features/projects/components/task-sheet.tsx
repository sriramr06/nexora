import { useId, useState, type FormEvent } from "react";
import { RefreshCwIcon, Trash2Icon, UserCheckIcon } from "lucide-react";
import { toast } from "sonner";
import {
  can,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  updateTaskSchema,
  type Project,
  type Task,
  type TaskPriority,
} from "@nexora/shared";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { toApiError } from "@/lib/api-error";
import { formatDateTime } from "@/features/organizations/labels";
import { useOrg } from "@/features/organizations/org-gate";
import {
  useDeleteTask,
  useProject,
  useSetAssignee,
  useTask,
  useTaskActivity,
  useUpdateTask,
} from "../projects-api";
import { describeActivity } from "./activity-text";
import { DueDate, PriorityLabel, TaskStatusBadge } from "./task-badges";

const factsFor = (project: Project, task: Task) => ({
  managerId: project.manager?.id ?? null,
  memberIds: project.members.map((m) => m.id),
  assigneeId: task.assignee?.id ?? null,
  createdBy: task.createdBy?.id ?? "",
});

// US-24: edit with optimistic concurrency. A 409 means someone saved first; the user
// chooses to load the latest version instead of silently overwriting it.
function DetailsForm({ task, editable }: { task: Task; editable: boolean }) {
  const { organization } = useOrg();
  const update = useUpdateTask(organization.id, task.id);
  const taskQuery = useTask(organization.id, task.id);
  const [values, setValues] = useState({
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    dueDate: task.dueDate ?? "",
  });
  const [baseVersion, setBaseVersion] = useState(task.version);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string>();
  const ids = { title: useId(), description: useId(), priority: useId(), due: useId() };

  const loadLatest = (latest: Task) => {
    setValues({
      title: latest.title,
      description: latest.description ?? "",
      priority: latest.priority,
      dueDate: latest.dueDate ?? "",
    });
    setBaseVersion(latest.version);
    setConflict(false);
    setError(undefined);
  };

  // The version the edits are based on is fixed when editing starts, so a save always
  // names the version the user actually saw (other changes meanwhile → 409).
  const edit = (patch: Partial<typeof values>) => {
    if (!dirty) setBaseVersion(task.version);
    setValues({ ...values, ...patch });
  };

  const dirty =
    values.title !== task.title ||
    values.description !== (task.description ?? "") ||
    values.priority !== task.priority ||
    values.dueDate !== (task.dueDate ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = updateTaskSchema.safeParse({
      ...values,
      dueDate: values.dueDate || null,
      version: baseVersion,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    update.mutate(parsed.data, {
      onSuccess: (saved) => {
        setBaseVersion(saved.version);
        toast.success("Task saved.");
      },
      onError: (err) => {
        const apiError = toApiError(err);
        if (apiError.code === "VERSION_CONFLICT") setConflict(true);
        else setError(apiError.message);
      },
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {conflict && (
        <Alert>
          <AlertTitle>Someone changed this task</AlertTitle>
          <AlertDescription>
            Your edits were not saved. Load the latest version, then make your change again.
          </AlertDescription>
          <AlertAction>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                const { data } = await taskQuery.refetch();
                if (data) loadLatest(data);
              }}
            >
              <RefreshCwIcon aria-hidden /> Load latest
            </Button>
          </AlertAction>
        </Alert>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor={ids.title}>Title</Label>
        <Input
          id={ids.title}
          value={values.title}
          disabled={!editable}
          onChange={(e) => edit({ title: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.description}>Description</Label>
        <Textarea
          id={ids.description}
          rows={5}
          value={values.description}
          disabled={!editable}
          placeholder={editable ? "Add details, steps or links" : "No description."}
          onChange={(e) => edit({ description: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={ids.priority}>Priority</Label>
          <NativeSelect
            id={ids.priority}
            className="w-full"
            value={values.priority}
            disabled={!editable}
            onChange={(e) => edit({ priority: e.target.value as TaskPriority })}
          >
            {TASK_PRIORITIES.map((p) => (
              <NativeSelectOption key={p} value={p}>
                {TASK_PRIORITY_LABELS[p]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.due}>Due date</Label>
          <Input
            id={ids.due}
            type="date"
            value={values.dueDate}
            disabled={!editable}
            onChange={(e) => edit({ dueDate: e.target.value })}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {editable && (
        <div>
          <Button type="submit" disabled={!dirty || update.isPending || conflict}>
            Save changes
          </Button>
        </div>
      )}
    </form>
  );
}

function AssigneeControl({ task, project }: { task: Task; project: Project }) {
  const { organization, actor } = useOrg();
  const assign = useSetAssignee(organization.id, task.id);
  const id = useId();
  const facts = factsFor(project, task);
  const canAssignAnyone = can(actor, "task.assign", { ...facts, newAssigneeId: null });
  const canTake =
    !task.assignee && can(actor, "task.assign", { ...facts, newAssigneeId: actor.userId });

  const set = (assigneeId: string | null) =>
    assign.mutate(
      { assigneeId, version: task.version },
      {
        onSuccess: (t) =>
          toast.success(t.assignee ? `Assigned to ${t.assignee.name}.` : "Task unassigned."),
        onError: (e) => toast.error(toApiError(e).message),
      },
    );

  if (canAssignAnyone) {
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={id}>Assignee</Label>
        <NativeSelect
          id={id}
          className="w-full"
          value={task.assignee?.id ?? ""}
          disabled={assign.isPending}
          onChange={(e) => set(e.target.value || null)}
        >
          <NativeSelectOption value="">Unassigned</NativeSelectOption>
          {project.members.map((m) => (
            <NativeSelectOption key={m.id} value={m.id}>
              {m.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">Assignee</span>
      {task.assignee ? (
        <span className="flex items-center gap-2 text-sm">
          <UserAvatar name={task.assignee.name} url={task.assignee.avatarUrl} size="sm" />{" "}
          {task.assignee.name}
        </span>
      ) : canTake ? (
        // US-23: pick up an unassigned task.
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          disabled={assign.isPending}
          onClick={() => set(actor.userId)}
        >
          <UserCheckIcon aria-hidden /> Assign to me
        </Button>
      ) : (
        <span className="text-sm text-muted-foreground">Unassigned</span>
      )}
    </div>
  );
}

function History({ taskId }: { taskId: string }) {
  const { organization } = useOrg();
  const activity = useTaskActivity(organization.id, taskId);
  if (activity.isPending) return <Skeleton className="h-24" />;
  if (activity.isError)
    return <p className="text-sm text-destructive">{toApiError(activity.error).message}</p>;
  return (
    <ol className="grid gap-3">
      {activity.data.data.map((e) => (
        <li key={e.id} className="flex gap-2.5 text-sm">
          <UserAvatar name={e.actor?.name ?? "?"} url={e.actor?.avatarUrl} size="sm" />
          <div className="grid min-w-0 gap-0.5">
            <p>
              <span className="font-medium">{e.actor?.name ?? "Someone"}</span>{" "}
              {describeActivity(e)}
            </p>
            <time dateTime={e.createdAt} className="text-xs text-muted-foreground">
              {formatDateTime(e.createdAt)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Task details in a side panel over its project (FE §5); /o/:orgId/tasks/:taskId deep-links here.
export function TaskSheet({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { organization, actor } = useOrg();
  const task = useTask(organization.id, taskId);
  const project = useProject(organization.id, task.data?.projectId ?? "");
  const remove = useDeleteTask(organization.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const t = task.data;
  const p = task.data?.projectId ? project.data : undefined;
  const archived = p?.status === "archived";
  const facts = t && p ? factsFor(p, t) : null;
  const editable = Boolean(facts && !archived && can(actor, "task.edit", facts));
  const canDelete = Boolean(facts && !archived && can(actor, "task.delete", facts));

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {!t || !p ? (
          <div className="grid gap-3 p-4">
            {task.isError ? (
              <>
                <SheetTitle>Task not found</SheetTitle>
                <SheetDescription>{toApiError(task.error).message}</SheetDescription>
              </>
            ) : (
              <>
                <SheetTitle className="sr-only">Loading task</SheetTitle>
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-40" />
              </>
            )}
          </div>
        ) : (
          <>
            <SheetHeader className="gap-2 border-b">
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <TaskStatusBadge status={t.status} />
                <PriorityLabel priority={t.priority} />
                {t.dueDate && <DueDate day={t.dueDate} overdue={t.overdue} />}
              </div>
              <SheetTitle className="text-lg leading-snug">{t.title}</SheetTitle>
              <SheetDescription>
                {t.projectName} · created by {t.createdBy?.name ?? "a former member"}
                {archived && " · project archived (read-only)"}
              </SheetDescription>
            </SheetHeader>

            <div className="grid gap-6 p-4">
              <AssigneeControl task={t} project={p} />
              <DetailsForm key={t.id} task={t} editable={editable} />
              <section aria-labelledby="history-heading" className="grid gap-3 border-t pt-4">
                <h3 id="history-heading" className="text-sm font-medium">
                  History
                </h3>
                <History taskId={t.id} />
              </section>
              {canDelete && (
                <div className="border-t pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2Icon aria-hidden /> Delete task
                  </Button>
                </div>
              )}
            </div>

            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={setConfirmDelete}
              title="Delete this task?"
              description="It is removed from the project. Its history stays in the project's activity."
              confirmLabel="Delete"
              pending={remove.isPending}
              onConfirm={() =>
                remove.mutate(t, {
                  onSuccess: () => {
                    toast.success("Task deleted.");
                    onClose();
                  },
                  onError: (e) => toast.error(toApiError(e).message),
                })
              }
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
