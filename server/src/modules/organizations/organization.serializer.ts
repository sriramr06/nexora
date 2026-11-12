import type { Organization } from "@nexora/shared";
import type { OrganizationDoc } from "./organization.model";

// Explicit API shape: internal fields (adminsVersion, createdBy, updatedBy, full history)
// never leak to tenant users by accident.
export const toOrganization = (org: OrganizationDoc): Organization => {
  const latest = org.statusHistory.at(-1);
  const showReason = org.status === "rejected" || org.status === "suspended";

  return {
    id: org.id,
    name: org.name,
    type: org.type,
    size: org.size,
    industry: org.industry,
    country: org.country,
    timezone: org.timezone,
    website: org.website ?? undefined,
    description: org.description ?? undefined,
    status: org.status,
    statusReason: showReason ? (latest?.reason ?? undefined) : undefined,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
};
