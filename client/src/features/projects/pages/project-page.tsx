import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UserMinusIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  can,
  createTaskSchema,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  updateProjectSchema,
  type Project,
  type ProjectFacts,
  type TaskPriority,
} from "@nexora/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { toApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { useMembers } from "@/features/members/members-api";
import { useOrg } from "@/features/organizations/org-gate";
import { useNavigate } from "react-router";
import { DueDate, PriorityLabel } from "../components/task-badges";
import { Board } from "../components/board";
import { BlockedTasksDialog, BoardFilterBar, SummaryStrip } from "../components/board-toolbar";
import type { BoardFilters } from "../projects-api";
import {
  useAddProjectMembers,
  useArchiveProject,
  useCreateTask,
  useDeleteProject,
  useProject,
  useProjectTasks,
  useRemoveProjectMember,
  useUpdateProject,
} from "../projects-api";

const factsOf = (p: Project): ProjectFacts => ({
  managerId: p.manager?.id ?? null,
  memberIds: p.members.map((m) => m.id),
});

// ---------- dialogs ----------

function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { organization } = useOrg();
  const update = useUpdateProject(organization.id, project.id);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [error, setError] = useState<string>();
  const ids = { name: useId(), description: useId() };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = updateProjectSchema.safeParse({ name, description });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    update.mutate(parsed.data, {
      onSuccess: () => {
        toast.success("Project updated.");
        onOpenChange(false);
      },
      onError: (err) => setError(toApiError(err).message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.name}>Name</Label>
            <Input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.description}>Description</Label>
            <Textarea
              id={ids.description}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={update.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// FR-PROJ-07: deleting everything needs the name typed exactly.
function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { organization } = useOrg();
  const navigate = useNavigate();
  const remove = useDeleteProject(organization.id);
  const [typed, setTyped] = useState("");
  const id = useId();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setTyped("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {project.name}?</DialogTitle>
          <DialogDescription>
            This permanently deletes the project with all its tasks and history. It cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor={id}>
            Type <span className="font-semibold">{project.name}</span> to confirm
          </Label>
          <Input
            id={id}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={typed !== project.name || remove.isPending}
            onClick={() =>
              remove.mutate(project.id, {
                onSuccess: () => {
                  toast.success(`${project.name} deleted.`);
                  navigate(`/o/${organization.id}/projects`, { replace: true });
                },
                onError: (e) => toast.error(toApiError(e).message),
              })
            }
          >
            Delete project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewTaskDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { organization, actor } = useOrg();
  const create = useCreateTask(organization.id, project.id);
  const facts = factsOf(project);
  const canAssignAnyone = actor.role === "admin" || facts.managerId === actor.userId;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState<string>();
  const ids = {
    title: useId(),
    description: useId(),
    priority: useId(),
    due: useId(),
    assignee: useId(),
  };
  // FR-TASK-06: Team Members may leave it unassigned or take it themselves.
  const assignable = canAssignAnyone
    ? project.members
    : project.members.filter((m) => m.id === actor.userId);

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setAssigneeId("");
    setError(undefined);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = createTaskSchema.safeParse({
      title,
      description,
      priority,
      dueDate: dueDate || undefined,
      assigneeId: assigneeId || null,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    create.mutate(parsed.data, {
      onSuccess: (task) => {
        toast.success(`“${task.title}” added to To do.`);
        reset();
        onOpenChange(false);
      },
      onError: (err) => setError(toApiError(err).message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>It starts in To do.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.title}>Title</Label>
            <Input
              id={ids.title}
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.description}>Description (optional)</Label>
            <Textarea
              id={ids.description}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor={ids.priority}>Priority</Label>
              <NativeSelect
                id={ids.priority}
                className="w-full"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
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
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={ids.assignee}>Assignee</Label>
              <NativeSelect
                id={ids.assignee}
                className="w-full"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <NativeSelectOption value="">Unassigned</NativeSelectOption>
                {assignable.map((m) => (
                  <NativeSelectOption key={m.id} value={m.id}>
                    {m.id === actor.userId ? `${m.name} (me)` : m.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- tabs ----------

function TaskList({ project }: { project: Project }) {
  const { organization } = useOrg();
  const location = useLocation();
  const tasks = useProjectTasks(organization.id, project.id);

  if (tasks.isPending) return <Skeleton className="h-48 w-full" />;
  if (tasks.isError)
    return <p className="text-sm text-destructive">{toApiError(tasks.error).message}</p>;
  if (tasks.data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No tasks yet.
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      {TASK_STATUSES.map((status) => {
        const group = tasks.data.filter((t) => t.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} aria-labelledby={`group-${status}`} className="grid gap-2">
            <h3 id={`group-${status}`} className="flex items-center gap-2 text-sm font-medium">
              {TASK_STATUS_LABELS[status]}
              <span className="text-muted-foreground">{group.length}</span>
            </h3>
            <Card className="gap-0 py-0">
              <ul className="divide-y">
                {group.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/o/${organization.id}/tasks/${t.id}`}
                      state={{ from: location.pathname }}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
                      <PriorityLabel priority={t.priority} />
                      <DueDate day={t.dueDate} overdue={t.overdue} />
                      {t.assignee ? (
                        <UserAvatar name={t.assignee.name} url={t.assignee.avatarUrl} size="sm" />
                      ) : (
                        <span
                          className="size-7 rounded-full border border-dashed"
                          title="Unassigned"
                          aria-label="Unassigned"
                        />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        );
      })}
    </div>
  );
}

function ProjectMembers({ project, canManage }: { project: Project; canManage: boolean }) {
  const { organization } = useOrg();
  const orgMembers = useMembers(organization.id);
  const add = useAddProjectMembers(organization.id, project.id);
  const remove = useRemoveProjectMember(organization.id, project.id);
  const [selected, setSelected] = useState<string[]>([]);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const candidates = useMemo(
    () =>
      (orgMembers.data?.data ?? []).filter((m) => !project.members.some((p) => p.id === m.userId)),
    [orgMembers.data, project.members],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Card className="gap-0 py-0">
        <ul className="divide-y">
          {project.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <UserAvatar name={m.name} url={m.avatarUrl} />
              <span className="flex-1 text-sm font-medium">{m.name}</span>
              {project.manager?.id === m.id && <Badge variant="secondary">Manager</Badge>}
              {canManage && project.manager?.id !== m.id && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${m.name} from project`}
                  onClick={() => setRemoving(m)}
                >
                  <UserMinusIcon aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {canManage && (
        <Card className="h-fit gap-3 p-4">
          <h3 className="text-sm font-medium">Add members</h3>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Everyone in the organization is already here.
            </p>
          ) : (
            <>
              <fieldset className="grid max-h-64 gap-1 overflow-y-auto">
                <legend className="sr-only">Organization members not in this project</legend>
                {candidates.map((m) => (
                  <label
                    key={m.userId}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selected.includes(m.userId)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked ? [...s, m.userId] : s.filter((id) => id !== m.userId),
                        )
                      }
                    />
                    <UserAvatar name={m.name} url={m.avatarUrl} size="sm" />
                    {m.name}
                  </label>
                ))}
              </fieldset>
              <Button
                size="sm"
                disabled={selected.length === 0 || add.isPending}
                onClick={() =>
                  add.mutate(selected, {
                    onSuccess: () => {
                      toast.success(
                        `${selected.length} member${selected.length > 1 ? "s" : ""} added.`,
                      );
                      setSelected([]);
                    },
                    onError: (e) => toast.error(toApiError(e).message),
                  })
                }
              >
                <UserPlusIcon aria-hidden /> Add {selected.length || ""}
              </Button>
            </>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name ?? ""} from this project?`}
        description="Their open tasks in this project become unassigned."
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => {
              toast.success(`${removing.name} removed from the project.`);
              setRemoving(null);
            },
            onError: (e) => toast.error(toApiError(e).message),
          })
        }
      />
    </div>
  );
}

// ---------- page ----------

// US-17 – US-21. `projectId` lets the task route render the project behind its panel.
export function ProjectPage({
  projectId: fixedId,
  children,
}: {
  projectId?: string;
  children?: ReactNode;
}) {
  const params = useParams();
  const projectId = fixedId ?? params.projectId ?? "";
  const { organization, actor } = useOrg();
  const project = useProject(organization.id, projectId);
  const archive = useArchiveProject(organization.id, projectId);
  // Sprint 5: the board is the default view; the list stays as an alternative.
  const [tab, setTab] = useState<"board" | "list" | "members">("board");
  const [filters, setFilters] = useState<BoardFilters>({});
  const [showBlocked, setShowBlocked] = useState(false);
  const [dialog, setDialog] = useState<"edit" | "delete" | "task" | null>(null);

  if (project.isPending) return <Skeleton className="h-64 w-full" />;
  if (project.isError) {
    return (
      <p className="text-sm text-destructive">
        {toApiError(project.error).message}{" "}
        <Link to={`/o/${organization.id}/projects`} className="underline">
          Back to projects
        </Link>
      </p>
    );
  }

  const p = project.data;
  const facts = factsOf(p);
  const archived = p.status === "archived";
  const canUpdate = can(actor, "project.update", facts);
  const canManageMembers = can(actor, "project.manageMembers", facts) && !archived;
  const canDelete = can(actor, "project.delete");
  const canCreateTask = can(actor, "task.create", facts) && !archived;

  return (
    <div className="grid gap-5">
      <Link
        to={`/o/${organization.id}/projects`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Projects
      </Link>

      <div className="flex flex-wrap items-start gap-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
            {archived && (
              <Badge variant="secondary" className="gap-1">
                <ArchiveIcon aria-hidden /> Archived
              </Badge>
            )}
          </div>
          {p.description && (
            <p className="max-w-prose text-sm whitespace-pre-line text-muted-foreground">
              {p.description}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Managed by {p.manager?.name ?? "nobody yet"} · {p.members.length} members
          </p>
        </div>
        <div className="flex gap-2">
          {canCreateTask && (
            <Button onClick={() => setDialog("task")}>
              <PlusIcon aria-hidden /> New task
            </Button>
          )}
          {(canUpdate || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" aria-label="Project actions" />}
              >
                <MoreHorizontalIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canUpdate && !archived && (
                  <DropdownMenuItem onClick={() => setDialog("edit")}>
                    <PencilIcon aria-hidden /> Edit details
                  </DropdownMenuItem>
                )}
                {canUpdate && (
                  <DropdownMenuItem
                    onClick={() =>
                      archive.mutate(!archived, {
                        onSuccess: () =>
                          toast.success(
                            archived
                              ? "Project restored."
                              : "Project archived. It is read-only now.",
                          ),
                        onError: (e) => toast.error(toApiError(e).message),
                      })
                    }
                  >
                    {archived ? <ArchiveRestoreIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
                    {archived ? "Restore" : "Archive"}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
                      <Trash2Icon aria-hidden /> Delete project
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <SummaryStrip project={p} onShowBlocked={() => setShowBlocked(true)} />

      <div role="tablist" aria-label="Project" className="flex gap-5 border-b text-sm">
        {(["board", "list", "members"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={cn(
              "border-b-2 pb-2 capitalize",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "board" && (
        <div className="grid gap-4">
          <BoardFilterBar project={p} filters={filters} onChange={setFilters} />
          <Board project={p} filters={filters} />
        </div>
      )}
      {tab === "list" && <TaskList project={p} />}
      {tab === "members" && <ProjectMembers project={p} canManage={canManageMembers} />}
      <BlockedTasksDialog project={p} open={showBlocked} onOpenChange={setShowBlocked} />

      {canUpdate && (
        <EditProjectDialog
          key={p.updatedAt}
          project={p}
          open={dialog === "edit"}
          onOpenChange={(o) => setDialog(o ? "edit" : null)}
        />
      )}
      {canDelete && (
        <DeleteProjectDialog
          project={p}
          open={dialog === "delete"}
          onOpenChange={(o) => setDialog(o ? "delete" : null)}
        />
      )}
      {canCreateTask && (
        <NewTaskDialog
          project={p}
          open={dialog === "task"}
          onOpenChange={(o) => setDialog(o ? "task" : null)}
        />
      )}
      {children}
    </div>
  );
}
