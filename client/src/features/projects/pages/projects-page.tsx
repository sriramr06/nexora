import { useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArchiveIcon, FolderPlusIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { createProjectSchema, type ProjectStatus } from "@nexora/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { toApiError } from "@/lib/api-error";
import { useMembers } from "@/features/members/members-api";
import { useOrg } from "@/features/organizations/org-gate";
import { useCreateProject, useProjects } from "../projects-api";

function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { organization, actor } = useOrg();
  const navigate = useNavigate();
  const create = useCreateProject(organization.id);
  const isAdmin = actor.role === "admin";
  const members = useMembers(organization.id);
  const managers = (members.data?.data ?? []).filter((m) => m.role !== "member");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerId, setManagerId] = useState(actor.userId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ids = { name: useId(), description: useId(), manager: useId() };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = createProjectSchema.safeParse({
      name,
      description,
      managerId: isAdmin ? managerId : undefined,
    });
    if (!parsed.success) {
      return setErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
      );
    }
    create.mutate(parsed.data, {
      onSuccess: (project) => {
        toast.success(`${project.name} created.`);
        onOpenChange(false);
        navigate(`/o/${organization.id}/projects/${project.id}`);
      },
      onError: (err) => {
        const apiError = toApiError(err);
        setErrors(
          apiError.code === "DUPLICATE" ? { name: apiError.message } : { form: apiError.message },
        );
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              {isAdmin ? "Choose who manages it." : "You will manage this project."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.name}>Name</Label>
            <Input
              id={ids.name}
              value={name}
              autoFocus
              aria-invalid={errors.name ? true : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setErrors({});
              }}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.description}>Description (optional)</Label>
            <Textarea
              id={ids.description}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
          </div>
          {isAdmin && (
            <div className="grid gap-1.5">
              <Label htmlFor={ids.manager}>Manager</Label>
              <NativeSelect
                id={ids.manager}
                className="w-full"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
              >
                {managers.map((m) => (
                  <NativeSelectOption key={m.userId} value={m.userId}>
                    {m.name}
                    {m.userId === actor.userId ? " (you)" : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                Project Managers and Tenant Admins can manage projects.
              </p>
            </div>
          )}
          {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// US-17 / FR-PROJ-05: projects the member can access.
export function ProjectsPage() {
  const { organization, allows } = useOrg();
  const [status, setStatus] = useState<ProjectStatus | undefined>("active");
  const [creating, setCreating] = useState(false);
  const projects = useProjects(organization.id, status);
  const canCreate = allows("project.create");

  const tabs: { label: string; value?: ProjectStatus }[] = [
    { label: "Active", value: "active" },
    { label: "Archived", value: "archived" },
    { label: "All" },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        {canCreate && (
          <Button className="ml-auto" onClick={() => setCreating(true)}>
            <FolderPlusIcon aria-hidden /> New project
          </Button>
        )}
      </div>

      <nav aria-label="Filter projects" className="flex gap-1">
        {tabs.map((t) => (
          <Button
            key={t.label}
            size="sm"
            variant={status === t.value ? "secondary" : "ghost"}
            aria-pressed={status === t.value}
            onClick={() => setStatus(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </nav>

      {projects.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}
      {projects.isError && (
        <p className="text-sm text-destructive">{toApiError(projects.error).message}</p>
      )}
      {projects.data?.data.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>No projects here yet</h2>
            </CardTitle>
            <CardDescription>
              {canCreate
                ? "Create a project to start planning work with your team."
                : "You will see projects here once a manager adds you to one."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.data?.data.map((p) => {
          const percent = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
          return (
            <Link
              key={p.id}
              to={`/o/${organization.id}/projects/${p.id}`}
              className="group rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Card className="h-full transition-colors group-hover:ring-foreground/20">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="leading-snug">
                      <h2>{p.name}</h2>
                    </CardTitle>
                    {p.status === "archived" && (
                      <Badge variant="secondary" className="gap-1">
                        <ArchiveIcon aria-hidden /> Archived
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="line-clamp-2">
                    {p.description ?? "No description."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto grid gap-3">
                  <div className="grid gap-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {p.doneCount} of {p.taskCount} tasks done
                      </span>
                      <span>{percent}%</span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-muted"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-2">
                      {p.manager ? (
                        <>
                          <UserAvatar name={p.manager.name} url={p.manager.avatarUrl} size="sm" />
                          {p.manager.name}
                        </>
                      ) : (
                        "No manager"
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <UsersIcon className="size-3.5" aria-hidden /> {p.memberCount}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {canCreate && <NewProjectDialog open={creating} onOpenChange={setCreating} />}
    </div>
  );
}
