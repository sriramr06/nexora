import { Link } from "react-router";
import { FolderKanbanIcon, SettingsIcon, UsersIcon } from "lucide-react";
import { ORG_ROLE_LABELS } from "@nexora/shared";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrg } from "../org-gate";

// Organization dashboard. Projects (Sprint 4) and members (Sprint 3) fill it in.
export function OrgHomePage() {
  const { organization, role, allows } = useOrg();

  const upcoming = [
    { Icon: FolderKanbanIcon, title: "Projects and boards", text: "Arrives in Sprint 4." },
    { Icon: UsersIcon, title: "Members and invitations", text: "Arrives in Sprint 3." },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
        <Badge variant="secondary">{ORG_ROLE_LABELS[role]}</Badge>
        {allows("org.update") && (
          <Link
            to={`/o/${organization.id}/settings`}
            className={buttonVariants({ variant: "outline", size: "sm", className: "ml-auto" })}
          >
            <SettingsIcon aria-hidden /> Settings
          </Link>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {upcoming.map(({ Icon, title, text }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="size-5 text-muted-foreground" aria-hidden />
              <CardTitle className="mt-2">{title}</CardTitle>
              <CardDescription>{text}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
