import { Link } from "react-router";
import { FolderKanbanIcon, ListTodoIcon, UserPlusIcon } from "lucide-react";
import { ORG_ROLE_LABELS } from "@nexora/shared";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { useMembers } from "@/features/members/members-api";
import { useMyTasks, useProjects } from "@/features/projects/projects-api";
import { useOrg } from "../org-gate";

// Organization overview: my work, projects and the team at a glance.
export function OrgHomePage() {
  const { organization, role, allows } = useOrg();
  const members = useMembers(organization.id);
  const projects = useProjects(organization.id, "active");
  const myTasks = useMyTasks(organization.id);
  const team = members.data?.data ?? [];
  const open = (myTasks.data?.data ?? []).filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.overdue).length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
        <Badge variant="secondary">{ORG_ROLE_LABELS[role]}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>My tasks</h2>
            </CardTitle>
            <CardDescription>
              {myTasks.data ? `${open.length} open` : "Loading…"}
              {overdue > 0 && <span className="text-destructive"> · {overdue} overdue</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Link
              to={`/o/${organization.id}/my-tasks`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ListTodoIcon aria-hidden /> Open my tasks
            </Link>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>
              <h2>Projects</h2>
            </CardTitle>
            <CardDescription>
              {projects.data ? `${projects.data.pagination.total} active` : "Loading…"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {projects.data?.data.slice(0, 4).map((p) => {
              const percent = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
              return (
                <Link
                  key={p.id}
                  to={`/o/${organization.id}/projects/${p.id}`}
                  className="grid gap-1.5 rounded-md text-sm hover:text-primary"
                >
                  <span className="flex justify-between gap-2">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.doneCount}/{p.taskCount} done
                    </span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                </Link>
              );
            })}
            <Link
              to={`/o/${organization.id}/projects`}
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
            >
              <FolderKanbanIcon aria-hidden /> All projects
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Team</h2>
          </CardTitle>
          <CardDescription>
            {members.data ? `${members.data.pagination.total} members` : "Loading…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex -space-x-2">
            {team.slice(0, 10).map((m) => (
              <UserAvatar
                key={m.userId}
                name={m.name}
                url={m.avatarUrl}
                className="ring-2 ring-card"
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/o/${organization.id}/members`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View members
            </Link>
            {allows("invitation.view") && (
              <Link
                to={`/o/${organization.id}/invitations`}
                className={buttonVariants({ size: "sm" })}
              >
                <UserPlusIcon aria-hidden /> Invite people
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
