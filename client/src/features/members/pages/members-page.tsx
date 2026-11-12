import { useState } from "react";
import { useNavigate } from "react-router";
import { LogOutIcon, UserMinusIcon } from "lucide-react";
import { toast } from "sonner";
import { ORG_ROLES, ORG_ROLE_LABELS, type Member, type OrgRole } from "@nexora/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { toApiError } from "@/lib/api-error";
import { useMediaQuery } from "@/lib/use-media-query";
import { useCurrentUser } from "@/lib/auth-store";
import { formatDate } from "@/features/organizations/labels";
import { useOrg } from "@/features/organizations/org-gate";
import { useChangeRole, useLeaveOrganization, useMembers, useRemoveMember } from "../members-api";

// US-15 / FR-MEM-01 – 04. Role changes, removal and leaving are enforced on the server
// (incl. the last-admin rule R1); the UI only hides what the role can't do.
export function MembersPage() {
  const { organization, allows } = useOrg();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const members = useMembers(organization.id);
  const changeRole = useChangeRole(organization.id);
  const remove = useRemoveMember(organization.id);
  const leave = useLeaveOrganization(organization.id);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [leaving, setLeaving] = useState(false);
  const canManage = allows("member.changeRole");
  // Phones: the role sits under the name instead of a squeezed column (one control either way).
  const wide = useMediaQuery("(min-width: 640px)");

  const roleControl = (m: Member) =>
    canManage ? (
      <NativeSelect
        size="sm"
        className="min-w-40"
        value={m.role}
        aria-label={`Role of ${m.name}`}
        disabled={changeRole.isPending}
        onChange={(e) => onRoleChange(m, e.target.value as OrgRole)}
      >
        {ORG_ROLES.map((r) => (
          <NativeSelectOption key={r} value={r}>
            {ORG_ROLE_LABELS[r]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    ) : (
      <Badge variant="secondary">{ORG_ROLE_LABELS[m.role]}</Badge>
    );

  const onRoleChange = (member: Member, role: OrgRole) =>
    changeRole.mutate(
      { userId: member.userId, role },
      {
        onSuccess: () => toast.success(`${member.name} is now ${ORG_ROLE_LABELS[role]}.`),
        onError: (e) => toast.error(toApiError(e).message),
      },
    );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        {members.data && (
          <span className="text-sm text-muted-foreground">{members.data.pagination.total}</span>
        )}
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setLeaving(true)}>
          <LogOutIcon aria-hidden /> Leave organization
        </Button>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Member</TableHead>
              {wide && <TableHead>Role</TableHead>}
              <TableHead className="hidden sm:table-cell">Joined</TableHead>
              {canManage && <TableHead className="w-12 pr-4" aria-label="Actions" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.isPending &&
              [1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4} className="px-4">
                    <Skeleton className="h-9 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {members.isError && (
              <TableRow>
                <TableCell colSpan={4} className="px-4 text-destructive">
                  {toApiError(members.error).message}
                </TableCell>
              </TableRow>
            )}
            {members.data?.data.map((m) => {
              const isMe = m.userId === me.id;
              return (
                <TableRow key={m.userId}>
                  <TableCell className="pl-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={m.name} url={m.avatarUrl} />
                      <div className="grid min-w-0">
                        <span className="font-medium break-words whitespace-normal">
                          {m.name}
                          {isMe && (
                            <span className="font-normal text-muted-foreground"> (you)</span>
                          )}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                        {!wide && <div className="mt-1.5">{roleControl(m)}</div>}
                      </div>
                    </div>
                  </TableCell>
                  {wide && <TableCell>{roleControl(m)}</TableCell>}
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatDate(m.joinedAt)}
                  </TableCell>
                  {canManage && (
                    <TableCell className="pr-4">
                      {!isMe && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${m.name}`}
                          onClick={() => setRemoving(m)}
                        >
                          <UserMinusIcon aria-hidden />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? ""}?`}
        description="They lose access to this organization immediately. Their account and past comments remain."
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.userId, {
            onSuccess: () => {
              toast.success(`${removing.name} was removed.`);
              setRemoving(null);
            },
            onError: (e) => toast.error(toApiError(e).message),
          })
        }
      />

      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={`Leave ${organization.name}?`}
        description="You lose access to its projects. You need a new invitation to come back."
        confirmLabel="Leave"
        pending={leave.isPending}
        onConfirm={() =>
          leave.mutate(undefined, {
            onSuccess: () => {
              toast.success(`You left ${organization.name}.`);
              navigate("/", { replace: true });
            },
            onError: (e) => {
              setLeaving(false);
              toast.error(toApiError(e).message);
            },
          })
        }
      />
    </div>
  );
}
