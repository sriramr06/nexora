import type { ClientSession, Types } from "mongoose";
import type { Member, OrgRole } from "@nexora/shared";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import { forTenant } from "../../common/db/tenant-scope";
import { withTransaction } from "../../common/db/transaction";
import type { TenantContext } from "../../common/middleware/tenancy";
import { revokePendingInvitationsBy } from "../invitations/invitation.service";
import { OrganizationModel } from "../organizations/organization.model";
import { UserModel } from "../users/user.model";
import { MembershipModel } from "./membership.model";

// FR-MEM-01: members with name, email, avatar and role, sorted by name.
export const listMembers = async (
  organizationId: Types.ObjectId,
  { page, limit }: { page: number; limit: number },
) => {
  const repo = forTenant(MembershipModel, organizationId);
  const [total, rows] = await Promise.all([
    repo.countDocuments(),
    MembershipModel.aggregate<{
      userId: Types.ObjectId;
      role: OrgRole;
      createdAt: Date;
      user: { name: string; email: string; avatar?: { url: string } };
    }>([
      { $match: { organizationId } }, // first stage scoped: required by the tenant guard
      { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $sort: { "user.name": 1, _id: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          userId: 1,
          role: 1,
          createdAt: 1,
          "user.name": 1,
          "user.email": 1,
          "user.avatar.url": 1,
        },
      },
    ]),
  ]);

  const items: Member[] = rows.map((r) => ({
    userId: String(r.userId),
    name: r.user.name,
    email: r.user.email,
    avatarUrl: r.user.avatar?.url ?? null,
    role: r.role,
    joinedAt: r.createdAt.toISOString(),
  }));
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const lastAdmin = (message: string) => new AppError(409, ERROR_CODES.LAST_ADMIN, message);

/**
 * R1 — an organization always keeps at least one Tenant Admin.
 *
 * Write skew: two admins demoting each other at the same moment would each see "another
 * admin exists" and both succeed, leaving none. Every change to the admin set therefore
 * first increments organizations.adminsVersion inside the transaction. Concurrent
 * transactions now write the same document, so MongoDB aborts one with a write conflict;
 * withTransaction retries it, and the retry sees the other change and is refused.
 */
const guardAdminChange = async (
  organizationId: Types.ObjectId,
  leavingAdminUserId: Types.ObjectId,
  session: ClientSession,
  message: string,
) => {
  await OrganizationModel.updateOne(
    { _id: organizationId },
    { $inc: { adminsVersion: 1 } },
    { session },
  );
  const otherAdmins = await MembershipModel.countDocuments(
    { organizationId, role: "admin", userId: { $ne: leavingAdminUserId } },
    { session },
  );
  if (otherAdmins === 0) throw lastAdmin(message);
};

const loadMember = async (organizationId: Types.ObjectId, userId: string) => {
  const membership = await forTenant(MembershipModel, organizationId)
    .findOne({ userId })
    .catch(() => null); // malformed ID
  if (!membership) throw AppError.notFound("Member not found.");
  return membership;
};

// Leaving the role / organization as a Project Manager revokes their pending invitations (R12).
const applyR12 = async (
  organizationId: Types.ObjectId,
  previousRole: OrgRole,
  userId: Types.ObjectId,
  session: ClientSession,
) => {
  if (previousRole === "project_manager") {
    await revokePendingInvitationsBy(organizationId, userId, session);
  }
};

// FR-MEM-02 (Tenant Admin only — checked by authorize).
export const changeRole = async (
  { organization, membership: actor }: TenantContext,
  targetUserId: string,
  role: OrgRole,
): Promise<Member> => {
  const target = await loadMember(organization._id, targetUserId);
  const previousRole = target.role;

  if (previousRole !== role) {
    await withTransaction(async (session) => {
      const changesAdminSet = previousRole === "admin" || role === "admin";
      if (previousRole === "admin") {
        await guardAdminChange(
          organization._id,
          target.userId,
          session,
          "This is the only Tenant Admin. Make someone else an admin first.",
        );
      } else if (changesAdminSet) {
        // Promotions also bump the version so they serialize with concurrent demotions.
        await OrganizationModel.updateOne(
          { _id: organization._id },
          { $inc: { adminsVersion: 1 } },
          { session },
        );
      }
      await MembershipModel.updateOne(
        { _id: target._id, organizationId: organization._id },
        { $set: { role, updatedBy: actor.userId } },
        { session },
      );
      if (role === "member") await applyR12(organization._id, previousRole, target.userId, session);
    });
  }

  const user = await UserModel.findById(target.userId).select("name email avatar").lean();
  return {
    userId: String(target.userId),
    name: user?.name ?? "",
    email: user?.email ?? "",
    avatarUrl: user?.avatar?.url ?? null,
    role,
    joinedAt: target.createdAt.toISOString(),
  };
};

const removeMembership = async (
  organizationId: Types.ObjectId,
  target: { _id: Types.ObjectId; userId: Types.ObjectId; role: OrgRole },
  lastAdminMessage: string,
) =>
  withTransaction(async (session) => {
    if (target.role === "admin") {
      await guardAdminChange(organizationId, target.userId, session, lastAdminMessage);
    }
    await MembershipModel.deleteOne({ _id: target._id, organizationId }, { session });
    await applyR12(organizationId, target.role, target.userId, session);
    // R5 / R6 (unassign open tasks, unset managed projects) arrive with projects in Sprint 6.
  });

// FR-MEM-03 (Tenant Admin only). Removing yourself is "leave", a separate action.
export const removeMember = async (
  { organization, membership: actor }: TenantContext,
  targetUserId: string,
) => {
  const target = await loadMember(organization._id, targetUserId);
  if (String(target.userId) === String(actor.userId)) {
    throw AppError.validation("To remove yourself, leave the organization instead.");
  }
  await removeMembership(
    organization._id,
    target,
    "This is the only Tenant Admin and cannot be removed.",
  );
};

// FR-MEM-04
export const leaveOrganization = async ({ organization, membership }: TenantContext) => {
  await removeMembership(
    organization._id,
    membership,
    "You are the only Tenant Admin. Make someone else an admin before leaving.",
  );
};
