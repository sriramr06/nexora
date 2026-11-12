import { Types, type ClientSession, type QueryFilter } from "mongoose";
import { can, type Task, type TaskPriority, type TaskStatus, type UserRef } from "@nexora/shared";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import { forTenant } from "../../common/db/tenant-scope";
import { withTransaction } from "../../common/db/transaction";
import type { AuthUser } from "../../common/middleware/authenticate";
import type { TenantContext } from "../../common/middleware/tenancy";
import { listActivity, recordActivity } from "../activity/activity.service";
import { ProjectModel, type ProjectDoc } from "../projects/project.model";
import { actorOf, assertActive, factsOf, loadProject } from "../projects/project.service";
import { UserModel } from "../users/user.model";
import { TaskModel, type TaskDoc, type TaskRecord } from "./task.model";

type Id = Types.ObjectId;

const taskNotFound = () => AppError.notFound("Task not found.");
const versionConflict = () =>
  new AppError(
    409,
    ERROR_CODES.VERSION_CONFLICT,
    "Someone else changed this task. Load the latest version and try again.",
  );

// ---------- dates (data model §4.6) ----------

// "2026-11-30" ↔ UTC midnight of that calendar date.
const toDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const toDay = (date: Date) => date.toISOString().slice(0, 10);

// FR-TASK-10: "today" in the organization's timezone, not the server's.
export const todayIn = (timezone: string, now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

const isOverdue = (task: { status: string; dueDate?: Date | null }, today: string) =>
  task.status !== "done" && Boolean(task.dueDate) && toDay(task.dueDate!) < today;

// ---------- loading and mapping ----------

const userRefs = async (ids: (Id | null | undefined)[]): Promise<Map<string, UserRef>> => {
  const present = ids.filter((id): id is Id => Boolean(id));
  const users = await UserModel.find({ _id: { $in: present } })
    .select("name avatar")
    .lean();
  return new Map(
    users.map((u) => [
      String(u._id),
      { id: String(u._id), name: u.name, avatarUrl: u.avatar?.url ?? null },
    ]),
  );
};

export const toTasks = async (
  tasks: (TaskRecord & { _id: Id })[],
  projectNames: Map<string, string>,
  timezone: string,
): Promise<Task[]> => {
  const refs = await userRefs(tasks.flatMap((t) => [t.assigneeId, t.createdBy, t.flag?.setBy]));
  const today = todayIn(timezone);
  return tasks.map((t) => ({
    id: String(t._id),
    projectId: String(t.projectId),
    projectName: projectNames.get(String(t.projectId)) ?? "",
    title: t.title,
    description: t.description ?? undefined,
    status: t.status,
    priority: t.priority,
    assignee: t.assigneeId ? (refs.get(String(t.assigneeId)) ?? null) : null,
    dueDate: t.dueDate ? toDay(t.dueDate) : null,
    overdue: isOverdue(t, today),
    flag: t.flag
      ? {
          type: t.flag.type,
          reason: t.flag.reason,
          setBy: refs.get(String(t.flag.setBy)) ?? null,
          setAt: t.flag.setAt.toISOString(),
        }
      : null,
    createdBy: refs.get(String(t.createdBy)) ?? null,
    version: t.version,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
};

const toTask = async (
  tenant: TenantContext,
  task: TaskDoc | (TaskRecord & { _id: Id }),
  project: { _id: Id; name: string },
) =>
  (
    await toTasks(
      ["toObject" in task ? (task as TaskDoc).toObject() : task],
      new Map([[String(project._id), project.name]]),
      tenant.organization.timezone,
    )
  )[0]!;

// A task is visible only through its project: no project access → "not found" (Roles §2).
const loadTask = async (tenant: TenantContext, taskId: string) => {
  const task = await forTenant(TaskModel, tenant.organization._id)
    .findById(taskId)
    .catch(() => null);
  if (!task) throw taskNotFound();
  const project = await loadProject(tenant, String(task.projectId)).catch(() => {
    throw taskNotFound();
  });
  return { task, project };
};

const taskFacts = (project: ProjectDoc, task: { assigneeId?: Id | null; createdBy: Id }) => ({
  ...factsOf(project),
  assigneeId: task.assigneeId ? String(task.assigneeId) : null,
  createdBy: String(task.createdBy),
});

// R4: the assignee must be a member of the task's project.
const assertProjectMember = (project: ProjectDoc, userId: string) => {
  if (!project.memberIds.some((id) => id.equals(userId))) {
    throw AppError.validation("The assignee must be a member of this project.");
  }
};

const snapshotOf = (project: { name: string }, task: { title: string }) => ({
  projectName: project.name,
  taskTitle: task.title,
});

/**
 * Optimistic concurrency (API design §6): the update applies only if the stored version
 * is still the one the client saw, and bumps it. A stale write gets 409 instead of
 * silently overwriting someone else's change.
 */
const updateIfVersion = async (
  organizationId: Id,
  taskId: Id,
  version: number,
  update: Record<string, unknown>,
  session: ClientSession,
) => {
  const updated = await TaskModel.findOneAndUpdate(
    { _id: taskId, organizationId, version },
    { ...update, $inc: { version: 1 } },
    { session, returnDocument: "after" },
  );
  if (!updated) throw versionConflict();
  return updated;
};

// ---------- create / read (FR-TASK-01, 02, 05, 06) ----------

export const createTask = async (
  tenant: TenantContext,
  user: AuthUser,
  projectId: string,
  input: {
    title: string;
    description?: string;
    priority: TaskPriority;
    dueDate?: string;
    assigneeId?: string | null;
  },
): Promise<Task> => {
  const project = await loadProject(tenant, projectId);
  assertActive(project); // R7
  const facts = factsOf(project);
  if (!can(actorOf(tenant), "task.create", facts)) throw AppError.forbidden();

  const assigneeId = input.assigneeId ?? null;
  if (assigneeId) {
    assertProjectMember(project, assigneeId);
    // FR-TASK-06: Team Members may leave a task unassigned or assign it to themselves only.
    if (
      !can(actorOf(tenant), "task.assign", {
        ...facts,
        assigneeId: null,
        createdBy: String(user._id),
        newAssigneeId: assigneeId,
      })
    ) {
      throw AppError.forbidden("You can only assign new tasks to yourself.");
    }
  }

  const task = await withTransaction(async (session) => {
    const created = await forTenant(TaskModel, tenant.organization._id).create(
      {
        projectId: project._id,
        title: input.title,
        description: input.description,
        status: "todo", // FR-TASK-02
        priority: input.priority,
        dueDate: input.dueDate ? toDate(input.dueDate) : undefined,
        assigneeId: assigneeId ? new Types.ObjectId(assigneeId) : undefined,
        createdBy: user._id,
        version: 0,
      } as never,
      session,
    );
    const base = {
      organizationId: tenant.organization._id,
      projectId: project._id,
      taskId: created._id,
      actorId: user._id,
      snapshot: snapshotOf(project, created),
    };
    await recordActivity(
      session,
      { ...base, action: "task.created" },
      ...(assigneeId
        ? [
            {
              ...base,
              action: "task.assigned" as const,
              changes: { assigneeId: { from: null, to: assigneeId } },
            },
          ]
        : []),
    );
    return created;
  });
  return toTask(tenant, task, project);
};

export const getTask = async (tenant: TenantContext, taskId: string) => {
  const { task, project } = await loadTask(tenant, taskId);
  return toTask(tenant, task, project);
};

export const listProjectTasks = async (tenant: TenantContext, projectId: string) => {
  const project = await loadProject(tenant, projectId);
  const tasks = await forTenant(TaskModel, tenant.organization._id)
    .find({ projectId: project._id })
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  return toTasks(
    tasks,
    new Map([[String(project._id), project.name]]),
    tenant.organization.timezone,
  );
};

// ---------- change (FR-TASK-05 – 09) ----------

export const updateTask = async (
  tenant: TenantContext,
  user: AuthUser,
  taskId: string,
  input: {
    title: string;
    description?: string;
    priority: TaskPriority;
    dueDate: string | null;
    version: number;
  },
): Promise<Task> => {
  const { task, project } = await loadTask(tenant, taskId);
  assertActive(project);
  if (!can(actorOf(tenant), "task.edit", taskFacts(project, task))) throw AppError.forbidden();

  const next = {
    title: input.title,
    description: input.description ?? null,
    priority: input.priority,
    dueDate: input.dueDate,
  };
  const before = {
    title: task.title,
    description: task.description ?? null,
    priority: task.priority,
    dueDate: task.dueDate ? toDay(task.dueDate) : null,
  };
  const changes = Object.fromEntries(
    (Object.keys(next) as (keyof typeof next)[])
      .filter((k) => before[k] !== next[k])
      .map((k) => [k, { from: before[k], to: next[k] }]),
  );

  const updated = await withTransaction(async (session) => {
    const set: Record<string, unknown> = { title: next.title, priority: next.priority };
    const unset: Record<string, 1> = {};
    if (next.description) set.description = next.description;
    else unset.description = 1;
    if (next.dueDate) set.dueDate = toDate(next.dueDate);
    else unset.dueDate = 1;

    const doc = await updateIfVersion(
      tenant.organization._id,
      task._id,
      input.version,
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      session,
    );
    if (Object.keys(changes).length > 0) {
      await recordActivity(session, {
        organizationId: tenant.organization._id,
        projectId: project._id,
        taskId: task._id,
        actorId: user._id,
        action: "task.updated",
        changes,
        snapshot: snapshotOf(project, doc),
      });
    }
    return doc;
  });
  return toTask(tenant, updated, project);
};

export const setAssignee = async (
  tenant: TenantContext,
  user: AuthUser,
  taskId: string,
  { assigneeId, version }: { assigneeId: string | null; version: number },
): Promise<Task> => {
  const { task, project } = await loadTask(tenant, taskId);
  assertActive(project);
  const current = task.assigneeId ? String(task.assigneeId) : null;

  if (
    !can(actorOf(tenant), "task.assign", { ...taskFacts(project, task), newAssigneeId: assigneeId })
  ) {
    throw AppError.forbidden(
      "Only the project's manager or a Tenant Admin can reassign or unassign tasks.",
    );
  }
  if (assigneeId) assertProjectMember(project, assigneeId);
  if (current === assigneeId) {
    if (task.version !== version) throw versionConflict();
    return toTask(tenant, task, project);
  }

  const updated = await withTransaction(async (session) => {
    const doc = await updateIfVersion(
      tenant.organization._id,
      task._id,
      version,
      assigneeId
        ? { $set: { assigneeId: new Types.ObjectId(assigneeId) } }
        : { $unset: { assigneeId: 1 } },
      session,
    );
    await recordActivity(session, {
      organizationId: tenant.organization._id,
      projectId: project._id,
      taskId: task._id,
      actorId: user._id,
      action: assigneeId ? "task.assigned" : "task.unassigned",
      changes: { assigneeId: { from: current, to: assigneeId } },
      snapshot: snapshotOf(project, doc),
    });
    return doc;
  });
  return toTask(tenant, updated, project);
};

// FR-TASK-09. History is kept (FR-ACT-05) with the title snapshot.
export const deleteTask = async (tenant: TenantContext, user: AuthUser, taskId: string) => {
  const { task, project } = await loadTask(tenant, taskId);
  assertActive(project);
  if (!can(actorOf(tenant), "task.delete", factsOf(project))) throw AppError.forbidden();

  await withTransaction(async (session) => {
    await TaskModel.deleteOne(
      { _id: task._id, organizationId: tenant.organization._id },
      { session },
    );
    await recordActivity(session, {
      organizationId: tenant.organization._id,
      projectId: project._id,
      taskId: task._id,
      actorId: user._id,
      action: "task.deleted",
      snapshot: snapshotOf(project, task),
    });
  });
};

// ---------- history and My Tasks ----------

// FR-ACT-03
export const taskActivity = async (
  tenant: TenantContext,
  taskId: string,
  page: { cursor?: string; limit: number },
) => {
  const { task } = await loadTask(tenant, taskId);
  return listActivity({ organizationId: tenant.organization._id, taskId: task._id }, page);
};

const STATUS_ORDER: Record<TaskStatus, number> = { in_progress: 0, in_review: 1, todo: 2, done: 3 };

// FR-TASK-11: my assigned tasks across projects I can still access (active projects),
// soonest due first, tasks without a due date last.
export const myTasks = async (
  tenant: TenantContext,
  { status, page, limit }: { status?: TaskStatus; page: number; limit: number },
) => {
  const organizationId = tenant.organization._id;
  const userId = tenant.membership.userId;
  const projects = await forTenant(ProjectModel, organizationId)
    .find({ status: "active", memberIds: userId })
    .select("name")
    .lean();
  const names = new Map(projects.map((p) => [String(p._id), p.name]));

  const filter: QueryFilter<TaskRecord> = {
    organizationId,
    assigneeId: userId,
    projectId: { $in: projects.map((p) => p._id) },
    ...(status ? { status } : {}),
  };
  const [total, rows] = await Promise.all([
    TaskModel.countDocuments(filter),
    TaskModel.aggregate<TaskRecord & { _id: Id }>([
      { $match: filter },
      { $addFields: { _noDue: { $cond: [{ $ifNull: ["$dueDate", false] }, 0, 1] } } },
      { $sort: { _noDue: 1, dueDate: 1, createdAt: -1, _id: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: { _noDue: 0 } },
    ]),
  ]);
  const items = (await toTasks(rows, names, tenant.organization.timezone)).sort((a, b) =>
    a.dueDate === b.dueDate ? STATUS_ORDER[a.status] - STATUS_ORDER[b.status] : 0,
  );
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};
