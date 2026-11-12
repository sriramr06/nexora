import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@nexora/shared";
import { CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Status colours (UI-1 / chart tokens): grey to do, blue in progress, amber review, teal done.
const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-muted-foreground",
  in_progress: "bg-chart-2",
  in_review: "bg-chart-3",
  done: "bg-primary",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

// Priority as text weight + a small bar count, never colour alone.
const PRIORITY_BARS: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3, urgent: 4 };

export function PriorityLabel({ priority }: { priority: TaskPriority }) {
  const bars = PRIORITY_BARS[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        priority === "urgent" ? "font-medium text-destructive" : "text-muted-foreground",
      )}
    >
      <span className="flex items-end gap-px" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("w-0.5 rounded-full", i <= bars ? "bg-current" : "bg-border")}
            style={{ height: `${4 + i * 2}px` }}
          />
        ))}
      </span>
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  );
}

export const formatDueDate = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export function DueDate({ day, overdue }: { day: string | null; overdue: boolean }) {
  if (!day) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        overdue ? "font-medium text-destructive" : "text-muted-foreground",
      )}
    >
      <CalendarIcon className="size-3.5" aria-hidden />
      {formatDueDate(day)}
      {overdue && <span className="sr-only">(overdue)</span>}
    </span>
  );
}
