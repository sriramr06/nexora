import { Types, type ClientSession, type QueryFilter } from "mongoose";
import {
  can,
  emailSchema,
  ORG_ROLE_LABELS,
  type BulkInviteResult,
  type Invitation,
  type InvitationListStatus,
  type InvitationLookup,
  type InviteResult,
  type OrgRole,
} from "@nexora/shared";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import { generateToken, hashToken } from "../../common/crypto/tokens";
import { forTenant } from "../../common/db/tenant-scope";
import { withTransaction } from "../../common/db/transaction";
import { logger } from "../../common/logger";
import type { AuthUser } from "../../common/middleware/authenticate";
import type { TenantContext } from "../../common/middleware/tenancy";
import { createSession, type AuthSession } from "../auth/auth.service";
import { hashPassword } from "../auth/password";
import { getEmailService } from "../email/email.service";
import { appLink, invitationEmail } from "../email/templates";
import { MembershipModel } from "../members/membership.model";
import { OrganizationModel } from "../organizations/organization.model";
import { UserModel } from "../users/user.model";
import { recordActivity } from "../activity/activity.service";
import { ProjectModel } from "../projects/project.model";
import { managedProjectIds } from "../projects/project.service";
import { InvitationModel, type InvitationDoc, type InvitationRecord } from "./invitation.model";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // FR-INV-02
const RESEND_COOLDOWN_MS = 5 * 60 * 1000; // FR-INV-05
const BULK_EMAIL_CONCURRENCY = 5; // integrations §3

const isExpired = (inv: Pick<InvitationRecord, "status" | "expiresAt">) =>
  inv.status === "pending" && inv.expiresAt.getTime() <= Date.now();

const listStatus = (inv: InvitationRecord): InvitationListStatus =>
  isExpired(inv) ? "expired" : inv.status;

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

const invalidInvitation = (message = "This invitation link is invalid.") =>
  new AppError(400, ERROR_CODES.INVITATION_INVALID, message);

const toInvitation = (
  inv: InvitationRecord & { _id: Types.ObjectId },
  inviters: Map<string, string>,
  projects: Map<string, string>,
): Invitation => {
  const inviterName = inviters.get(String(inv.invitedBy));
  return {
    id: String(inv._id),
    email: inv.email,
    role: inv.role,
    status: listStatus(inv),
    invitedBy: inviterName ? { id: String(inv.invitedBy), name: inviterName } : null,
    projects: (inv.projectIds ?? []).flatMap((id) => {
      const name = projects.get(String(id));
      return name ? [{ id: String(id), name }] : [];
    }),
    lastSentAt: inv.lastSentAt.toISOString(),
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  };
};

const inviterNames = async (ids: Types.ObjectId[]) => {
  const users = await UserModel.find({ _id: { $in: ids } })
    .select("name")
    .lean();
  return new Map(users.map((u) => [String(u._id), u.name]));
};

const projectNames = async (organizationId: Types.ObjectId, ids: Types.ObjectId[]) => {
  if (ids.length === 0) return new Map<string, string>();
  const projects = await forTenant(ProjectModel, organizationId)
    .find({ _id: { $in: ids } })
    .select("name")
    .lean();
  return new Map(projects.map((p) => [String(p._id), p.name]));
};

const actorOf = ({ membership }: TenantContext) => ({
  userId: String(membership.userId),
  role: membership.role,
});

// ---------- email ----------

const sendInvitationEmail = async (
  tenant: TenantContext,
  inviter: AuthUser,
  inv: InvitationDoc,
  token: string,
): Promise<boolean> => {
  try {
    const content = invitationEmail(
      tenant.organization.name,
      inviter.name,
      ORG_ROLE_LABELS[inv.role],
      appLink("/invite", token),
    );
    await getEmailService().send({ to: inv.email, ...content });
    return true;
  } catch (err) {
    // The invitation is kept; the inviter can resend (integrations §3).
    logger.error({ err, invitationId: inv.id }, "Failed to send invitation email");
    return false;
  }
};

// ---------- create (FR-INV-01, 04, 09, 10; R8, R10, R11) ----------

// Creates or renews the invitation document; returns it with the raw token for the email.
const issueInvitation = async (
  tenant: TenantContext,
  inviter: AuthUser,
  email: string,
  role: OrgRole,
  projectIds: string[],
): Promise<{ invitation: InvitationDoc; token: string }> => {
  const orgId = tenant.organization._id;
  const uniqueProjectIds = [...new Set(projectIds)];

  // R11: Project Managers invite Team Members only, to projects they manage.
  const managed =
    tenant.membership.role === "project_manager"
      ? await managedProjectIds(orgId, tenant.membership.userId)
      : [];
  if (
    !can(actorOf(tenant), "invitation.create", {
      role,
      projectIds: uniqueProjectIds,
      managedProjectIds: managed,
    })
  ) {
    throw AppError.forbidden(
      "Project Managers can invite Team Members only, to projects they manage.",
    );
  }
  if (uniqueProjectIds.length > 0) {
    const active = await forTenant(ProjectModel, orgId).countDocuments({
      _id: { $in: uniqueProjectIds },
      status: "active",
    });
    if (active !== uniqueProjectIds.length) {
      throw AppError.validation("Choose active projects in this organization.");
    }
  }

  const existingUser = await UserModel.findOne({ email }).select("platformRole").lean();
  if (existingUser?.platformRole === "owner") {
    throw AppError.validation("This email cannot be invited."); // R8 / FR-INV-09
  }
  if (
    existingUser &&
    (await forTenant(MembershipModel, orgId).exists({ userId: existingUser._id }))
  ) {
    throw AppError.duplicate("This person is already a member.");
  }

  const repo = forTenant(InvitationModel, orgId);
  const token = generateToken();
  const now = new Date();
  const fresh = {
    role,
    projectIds: uniqueProjectIds.map((id) => new Types.ObjectId(id)),
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
    invitedBy: inviter._id,
    lastSentAt: now,
  };

  const pending = await repo.findOne({ email, status: "pending" });
  if (pending && !isExpired(pending)) {
    throw AppError.duplicate("This email already has a pending invitation.");
  }

  try {
    if (pending) {
      // Re-inviting an expired invitation reuses the document (data model §4.4).
      pending.set(fresh);
      await pending.save();
      return { invitation: pending, token };
    }
    const invitation = await repo.create({ email, status: "pending", ...fresh });
    return { invitation, token };
  } catch (error) {
    // Two parallel invitations for the same email: the partial unique index wins.
    if (isDuplicateKeyError(error)) {
      throw AppError.duplicate("This email already has a pending invitation.");
    }
    throw error;
  }
};

export const createInvitation = async (
  tenant: TenantContext,
  inviter: AuthUser,
  { email, role, projectIds = [] }: { email: string; role: OrgRole; projectIds?: string[] },
): Promise<InviteResult> => {
  const { invitation, token } = await issueInvitation(tenant, inviter, email, role, projectIds);
  const emailSent = await sendInvitationEmail(tenant, inviter, invitation, token);
  const names = new Map([[String(inviter._id), inviter.name]]);
  const projects = await projectNames(tenant.organization._id, invitation.projectIds);
  return { invitation: toInvitation(invitation.toObject(), names, projects), emailSent };
};

// FR-INV-12: each address is validated and processed independently.
export const createBulkInvitations = async (
  tenant: TenantContext,
  inviter: AuthUser,
  { emails, role, projectIds = [] }: { emails: string[]; role: OrgRole; projectIds?: string[] },
): Promise<BulkInviteResult[]> => {
  const results: BulkInviteResult[] = [];
  const seen = new Set<string>();
  const toSend: { index: number; invitation: InvitationDoc; token: string }[] = [];

  for (const raw of emails) {
    const parsed = emailSchema.safeParse(raw);
    const email = parsed.success ? parsed.data : raw.trim();
    if (!parsed.success) {
      results.push({ email, outcome: "skipped", reason: "Not a valid email address." });
      continue;
    }
    if (seen.has(email)) {
      results.push({ email, outcome: "skipped", reason: "Listed more than once." });
      continue;
    }
    seen.add(email);
    try {
      const issued = await issueInvitation(tenant, inviter, email, role, projectIds);
      toSend.push({ index: results.length, ...issued });
      results.push({ email, outcome: "sent" });
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      results.push({ email, outcome: "skipped", reason: error.message });
    }
  }

  // Emails in parallel, at most 5 at a time.
  for (let i = 0; i < toSend.length; i += BULK_EMAIL_CONCURRENCY) {
    await Promise.all(
      toSend.slice(i, i + BULK_EMAIL_CONCURRENCY).map(async ({ index, invitation, token }) => {
        if (!(await sendInvitationEmail(tenant, inviter, invitation, token))) {
          results[index] = { email: invitation.email, outcome: "email_failed" };
        }
      }),
    );
  }
  return results;
};

// ---------- list / resend / revoke (FR-INV-05, 13) ----------

export const listInvitations = async (
  tenant: TenantContext,
  { status, page, limit }: { status?: InvitationListStatus; page: number; limit: number },
) => {
  const now = new Date();
  const statusFilter: QueryFilter<InvitationRecord> =
    status === "pending"
      ? { status: "pending", expiresAt: { $gt: now } }
      : status === "expired"
        ? { status: "pending", expiresAt: { $lte: now } }
        : status
          ? { status }
          : {};
  // Tenant Admins see all; Project Managers only their own (Roles §5.1).
  const filter: QueryFilter<InvitationRecord> = can(actorOf(tenant), "invitation.viewAll")
    ? statusFilter
    : { ...statusFilter, invitedBy: tenant.membership.userId };

  const repo = forTenant(InvitationModel, tenant.organization._id);
  const [total, docs] = await Promise.all([
    repo.countDocuments(filter),
    repo
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  const names = await inviterNames(docs.map((d) => d.invitedBy));
  const projects = await projectNames(
    tenant.organization._id,
    docs.flatMap((d) => d.projectIds ?? []),
  );
  return {
    items: docs.map((d) => toInvitation(d, names, projects)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// Loads an invitation the caller may manage; others' invitations are "not found" for PMs.
const loadManageable = async (tenant: TenantContext, invitationId: string) => {
  const invitation = await forTenant(InvitationModel, tenant.organization._id)
    .findById(invitationId)
    .catch(() => null); // malformed ID
  if (!invitation) throw AppError.notFound("Invitation not found.");
  if (!can(actorOf(tenant), "invitation.manage", { invitedBy: String(invitation.invitedBy) })) {
    throw AppError.notFound("Invitation not found.");
  }
  return invitation;
};

export const resendInvitation = async (
  tenant: TenantContext,
  user: AuthUser,
  invitationId: string,
): Promise<InviteResult> => {
  const invitation = await loadManageable(tenant, invitationId);
  if (invitation.status !== "pending") {
    throw new AppError(
      409,
      ERROR_CODES.INVALID_TRANSITION,
      "Only pending invitations can be resent.",
    );
  }
  if (Date.now() - invitation.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new AppError(
      429,
      ERROR_CODES.RESEND_COOLDOWN,
      "This invitation was sent less than 5 minutes ago. Please wait before resending.",
    );
  }

  // A new token: the previous link stops working (data model §4.4).
  const token = generateToken();
  const now = new Date();
  invitation.set({
    tokenHash: hashToken(token),
    lastSentAt: now,
    expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
  });
  await invitation.save();

  const emailSent = await sendInvitationEmail(tenant, user, invitation, token);
  const names = await inviterNames([invitation.invitedBy]);
  const projects = await projectNames(tenant.organization._id, invitation.projectIds);
  return { invitation: toInvitation(invitation.toObject(), names, projects), emailSent };
};

export const revokeInvitation = async (
  tenant: TenantContext,
  user: AuthUser,
  invitationId: string,
): Promise<Invitation> => {
  const invitation = await loadManageable(tenant, invitationId);
  if (invitation.status !== "pending") {
    throw new AppError(
      409,
      ERROR_CODES.INVALID_TRANSITION,
      "Only pending invitations can be revoked.",
    );
  }
  invitation.set({ status: "revoked", revokedBy: user._id, revokedAt: new Date() });
  await invitation.save();
  const names = await inviterNames([invitation.invitedBy]);
  const projects = await projectNames(tenant.organization._id, invitation.projectIds);
  return toInvitation(invitation.toObject(), names, projects);
};

// R12: when a Project Manager is removed or demoted, their pending invitations are revoked
// automatically (no revokedBy = done by the system). Runs inside the member transaction.
export const revokePendingInvitationsBy = async (
  organizationId: Types.ObjectId,
  userId: Types.ObjectId,
  session: ClientSession,
) => {
  await InvitationModel.updateMany(
    { organizationId, invitedBy: userId, status: "pending" },
    { $set: { status: "revoked", revokedAt: new Date() } },
    { session },
  );
};

// ---------- public side: lookup, accept, register (FR-INV-06 – 08) ----------

// Looked up by token, so the organization isn't known yet: an explicit cross-tenant read.
const findByToken = (token: string) =>
  InvitationModel.findOne({ tokenHash: hashToken(token) }).setOptions({ tenantScope: "bypass" });

export const lookupInvitation = async (token: string): Promise<InvitationLookup> => {
  const invitation = await findByToken(token);
  if (!invitation) throw invalidInvitation();

  const [org, inviter, account] = await Promise.all([
    OrganizationModel.findById(invitation.organizationId).select("name status").lean(),
    UserModel.findById(invitation.invitedBy).select("name").lean(),
    UserModel.exists({ email: invitation.email }),
  ]);
  if (!org) throw invalidInvitation();

  const state: InvitationLookup["state"] =
    invitation.status === "accepted"
      ? "accepted"
      : invitation.status === "revoked"
        ? "revoked"
        : isExpired(invitation)
          ? "expired"
          : org.status !== "active"
            ? "organization_inactive" // R10
            : "valid";

  return {
    organizationName: org.name,
    email: invitation.email,
    role: invitation.role,
    invitedBy: inviter?.name ?? null,
    state,
    accountExists: Boolean(account),
  };
};

// FR-INV-08: every reason an invitation cannot be used.
const assertUsable = async (invitation: InvitationDoc | null) => {
  if (!invitation) throw invalidInvitation();
  if (invitation.status === "accepted")
    throw invalidInvitation("This invitation was already used.");
  if (invitation.status === "revoked") throw invalidInvitation("This invitation was revoked.");
  if (isExpired(invitation))
    throw invalidInvitation("This invitation has expired. Ask for a new one.");
  const org = await OrganizationModel.findById(invitation.organizationId).select("status").lean();
  if (org?.status !== "active") {
    throw invalidInvitation("This organization is not accepting new members right now.");
  }
  return invitation;
};

// Joins and marks the invitation used, atomically: a link cannot be used twice.
const joinOrganization = async (
  invitation: InvitationDoc,
  userId: Types.ObjectId,
  session: ClientSession,
) => {
  const claimed = await InvitationModel.findOneAndUpdate(
    {
      _id: invitation._id,
      organizationId: invitation.organizationId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    },
    { $set: { status: "accepted", acceptedBy: userId, acceptedAt: new Date() } },
    { session },
  );
  if (!claimed) throw invalidInvitation("This invitation was already used.");

  await forTenant(MembershipModel, invitation.organizationId).create(
    { userId, role: invitation.role },
    session,
  );

  // R13: join the pre-selected projects that still exist and are not archived.
  if (invitation.projectIds.length > 0) {
    const projects = await ProjectModel.find({
      organizationId: invitation.organizationId,
      _id: { $in: invitation.projectIds },
      status: "active",
    })
      .session(session)
      .select("name")
      .lean();
    await ProjectModel.updateMany(
      { organizationId: invitation.organizationId, _id: { $in: projects.map((p) => p._id) } },
      { $addToSet: { memberIds: userId } },
      { session },
    );
    await recordActivity(
      session,
      ...projects.map((p) => ({
        organizationId: invitation.organizationId,
        projectId: p._id,
        actorId: invitation.invitedBy,
        action: "project.member_added" as const,
        changes: { member: { from: null, to: String(userId) } },
        snapshot: { projectName: p.name },
      })),
    );
  }
};

// FR-INV-07: an existing user accepts after logging in with the invited email.
export const acceptInvitation = async (user: AuthUser, token: string) => {
  const invitation = await assertUsable(await findByToken(token));

  if (user.platformRole === "owner")
    throw AppError.forbidden("The Application Owner cannot join organizations.");
  if (user.email !== invitation.email) {
    throw new AppError(
      403,
      ERROR_CODES.INVITATION_EMAIL_MISMATCH,
      `This invitation is for ${invitation.email}. Log in with that email to accept it.`,
    );
  }
  if (await forTenant(MembershipModel, invitation.organizationId).exists({ userId: user._id })) {
    throw AppError.duplicate("You are already a member of this organization.");
  }

  try {
    await withTransaction((session) => joinOrganization(invitation, user._id, session));
  } catch (error) {
    if (isDuplicateKeyError(error))
      throw AppError.duplicate("You are already a member of this organization.");
    throw error;
  }
  return { organizationId: String(invitation.organizationId) };
};

// FR-INV-06: register through the invitation; the email is verified by the link itself.
export const registerWithInvitation = async ({
  token,
  name,
  password,
}: {
  token: string;
  name: string;
  password: string;
}): Promise<AuthSession & { organizationId: string }> => {
  const invitation = await assertUsable(await findByToken(token));
  if (await UserModel.exists({ email: invitation.email })) {
    throw AppError.duplicate(
      "An account with this email already exists. Log in to accept the invitation.",
    );
  }
  const passwordHash = await hashPassword(password); // slow; outside the transaction

  try {
    return await withTransaction(async (session) => {
      const [user] = await UserModel.create(
        [{ name, email: invitation.email, passwordHash, emailVerified: true }],
        { session },
      );
      await joinOrganization(invitation, user!._id, session);
      const authSession = await createSession(user!, session);
      return { ...authSession, organizationId: String(invitation.organizationId) };
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw AppError.duplicate(
        "An account with this email already exists. Log in to accept the invitation.",
      );
    }
    throw error;
  }
};
