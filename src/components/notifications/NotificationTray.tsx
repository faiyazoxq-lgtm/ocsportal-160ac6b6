import { useRouter } from "@tanstack/react-router";
import { Check, CheckCheck, X, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDismissNotification,
} from "@/hooks/useNotifications";
import {
  NOTIFICATION_TYPE_LABEL,
  type NotificationRow,
} from "@/types/notifications";

function severityClass(s: NotificationRow["severity"]) {
  switch (s) {
    case "critical":
      return "border-l-destructive bg-destructive/5";
    case "warn":
      return "border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20";
    default:
      return "border-l-primary/40 bg-card";
  }
}

export function NotificationTray({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { data: items = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();

  const open_ = (n: NotificationRow) => {
    if (!n.read_at) void markRead.mutate({ id: n.id });
    if (n.link_path) {
      onOpenChange(false);
      void router.navigate({ to: n.link_path });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md p-0 sm:max-w-md">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <SheetHeader className="text-left">
            <SheetTitle className="text-sm font-semibold">Notifications</SheetTitle>
          </SheetHeader>
          <button
            type="button"
            onClick={() => markAll.mutate()}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
          >
            <CheckCheck className="h-3 w-3" />
            Mark all read
          </button>
        </div>

        <div className="max-h-[calc(100vh-3.25rem)] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Loading…
            </div>
          ) : !items.length ? (
            <div className="p-8 text-center">
              <Inbox className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                No notifications yet. You'll see operational alerts here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const unread = !n.read_at;
                return (
                  <li
                    key={n.id}
                    className={`group border-l-2 px-3 py-2.5 transition-colors hover:bg-accent/30 ${severityClass(n.severity)}`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => open_(n)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          {unread ? (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          ) : null}
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {NOTIFICATION_TYPE_LABEL[n.notification_type]}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ·{" "}
                            {formatDistanceToNow(new Date(n.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <div
                          className={`mt-0.5 text-sm ${unread ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}
                        >
                          {n.title}
                        </div>
                        {n.body ? (
                          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {n.body}
                          </div>
                        ) : null}
                      </button>
                      <div className="flex shrink-0 flex-col gap-1 opacity-0 group-hover:opacity-100">
                        {unread ? (
                          <button
                            type="button"
                            onClick={() => markRead.mutate({ id: n.id })}
                            className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label="Mark read"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => dismiss.mutate({ id: n.id })}
                          className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label="Dismiss"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}