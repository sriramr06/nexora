import type { UserRef } from "./projects";

// Data model §4.9 / FR §12.1. Text is built by the client from `type` + `data`.
export const NOTIFICATION_TYPES = [
  "task.assigned",
  "task.unassigned",
  "task.status_changed",
  "task.submitted_for_review",
  "task.changes_requested",
  "task.blocked",
  "task.unblocked",
  "comment.added",
  "project.member_added",
  "project.member_removed",
  "project.tasks_unassigned",
  "project.manager_unset",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// A display snapshot: values at the time of the event.
export interface NotificationData {
  taskTitle?: string;
  projectName?: string;
  status?: string;
  reason?: string;
  memberName?: string;
  count?: number;
}

export interface Notification {
  id: string;
  type: NotificationType;
  actor: UserRef | null;
  projectId: string | null;
  taskId: string | null;
  data: NotificationData;
  read: boolean;
  createdAt: string;
}
