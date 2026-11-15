import { Link, useLocation } from "react-router";
import type { ActivityEntry } from "@nexora/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { toApiError } from "@/lib/api-error";
import { formatDateTime } from "@/features/organizations/labels";
import { useOrg } from "@/features/organizations/org-gate";
import { useProjectActivity } from "../projects-api";
import { describeActivity } from "./activity-text";

// Task entries name the task they are about; deleted tasks keep their title snapshot (DM-4).
function TaskRef({ entry }: { entry: ActivityEntry }) {
  const { organization } = useOrg();
  const location = useLocation();
  if (!entry.taskId || !entry.snapshot.taskTitle) return null;
  if (entry.action === "task.deleted") {
    return <span className="truncate text-muted-foreground">{entry.snapshot.taskTitle}</span>;
  }
  return (
    <Link
      to={`/o/${organization.id}/tasks/${entry.taskId}`}
      state={{ from: location.pathname }}
      className="w-fit max-w-full truncate text-primary underline-offset-4 hover:underline"
    >
      {entry.snapshot.taskTitle}
    </Link>
  );
}

// US-29 / FR-ACT-04: who changed what in this project, newest first, page by page.
export function ProjectActivity({ projectId }: { projectId: string }) {
  const { organization } = useOrg();
  const feed = useProjectActivity(organization.id, projectId);

  if (feed.isPending) return <Skeleton className="h-48 w-full" />;
  if (feed.isError)
    return <p className="text-sm text-destructive">{toApiError(feed.error).message}</p>;
  const entries = feed.data.pages.flatMap((p) => p.data);

  return (
    <div className="grid gap-4">
      <Card className="gap-0 py-0">
        <ol className="divide-y">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3 px-4 py-3 text-sm">
              <UserAvatar name={e.actor?.name ?? "?"} url={e.actor?.avatarUrl} size="sm" />
              <div className="grid min-w-0 gap-0.5">
                <p className="break-words">
                  <span className="font-medium">{e.actor?.name ?? "A former member"}</span>{" "}
                  {describeActivity(e)}
                </p>
                <TaskRef entry={e} />
                <time dateTime={e.createdAt} className="text-xs text-muted-foreground">
                  {formatDateTime(e.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      {feed.hasNextPage && (
        <Button
          variant="outline"
          className="w-fit justify-self-center"
          disabled={feed.isFetchingNextPage}
          onClick={() => void feed.fetchNextPage()}
        >
          {feed.isFetchingNextPage ? "Loading…" : "Load older activity"}
        </Button>
      )}
    </div>
  );
}
