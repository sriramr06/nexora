import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type ActivityEntry,
  type TaskPriority,
  type TaskStatus,
} from "@nexora/shared";
import { formatDueDate } from "./task-badges";

// Turns an activity entry into a short sentence ("Arun changed priority from Medium to High").
const name = (entry: ActivityEntry, id: unknown) =>
  typeof id === "string" ? (entry.users?.[id] ?? "a former member") : "nobody";

const FIELD_LABELS: Record<string, string> = {
  title: "the title",
  description: "the description",
  priority: "priority",
  dueDate: "the due date",
};

const show = (field: string, value: unknown): string => {
  if (value === null || value === undefined || value === "") return "none";
  if (field === "priority") return TASK_PRIORITY_LABELS[value as TaskPriority] ?? String(value);
  if (field === "status") return TASK_STATUS_LABELS[value as TaskStatus] ?? String(value);
  if (field === "dueDate") return formatDueDate(String(value));
  return `“${String(value)}”`;
};

export const describeActivity = (entry: ActivityEntry): string => {
  const changes = entry.changes ?? {};
  switch (entry.action) {
    case "task.created":
      return "created the task";
    case "task.assigned": {
      const { from, to } = changes.assigneeId ?? { from: null, to: null };
      return from
        ? `reassigned it from ${name(entry, from)} to ${name(entry, to)}`
        : `assigned it to ${name(entry, to)}`;
    }
    case "task.unassigned":
      return `unassigned ${name(entry, changes.assigneeId?.from)}`;
    case "task.updated":
      return Object.entries(changes)
        .map(([field, { from, to }]) =>
          field === "description"
            ? "updated the description"
            : to === null && field === "dueDate"
              ? "removed the due date"
              : `changed ${FIELD_LABELS[field] ?? field} from ${show(field, from)} to ${show(field, to)}`,
        )
        .join(", ");
    case "task.status_changed":
      return `moved it from ${show("status", changes.status?.from)} to ${show("status", changes.status?.to)}`;
    case "task.changes_requested":
      return "requested changes";
    case "task.flagged":
      return "flagged the task";
    case "task.unflagged":
      return "cleared the flag";
    case "task.deleted":
      return "deleted the task";
    default:
      return entry.action.replace(".", " ").replace("_", " ");
  }
};
