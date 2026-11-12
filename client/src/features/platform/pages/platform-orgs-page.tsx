import { type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { SearchIcon } from "lucide-react";
import { ORG_STATUSES, ORG_STATUS_LABELS, type OrgStatus } from "@nexora/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toApiError } from "@/lib/api-error";
import { OrgStatusBadge } from "@/features/organizations/components/status-badge";
import { countryName, formatDate } from "@/features/organizations/labels";
import { usePlatformOrganizations } from "../platform-api";

const isStatus = (v: string | null): v is OrgStatus =>
  v !== null && (ORG_STATUSES as readonly string[]).includes(v);

// US-09 / FR-PLAT-02. Filters live in the URL (FE §3), so the view is shareable and
// survives a reload.
export function PlatformOrgsPage() {
  const [params, setParams] = useSearchParams();
  const statusParam = params.get("status");
  const status = isStatus(statusParam) ? statusParam : undefined;
  const q = params.get("q") ?? undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);

  const query = usePlatformOrganizations({ status, q, page });

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next);
  };

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = new FormData(e.currentTarget).get("q");
    update({ q: typeof value === "string" ? value.trim() : undefined, page: undefined });
  };

  const tabs: { label: string; value?: OrgStatus }[] = [
    { label: "All" },
    ...ORG_STATUSES.map((s) => ({ label: ORG_STATUS_LABELS[s], value: s })),
  ];

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <Button
              key={tab.label}
              size="sm"
              variant={status === tab.value ? "secondary" : "ghost"}
              aria-pressed={status === tab.value}
              onClick={() => update({ status: tab.value, page: undefined })}
            >
              {tab.label}
            </Button>
          ))}
        </nav>
        <form onSubmit={onSearch} role="search" className="relative sm:w-64">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            key={q}
            name="q"
            defaultValue={q}
            placeholder="Search by name"
            aria-label="Search organizations by name"
            className="pl-8"
          />
        </form>
      </div>

      <Card className="py-0">
        {query.isError ? (
          <p className="p-4 text-sm text-destructive">{toApiError(query.error).message}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Country</TableHead>
                <TableHead className="hidden pr-4 sm:table-cell">Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={cn(query.isPlaceholderData && "opacity-60")}>
              {query.isPending &&
                [1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4} className="px-4">
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {query.data?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No organizations match.
                  </TableCell>
                </TableRow>
              )}
              {query.data?.data.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link
                      to={`/platform/organizations/${org.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {org.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <OrgStatusBadge status={org.status} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{countryName(org.country)}</TableCell>
                  <TableCell className="hidden pr-4 text-muted-foreground sm:table-cell">
                    {formatDate(org.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {query.data && query.data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {query.data.pagination.totalPages} · {query.data.pagination.total}{" "}
            organizations
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= query.data.pagination.totalPages}
              onClick={() => update({ page: String(page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
