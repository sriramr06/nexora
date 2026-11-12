import { useState } from "react";
import { Link, useLocation } from "react-router";
import { TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus } from "@nexora/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toApiError } from "@/lib/api-error";
import { useOrg } from "@/features/organizations/org-gate";
import { DueDate, PriorityLabel, TaskStatusBadge } from "../components/task-badges";
import { useMyTasks } from "../projects-api";

// US-27 / FR-TASK-11: my assigned tasks across projects, soonest due first.
export function MyTasksPage() {
  const { organization } = useOrg();
  const location = useLocation();
  const [status, setStatus] = useState<TaskStatus | undefined>();
  const tasks = useMyTasks(organization.id, status);
  const overdue = tasks.data?.data.filter((t) => t.overdue).length ?? 0;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My tasks</h1>
        {overdue > 0 && (
          <span className="text-sm font-medium text-destructive">{overdue} overdue</span>
        )}
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-1">
        {[undefined, ...TASK_STATUSES].map((s) => (
          <Button
            key={s ?? "all"}
            size="sm"
            variant={status === s ? "secondary" : "ghost"}
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
          >
            {s ? TASK_STATUS_LABELS[s] : "All"}
          </Button>
        ))}
      </nav>

      {tasks.isPending && <Skeleton className="h-48" />}
      {tasks.isError && (
        <p className="text-sm text-destructive">{toApiError(tasks.error).message}</p>
      )}
      {tasks.data?.data.length === 0 && (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing assigned to you{status ? ` in ${TASK_STATUS_LABELS[status]}` : ""}.
        </p>
      )}
      {tasks.data && tasks.data.data.length > 0 && (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {tasks.data.data.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/o/${organization.id}/tasks/${t.id}`}
                  state={{ from: location.pathname }}
                  className="grid gap-1 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:flex sm:items-center sm:gap-4"
                >
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate text-sm font-medium">{t.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{t.projectName}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-3">
                    <TaskStatusBadge status={t.status} />
                    <PriorityLabel priority={t.priority} />
                    <DueDate day={t.dueDate} overdue={t.overdue} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
