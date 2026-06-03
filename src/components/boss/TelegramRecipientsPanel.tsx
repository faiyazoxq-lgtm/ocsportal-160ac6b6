import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Trash2, Save, ChevronDown } from "lucide-react";
import {
  listTelegramRecipients,
  adminSetTelegramLink,
  adminClearTelegramLink,
  adminUpdateNotificationPrefs,
} from "@/lib/telegramAdmin.functions";
import {
  NOTIFICATION_TYPE_LABEL,
  ROLE_RELEVANT_TYPES,
  type NotificationType,
} from "@/types/notifications";
import { cn } from "@/lib/utils";

type Row = {
  profile_id: string;
  full_name: string | null;
  email: string;
  role: "boss" | "dispatcher" | "engineer";
  telegram_username: string | null;
  telegram_chat_id: string | null;
  telegram_linked_at: string | null;
  in_app_enabled: boolean;
  telegram_enabled: boolean;
  muted_types: NotificationType[];
};

export function TelegramRecipientsPanel() {
  const list = useServerFn(listTelegramRecipients);
  const { data, isLoading, error } = useQuery({
    queryKey: ["boss", "telegram-recipients"],
    queryFn: () => list({}),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading recipients…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load recipients: {(error as Error).message}
      </p>
    );
  }

  const rows = (data?.rows ?? []) as Row[];
  const byRole = {
    boss: rows.filter((r) => r.role === "boss"),
    dispatcher: rows.filter((r) => r.role === "dispatcher"),
    engineer: rows.filter((r) => r.role === "engineer"),
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card/60 p-3 text-[12px] leading-relaxed text-muted-foreground">
        Add a Telegram <b>chat ID</b> to enable bot delivery for that user. The
        chat ID is the numeric ID from <code>@userinfobot</code> on Telegram
        (it&apos;s like <code>123456789</code>, or negative for groups).
        Username is optional and shown for reference. Per-user toggles control
        which notification types reach them.
      </div>

      {(["dispatcher", "boss", "engineer"] as const).map((role) => (
        <RoleSection key={role} role={role} rows={byRole[role]} />
      ))}
    </div>
  );
}

function RoleSection({
  role,
  rows,
}: {
  role: "boss" | "dispatcher" | "engineer";
  rows: Row[];
}) {
  if (!rows.length) return null;
  return (
    <section>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {role === "boss" ? "Bosses" : role === "dispatcher" ? "Dispatchers" : "Engineers"}
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {rows.map((r) => (
          <RecipientRow key={r.profile_id} row={r} />
        ))}
      </ul>
    </section>
  );
}

function RecipientRow({ row }: { row: Row }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [chatId, setChatId] = useState(row.telegram_chat_id ?? "");
  const [username, setUsername] = useState(row.telegram_username ?? "");

  const setLink = useMutation({
    mutationFn: useServerFn(adminSetTelegramLink),
    onSuccess: () => {
      toast.success("Telegram link saved");
      qc.invalidateQueries({ queryKey: ["boss", "telegram-recipients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const clearLink = useMutation({
    mutationFn: useServerFn(adminClearTelegramLink),
    onSuccess: () => {
      toast.success("Telegram link removed");
      setChatId("");
      setUsername("");
      qc.invalidateQueries({ queryKey: ["boss", "telegram-recipients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updatePrefs = useMutation({
    mutationFn: useServerFn(adminUpdateNotificationPrefs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boss", "telegram-recipients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = () => {
    if (!chatId.trim()) {
      toast.error("Chat ID is required");
      return;
    }
    setLink.mutate({
      data: {
        profileId: row.profile_id,
        telegramChatId: chatId.trim(),
        telegramUsername: username.trim() || undefined,
      },
    });
  };

  const remove = () => {
    if (!confirm(`Remove Telegram link for ${row.full_name || row.email}?`)) return;
    clearLink.mutate({ data: { profileId: row.profile_id } });
  };

  const toggleTelegramEnabled = (v: boolean) =>
    updatePrefs.mutate({
      data: { profileId: row.profile_id, telegram_enabled: v },
    });

  const toggleMuted = (t: NotificationType) => {
    const next = row.muted_types.includes(t)
      ? row.muted_types.filter((x) => x !== t)
      : [...row.muted_types, t];
    updatePrefs.mutate({
      data: { profileId: row.profile_id, muted_types: next },
    });
  };

  const relevantTypes = ROLE_RELEVANT_TYPES[row.role];
  const isLinked = !!row.telegram_chat_id;

  return (
    <li className="px-3 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {row.full_name || row.email}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {row.email}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            isLinked
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          <Send className="h-3 w-3" />
          {isLinked ? "Linked" : "Not linked"}
        </span>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={row.telegram_enabled}
            disabled={!isLinked || updatePrefs.isPending}
            onChange={(e) => toggleTelegramEnabled(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Telegram on
        </label>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
        >
          {expanded ? "Hide" : "Manage"}
          <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/30 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <label className="text-[11px]">
              <span className="mb-1 block font-semibold uppercase tracking-wider text-muted-foreground">
                Chat ID
              </span>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="e.g. 123456789"
                className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-[11px]">
              <span className="mb-1 block font-semibold uppercase tracking-wider text-muted-foreground">
                Username (optional)
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@handle"
                className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={save}
              disabled={setLink.isPending}
              className="inline-flex items-center gap-1 self-end rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={!isLinked || clearLink.isPending}
              className="inline-flex items-center gap-1 self-end rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mute event types for this user
            </div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {relevantTypes.map((t) => {
                const isMuted = row.muted_types.includes(t);
                return (
                  <li key={t}>
                    <label className="flex items-center justify-between gap-2 rounded-sm border border-border bg-background px-2 py-1.5 text-[12px]">
                      <span className="truncate text-foreground">
                        {NOTIFICATION_TYPE_LABEL[t]}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={isMuted}
                          disabled={updatePrefs.isPending}
                          onChange={() => toggleMuted(t)}
                          className="h-3.5 w-3.5"
                        />
                        Muted
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}