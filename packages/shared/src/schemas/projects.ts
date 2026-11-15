import { z } from "zod";
import {
  PROJECT_STATUSES,
  TASK_FLAG_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ProjectStatus,
  type TaskFlagType,
  type TaskPriority,
  type TaskStatus,
} from "../constants";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid ID.");

// ---------- projects (FR-PROJ) ----------

export const projectNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(100, "Name must not exceed 100 characters.");

const description = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Description must not exceed ${max.toLocaleString("en")} characters.`)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

export const createProjectSchema = z.object({
  name: projectNameSchema,
  description: description(2000),
  // Tenant Admins may choose the manager (R3); a Project Manager always manages their own.
  managerId: objectId.optional(),
});
export type CreateProjectInput = z.input<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: projectNameSchema,
  description: description(2000),
});
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;

export const setManagerSchema = z.object({ userId: objectId });
export const addProjectMembersSchema = z.object({
  userIds: z.array(objectId).min(1, "Choose at least one member.").max(100),
});

export const projectsQuerySchema = z.object({
  status: z.enum(PROJECT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export interface UserRef {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ProjectSummaryItem {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  manager: UserRef | null;
  memberCount: number;
  taskCount: number;
  doneCount: number;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  manager: UserRef | null;
  members: UserRef[];
  createdAt: string;
  updatedAt: string;
}

// ---------- tasks (FR-TASK) ----------

// Calendar date only (data model §4.6): "2026-11-30".
export const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Use a valid date.");

const titleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(200, "Title must not exceed 200 characters.");

const versionSchema = z.number().int().min(0);

export const createTaskSchema = z.object({
  title: titleSchema,
  description: description(5000),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  dueDate: dueDateSchema.optional(),
  assigneeId: objectId.nullable().optional(),
});
export type CreateTaskInput = z.input<typeof createTaskSchema>;

// Every change carries the version the client last saw (API design §6).
export const updateTaskSchema = z.object({
  title: titleSchema,
  description: description(5000),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: dueDateSchema.nullable(),
  version: versionSchema,
});
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export const setAssigneeSchema = z.object({
  assigneeId: objectId.nullable(),
  version: versionSchema,
});

export const myTasksQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const activityQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export interface TaskFlag {
  type: TaskFlagType;
  reason: string;
  setBy: UserRef | null;
  setAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: UserRef | null;
  dueDate: string | null;
  overdue: boolean; // computed in the organization's timezone (FR-TASK-10)
  flag: TaskFlag | null;
  createdBy: UserRef | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ---------- activity (FR-ACT) ----------

export const ACTIVITY_ACTIONS = [
  "task.created",
  "task.updated",
  "task.status_changed",
  "task.changes_requested",
  "task.flagged",
  "task.unflagged",
  "task.assigned",
  "task.unassigned",
  "task.deleted",
  "comment.added",
  "comment.deleted",
  "project.created",
  "project.updated",
  "project.archived",
  "project.restored",
  "project.member_added",
  "project.member_removed",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface ActivityEntry {
  id: string;
  action: ActivityAction;
  actor: UserRef | null;
  taskId: string | null;
  changes?: Record<string, { from: unknown; to: unknown }>;
  reason?: string;
  // Values at the time (DM-4); user IDs in changes are resolved to names here.
  snapshot: { projectName: string; taskTitle?: string };
  users?: Record<string, string>;
  createdAt: string;
}

export interface CursorPage<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean };
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

// ---------- board and workflow (FR-BOARD, R14 – R16) ----------

export const changeStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
  version: versionSchema,
});

const reasonSchema = z
  .string()
  .trim()
  .min(1, "Please give a reason.")
  .max(500, "Reason must not exceed 500 characters.");

export const requestChangesSchema = z.object({ reason: reasonSchema, version: versionSchema });

export const setFlagSchema = z.object({
  type: z.enum(TASK_FLAG_TYPES),
  reason: reasonSchema,
  version: versionSchema,
});

export const versionOnlySchema = z.object({ version: versionSchema });

export const boardQuerySchema = z.object({
  // "me" and "none" are resolved on the server.
  assigneeId: z.union([objectId, z.literal("none")]).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  flag: z.enum(TASK_FLAG_TYPES).optional(),
});

export type Board = Record<TaskStatus, Task[]>;

export interface ProjectSummary {
  counts: Record<TaskStatus, number>;
  total: number;
  overdue: number;
  blocked: number;
  percentComplete: number;
}

// ---------- comments (FR-COM) ----------

export const commentBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write something first.")
    .max(2000, "Comments must not exceed 2,000 characters."),
});

export interface Comment {
  id: string;
  taskId: string;
  author: UserRef | null;
  body: string;
  editedAt: string | null;
  createdAt: string;
}
