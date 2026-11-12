import { describe, expect, it } from "vitest";
import { ORG_ROLES, type OrgRole } from "./constants";
import { can, type Action, type Actor } from "./permissions";

const actor = (role: OrgRole, userId = "u1"): Actor => ({ userId, role });

// Roles document §5.1, rows without conditions: action → roles allowed.
const matrix: [Action, OrgRole[]][] = [
  ["org.view", ["admin", "project_manager", "member"]],
  ["org.update", ["admin"]],
  ["member.view", ["admin", "project_manager", "member"]],
  ["invitation.view", ["admin", "project_manager"]],
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

describe("can() — projects and tasks (Roles §5.2, §5.3)", () => {
  const pm = actor("project_manager", "pm");
  const other = actor("project_manager", "pm2");
  const tm = actor("member", "tm");
  const admin = actor("admin", "ad");
  const project = { managerId: "pm", memberIds: ["pm", "pm2", "tm"] };
  const task = (assigneeId: string | null, createdBy = "pm") => ({
    ...project,
    assigneeId,
    createdBy,
  });

  it("lets admins and PMs create projects, never Team Members", () => {
    expect(can(admin, "project.create")).toBe(true);
    expect(can(pm, "project.create")).toBe(true);
    expect(can(tm, "project.create")).toBe(false);
  });

  it("restricts project management to admins and the project's manager", () => {
    for (const action of ["project.update", "project.manageMembers"] as const) {
      expect(can(admin, action, project)).toBe(true);
      expect(can(pm, action, project)).toBe(true);
      expect(can(other, action, project)).toBe(false); // PM, but only a member here
      expect(can(tm, action, project)).toBe(false);
    }
    expect(can(pm, "project.setManager")).toBe(false);
    expect(can(pm, "project.delete")).toBe(false);
  });

  it("shows projects to admins and members only", () => {
    expect(can(actor("member", "outsider"), "project.view", project)).toBe(false);
    expect(can(tm, "project.view", project)).toBe(true);
    expect(can(actor("admin", "x"), "project.view", project)).toBe(true);
  });

  it("lets members create tasks; outsiders cannot", () => {
    expect(can(tm, "task.create", project)).toBe(true);
    expect(can(actor("member", "outsider"), "task.create", project)).toBe(false);
  });

  it("lets Team Members edit only tasks assigned to or created by them (note 3)", () => {
    expect(can(tm, "task.edit", task("tm"))).toBe(true);
    expect(can(tm, "task.edit", task(null, "tm"))).toBe(true);
    expect(can(tm, "task.edit", task("pm2"))).toBe(false);
    expect(can(pm, "task.edit", task("pm2"))).toBe(true); // manager
  });

  it("lets Team Members only self-assign an unassigned task (FR-TASK-06, 07)", () => {
    expect(can(tm, "task.assign", { ...task(null), newAssigneeId: "tm" })).toBe(true);
    expect(can(tm, "task.assign", { ...task(null), newAssigneeId: "pm2" })).toBe(false);
    expect(can(tm, "task.assign", { ...task("pm2"), newAssigneeId: "tm" })).toBe(false);
    expect(can(tm, "task.assign", { ...task("tm"), newAssigneeId: null })).toBe(false); // unassign
    expect(can(pm, "task.assign", { ...task("tm"), newAssigneeId: null })).toBe(true);
    expect(can(other, "task.assign", { ...task("tm"), newAssigneeId: "pm2" })).toBe(false);
  });

  it("lets only admins and the manager delete tasks", () => {
    expect(can(pm, "task.delete", project)).toBe(true);
    expect(can(other, "task.delete", project)).toBe(false);
    expect(can(tm, "task.delete", project)).toBe(false);
  });
});
