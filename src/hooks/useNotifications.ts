import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type {
  NotificationRow,
  NotificationPreferencesRow,
  NotificationType,
} from "@/types/notifications";

const LIST_LIMIT = 50;

function key(userId: string | null | undefined) {
  return ["notifications", userId ?? "anon"] as const;
}

export function useNotifications(opts: { onlyUnread?: boolean } = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: [...key(userId), opts.onlyUnread ? "unread" : "all"],
    enabled: !!userId,
    queryFn: async (): Promise<NotificationRow[]> => {
      let q = supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);
      if (opts.onlyUnread) q = q.is("read_at", null).is("dismissed_at", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  // Realtime — refresh on any change to the user's notifications
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_profile_id=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: key(userId) });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return query;
}

export function useUnreadNotificationCount() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: [...key(userId), "unread-count"],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null)
        .is("dismissed_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif-count:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_profile_id=eq.${userId}`,
        },
        () => qc.invalidateQueries({ queryKey: key(userId) }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return query;
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(user?.id) }),
  });
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(user?.id) }),
  });
}

export function useDismissNotification() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase
        .from("notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(user?.id) }),
  });
}

/* ============ Preferences ============ */

function prefsKey(userId: string | null | undefined) {
  return ["notification-prefs", userId ?? "anon"] as const;
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: prefsKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<NotificationPreferencesRow | null> => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("profile_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as NotificationPreferencesRow | null;
    },
  });
}

export function useUpdateNotificationPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      in_app_enabled?: boolean;
      telegram_enabled?: boolean;
      muted_types?: NotificationType[];
    }) => {
      if (!user?.id) throw new Error("Not signed in");
      const { error } = await supabase.from("notification_preferences").upsert(
        {
          profile_id: user.id,
          in_app_enabled: input.in_app_enabled ?? true,
          telegram_enabled: input.telegram_enabled ?? true,
          muted_types: input.muted_types ?? [],
        },
        { onConflict: "profile_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: prefsKey(user?.id) }),
  });
}