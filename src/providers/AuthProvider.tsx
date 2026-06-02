import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { endSession, startSession } from "@/lib/sessionTracking.functions";
import type { Profile } from "@/types/auth";

export type AuthStatus =
  | "loading"
  | "unauthenticated"
  | "authenticated"
  | "profile_missing"
  | "inactive"
  | "invalid_role";

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const VALID_ROLES = new Set(["dispatcher", "engineer", "boss"]);

function getOrCreateClientSessionKey(userId: string): string {
  const key = `ocs:session-key:${userId}`;
  try {
    if (typeof sessionStorage === "undefined") return `${userId}:${Date.now()}`;
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, generated);
    return generated;
  } catch {
    return `${userId}:${Date.now()}`;
  }
}

function clearClientSessionKey(userId: string) {
  try {
    sessionStorage.removeItem(`ocs:session-key:${userId}`);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFetched, setProfileFetched] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("Failed to load profile", error);
      setProfile(null);
    } else {
      setProfile((data as Profile | null) ?? null);
    }
    setProfileLoading(false);
    setProfileFetched(true);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setAuthReady(true);
        if (!newSession) {
          setProfile(null);
          setProfileFetched(true);
        } else {
          setProfileFetched(false);
          // Defer DB call to avoid deadlock in callback
          setTimeout(() => {
            void fetchProfile(newSession.user.id);
          }, 0);
          if (event === "SIGNED_IN") {
            try {
              const provider =
                (newSession.user.app_metadata?.provider as string | undefined) ?? "unknown";
              const method: "google" | "password" | "unknown" =
                provider === "google"
                  ? "google"
                  : provider === "email"
                    ? "password"
                    : "unknown";
              const clientSessionKey = getOrCreateClientSessionKey(newSession.user.id);
              setTimeout(() => {
                void startSession({
                  data: {
                    userId: newSession.user.id,
                    clientSessionKey,
                    method,
                  },
                }).catch((err) => console.warn("[startSession] failed", err));
              }, 50);
            } catch {
              /* ignore */
            }
          }
        }
      },
    );

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
      if (data.session) {
        void fetchProfile(data.session.user.id);
      } else {
        setProfileFetched(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Notify server when the browsing session ends (tab close / refresh / nav).
  useEffect(() => {
    if (!session?.user.id) return;
    const userId = session.user.id;
    const handler = () => {
      try {
        const clientSessionKey =
          (typeof sessionStorage !== "undefined" &&
            sessionStorage.getItem(`ocs:session-key:${userId}`)) ||
          null;
        if (!clientSessionKey) return;
        const body = JSON.stringify({
          data: { userId, clientSessionKey, reason: "browser_closed" },
        });
        // Use fetch with keepalive so the request survives page unload.
        void fetch("/_serverFn/src_lib_sessionTracking_functions_ts--endSession_createServerFn_handler", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {
          /* best-effort */
        });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("pagehide", handler);
    };
  }, [session?.user.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return { error: result.error.message ?? "Google sign-in failed" };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const userId = session?.user.id;
    if (userId) {
      try {
        const clientSessionKey =
          (typeof sessionStorage !== "undefined" &&
            sessionStorage.getItem(`ocs:session-key:${userId}`)) ||
          null;
        if (clientSessionKey) {
          await endSession({
            data: { userId, clientSessionKey, reason: "signed_out" },
          }).catch((err) => console.warn("[endSession] failed", err));
        }
        clearClientSessionKey(userId);
      } catch {
        /* ignore */
      }
    }
    await supabase.auth.signOut();
    setProfile(null);
  }, [session?.user.id]);

  const refreshProfile = useCallback(async () => {
    if (session?.user.id) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const status: AuthStatus = useMemo(() => {
    if (!authReady) return "loading";
    if (!session) return "unauthenticated";
    if (profileLoading || !profileFetched) return "loading";
    if (!profile) return "profile_missing";
    if (!profile.is_active) return "inactive";
    if (!VALID_ROLES.has(profile.role)) return "invalid_role";
    return "authenticated";
  }, [authReady, session, profile, profileLoading, profileFetched]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, profile, signIn, signInWithGoogle, signOut, refreshProfile }),
    [status, session, profile, signIn, signInWithGoogle, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}