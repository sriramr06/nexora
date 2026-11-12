import type { Types } from "mongoose";
import type { OrgRole, OrgStatus } from "@nexora/shared";
import { signAccessToken } from "../modules/auth/access-token";
import { hashPassword } from "../modules/auth/password";
import { MembershipModel } from "../modules/members/membership.model";
import { OrganizationModel } from "../modules/organizations/organization.model";
import { UserModel } from "../modules/users/user.model";

// Fast test data: users are inserted directly (one shared bcrypt hash) and authenticate
// with a signed access token instead of going through /auth/login.

export const TEST_PASSWORD = "secret123";
let passwordHash: Promise<string> | undefined;
let counter = 0;

export const createUser = async (
  overrides: Partial<{ name: string; email: string; emailVerified: boolean; owner: boolean }> = {},
) => {
  counter += 1;
  passwordHash ??= hashPassword(TEST_PASSWORD);
  return UserModel.create({
    name: overrides.name ?? `User ${counter}`,
    email: overrides.email ?? `user${counter}@test.nexora`,
    passwordHash: await passwordHash,
    emailVerified: overrides.emailVerified ?? true,
    ...(overrides.owner ? { platformRole: "owner" } : {}),
  });
};

export type TestUser = Awaited<ReturnType<typeof createUser>>;

export const bearer = (user: TestUser) => `Bearer ${signAccessToken(user.id)}`;

export const orgDetails = {
  name: "Acme Corp",
  type: "product",
  size: "11-50",
  industry: "software_product",
  country: "IN",
  timezone: "Asia/Kolkata",
} as const;

// An organization with `admin` as its Tenant Admin, directly in the given status.
export const createOrg = async (
  admin: TestUser,
  { status = "active", name = "Acme Corp" }: { status?: OrgStatus; name?: string } = {},
) => {
  const org = await OrganizationModel.create({
    ...orgDetails,
    name,
    status,
    statusHistory: [{ status, changedBy: admin._id, changedAt: new Date() }],
    createdBy: admin._id,
  });
  await addMember(org._id, admin, "admin");
  return org;
};

export const addMember = (organizationId: Types.ObjectId, user: TestUser, role: OrgRole) =>
  MembershipModel.create({ organizationId, userId: user._id, role });
