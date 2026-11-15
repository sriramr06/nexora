import { describe, expect, it } from "vitest";
import type { Actor } from "./permissions";
import {
  canDeleteComment,
  canEditComment,
  clearFlag,
  requestChanges,
  setFlag,
  statusChange,
  type WorkflowFacts,
} from "./workflow";

const admin: Actor = { userId: "ad", role: "admin" };
const pm: Actor = { userId: "pm", role: "project_manager" }; // manages the project
const otherPm: Actor = { userId: "pm2", role: "project_manager" }; // member only
const assignee: Actor = { userId: "tm", role: "member" };
const teammate: Actor = { userId: "tm2", role: "member" };

const task = (over: Partial<WorkflowFacts> = {}): WorkflowFacts => ({
  managerId: "pm",
  memberIds: ["pm", "pm2", "tm", "tm2"],
  assigneeId: "tm",
  createdBy: "pm",
  status: "todo",
  flag: null,
  ...over,
});

const ok = (d: { ok: boolean }) => d.ok;

describe("statusChange (R14)", () => {
  it("lets the assignee move To Do ↔ In Progress → In Review and withdraw", () => {
    expect(ok(statusChange(assignee, task(), "in_progress"))).toBe(true);
    expect(ok(statusChange(assignee, task({ status: "in_progress" }), "todo"))).toBe(true);
    expect(ok(statusChange(assignee, task({ status: "in_progress" }), "in_review"))).toBe(true);
    expect(ok(statusChange(assignee, task({ status: "in_review" }), "in_progress"))).toBe(true);
  });

  it("tells a Team Member to submit for review instead of Done", () => {
    const d = statusChange(assignee, task({ status: "in_review" }), "done");
    expect(d).toEqual({ ok: false, reason: expect.stringMatching(/Submit for review/) });
  });

  it("stops Team Members reopening, skipping steps, or moving others' tasks", () => {
    expect(ok(statusChange(assignee, task({ status: "done" }), "todo"))).toBe(false);
    expect(ok(statusChange(assignee, task(), "in_review"))).toBe(false);
    expect(ok(statusChange(teammate, task(), "in_progress"))).toBe(false);
    expect(ok(statusChange(otherPm, task(), "in_progress"))).toBe(false); // PM, but not this project's
  });

  it("lets the manager and admins approve from any status and reopen", () => {
    for (const status of ["todo", "in_progress", "in_review"] as const) {
      expect(ok(statusChange(pm, task({ status }), "done"))).toBe(true);
    }
    expect(ok(statusChange(admin, task({ status: "done" }), "in_progress"))).toBe(true);
  });

  it("routes a manager sending work back through 'Request changes'", () => {
    const d = statusChange(pm, task({ status: "in_review" }), "in_progress");
    expect(d).toEqual({ ok: false, reason: expect.stringMatching(/Request changes/) });
    expect(ok(requestChanges(pm, task({ status: "in_review" })))).toBe(true);
    expect(ok(requestChanges(assignee, task({ status: "in_review" })))).toBe(false);
    expect(ok(requestChanges(pm, task({ status: "in_progress" })))).toBe(false);
  });

  it("freezes a Blocked task for the assignee, not for the manager (R16)", () => {
    expect(ok(statusChange(assignee, task({ flag: "blocked" }), "in_progress"))).toBe(false);
    expect(ok(statusChange(pm, task({ flag: "blocked" }), "in_progress"))).toBe(true);
    expect(ok(statusChange(assignee, task({ flag: "on_hold" }), "in_progress"))).toBe(true);
  });
});

describe("flags (R15, R16)", () => {
  it("lets the assignee and manager flag; never Done tasks", () => {
    expect(ok(setFlag(assignee, task(), "blocked"))).toBe(true);
    expect(ok(setFlag(pm, task(), "on_hold"))).toBe(true);
    expect(ok(setFlag(teammate, task(), "blocked"))).toBe(false);
    expect(ok(setFlag(pm, task({ status: "done" }), "blocked"))).toBe(false);
  });

  it("lets only the manager clear Blocked; the assignee may clear On hold", () => {
    expect(ok(clearFlag(assignee, task({ flag: "blocked" })))).toBe(false);
    expect(ok(clearFlag(pm, task({ flag: "blocked" })))).toBe(true);
    expect(ok(clearFlag(assignee, task({ flag: "on_hold" })))).toBe(true);
    // ...and cannot sneak out of Blocked by switching to On hold.
    expect(ok(setFlag(assignee, task({ flag: "blocked" }), "on_hold"))).toBe(false);
  });
});

describe("comments (Roles §5.4)", () => {
  it("authors edit; authors, manager and admins delete", () => {
    expect(canEditComment(assignee, "tm")).toBe(true);
    expect(canEditComment(pm, "tm")).toBe(false);
    const f = task();
    expect(canDeleteComment(assignee, f, "tm")).toBe(true);
    expect(canDeleteComment(pm, f, "tm")).toBe(true);
    expect(canDeleteComment(admin, f, "tm")).toBe(true);
    expect(canDeleteComment(teammate, f, "tm")).toBe(false);
  });
});
