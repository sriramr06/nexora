import { useNavigate } from "react-router";
import { BellOffIcon, CheckCheckIcon } from "lucide-react";
import { toast } from "sonner";
import type { Notification } from "@nexora/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toApiError } from "@/lib/api-error";
import { useOrg } from "@/features/organizations/org-gate";
import { NotificationItem } from "../components/notification-item";
import { notificationHref } from "../notification-text";
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from "../notifications-api";

// US-30 / FR-NOT-04 – 06: every notification in this organization, newest first.
export function NotificationsPage() {
  const { organization } = useOrg();
  const orgId = organization.id;
  const navigate = useNavigate();
  const list = useNotifications(orgId, 20);
  const unread = useUnreadCount(orgId);
  const markRead = useMarkRead(orgId);
  const markAll = useMarkAllRead(orgId);

  const open = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id);
    void navigate(notificationHref(orgId, n));
  };
  const items = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Updates about work that concerns you. Kept for 90 days.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!unread.data || markAll.isPending}
          onClick={() =>
            markAll.mutate(undefined, { onError: (e) => toast.error(toApiError(e).message) })
          }
        >
          <CheckCheckIcon aria-hidden /> Mark all read
        </Button>
      </div>

      {list.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : list.isError ? (
        <p className="text-sm text-destructive">{toApiError(list.error).message}</p>
      ) : items.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed p-10 text-center">
          <BellOffIcon className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">No notifications yet</p>
          <p className="text-sm text-muted-foreground">
            You'll hear here when someone assigns you work, reviews it or comments.
          </p>
        </div>
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className="w-full px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                >
                  <NotificationItem notification={n} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {list.hasNextPage && (
        <Button
          variant="outline"
          className="w-fit justify-self-center"
          disabled={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          {list.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
