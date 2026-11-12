import { ORG_STATUS_LABELS, type OrgStatus } from "@nexora/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Flat dot + label (UI-7). Colour is never the only signal: the label is always shown.
const dot: Record<OrgStatus, string> = {
  pending_approval: "bg-chart-3",
  active: "bg-chart-2",
  rejected: "bg-destructive",
  suspended: "bg-muted-foreground",
};

export function OrgStatusBadge({ status }: { status: OrgStatus }) {
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span className={cn("size-1.5 rounded-full", dot[status])} aria-hidden />
      {ORG_STATUS_LABELS[status]}
    </Badge>
  );
}
