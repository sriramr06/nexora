import { useState } from "react";
import { Link, useLocation } from "react-router";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVerticalIcon, OctagonAlertIcon, PauseIcon } from "lucide-react";
import { toast } from "sonner";
import {
  statusChange,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type Board as BoardData,
  type Project,
  type Task,
  type TaskStatus,
  type WorkflowFacts,
} from "@nexora/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { toApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { useOrg } from "@/features/organizations/org-gate";
import {
  boardKeys,
  useBoard,
  useChangeStatus,
  useRequestChanges,
  type BoardFilters,
} from "../projects-api";
import { ReasonDialog } from "./reason-dialog";
import { DueDate, PriorityLabel } from "./task-badges";

export const workflowFactsOf = (project: Project, task: Task): WorkflowFacts => ({
  managerId: project.manager?.id ?? null,
  memberIds: project.members.map((m) => m.id),
  assigneeId: task.assignee?.id ?? null,
  createdBy: task.createdBy?.id ?? "",
  status: task.status,
  flag: task.flag?.type ?? null,
});

const COLUMN_DOT: Record<TaskStatus, string> = {
  todo: "bg-muted-foreground",
  in_progress: "bg-chart-2",
  in_review: "bg-chart-3",
  done: "bg-primary",
};

function FlagBadge({ task }: { task: Task }) {
  if (!task.flag) return null;
  const blocked = task.flag.type === "blocked";
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-xs",
        blocked ? "bg-destructive/10 text-destructive" : "bg-chart-3/15 text-foreground",
      )}
      title={task.flag.reason}
    >
      {blocked ? (
        <OctagonAlertIcon className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <PauseIcon className="size-3.5 shrink-0" aria-hidden />
      )}
      <span className="font-medium">{blocked ? "Blocked" : "On hold"}:</span>
      <span className="truncate">{task.flag.reason}</span>
    </span>
  );
}

function TaskCard({
  task,
  project,
  readOnly,
  onMove,
}: {
  task: Task;
  project: Project;
  readOnly: boolean;
  onMove: (task: Task, to: TaskStatus) => void;
}) {
  const { organization, actor } = useOrg();
  const location = useLocation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: readOnly,
  });
  // FR-BOARD-04: the same moves without dragging, limited to what the rules allow.
  const moves = TASK_STATUSES.filter(
    (s) =>
      s !== task.status &&
      (statusChange(actor, workflowFactsOf(project, task), s).ok ||
        (s === "in_progress" && task.status === "in_review")),
  );

  return (
    <div
      ref={setNodeRef}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
      className={cn(
        "group relative grid gap-2 rounded-lg border bg-card p-3 text-left shadow-xs",
        isDragging && "z-10 opacity-80 shadow-md ring-2 ring-ring/30",
        task.flag?.type === "blocked" && "border-destructive/40",
      )}
      {...attributes}
      {...listeners}
      aria-roledescription="Task card"
      aria-label={`${task.title}. ${TASK_STATUS_LABELS[task.status]}.`}
    >
      <div className="flex items-start gap-2">
        <Link
          to={`/o/${organization.id}/tasks/${task.id}`}
          state={{ from: location.pathname }}
          className="min-w-0 flex-1 text-sm leading-snug font-medium hover:underline"
        >
          {task.title}
        </Link>
        {!readOnly && moves.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="relative z-10 -mt-0.5 -mr-1"
                  aria-label={`Move “${task.title}”`}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreVerticalIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {/* Base UI: a label must live inside a group. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                {moves.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => onMove(task, s)}>
                    {TASK_STATUS_LABELS[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <FlagBadge task={task} />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-3">
          <PriorityLabel priority={task.priority} />
          {task.dueDate && <DueDate day={task.dueDate} overdue={task.overdue} />}
        </span>
        {task.assignee ? (
          <UserAvatar name={task.assignee.name} url={task.assignee.avatarUrl} size="sm" />
        ) : (
          <span className="size-7 rounded-full border border-dashed" aria-label="Unassigned" />
        )}
      </div>
    </div>
  );
}

function Column({
  status,
  tasks,
  children,
}: {
  status: TaskStatus;
  tasks: Task[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${TASK_STATUS_LABELS[status]}, ${tasks.length} tasks`}
      className={cn(
        "grid min-w-56 content-start gap-2 rounded-xl border bg-muted/40 p-2 transition-colors",
        isOver && "border-ring/50 bg-accent",
      )}
    >
      <h3 className="flex items-center gap-2 px-1 py-1 text-sm font-medium">
        <span className={cn("size-2 rounded-full", COLUMN_DOT[status])} aria-hidden />
        {TASK_STATUS_LABELS[status]}
        <span className="ml-auto text-xs text-muted-foreground">{tasks.length}</span>
      </h3>
      {children}
      {tasks.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          No tasks
        </p>
      )}
    </section>
  );
}

// US-25: drag cards between columns. The move shows instantly (optimistic); if the server
// refuses (rules, stale version, network), the card returns and the reason is shown.
export function Board({ project, filters }: { project: Project; filters: BoardFilters }) {
  const { organization, actor } = useOrg();
  const qc = useQueryClient();
  const key = boardKeys.board(organization.id, project.id, filters);
  const board = useBoard(organization.id, project.id, filters);
  const changeStatus = useChangeStatus(organization.id);
  const requestChanges = useRequestChanges(organization.id);
  const [sendingBack, setSendingBack] = useState<Task | null>(null);
  const readOnly = project.status === "archived";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), // clicks still open the task
    useSensor(KeyboardSensor),
  );

  const move = (task: Task, to: TaskStatus) => {
    const decision = statusChange(actor, workflowFactsOf(project, task), to);
    if (!decision.ok) {
      // A manager sending reviewed work back needs a reason (R14).
      if (
        to === "in_progress" &&
        task.status === "in_review" &&
        decision.reason.includes("Request changes")
      ) {
        setSendingBack(task);
        return;
      }
      toast.error(decision.reason); // FR-BOARD-03: refused drops stay put, with the reason
      return;
    }

    const previous = qc.getQueryData<BoardData>(key);
    if (previous) {
      const moved = { ...task, status: to, flag: to === "done" ? null : task.flag };
      qc.setQueryData<BoardData>(key, {
        ...previous,
        [task.status]: previous[task.status].filter((t) => t.id !== task.id),
        [to]: [moved, ...previous[to]],
      });
    }
    changeStatus.mutate(
      { task, status: to },
      {
        onError: (error) => {
          if (previous) qc.setQueryData(key, previous); // FR-BOARD-05: roll back
          const apiError = toApiError(error);
          toast.error(
            apiError.code === "VERSION_CONFLICT"
              ? "Someone changed this task meanwhile. The board was refreshed — try again."
              : apiError.message,
          );
        },
      },
    );
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const task = active.data.current?.task as Task | undefined;
    const to = over?.id as TaskStatus | undefined;
    if (task && to && to !== task.status) move(task, to);
  };

  if (board.isPending) {
    return (
      <div className="grid gap-3 md:grid-cols-4">
        {TASK_STATUSES.map((s) => (
          <Skeleton key={s} className="h-64" />
        ))}
      </div>
    );
  }
  if (board.isError)
    return <p className="text-sm text-destructive">{toApiError(board.error).message}</p>;

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "To move a task, press space, use the arrow keys to choose a column, then press space again. Or use the task's Move menu.",
          },
        }}
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <div className="grid auto-cols-[minmax(14rem,1fr)] grid-flow-col gap-3">
            {TASK_STATUSES.map((status) => (
              <Column key={status} status={status} tasks={board.data[status]}>
                {board.data[status].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    project={project}
                    readOnly={readOnly}
                    onMove={move}
                  />
                ))}
              </Column>
            ))}
          </div>
        </div>
      </DndContext>

      <ReasonDialog
        open={sendingBack !== null}
        onOpenChange={(o) => !o && setSendingBack(null)}
        title="Request changes"
        description="The task returns to In Progress. The reason is saved in its history."
        confirmLabel="Send back"
        pending={requestChanges.isPending}
        onConfirm={(reason) =>
          sendingBack &&
          requestChanges.mutate(
            { task: sendingBack, reason },
            {
              onSuccess: () => {
                toast.success("Sent back to In Progress.");
                setSendingBack(null);
              },
              onError: (e) => toast.error(toApiError(e).message),
            },
          )
        }
      />
    </>
  );
}
