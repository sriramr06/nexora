import type { QueryFilter } from "mongoose";
import {
  clearFlag,
  requestChanges,
  setFlag,
  statusChange,
  type ActivityAction,
  type Board,
  type Decision,
  type ProjectSummary,
  type Task,
  type TaskFlagType,
  type TaskPriority,
  type TaskStatus,
  type WorkflowFacts,
} from "@nexora/shared";
import { AppError } from "../../common/errors/app-error";
import { forTenant } from "../../common/db/tenant-scope";
import { withTransaction } from "../../common/db/transaction";
import type { AuthUser } from "../../common/middleware/authenticate";
import type { TenantContext } from "../../common/middleware/tenancy";
import { recordActivity } from "../activity/activity.service";
import type { ProjectDoc } from "../projects/project.model";
import { actorOf, assertActive, loadProject } from "../projects/project.service";
import { TaskModel, type TaskDoc, type TaskRecord } from "./task.model";
import {
  loadTask,
  snapshotOf,
  taskFacts,
  toDate,
  todayIn,
  toTask,
  toTasks,
  updateIfVersion,
} from "./task.service";

// The review and blocker workflow (R14 – R16), board, summary and blocked list.
// Rules come from packages/shared/src/workflow.ts — the same code the board uses.

const workflowFacts = (project: ProjectDoc, task: TaskDoc): WorkflowFacts => ({
  ...taskFacts(project, task),
  status: task.status,
  flag: task.flag?.type ?? null,
});

const enforce = (decision: Decision) => {
  if (!decision.ok) throw AppError.forbidden(decision.reason);
};

interface Entry {
  action: ActivityAction;
  changes?: Record<string, { from: unknown; to: unknown }>;
  reason?: string;
}

// Version-checked update + activity entry in one transaction (API design §6, FR-ACT-02).
const changeWith = async (
  tenant: TenantContext,
  user: AuthUser,
  task: TaskDoc,
  project: ProjectDoc,
  version: number,
  update: Record<string, unknown>,
  entry: Entry,
): Promise<Task> => {
  const updated = await withTransaction(async (session) => {
    const doc = await updateIfVersion(tenant.organization._id, task._id, version, update, session);
    await recordActivity(session, {
      organizationId: tenant.organization._id,
      projectId: project._id,
      taskId: task._id,
      actorId: user._id,
      snapshot: snapshotOf(project, doc),
      ...entry,
    });
    return doc;
  });
  return toTask(tenant, updated, project);
};

const loadChangeable = async (tenant: TenantContext, taskId: string) => {
  const loaded = await loadTask(tenant, taskId);
  assertActive(loaded.project); // R7
  return loaded;
};

// FR-TASK-03, 12, 13, 16; FR-BOARD-03, 04
export const changeStatus = async (
  tenant: TenantContext,
  user: AuthUser,
  taskId: string,
  { status, version }: { status: TaskStatus; version: number },
): Promise<Task> => {
  const { task, project } = await loadChangeable(tenant, taskId);
  enforce(statusChange(actorOf(tenant), workflowFacts(project, task), status));

  // R15: moving to Done clears any flag.
  const clearsFlag = status === "done" && Boolean(task.flag);
  return changeWith(
    tenant,
    user,
    task,
    project,
    version,
    { $set: { status }, ...(clearsFlag ? { $unset: { flag: 1 } } : {}) },
    {
      action: "task.status_changed",
      changes: {
        status: { from: task.status, to: status },
        ...(clearsFlag ? { flag: { from: task.flag?.type ?? null, to: null } } : {}),
      },
    },
  );
};

// R14: In Review → In Progress with a reason, kept in the activity log.
export const requestChangesOn = async (
  tenant: TenantContext,
  user: AuthUser,
  taskId: string,
  { reason, version }: { reason: string; version: number },
): Promise<Task> => {
  const { task, project } = await loadChangeable(tenant, taskId);
  enforce(requestChanges(actorOf(tenant), workflowFacts(project, task)));
  return changeWith(
    tenant,
    user,
    task,
    project,
    version,
    { $set: { status: "in_progress" } },
    {
      action: "task.changes_requested",
      changes: { status: { from: "in_review", to: "in_progress" } },
      reason,
    },
  );
};

// FR-TASK-14, 15
export const flagTask = async (
  tenant: TenantContext,
  user: AuthUser,
  taskId: string,
  { type, reason, version }: { type: TaskFlagType; reason: string; version: number },
): Promise<Task> => {
  const { task, project } = await loadChangeable(tenant, taskId);
  enforce(setFlag(actorOf(tenant), workflowFacts(project, task), type));
  return changeWith(
    tenant,
    user,
    task,
    project,
    version,
    { $set: { flag: { type, reason, setBy: user._id, setAt: new Date() } } },
    {
      action: "task.flagged",
      changes: { flag: { from: task.flag?.type ?? null, to: type } },
      reason,
    },
  );
};

export const unflagTask = async (
  tenant: TenantContext,
  user: AuthUser,
  taskId: string,
  { version }: { version: number },
): Promise<Task> => {
  const { task, project } = await loadChangeable(tenant, taskId);
  enforce(clearFlag(actorOf(tenant), workflowFacts(project, task)));
  return changeWith(
    tenant,
    user,
    task,
    project,
    version,
    { $unset: { flag: 1 } },
    {
      action: "task.unflagged",
      changes: { flag: { from: task.flag?.type ?? null, to: null } },
    },
  );
};

// ---------- board, summary, blocked tasks (FR-BOARD-01 – 09, FR-PROJ-08) ----------

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const NO_DUE = "9999-12-31";

// FR-BOARD-02: Urgent first, then earliest due date; no due date last.
const byBoardOrder = (a: Task, b: Task) =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
  (a.dueDate ?? NO_DUE).localeCompare(b.dueDate ?? NO_DUE) ||
  a.createdAt.localeCompare(b.createdAt);

export const projectBoard = async (
  tenant: TenantContext,
  projectId: string,
  filters: { assigneeId?: string; priority?: TaskPriority; flag?: TaskFlagType },
): Promise<Board> => {
  const project = await loadProject(tenant, projectId);
  const filter: QueryFilter<TaskRecord> = {
    projectId: project._id,
    ...(filters.assigneeId === "none"
      ? { assigneeId: { $exists: false } }
      : filters.assigneeId
        ? { assigneeId: filters.assigneeId }
        : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.flag ? { "flag.type": filters.flag } : {}),
  };
  const rows = await forTenant(TaskModel, tenant.organization._id).find(filter).lean();
  const tasks = await toTasks(
    rows,
    new Map([[String(project._id), project.name]]),
    tenant.organization.timezone,
  );
  const board: Board = { todo: [], in_progress: [], in_review: [], done: [] };
  for (const t of tasks.sort(byBoardOrder)) board[t.status].push(t);
  return board;
};

// FR-PROJ-08 / US-19: computed by aggregation, never stored.
export const projectSummary = async (
  tenant: TenantContext,
  projectId: string,
): Promise<ProjectSummary> => {
  const project = await loadProject(tenant, projectId);
  const today = toDate(todayIn(tenant.organization.timezone));
  const count = (cond: unknown) => ({ $sum: { $cond: [cond, 1, 0] } });

  const [row] = await TaskModel.aggregate<
    Record<"total" | "todo" | "in_progress" | "in_review" | "done" | "overdue" | "blocked", number>
  >([
    { $match: { organizationId: tenant.organization._id, projectId: project._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        todo: count({ $eq: ["$status", "todo"] }),
        in_progress: count({ $eq: ["$status", "in_progress"] }),
        in_review: count({ $eq: ["$status", "in_review"] }),
        done: count({ $eq: ["$status", "done"] }),
        // Same rule as the cards: not Done and due before today in the org's timezone.
        overdue: count({
          $and: [
            { $ne: ["$status", "done"] },
            { $gt: ["$dueDate", null] },
            { $lt: ["$dueDate", today] },
          ],
        }),
        blocked: count({ $eq: ["$flag.type", "blocked"] }),
      },
    },
  ]);

  const total = row?.total ?? 0;
  const done = row?.done ?? 0;
  return {
    counts: {
      todo: row?.todo ?? 0,
      in_progress: row?.in_progress ?? 0,
      in_review: row?.in_review ?? 0,
      done,
    },
    total,
    overdue: row?.overdue ?? 0,
    blocked: row?.blocked ?? 0,
    percentComplete: total ? Math.round((done / total) * 100) : 0,
  };
};

// FR-BOARD-09: reason, assignee, who flagged it and since when — longest-blocked first.
export const blockedTasks = async (tenant: TenantContext, projectId: string) => {
  const project = await loadProject(tenant, projectId);
  const rows = await forTenant(TaskModel, tenant.organization._id)
    .find({ projectId: project._id, "flag.type": "blocked" })
    .sort({ "flag.setAt": 1 })
    .lean();
  return toTasks(
    rows,
    new Map([[String(project._id), project.name]]),
    tenant.organization.timezone,
  );
};
