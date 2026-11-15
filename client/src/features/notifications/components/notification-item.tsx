import type { Notification } from "@nexora/shared";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { describeNotification, timeAgo } from "../notification-text";

// One row, used by the bell menu and the Notifications page.
export function NotificationItem({ notification: n }: { notification: Notification }) {
  return (
    <div className="flex w-full min-w-0 items-start gap-2.5 text-left">
      <UserAvatar name={n.actor?.name ?? "?"} url={n.actor?.avatarUrl} size="sm" />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className={cn("text-sm break-words", !n.read && "font-medium")}>
          {describeNotification(n)}
        </p>
        <time dateTime={n.createdAt} className="text-xs text-muted-foreground">
          {timeAgo(n.createdAt)}
        </time>
      </div>
      {!n.read && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
          <span className="sr-only">Unread</span>
        </span>
      )}
    </div>
  );
}
