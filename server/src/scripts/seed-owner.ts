import { hashPassword } from "../modules/auth/password";
import { MembershipModel } from "../modules/members/membership.model";
import { UserModel } from "../modules/users/user.model";

interface OwnerInput {
  email: string;
  name: string;
  password: string;
}

// Idempotent: safe to run on every deploy. An existing account is promoted, and its
// password is left unchanged (rotate it through "forgot password" instead).
export const seedOwner = async ({
  email,
  name,
  password,
}: OwnerInput): Promise<"created" | "promoted" | "unchanged"> => {
  const existing = await UserModel.findOne({ email });

  if (!existing) {
    await UserModel.create({
      email,
      name,
      passwordHash: await hashPassword(password),
      emailVerified: true,
      platformRole: "owner",
    });
    return "created";
  }

  if (existing.platformRole === "owner") return "unchanged";

  // R8: the Application Owner cannot hold tenant memberships.
  const memberships = await MembershipModel.countDocuments({ userId: existing._id }).setOptions({
    tenantScope: "bypass",
  });
  if (memberships > 0) {
    throw new Error(
      `${email} belongs to organizations and cannot become the Application Owner (R8)`,
    );
  }

  existing.set({ platformRole: "owner", emailVerified: true });
  await existing.save();
  return "promoted";
};
