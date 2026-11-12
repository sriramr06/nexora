import type { Types } from "mongoose";
import type { MyOrganization, OrganizationDetails, OrganizationWithRole } from "@nexora/shared";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import { withTransaction } from "../../common/db/transaction";
import { forTenant } from "../../common/db/tenant-scope";
import type { AuthUser } from "../../common/middleware/authenticate";
import type { TenantContext } from "../../common/middleware/tenancy";
import { MembershipModel } from "../members/membership.model";
import { OrganizationModel } from "./organization.model";
import { toOrganization } from "./organization.serializer";

const OPEN_STATUSES = ["pending_approval", "rejected"] as const;

const openRegistrationExists = () =>
  new AppError(
    409,
    ERROR_CODES.DUPLICATE,
    "You already have an organization awaiting approval. Wait for a decision, or update and resubmit it.",
  );

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

const historyEntry = (
  status: (typeof OPEN_STATUSES)[number] | "active",
  userId: Types.ObjectId,
) => ({ status, changedBy: userId, changedAt: new Date() });

// US-06, FR-ORG-01/02/09, R2, R8.
export const registerOrganization = async (
  user: AuthUser,
  details: OrganizationDetails,
): Promise<OrganizationWithRole> => {
  if (user.platformRole === "owner") {
    throw AppError.forbidden("The Application Owner cannot belong to organizations.");
  }

  // Fast, friendly check; the partial unique index is the real guarantee under races.
  if (await OrganizationModel.exists({ createdBy: user._id, status: { $in: OPEN_STATUSES } })) {
    throw openRegistrationExists();
  }

  try {
    return await withTransaction(async (session) => {
      // Organization and its first Tenant Admin are created together, or not at all.
      const [organization] = await OrganizationModel.create(
        [
          {
            ...details,
            status: "pending_approval",
            statusHistory: [historyEntry("pending_approval", user._id)],
            createdBy: user._id,
          },
        ],
        { session },
      );
      await forTenant(MembershipModel, organization!._id).create(
        { userId: user._id, role: "admin" },
        session,
      );
      return { organization: toOrganization(organization!), role: "admin" };
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw openRegistrationExists();
    throw error;
  }
};

export const getOrganization = ({ organization, membership }: TenantContext) => ({
  organization: toOrganization(organization),
  role: membership.role,
});

// FR-ORG-04/05: editable while Active, or while Rejected (before resubmitting).
export const updateOrganization = async (
  { organization, membership }: TenantContext,
  user: AuthUser,
  details: OrganizationDetails,
): Promise<OrganizationWithRole> => {
  if (organization.status !== "active" && organization.status !== "rejected") {
    throw new AppError(
      403,
      ERROR_CODES.ORG_NOT_ACTIVE,
      "Details cannot be changed while the organization is " +
        (organization.status === "pending_approval" ? "awaiting approval." : "suspended."),
    );
  }

  organization.set({ ...details, updatedBy: user._id });
  // Optional fields cleared in the form must be removed, not left unchanged.
  if (details.website === undefined) organization.set("website", undefined);
  if (details.description === undefined) organization.set("description", undefined);
  await organization.save();

  return { organization: toOrganization(organization), role: membership.role };
};

// FR-ORG-04: Rejected → Pending Approval. Atomic, so a double click resubmits once.
export const resubmitOrganization = async (
  { organization, membership }: TenantContext,
  user: AuthUser,
): Promise<OrganizationWithRole> => {
  const updated = await OrganizationModel.findOneAndUpdate(
    { _id: organization._id, status: "rejected" },
    {
      $set: { status: "pending_approval" },
      $push: { statusHistory: historyEntry("pending_approval", user._id) },
    },
    { returnDocument: "after" },
  );
  if (!updated) {
    throw new AppError(
      409,
      ERROR_CODES.INVALID_TRANSITION,
      "Only a rejected organization can be resubmitted.",
    );
  }
  return { organization: toOrganization(updated), role: membership.role };
};

// GET /me/organizations — the switcher (FR-ORG-06). A legitimate cross-tenant read,
// scoped by the caller's own userId, so it uses the explicit bypass.
export const listMyOrganizations = async (userId: Types.ObjectId): Promise<MyOrganization[]> => {
  const memberships = await MembershipModel.find({ userId })
    .setOptions({ tenantScope: "bypass" })
    .lean();
  const orgs = await OrganizationModel.find({
    _id: { $in: memberships.map((m) => m.organizationId) },
  })
    .select("name status")
    .lean();

  const byId = new Map(orgs.map((o) => [String(o._id), o]));
  return memberships
    .map((m) => {
      const org = byId.get(String(m.organizationId));
      return org && { id: String(org._id), name: org.name, status: org.status, role: m.role };
    })
    .filter((o): o is MyOrganization => Boolean(o))
    .sort((a, b) => a.name.localeCompare(b.name));
};
