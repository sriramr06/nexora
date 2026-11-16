import { useNavigate } from "react-router";
import { Building2Icon, CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMyOrganizations } from "../org-api";
import type { MyOrganization } from "@nexora/shared";
import { OrgStatusBadge } from "./status-badge";

// FR-ORG-09: an organization this user registered that is still Pending or Rejected.
// Nobody can be invited into such an organization, so its admin is its creator.
export const openRegistrationOf = (orgs: MyOrganization[]) =>
  orgs.find(
    (o) => o.role === "admin" && (o.status === "pending_approval" || o.status === "rejected"),
  );

// US-08 / FR-ORG-06. Switching changes the URL (/o/:orgId), so every query below it
// is keyed by the new organization and nothing from the previous one is shown.
export function OrgSwitcher({ currentOrgId }: { currentOrgId?: string }) {
  const navigate = useNavigate();
  const { data: orgs = [] } = useMyOrganizations();
  const current = orgs.find((o) => o.id === currentOrgId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="max-w-36 min-w-0 justify-between sm:max-w-56"
          />
        }
      >
        <Building2Icon aria-hidden />
        <span className="truncate">{current?.name ?? "Organizations"}</span>
        <ChevronsUpDownIcon className="text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Your organizations</DropdownMenuLabel>
          {orgs.length === 0 && (
            <p className="px-1.5 py-1 text-sm text-muted-foreground">None yet.</p>
          )}
          {orgs.map((org) => (
            <DropdownMenuItem key={org.id} onClick={() => navigate(`/o/${org.id}`)}>
              <span className="truncate">{org.name}</span>
              {org.status !== "active" && <OrgStatusBadge status={org.status} />}
              {org.id === currentOrgId && <CheckIcon className="ml-auto" aria-label="Current" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {!openRegistrationOf(orgs) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/organizations/new")}>
              <PlusIcon aria-hidden /> Register an organization
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
