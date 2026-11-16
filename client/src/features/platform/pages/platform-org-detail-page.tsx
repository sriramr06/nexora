import { useId, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";
import { orgNameSchema, type PlatformOrganizationDetails } from "@nexora/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { OrgActions } from "../components/org-actions";
import { usePlatformOrganization, useRename } from "../platform-api";

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
  if (query.isPending) return <Skeleton className="h-64 w-full max-w-3xl" />;
  if (query.isError) {
    return <p className="text-sm text-destructive">{toApiError(query.error).message}</p>;
  }
  const org = query.data;

  return (
    <div className="grid max-w-4xl gap-6">
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
          <OrgActions org={org} />
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
    </div>
  );
}
