import { useState } from "react";
import { useNavigate } from "react-router";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import type { Notification } from "@nexora/shared";
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
import { Skeleton } from "@/components/ui/skeleton";
import { notificationHref } from "../notification-text";
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from "../notifications-api";
import { NotificationItem } from "./notification-item";

// US-30: unread badge (polled) and the latest notifications in the header.
export function NotificationBell({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount(orgId);
  // The list loads only when the menu opens; the badge is the only thing polled.
  const list = useNotifications(orgId, 8, open);
  const markRead = useMarkRead(orgId);
  const markAll = useMarkAllRead(orgId);

  if (unread.isError) return null; // e.g. organization not active yet
  const count = unread.data ?? 0;
  const items = list.data?.pages.flatMap((p) => p.data) ?? [];

  const openOne = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id);
    void navigate(notificationHref(orgId, n));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
          />
        }
      >
        <BellIcon aria-hidden />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))]">
        <DropdownMenuGroup>
          <div className="flex items-center justify-between gap-2">
            <DropdownMenuLabel className="text-sm font-medium text-foreground">
              Notifications
            </DropdownMenuLabel>
            {count > 0 && (
              <DropdownMenuItem
                className="w-fit text-xs"
                closeOnClick={false}
                onClick={() => markAll.mutate()}
              >
                <CheckCheckIcon aria-hidden /> Mark all read
              </DropdownMenuItem>
            )}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {list.isPending ? (
          <div className="grid gap-2 p-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            You're all caught up.
          </p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} className="py-2" onClick={() => openOne(n)}>
              <NotificationItem notification={n} />
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-sm"
          onClick={() => void navigate(`/o/${orgId}/notifications`)}
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
