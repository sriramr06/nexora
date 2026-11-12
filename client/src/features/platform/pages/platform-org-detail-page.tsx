import { useId, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";
import {
  ORG_STATUS_LABELS,
  orgNameSchema,
  statusReasonSchema,
  type PlatformOrganizationDetails,
} from "@nexora/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toApiError } from "@/lib/api-error";
import { OrgStatusBadge } from "@/features/organizations/components/status-badge";
import {
  countryName,
  formatDate,
  formatDateTime,
  INDUSTRY_LABELS,
  ORG_SIZE_LABELS,
  ORG_TYPE_LABELS,
} from "@/features/organizations/labels";
import {
  usePlatformOrganization,
  useRename,
  useTransition,
  type Transition,
} from "../platform-api";

const ACTIONS: Record<
  Transition,
  { label: string; needsReason: boolean; variant: "default" | "outline" | "destructive" }
> = {
  approve: { label: "Approve", needsReason: false, variant: "default" },
  reject: { label: "Reject", needsReason: true, variant: "destructive" },
  suspend: { label: "Suspend", needsReason: true, variant: "destructive" },
  reactivate: { label: "Reactivate", needsReason: false, variant: "default" },
};

const available = (org: PlatformOrganizationDetails): Transition[] =>
  ({
    pending_approval: ["approve", "reject"] as Transition[],
    active: ["suspend"] as Transition[],
    suspended: ["reactivate"] as Transition[],
    rejected: [] as Transition[],
  })[org.status];

// Reject / suspend need a reason (FR-PLAT-05, 06); it is emailed to the admins.
function ReasonDialog({
  transition,
  orgName,
  pending,
  onClose,
  onConfirm,
}: {
  transition: Transition | null;
  orgName: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const id = useId();
  const verb = transition === "reject" ? "Reject" : "Suspend";

  return (
    <Dialog
      open={transition !== null}
      onOpenChange={(open) => {
        if (!open) {
          setReason("");
          setError(undefined);
          onClose();
        }
      }}
    >
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = statusReasonSchema.safeParse({ reason });
            if (!parsed.success) return setError(parsed.error.issues[0]?.message);
            onConfirm(parsed.data.reason);
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {verb} {orgName}?
            </DialogTitle>
            <DialogDescription>
              The reason is shown to the organization and emailed to its admins.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={id}>Reason</Label>
            <Textarea
              id={id}
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(undefined);
              }}
              aria-invalid={error ? true : undefined}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {verb}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ org }: { org: PlatformOrganizationDetails }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(org.name);
  const [error, setError] = useState<string>();
  const rename = useRename(org.id);
  const id = useId();

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit name
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = orgNameSchema.safeParse(name);
              if (!parsed.success) return setError(parsed.error.issues[0]?.message);
              rename.mutate(parsed.data, {
                onSuccess: () => {
                  toast.success("Name updated.");
                  setOpen(false);
                },
                onError: (err) => setError(toApiError(err).message),
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit organization name</DialogTitle>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor={id}>Name</Label>
              <Input
                id={id}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(undefined);
                }}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={rename.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

// US-09 – US-11. Metadata only: the Owner never sees projects or tasks (FR-PLAT-08).
export function PlatformOrgDetailPage() {
  const { id = "" } = useParams();
  const query = usePlatformOrganization(id);
  const transition = useTransition(id);
  const [reasonFor, setReasonFor] = useState<Transition | null>(null);

  const run = (t: Transition, reason?: string) =>
    transition.mutate(
      { transition: t, reason },
      {
        onSuccess: (org) => {
          toast.success(`${org.name} is now ${ORG_STATUS_LABELS[org.status].toLowerCase()}.`);
          setReasonFor(null);
        },
        onError: (err) => toast.error(toApiError(err).message),
      },
    );

  if (query.isPending) return <Skeleton className="h-64 w-full max-w-3xl" />;
  if (query.isError) {
    return <p className="text-sm text-destructive">{toApiError(query.error).message}</p>;
  }
  const org = query.data;

  return (
    <div className="grid max-w-3xl gap-6">
      <Link
        to="/platform/organizations"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Organizations
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        <OrgStatusBadge status={org.status} />
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <RenameDialog key={org.name} org={org} />
          {available(org).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={ACTIONS[t].variant}
              disabled={transition.isPending}
              onClick={() => (ACTIONS[t].needsReason ? setReasonFor(t) : run(t))}
            >
              {ACTIONS[t].label}
            </Button>
          ))}
        </div>
      </div>

      {org.statusReason && (
        <p className="border-l-2 pl-3 text-sm">
          <span className="text-muted-foreground">Reason: </span>
          {org.statusReason}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Registration details</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Type">{ORG_TYPE_LABELS[org.type]}</Detail>
            <Detail label="Size">{ORG_SIZE_LABELS[org.size]}</Detail>
            <Detail label="Industry">{INDUSTRY_LABELS[org.industry]}</Detail>
            <Detail label="Country">{countryName(org.country)}</Detail>
            <Detail label="Timezone">{org.timezone}</Detail>
            <Detail label="Website">
              {org.website ? (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-4"
                >
                  {org.website}
                </a>
              ) : (
                "—"
              )}
            </Detail>
            <Detail label="Registered">{formatDate(org.createdAt)}</Detail>
            <Detail label="Members">{org.memberCount}</Detail>
            {org.description && (
              <div className="sm:col-span-2">
                <Detail label="Description">{org.description}</Detail>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Tenant Admins</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm">
            {org.admins.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2">
                <span>{a.name}</span>
                <a
                  href={`mailto:${a.email}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {a.email}
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Status history</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3">
            {[...org.statusHistory].reverse().map((h, i) => (
              <li key={i} className="grid gap-1 border-l-2 pl-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <OrgStatusBadge status={h.status} />
                  <span className="text-muted-foreground">
                    {formatDateTime(h.changedAt)} · {h.changedBy?.name ?? "Unknown user"}
                  </span>
                </div>
                {h.reason && <p>{h.reason}</p>}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <ReasonDialog
        transition={reasonFor}
        orgName={org.name}
        pending={transition.isPending}
        onClose={() => setReasonFor(null)}
        onConfirm={(reason) => reasonFor && run(reasonFor, reason)}
      />
    </div>
  );
}
