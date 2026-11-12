import { isValidObjectId, type Types } from "mongoose";
import type {
  OrgStatus,
  PlatformOrganizationDetails,
  PlatformOrganizationSummary,
  platformOrganizationsQuerySchema,
} from "@nexora/shared";
import type { z } from "zod";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import { forTenant } from "../../common/db/tenant-scope";
import { logger } from "../../common/logger";
import type { AuthUser } from "../../common/middleware/authenticate";
import { getEmailService } from "../email/email.service";
import type { EmailContent } from "../email/templates";
import {
  appUrl,
  organizationApprovedEmail,
  organizationReactivatedEmail,
  organizationRejectedEmail,
  organizationSuspendedEmail,
} from "../email/templates";
import { MembershipModel } from "../members/membership.model";
import { OrganizationModel, type OrganizationDoc } from "../organizations/organization.model";
import { toOrganization } from "../organizations/organization.serializer";
import { UserModel } from "../users/user.model";

type ListQuery = z.output<typeof platformOrganizationsQuerySchema>;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const notFound = () => AppError.notFound("Organization not found.");

const loadOrganization = async (id: string) => {
  if (!isValidObjectId(id)) throw notFound();
  const org = await OrganizationModel.findById(id);
  if (!org) throw notFound();
  return org;
};

// US-09, FR-PLAT-02: filter by status, search by name, newest first.
export const listOrganizations = async ({ status, q, page, limit }: ListQuery) => {
  const filter = {
    ...(status ? { status } : {}),
    ...(q ? { name: { $regex: escapeRegex(q), $options: "i" } } : {}),
  };
  const [total, orgs] = await Promise.all([
    OrganizationModel.countDocuments(filter),
    OrganizationModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("name status country createdAt")
      .lean(),
  ]);

  const items: PlatformOrganizationSummary[] = orgs.map((o) => ({
    id: String(o._id),
    name: o.name,
    status: o.status,
    country: o.country,
    createdAt: o.createdAt.toISOString(),
  }));
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const adminsOf = async (orgId: Types.ObjectId) => {
  const admins = await forTenant(MembershipModel, orgId).find({ role: "admin" }).lean();
  return UserModel.find({ _id: { $in: admins.map((a) => a.userId) } })
    .select("name email")
    .lean();
};

// US-09, FR-PLAT-03: metadata only — never projects or tasks (D9, FR-PLAT-08).
export const getOrganizationDetails = async (id: string): Promise<PlatformOrganizationDetails> => {
  const org = await loadOrganization(id);

  const userIds = [org.createdBy, ...org.statusHistory.map((h) => h.changedBy)];
  const [memberCount, admins, users] = await Promise.all([
    forTenant(MembershipModel, org._id).countDocuments(),
    adminsOf(org._id),
    UserModel.find({ _id: { $in: userIds } })
      .select("name email")
      .lean(),
  ]);
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const creator = userById.get(String(org.createdBy));

  return {
    ...toOrganization(org),
    statusHistory: org.statusHistory.map((h) => {
      const by = userById.get(String(h.changedBy));
      return {
        status: h.status,
        reason: h.reason ?? undefined,
        changedBy: by ? { id: String(by._id), name: by.name } : null,
        changedAt: h.changedAt.toISOString(),
      };
    }),
    memberCount,
    admins: admins.map((a) => ({ id: String(a._id), name: a.name, email: a.email })),
    createdBy: creator
      ? { id: String(creator._id), name: creator.name, email: creator.email }
      : null,
  };
};

// FR-PLAT-07
export const renameOrganization = async (id: string, name: string, owner: AuthUser) => {
  const org = await loadOrganization(id);
  org.set({ name, updatedBy: owner._id });
  await org.save();
  return getOrganizationDetails(id);
};

// ---------- status lifecycle (FR-PLAT-04 – 06) ----------

type Transition = "approve" | "reject" | "suspend" | "reactivate";

const TRANSITIONS: Record<Transition, { from: OrgStatus; to: OrgStatus }> = {
  approve: { from: "pending_approval", to: "active" },
  reject: { from: "pending_approval", to: "rejected" },
  suspend: { from: "active", to: "suspended" },
  reactivate: { from: "suspended", to: "active" },
};

const sendSafely = async (to: string, content: EmailContent) => {
  try {
    await getEmailService().send({ to, ...content });
  } catch (err) {
    // The status change is already committed; a failed email must not undo or fail it.
    logger.error({ err, to, subject: content.subject }, "Failed to send organization email");
  }
};

const notify = async (transition: Transition, org: OrganizationDoc, reason?: string) => {
  const link = appUrl(`/o/${org.id}`);

  if (transition === "approve" || transition === "reject") {
    // FR-ORG-08: the submitting Tenant Admin.
    const creator = await UserModel.findById(org.createdBy).select("name email").lean();
    if (!creator) return;
    const content =
      transition === "approve"
        ? organizationApprovedEmail(creator.name, org.name, link)
        : organizationRejectedEmail(creator.name, org.name, reason!, link);
    await sendSafely(creator.email, content);
    return;
  }

  // FR-ORG-10: every Tenant Admin.
  const admins = await adminsOf(org._id);
  await Promise.all(
    admins.map((admin) =>
      sendSafely(
        admin.email,
        transition === "suspend"
          ? organizationSuspendedEmail(admin.name, org.name, reason!)
          : organizationReactivatedEmail(admin.name, org.name, link),
      ),
    ),
  );
};

const INVALID_TRANSITION_MESSAGES: Record<Transition, string> = {
  approve: "Only an organization awaiting approval can be approved.",
  reject: "Only an organization awaiting approval can be rejected.",
  suspend: "Only an active organization can be suspended.",
  reactivate: "Only a suspended organization can be reactivated.",
};

export const changeStatus = async (
  id: string,
  transition: Transition,
  owner: AuthUser,
  reason?: string,
): Promise<PlatformOrganizationDetails> => {
  const { from, to } = TRANSITIONS[transition];
  if (!isValidObjectId(id)) throw notFound();

  // Atomic compare-and-set on status: two Owners clicking at once cannot both win,
  // and the status and its history entry always change together.
  const updated = await OrganizationModel.findOneAndUpdate(
    { _id: id, status: from },
    {
      $set: { status: to },
      $push: {
        statusHistory: { status: to, reason, changedBy: owner._id, changedAt: new Date() },
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    const exists = await OrganizationModel.exists({ _id: id });
    if (!exists) throw notFound();
    throw new AppError(
      409,
      ERROR_CODES.INVALID_TRANSITION,
      INVALID_TRANSITION_MESSAGES[transition],
    );
  }

  await notify(transition, updated, reason);
  return getOrganizationDetails(id);
};
