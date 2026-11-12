import { describe, expect, it } from "vitest";
import { ORG_ROLES, type OrgRole } from "./constants";
import { can, type Action, type Actor } from "./permissions";

const actor = (role: OrgRole, userId = "u1"): Actor => ({ userId, role });

// Roles document §5.1, rows without conditions: action → roles allowed.
const matrix: [Action, OrgRole[]][] = [
  ["org.view", ["admin", "project_manager", "member"]],
  ["org.update", ["admin"]],
  ["member.view", ["admin", "project_manager", "member"]],
  ["invitation.viewAll", ["admin"]],
  ["member.changeRole", ["admin"]],
  ["member.remove", ["admin"]],
  ["org.leave", ["admin", "project_manager", "member"]],
];

describe("can() — organization and members matrix", () => {
  for (const [action, allowed] of matrix) {
    for (const role of ORG_ROLES) {
      const expected = allowed.includes(role);
      it(`${role} ${expected ? "can" : "cannot"} ${action}`, () => {
        expect((can as (a: Actor, x: Action) => boolean)(actor(role), action)).toBe(expected);
      });
    }
  }
});

describe("can() — invitation.create (R11)", () => {
  const managed = ["p1", "p2"];

  it("lets a Tenant Admin invite any role to any project", () => {
    for (const role of ORG_ROLES) {
      expect(
        can(actor("admin"), "invitation.create", {
          role,
          projectIds: ["p9"],
          managedProjectIds: [],
        }),
      ).toBe(true);
    }
  });

  it("lets a Project Manager invite Team Members to projects they manage", () => {
    expect(
      can(actor("project_manager"), "invitation.create", {
        role: "member",
        projectIds: ["p1"],
        managedProjectIds: managed,
      }),
    ).toBe(true);
  });

  it("stops a Project Manager granting a higher role (escalation)", () => {
    for (const role of ["admin", "project_manager"] as const) {
      expect(
        can(actor("project_manager"), "invitation.create", {
          role,
          projectIds: [],
          managedProjectIds: managed,
        }),
      ).toBe(false);
    }
  });

  it("stops a Project Manager pre-selecting a project they do not manage", () => {
    expect(
      can(actor("project_manager"), "invitation.create", {
        role: "member",
        projectIds: ["p1", "p3"],
        managedProjectIds: managed,
      }),
    ).toBe(false);
  });

  it("never lets a Team Member invite", () => {
    expect(
      can(actor("member"), "invitation.create", {
        role: "member",
        projectIds: [],
        managedProjectIds: [],
      }),
    ).toBe(false);
  });
});

describe("can() — invitation.manage", () => {
  it("lets admins manage all, Project Managers only their own", () => {
    expect(can(actor("admin"), "invitation.manage", { invitedBy: "other" })).toBe(true);
    expect(can(actor("project_manager", "pm"), "invitation.manage", { invitedBy: "pm" })).toBe(
      true,
    );
    expect(can(actor("project_manager", "pm"), "invitation.manage", { invitedBy: "x" })).toBe(
      false,
    );
    expect(can(actor("member", "m"), "invitation.manage", { invitedBy: "m" })).toBe(false);
  });
});
