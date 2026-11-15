import { Types, type ClientSession, type QueryFilter } from "mongoose";
import {
  can,
  type Action,
  type Project,
  type ProjectFacts,
  type ProjectSummaryItem,
  type UserRef,
} from "@nexora/shared";
import { AppError } from "../../common/errors/app-error";
import { forTenant } from "../../common/db/tenant-scope";
import { withTransaction } from "../../common/db/transaction";
import type { AuthUser } from "../../common/middleware/authenticate";
import type { TenantContext } from "../../common/middleware/tenancy";
import { ActivityModel } from "../activity/activity.model";
import { CommentModel } from "../comments/comment.model";
import { recordActivity, type ActivityInput } from "../activity/activity.service";
import { MembershipModel } from "../members/membership.model";
import { TaskModel, type TaskRecord } from "../tasks/task.model";
import { UserModel } from "../users/user.model";
import { ProjectModel, type ProjectDoc } from "./project.model";

type Id = Types.ObjectId;

const projectNotFound = () => AppError.notFound("Project not found.");
const readOnly = () => AppError.forbidden("Archived projects are read-only. Restore it first.");
const duplicateName = () => AppError.duplicate("A project with this name already exists.");

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

export const actorOf = ({ membership }: TenantContext) => ({
  userId: String(membership.userId),
  role: membership.role,
});

export const factsOf = (project: { managerId?: Id | null; memberIds: Id[] }): ProjectFacts => ({
  managerId: project.managerId ? String(project.managerId) : null,
  memberIds: project.memberIds.map(String),
});

// Loads a project the caller may see. Others' projects are "not found" (TEN-6, Roles §2).
export const loadProject = async (tenant: TenantContext, projectId: string) => {
  const project = await forTenant(ProjectModel, tenant.organization._id)
    .findById(projectId)
    .catch(() => null); // malformed ID
  if (!project || !can(actorOf(tenant), "project.view", factsOf(project))) throw projectNotFound();
  return project;
};

const requirePermission = (
  tenant: TenantContext,
  action: Extract<Action, "project.update" | "project.manageMembers">,
  project: ProjectDoc,
) => {
  if (!can(actorOf(tenant), action, factsOf(project))) throw AppError.forbidden();
};

export const assertActive = (project: { status: string }) => {
  if (project.status === "archived") throw readOnly(); // R7
};

const snapshot = (project: { name: string }) => ({ projectName: project.name });

const activity = (
  tenant: TenantContext,
  actor: AuthUser,
  project: { _id: Id; name: string },
  entry: Omit<ActivityInput, "organizationId" | "projectId" | "actorId" | "snapshot">,
): ActivityInput => ({
  organizationId: tenant.organization._id,
  projectId: project._id,
  actorId: actor._id,
  snapshot: snapshot(project),
  ...entry,
});

const userRefs = async (ids: Id[]): Promise<Map<string, UserRef>> => {
  const users = await UserModel.find({ _id: { $in: ids } })
    .select("name avatar")
    .lean();
  return new Map(
    users.map((u) => [
      String(u._id),
      { id: String(u._id), name: u.name, avatarUrl: u.avatar?.url ?? null },
    ]),
  );
};

const toProject = async (project: ProjectDoc): Promise<Project> => {
  const refs = await userRefs([
    ...project.memberIds,
    ...(project.managerId ? [project.managerId] : []),
  ]);
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? undefined,
    status: project.status,
    manager: project.managerId ? (refs.get(String(project.managerId)) ?? null) : null,
    members: project.memberIds
      .map((id) => refs.get(String(id)))
      .filter((u): u is UserRef => Boolean(u))
      .sort((a, b) => a.name.localeCompare(b.name)),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
};

// NFR-ISO-05: every referenced user must belong to this organization.
const assertOrgMembers = async (organizationId: Id, userIds: Id[]) => {
  const found = await forTenant(MembershipModel, organizationId).countDocuments({
    userId: { $in: userIds },
  });
  if (found !== new Set(userIds.map(String)).size) {
    throw AppError.validation("Every member must belong to this organization.");
  }
};

// R3: the manager must be a Project Manager or Tenant Admin of this organization.
const assertCanManage = async (organizationId: Id, userId: Id) => {
  const membership = await forTenant(MembershipModel, organizationId).findOne({ userId });
  if (!membership || membership.role === "member") {
    throw AppError.validation("The manager must be a Project Manager or Tenant Admin.");
  }
};

// ---------- list / create / view (FR-PROJ-01, 02, 05) ----------

export const listProjects = async (
  tenant: TenantContext,
  { status, page, limit }: { status?: "active" | "archived"; page: number; limit: number },
) => {
  const filter = {
    ...(status ? { status } : {}),
    // Admins see every project; everyone else only projects they belong to.
    ...(can(actorOf(tenant), "project.viewAll") ? {} : { memberIds: tenant.membership.userId }),
  };
  const repo = forTenant(ProjectModel, tenant.organization._id);
  const [total, projects] = await Promise.all([
    repo.countDocuments(filter),
    repo
      .find(filter)
      .sort({ status: 1, updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const ids = projects.map((p) => p._id);
  const counts = await TaskModel.aggregate<{ _id: Id; total: number; done: number }>([
    { $match: { organizationId: tenant.organization._id, projectId: { $in: ids } } },
    {
      $group: {
        _id: "$projectId",
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
      },
    },
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c]));
  const managers = await userRefs(projects.flatMap((p) => (p.managerId ? [p.managerId] : [])));

  const items: ProjectSummaryItem[] = projects.map((p) => ({
    id: String(p._id),
    name: p.name,
    description: p.description ?? undefined,
    status: p.status,
    manager: p.managerId ? (managers.get(String(p.managerId)) ?? null) : null,
    memberCount: p.memberIds.length,
    taskCount: countById.get(String(p._id))?.total ?? 0,
    doneCount: countById.get(String(p._id))?.done ?? 0,
    updatedAt: p.updatedAt.toISOString(),
  }));
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const createProject = async (
  tenant: TenantContext,
  user: AuthUser,
  input: { name: string; description?: string; managerId?: string },
): Promise<Project> => {
  if (!can(actorOf(tenant), "project.create")) throw AppError.forbidden();

  // FR-PROJ-02: a Project Manager manages what they create; an admin may pick (default: self).
  const isAdmin = tenant.membership.role === "admin";
  const managerId = isAdmin && input.managerId ? new Types.ObjectId(input.managerId) : user._id;
  if (!managerId.equals(user._id)) await assertCanManage(tenant.organization._id, managerId);

  try {
    const project = await withTransaction(async (session) => {
      const created = await forTenant(ProjectModel, tenant.organization._id).create(
        {
          name: input.name,
          description: input.description,
          managerId,
          memberIds: [managerId],
          status: "active",
          createdBy: user._id,
        },
        session,
      );
      await recordActivity(session, activity(tenant, user, created, { action: "project.created" }));
      return created;
    });
    return toProject(project);
  } catch (error) {
    if (isDuplicateKeyError(error)) throw duplicateName();
    throw error;
  }
};

export const getProject = async (tenant: TenantContext, projectId: string) =>
  toProject(await loadProject(tenant, projectId));

// ---------- change (FR-PROJ-02 – 04, 06) ----------

export const updateProject = async (
  tenant: TenantContext,
  user: AuthUser,
  projectId: string,
  input: { name: string; description?: string },
): Promise<Project> => {
  const project = await loadProject(tenant, projectId);
  requirePermission(tenant, "project.update", project);
  assertActive(project);

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (project.name !== input.name) changes.name = { from: project.name, to: input.name };
  if ((project.description ?? undefined) !== input.description) {
    changes.description = { from: project.description ?? null, to: input.description ?? null };
  }
  if (Object.keys(changes).length === 0) return toProject(project);

  try {
    await withTransaction(async (session) => {
      project.set({ name: input.name, description: input.description });
      if (input.description === undefined) project.set("description", undefined);
      await project.save({ session });
      await recordActivity(
        session,
        activity(tenant, user, project, { action: "project.updated", changes }),
      );
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw duplicateName();
    throw error;
  }
  return toProject(project);
};

export const setManager = async (
  tenant: TenantContext,
  user: AuthUser,
  projectId: string,
  managerUserId: string,
): Promise<Project> => {
  if (!can(actorOf(tenant), "project.setManager")) throw AppError.forbidden();
  const project = await loadProject(tenant, projectId);
  assertActive(project);
  const managerId = new Types.ObjectId(managerUserId);
  await assertCanManage(tenant.organization._id, managerId);

  if (!project.managerId?.equals(managerId)) {
    await withTransaction(async (session) => {
      const from = project.managerId ? String(project.managerId) : null;
      project.managerId = managerId;
      // The manager is always a member (R3).
      if (!project.memberIds.some((id) => id.equals(managerId))) project.memberIds.push(managerId);
      await project.save({ session });
      await recordActivity(
        session,
        activity(tenant, user, project, {
          action: "project.updated",
          changes: { managerId: { from, to: String(managerId) } },
        }),
      );
    });
  }
  return toProject(project);
};

export const addMembers = async (
  tenant: TenantContext,
  user: AuthUser,
  projectId: string,
  userIds: string[],
): Promise<Project> => {
  const project = await loadProject(tenant, projectId);
  requirePermission(tenant, "project.manageMembers", project);
  assertActive(project);

  const ids = [...new Set(userIds)].map((id) => new Types.ObjectId(id));
  await assertOrgMembers(tenant.organization._id, ids);
  const added = ids.filter((id) => !project.memberIds.some((m) => m.equals(id)));

  if (added.length > 0) {
    await withTransaction(async (session) => {
      project.memberIds.push(...added);
      await project.save({ session });
      await recordActivity(
        session,
        ...added.map((id) =>
          activity(tenant, user, project, {
            action: "project.member_added",
            changes: { member: { from: null, to: String(id) } },
          }),
        ),
      );
    });
  }
  return toProject(project);
};

/**
 * R5 (data part): a member leaving a project — or the organization — has their open tasks
 * unassigned, in the same transaction. Notifying the manager arrives in Sprint 6.
 */
export const unassignOpenTasks = async (
  organizationId: Id,
  userId: Id,
  projectIds: Id[] | "all",
  session: ClientSession,
  actorId: Id,
) => {
  const filter: QueryFilter<TaskRecord> = {
    organizationId,
    assigneeId: userId,
    status: { $ne: "done" },
    ...(projectIds === "all" ? {} : { projectId: { $in: projectIds } }),
  };
  const tasks = await TaskModel.find(filter).session(session).lean();
  if (tasks.length === 0) return;

  await TaskModel.updateMany(
    filter,
    { $unset: { assigneeId: 1 }, $inc: { version: 1 } },
    { session },
  );
  const projects = await ProjectModel.find(
    { organizationId, _id: { $in: tasks.map((t) => t.projectId) } },
    null,
    { session },
  )
    .select("name")
    .lean();
  const nameOf = new Map(projects.map((p) => [String(p._id), p.name]));
  await recordActivity(
    session,
    ...tasks.map((t) => ({
      organizationId,
      projectId: t.projectId,
      taskId: t._id,
      actorId,
      action: "task.unassigned" as const,
      changes: { assigneeId: { from: String(userId), to: null } },
      snapshot: { projectName: nameOf.get(String(t.projectId)) ?? "", taskTitle: t.title },
    })),
  );
};

export const removeMember = async (
  tenant: TenantContext,
  user: AuthUser,
  projectId: string,
  memberUserId: string,
): Promise<Project> => {
  const project = await loadProject(tenant, projectId);
  requirePermission(tenant, "project.manageMembers", project);
  assertActive(project);

  const memberId = new Types.ObjectId(memberUserId);
  if (!project.memberIds.some((id) => id.equals(memberId)))
    throw AppError.notFound("Member not found.");
  if (project.managerId?.equals(memberId)) {
    throw AppError.validation(
      "The project manager cannot be removed. Assign another manager first.",
    );
  }

  await withTransaction(async (session) => {
    project.memberIds = project.memberIds.filter((id) => !id.equals(memberId));
    await project.save({ session });
    await unassignOpenTasks(tenant.organization._id, memberId, [project._id], session, user._id);
    await recordActivity(
      session,
      activity(tenant, user, project, {
        action: "project.member_removed",
        changes: { member: { from: String(memberId), to: null } },
      }),
    );
  });
  return toProject(project);
};

// FR-PROJ-06 / R7
export const setArchived = async (
  tenant: TenantContext,
  user: AuthUser,
  projectId: string,
  archived: boolean,
): Promise<Project> => {
  const project = await loadProject(tenant, projectId);
  requirePermission(tenant, "project.update", project);
  const target = archived ? "archived" : "active";
  if (project.status !== target) {
    await withTransaction(async (session) => {
      project.status = target;
      await project.save({ session });
      await recordActivity(
        session,
        activity(tenant, user, project, {
          action: archived ? "project.archived" : "project.restored",
        }),
      );
    });
  }
  return toProject(project);
};

// FR-PROJ-07: the project, its tasks and its activity, all or nothing. (Comments and
// notifications join this transaction when they exist — Sprints 5 and 6.)
export const deleteProject = async (tenant: TenantContext, projectId: string) => {
  if (!can(actorOf(tenant), "project.delete")) throw AppError.forbidden();
  const project = await loadProject(tenant, projectId);
  const organizationId = tenant.organization._id;

  await withTransaction(async (session) => {
    await TaskModel.deleteMany({ organizationId, projectId: project._id }, { session });
    await CommentModel.deleteMany({ organizationId, projectId: project._id }, { session });
    await ActivityModel.deleteMany({ organizationId, projectId: project._id }, { session });
    await ProjectModel.deleteOne({ organizationId, _id: project._id }, { session });
  });
};

// ---------- organization membership hooks (R5, R6) ----------

// Called inside the member transaction when someone leaves or is removed from the organization.
export const onMemberLeavingOrganization = async (
  organizationId: Id,
  userId: Id,
  actorId: Id,
  session: ClientSession,
) => {
  await unassignOpenTasks(organizationId, userId, "all", session, actorId);
  await ProjectModel.updateMany(
    { organizationId, managerId: userId },
    { $unset: { managerId: 1 } }, // R6
    { session },
  );
  await ProjectModel.updateMany(
    { organizationId, memberIds: userId },
    { $pull: { memberIds: userId } },
    { session },
  );
};

// R6: a Project Manager demoted to Team Member no longer manages projects.
export const onDemotedToMember = async (organizationId: Id, userId: Id, session: ClientSession) => {
  await ProjectModel.updateMany(
    { organizationId, managerId: userId },
    { $unset: { managerId: 1 } },
    { session },
  );
};

// Projects a Project Manager manages (R11 for invitations).
export const managedProjectIds = async (organizationId: Id, userId: Id) =>
  (
    await forTenant(ProjectModel, organizationId).find({ managerId: userId }).select("_id").lean()
  ).map((p) => String(p._id));
