import { useState } from "react";
import { Bell, Settings2 } from "lucide-react";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { NotificationTray } from "./NotificationTray";

export function NotificationBell({
  compact = false,
  onOpenPreferences,
}: {
  compact?: boolean;
  onOpenPreferences?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = useUnreadNotificationCount();

  return (
    <>
      <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative inline-flex items-center justify-center rounded-sm border border-border bg-background text-foreground hover:bg-accent ${
          compact ? "h-8 w-8" : "h-9 w-9"
        }`}
        aria-label={`Notifications${count ? ` (${count} unread)` : ""}`}
      >
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>
      {onOpenPreferences ? (
        <button
          type="button"
          onClick={onOpenPreferences}
          className={`inline-flex items-center justify-center rounded-sm border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground ${
            compact ? "h-8 w-8" : "h-9 w-9"
          }`}
          aria-label="Notification preferences"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
      </div>
      <NotificationTray open={open} onOpenChange={setOpen} />
    </>
  );
}