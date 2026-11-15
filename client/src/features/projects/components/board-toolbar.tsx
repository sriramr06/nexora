import { useState } from "react";
import { Link, useLocation } from "react-router";
import { OctagonAlertIcon } from "lucide-react";
import {
  TASK_FLAG_TYPES,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type Project,
  type TaskFlagType,
  type TaskPriority,
} from "@nexora/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { formatDateTime } from "@/features/organizations/labels";
import { useOrg } from "@/features/organizations/org-gate";
import { useBlockedTasks, useProjectSummary, type BoardFilters } from "../projects-api";

// US-19 / FR-PROJ-08: counts per status, overdue, blocked and % complete.
export function SummaryStrip({
  project,
  onShowBlocked,
}: {
  project: Project;
  onShowBlocked: () => void;
}) {
  const { organization } = useOrg();
  const summary = useProjectSummary(organization.id, project.id);
  if (summary.isPending) return <Skeleton className="h-16" />;
  if (!summary.data) return null;
  const s = summary.data;

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
        <span className="text-2xl font-semibold tabular-nums">{s.percentComplete}%</span>
        <span className="text-muted-foreground">
          complete · {s.counts.done} of {s.total} done
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground sm:ml-auto">
          {TASK_STATUSES.filter((st) => st !== "done").map((st) => (
            <span key={st} className="tabular-nums">
              {TASK_STATUS_LABELS[st]}{" "}
              <span className="font-medium text-foreground">{s.counts[st]}</span>
            </span>
          ))}
          <span
            className={s.overdue ? "font-medium text-destructive tabular-nums" : "tabular-nums"}
          >
            Overdue {s.overdue}
          </span>
        </span>
        {/* FR-BOARD-09: the Blocked tasks control */}
        <Button
          variant={s.blocked ? "destructive" : "outline"}
          size="sm"
          disabled={s.blocked === 0}
          onClick={onShowBlocked}
        >
          <OctagonAlertIcon aria-hidden /> Blocked {s.blocked}
        </Button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${s.percentComplete}%` }}
        />
      </div>
    </div>
  );
}

export function BlockedTasksDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { organization } = useOrg();
  const location = useLocation();
  const blocked = useBlockedTasks(organization.id, project.id, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Blocked tasks</DialogTitle>
          <DialogDescription>
            Longest blocked first. Open a task to clear its blocker.
          </DialogDescription>
        </DialogHeader>
        {blocked.isPending ? (
          <Skeleton className="h-24" />
        ) : (
          <ul className="grid max-h-[60vh] gap-3 overflow-y-auto">
            {blocked.data?.map((t) => (
              <li key={t.id} className="grid gap-1.5 rounded-lg border p-3 text-sm">
                <Link
                  to={`/o/${organization.id}/tasks/${t.id}`}
                  state={{ from: location.pathname }}
                  className="font-medium hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  {t.title}
                </Link>
                <p className="border-l-2 border-destructive/50 pl-2">{t.flag?.reason}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {t.assignee ? (
                      <>
                        <UserAvatar name={t.assignee.name} url={t.assignee.avatarUrl} size="sm" />
                        {t.assignee.name}
                      </>
                    ) : (
                      "Unassigned"
                    )}
                  </span>
                  <span>
                    Flagged by {t.flag?.setBy?.name ?? "a former member"}
                    {t.flag && ` · ${formatDateTime(t.flag.setAt)}`}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

// US-26 / FR-BOARD-06
export function BoardFilterBar({
  project,
  filters,
  onChange,
}: {
  project: Project;
  filters: BoardFilters;
  onChange: (f: BoardFilters) => void;
}) {
  const { actor } = useOrg();
  const [ids] = useState(() => ({ a: "f-assignee", p: "f-priority", f: "f-flag" }));
  const active = Boolean(filters.assigneeId || filters.priority || filters.flag);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs text-muted-foreground" htmlFor={ids.a}>
        Assignee
        <NativeSelect
          id={ids.a}
          size="sm"
          value={filters.assigneeId ?? ""}
          onChange={(e) => onChange({ ...filters, assigneeId: e.target.value || undefined })}
        >
          <NativeSelectOption value="">Everyone</NativeSelectOption>
          <NativeSelectOption value={actor.userId}>Me</NativeSelectOption>
          <NativeSelectOption value="none">Unassigned</NativeSelectOption>
          {project.members
            .filter((m) => m.id !== actor.userId)
            .map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.name}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground" htmlFor={ids.p}>
        Priority
        <NativeSelect
          id={ids.p}
          size="sm"
          value={filters.priority ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              priority: (e.target.value || undefined) as TaskPriority | undefined,
            })
          }
        >
          <NativeSelectOption value="">Any</NativeSelectOption>
          {TASK_PRIORITIES.map((p) => (
            <NativeSelectOption key={p} value={p}>
              {TASK_PRIORITY_LABELS[p]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground" htmlFor={ids.f}>
        Flag
        <NativeSelect
          id={ids.f}
          size="sm"
          value={filters.flag ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              flag: (e.target.value || undefined) as TaskFlagType | undefined,
            })
          }
        >
          <NativeSelectOption value="">Any</NativeSelectOption>
          {TASK_FLAG_TYPES.map((f) => (
            <NativeSelectOption key={f} value={f}>
              {f === "blocked" ? "Blocked" : "On hold"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
