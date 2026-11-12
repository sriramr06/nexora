import { Link } from "react-router";
import { FolderKanbanIcon, UserPlusIcon } from "lucide-react";
import { ORG_ROLE_LABELS } from "@nexora/shared";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { useMembers } from "@/features/members/members-api";
import { useOrg } from "../org-gate";

// Organization overview. Projects (Sprint 4) join the team card here.
export function OrgHomePage() {
  const { organization, role, allows } = useOrg();
  const members = useMembers(organization.id);
  const team = members.data?.data ?? [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
        <Badge variant="secondary">{ORG_ROLE_LABELS[role]}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Team</h2>
            </CardTitle>
            <CardDescription>
              {members.data ? `${members.data.pagination.total} members` : "Loading…"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex -space-x-2">
              {team.slice(0, 8).map((m) => (
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

        <Card>
          <CardHeader>
            <FolderKanbanIcon className="size-5 text-muted-foreground" aria-hidden />
            <CardTitle className="mt-2">
              <h2>Projects and boards</h2>
            </CardTitle>
            <CardDescription>Arrive in Sprint 4.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
