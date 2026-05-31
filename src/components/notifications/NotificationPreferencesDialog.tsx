import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/useNotifications";
import {
  NOTIFICATION_TYPE_LABEL,
  ROLE_RELEVANT_TYPES,
  type NotificationType,
} from "@/types/notifications";

export function NotificationPreferencesDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: "dispatcher" | "engineer";
}) {
  const { data: prefs } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const [inApp, setInApp] = useState(true);
  const [telegram, setTelegram] = useState(true);
  const [muted, setMuted] = useState<NotificationType[]>([]);

  useEffect(() => {
    if (!open) return;
    setInApp(prefs?.in_app_enabled ?? true);
    setTelegram(prefs?.telegram_enabled ?? true);
    setMuted((prefs?.muted_types ?? []) as NotificationType[]);
  }, [open, prefs]);

  const toggleMuted = (t: NotificationType) =>
    setMuted((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t],
    );

  const save = async () => {
    await update.mutateAsync({
      in_app_enabled: inApp,
      telegram_enabled: telegram,
      muted_types: muted,
    });
    onOpenChange(false);
  };

  const types = ROLE_RELEVANT_TYPES[role];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Notification preferences
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose how you want to be alerted. Muted types still appear in the
            tray but don't trigger active alerts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 rounded-sm border border-border bg-card p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium text-foreground">In-app alerts</span>
                <span className="block text-[11px] text-muted-foreground">
                  Show notifications in the tray and bell badge
                </span>
              </span>
              <input
                type="checkbox"
                checked={inApp}
                onChange={(e) => setInApp(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium text-foreground">Telegram</span>
                <span className="block text-[11px] text-muted-foreground">
                  Route critical alerts to Telegram when configured
                </span>
              </span>
              <input
                type="checkbox"
                checked={telegram}
                onChange={(e) => setTelegram(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mute event types
            </div>
            <ul className="divide-y divide-border rounded-sm border border-border bg-card">
              {types.map((t) => {
                const isMuted = muted.includes(t);
                return (
                  <li key={t} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-foreground">{NOTIFICATION_TYPE_LABEL[t]}</span>
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={isMuted}
                        onChange={() => toggleMuted(t)}
                        className="h-3.5 w-3.5"
                      />
                      Muted
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={update.isPending}
            className="inline-flex items-center rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {update.isPending ? "Saving…" : "Save preferences"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}