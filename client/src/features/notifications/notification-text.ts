import { TASK_STATUS_LABELS, type Notification, type TaskStatus } from "@nexora/shared";

// Notification text is built here from type + data (data model §4.9); the server stores
// no sentences, so wording can change without a migration.
export const describeNotification = (n: Notification): string => {
  const who = n.actor?.name ?? "Someone";
  const task = `“${n.data.taskTitle ?? "a task"}”`;
  const project = `“${n.data.projectName ?? "a project"}”`;
  switch (n.type) {
    case "task.assigned":
      return `${who} assigned you ${task}`;
    case "task.unassigned":
      return `${who} unassigned you from ${task}`;
    case "task.status_changed": {
      const status = n.data.status as TaskStatus | undefined;
      return status === "done"
        ? `${who} marked ${task} done`
        : `${who} moved ${task} to ${status ? TASK_STATUS_LABELS[status] : "a new status"}`;
    }
    case "task.submitted_for_review":
      return `${who} submitted ${task} for review`;
    case "task.changes_requested":
      return `${who} requested changes on ${task}: ${n.data.reason ?? ""}`;
    case "task.blocked":
      return `${who} marked ${task} blocked: ${n.data.reason ?? ""}`;
    case "task.unblocked":
      return `${who} cleared the blocker on ${task}`;
    case "comment.added":
      return `${who} commented on ${task}`;
    case "project.member_added":
      return `${who} added you to ${project}`;
    case "project.member_removed":
      return `${who} removed you from ${project}`;
    case "project.tasks_unassigned": {
      const count = n.data.count ?? 0;
      return `${n.data.memberName ?? "A member"} left ${project}; ${count} open ${count === 1 ? "task is" : "tasks are"} now unassigned`;
    }
    case "project.manager_unset":
      return `${project} no longer has a manager (was ${n.data.memberName ?? "unknown"}). Assign a new one.`;
  }
};

// Where a notification leads (FR-NOT-06). Someone removed from a project can no longer
// open it, so that one goes to the projects list.
export const notificationHref = (orgId: string, n: Notification): string => {
  if (n.taskId) return `/o/${orgId}/tasks/${n.taskId}`;
  if (n.projectId && n.type !== "project.member_removed")
    return `/o/${orgId}/projects/${n.projectId}`;
  return `/o/${orgId}/projects`;
};

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" });

export const timeAgo = (iso: string, now = Date.now()): string => {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
};
