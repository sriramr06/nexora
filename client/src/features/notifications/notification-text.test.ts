import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES, type Notification } from "@nexora/shared";
import { describeNotification, notificationHref, timeAgo } from "./notification-text";

const make = (over: Partial<Notification>): Notification => ({
  id: "n1",
  type: "task.assigned",
  actor: { id: "u1", name: "Arun", avatarUrl: null },
  projectId: "p1",
  taskId: "t1",
  data: { taskTitle: "Design onboarding", projectName: "Website" },
  read: false,
  createdAt: new Date().toISOString(),
  ...over,
});

describe("describeNotification", () => {
  it("has a sentence for every type", () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(describeNotification(make({ type })).length).toBeGreaterThan(10);
    }
  });

  it("uses the snapshot values", () => {
    expect(describeNotification(make({}))).toBe("Arun assigned you “Design onboarding”");
    expect(
      describeNotification(
        make({
          type: "project.tasks_unassigned",
          data: { projectName: "Website", count: 2, memberName: "Kiran" },
        }),
      ),
    ).toBe("Kiran left “Website”; 2 open tasks are now unassigned");
  });
});

describe("notificationHref", () => {
  it("prefers the task, then the project, but not a project you were removed from", () => {
    expect(notificationHref("o1", make({}))).toBe("/o/o1/tasks/t1");
    expect(notificationHref("o1", make({ type: "project.member_added", taskId: null }))).toBe(
      "/o/o1/projects/p1",
    );
    expect(notificationHref("o1", make({ type: "project.member_removed", taskId: null }))).toBe(
      "/o/o1/projects",
    );
  });
});

describe("timeAgo", () => {
  it("rounds to the largest unit", () => {
    const now = Date.parse("2026-11-15T12:00:00Z");
    expect(timeAgo("2026-11-15T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-11-15T09:00:00Z", now)).toMatch(/3/);
  });
});
