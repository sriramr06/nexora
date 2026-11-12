import { useId, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { MailIcon, RotateCwIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  INVITATION_LIST_STATUSES,
  ORG_ROLES,
  ORG_ROLE_LABELS,
  type BulkInviteResult,
  type InvitationListStatus,
  type OrgRole,
} from "@nexora/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { formatDate } from "@/features/organizations/labels";
import { useOrg } from "@/features/organizations/org-gate";
import { useProjects } from "@/features/projects/projects-api";
import {
  useBulkInvite,
  useInvitations,
  useInvite,
  useResendInvitation,
  useRevokeInvitation,
} from "../members-api";

const STATUS_LABELS: Record<InvitationListStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
};

const STATUS_DOT: Record<InvitationListStatus, string> = {
  pending: "bg-chart-3",
  accepted: "bg-primary",
  revoked: "bg-muted-foreground",
  expired: "bg-destructive",
};

// "a@x.com, b@x.com" or one per line.
const parseEmails = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);

function InviteForm({ orgId, canInviteAnyRole }: { orgId: string; canInviteAnyRole: boolean }) {
  const { actor } = useOrg();
  const projects = useProjects(orgId, "active");
  // R11: admins may pre-select any project; Project Managers only the ones they manage.
  const selectable = (projects.data?.data ?? []).filter(
    (p) => canInviteAnyRole || p.manager?.id === actor.userId,
  );
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [error, setError] = useState<string>();
  const [results, setResults] = useState<BulkInviteResult[] | null>(null);
  const single = useInvite(orgId);
  const bulk = useBulkInvite(orgId);
  const emailsId = useId();
  const roleId = useId();
  const pending = single.isPending || bulk.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setResults(null);
    const emails = parseEmails(text);
    if (emails.length === 0) return setError("Enter at least one email address.");
    if (emails.length > 20) return setError("You can invite up to 20 people at a time.");
    setError(undefined);

    if (emails.length === 1) {
      single.mutate(
        { email: emails[0]!, role, projectIds },
        {
          onSuccess: ({ invitation, emailSent }) => {
            setText("");
            setProjectIds([]);
            if (emailSent) toast.success(`Invitation sent to ${invitation.email}.`);
            else toast.warning(`Invitation created, but the email failed. Use Resend.`);
          },
          onError: (err) => setError(toApiError(err).message),
        },
      );
    } else {
      bulk.mutate(
        { emails, role, projectIds },
        {
          onSuccess: (r) => {
            setResults(r);
            setText("");
            setProjectIds([]);
          },
          onError: (err) => setError(toApiError(err).message),
        },
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Invite people</h2>
        </CardTitle>
        <CardDescription>
          One address, or up to 20 separated by commas or new lines. Links are valid for 7 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <div className="grid gap-1.5">
              <Label htmlFor={emailsId}>Email addresses</Label>
              <Textarea
                id={emailsId}
                rows={2}
                placeholder="ravi@acme.com"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(undefined);
                }}
                aria-invalid={error ? true : undefined}
              />
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor={roleId}>Role</Label>
              <NativeSelect
                id={roleId}
                className="w-full"
                value={role}
                disabled={!canInviteAnyRole}
                onChange={(e) => setRole(e.target.value as OrgRole)}
              >
                {(canInviteAnyRole ? ORG_ROLES : (["member"] as const)).map((r) => (
                  <NativeSelectOption key={r} value={r}>
                    {ORG_ROLE_LABELS[r]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {!canInviteAnyRole && (
                <p className="text-xs text-muted-foreground">
                  Project Managers invite Team Members.
                </p>
              )}
            </div>
          </div>
          {selectable.length > 0 && (
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">Add to projects (optional)</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {selectable.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={projectIds.includes(p.id)}
                      onChange={(e) =>
                        setProjectIds((ids) =>
                          e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id),
                        )
                      }
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div>
            <Button type="submit" disabled={pending}>
              <MailIcon aria-hidden /> Send invitations
            </Button>
          </div>
        </form>

        {results && (
          <ul className="mt-4 grid gap-1.5 border-t pt-4 text-sm" aria-label="Invitation results">
            {results.map((r, i) => (
              <li key={`${r.email}-${i}`} className="flex flex-wrap gap-x-2">
                <span className="font-medium">{r.email}</span>
                <span
                  className={cn(
                    r.outcome === "sent" ? "text-primary" : "text-muted-foreground",
                    r.outcome === "email_failed" && "text-destructive",
                  )}
                >
                  {r.outcome === "sent"
                    ? "Sent"
                    : r.outcome === "email_failed"
                      ? "Created, email failed — use Resend"
                      : `Skipped: ${r.reason}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// US-12 / FR-INV-01, 05, 10, 12, 13. Admins see every invitation; PMs their own.
export function InvitationsPage() {
  const { organization, allows } = useOrg();
  const [status, setStatus] = useState<InvitationListStatus | undefined>("pending");
  const canView = allows("invitation.view");
  const invitations = useInvitations(organization.id, status, canView);
  const resend = useResendInvitation(organization.id);
  const revoke = useRevokeInvitation(organization.id);

  if (!canView) return <Navigate to={`/o/${organization.id}`} replace />;

  const tabs: { label: string; value?: InvitationListStatus }[] = [
    { label: "All" },
    ...INVITATION_LIST_STATUSES.map((s) => ({ label: STATUS_LABELS[s], value: s })),
  ];

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Invitations</h1>
      <InviteForm orgId={organization.id} canInviteAnyRole={allows("invitation.viewAll")} />

      <div className="grid gap-3">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1">
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
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Role</TableHead>
                <TableHead className="hidden md:table-cell">Invited by</TableHead>
                <TableHead className="hidden sm:table-cell">Sent</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={cn(invitations.isPlaceholderData && "opacity-60")}>
              {invitations.isPending && (
                <TableRow>
                  <TableCell colSpan={6} className="px-4">
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              )}
              {invitations.data?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No invitations here yet.
                  </TableCell>
                </TableRow>
              )}
              {invitations.data?.data.map((inv) => {
                const open = inv.status === "pending" || inv.status === "expired";
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="max-w-56 pl-4">
                      <span className="block truncate font-medium">{inv.email}</span>
                      {inv.projects.length > 0 && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {inv.projects.map((p) => p.name).join(", ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1.5 font-normal">
                        <span className={cn("size-1.5 rounded-full", STATUS_DOT[inv.status])} />
                        {STATUS_LABELS[inv.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {ORG_ROLE_LABELS[inv.role]}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {inv.invitedBy?.name ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(inv.lastSentAt)}
                    </TableCell>
                    <TableCell className="pr-4">
                      {open && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Resend to ${inv.email}`}
                            disabled={resend.isPending}
                            onClick={() =>
                              resend.mutate(inv.id, {
                                onSuccess: ({ emailSent }) =>
                                  emailSent
                                    ? toast.success(`Sent again to ${inv.email}.`)
                                    : toast.warning("Invitation renewed, but the email failed."),
                                onError: (e) => toast.error(toApiError(e).message),
                              })
                            }
                          >
                            <RotateCwIcon aria-hidden />
                          </Button>
                          {inv.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Revoke invitation for ${inv.email}`}
                              disabled={revoke.isPending}
                              onClick={() =>
                                revoke.mutate(inv.id, {
                                  onSuccess: () =>
                                    toast.success(`Invitation for ${inv.email} revoked.`),
                                  onError: (e) => toast.error(toApiError(e).message),
                                })
                              }
                            >
                              <XIcon aria-hidden />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
