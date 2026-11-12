import type { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";
import { can, type Action, type PermissionContext } from "@nexora/shared";
import { AppError } from "../errors/app-error";
import { ERROR_CODES } from "../errors/error-codes";
import { forTenant } from "../db/tenant-scope";
import { authenticate } from "./authenticate";
import {
  OrganizationModel,
  type OrganizationDoc,
} from "../../modules/organizations/organization.model";
import { MembershipModel, type MembershipDoc } from "../../modules/members/membership.model";

export interface TenantContext {
  organization: OrganizationDoc;
  membership: MembershipDoc;
}

declare module "express-serve-static-core" {
  interface Request {
    tenant?: TenantContext;
  }
}

// Same response for "no such organization" and "not your organization" (TEN-6):
// a valid ID from another tenant must not reveal that it exists.
const orgNotFound = () => AppError.notFound("Organization not found.");

// Tenancy design §5, steps 2–3.
const loadTenant: RequestHandler = async (req, _res, next) => {
  const orgId = req.params.orgId;
  if (typeof orgId !== "string" || !isValidObjectId(orgId)) throw orgNotFound();

  const organization = await OrganizationModel.findById(orgId);
  if (!organization) throw orgNotFound();

  // Membership is looked up on every request (TEN-3), so role changes and removals
  // take effect immediately — the JWT carries identity only.
  const membership = await forTenant(MembershipModel, organization._id).findOne({
    userId: req.user!._id,
  });
  if (!membership) throw orgNotFound();

  req.tenant = { organization, membership };
  next();
};

// Step 4 (R9). Status-exempt routes let members see the status page and fix a rejection.
const requireActiveOrg =
  (statusExempt: boolean): RequestHandler =>
  (req, _res, next) => {
    if (!statusExempt && currentTenant(req).organization.status !== "active") {
      throw new AppError(403, ERROR_CODES.ORG_NOT_ACTIVE, "This organization is not active.");
    }
    next();
  };

// The standard chain for /orgs/:orgId/... routes (API design §7).
export const tenant = ({ statusExempt = false } = {}): RequestHandler[] => [
  authenticate,
  loadTenant,
  requireActiveOrg(statusExempt),
];

// Step 5: role permission via the shared can() (TEN-7). `context` loads the facts.
export function authorize<A extends Action>(
  action: A,
  ...context: PermissionContext[A] extends undefined
    ? []
    : [(req: Parameters<RequestHandler>[0]) => PermissionContext[A] | Promise<PermissionContext[A]>]
): RequestHandler {
  return async (req, _res, next) => {
    const { membership } = currentTenant(req);
    const actor = { userId: String(membership.userId), role: membership.role };
    const facts = context[0] ? await context[0](req) : undefined;
    const allowed = (can as (a: typeof actor, x: Action, c?: unknown) => boolean)(
      actor,
      action,
      facts,
    );
    if (!allowed) throw AppError.forbidden();
    next();
  };
}

export const currentTenant = (req: { tenant?: TenantContext }): TenantContext => {
  if (!req.tenant) throw new Error("currentTenant() used on a route without tenant()");
  return req.tenant;
};

// Platform routes (tenancy design §5): Application Owner only.
export const requireOwner: RequestHandler = (req, _res, next) => {
  if (req.user?.platformRole !== "owner") throw AppError.forbidden();
  next();
};
