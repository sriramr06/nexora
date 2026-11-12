import { z } from "zod";
import {
  INDUSTRIES,
  ORG_SIZES,
  ORG_STATUSES,
  ORG_TYPES,
  type OrgRole,
  type OrgStatus,
} from "../constants";

// ISO 3166-1 alpha-2 (data model 4.2). The UI shows full names via Intl.DisplayNames.
export const COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ " +
  "BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM " +
  "DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS " +
  "GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN " +
  "KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ " +
  "MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM " +
  "PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV " +
  "SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI " +
  "VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

// Accepts any IANA name the runtime knows, including aliases such as "Asia/Calcutta"
// that some browsers still report.
export const isValidTimezone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

export const orgNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(100, "Name must not exceed 100 characters.");

// FR-ORG-01: the registration form, also used to update details (FR-ORG-04, 05).
export const organizationDetailsSchema = z.object({
  name: orgNameSchema,
  type: z.enum(ORG_TYPES, "Select a type."),
  size: z.enum(ORG_SIZES, "Select a company size."),
  industry: z.enum(INDUSTRIES, "Select an industry."),
  country: z.string().refine((v) => COUNTRY_CODES.includes(v), "Select a country."),
  timezone: z.string().refine(isValidTimezone, "Select a valid timezone."),
  website: optionalText(200, "Website must not exceed 200 characters.").refine(
    (v) => v === undefined || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v),
    "Enter a full URL starting with http:// or https://.",
  ),
  description: optionalText(500, "Description must not exceed 500 characters."),
});

export type OrganizationDetailsInput = z.input<typeof organizationDetailsSchema>;
export type OrganizationDetails = z.output<typeof organizationDetailsSchema>;

// Application Owner: rename (FR-PLAT-07).
export const renameOrganizationSchema = z.object({ name: orgNameSchema });

// Reject / suspend need a reason (FR-PLAT-05, 06).
export const statusReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please give a reason.")
    .max(500, "Reason must not exceed 500 characters."),
});

export const platformOrganizationsQuerySchema = z.object({
  status: z.enum(ORG_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PlatformOrganizationsQuery = z.input<typeof platformOrganizationsQuerySchema>;

// ---------- response shapes ----------

export interface StatusHistoryEntry {
  status: OrgStatus;
  reason?: string;
  changedBy: { id: string; name: string } | null;
  changedAt: string;
}

export interface Organization extends OrganizationDetails {
  id: string;
  status: OrgStatus;
  // Latest reason for Rejected / Suspended (data model: single source of truth is the history).
  statusReason?: string;
  createdAt: string;
  updatedAt: string;
}

// GET /orgs/:orgId — the organization plus the caller's role in it.
export interface OrganizationWithRole {
  organization: Organization;
  role: OrgRole;
}

// GET /me/organizations — switcher entries.
export interface MyOrganization {
  id: string;
  name: string;
  status: OrgStatus;
  role: OrgRole;
}

export interface PlatformOrganizationSummary {
  id: string;
  name: string;
  status: OrgStatus;
  country: string;
  createdAt: string;
}

export interface PlatformOrganizationDetails extends Organization {
  statusHistory: StatusHistoryEntry[];
  memberCount: number;
  admins: { id: string; name: string; email: string }[];
  createdBy: { id: string; name: string; email: string } | null;
}

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Tenant Admin",
  project_manager: "Project Manager",
  member: "Team Member",
};

export const ORG_STATUS_LABELS: Record<OrgStatus, string> = {
  pending_approval: "Pending approval",
  active: "Active",
  rejected: "Rejected",
  suspended: "Suspended",
};
