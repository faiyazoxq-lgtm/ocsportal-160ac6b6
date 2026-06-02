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
import { notifySignIn } from "@/lib/signinNotify.functions";
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
            // Dedupe across tab reloads — Supabase re-fires SIGNED_IN on
            // restore. Only notify once per access token.
            try {
              const key = `ocs:signin-notified:${newSession.access_token.slice(-24)}`;
              if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(key)) {
                sessionStorage.setItem(key, "1");
                const provider =
                  (newSession.user.app_metadata?.provider as string | undefined) ?? "unknown";
                const method: "google" | "password" | "unknown" =
                  provider === "google" ? "google" : provider === "email" ? "password" : "unknown";
                setTimeout(() => {
                  void notifySignIn({ data: { userId: newSession.user.id, method } }).catch(
                    (err) => console.warn("[signinNotify] failed", err),
                  );
                }, 50);
              }
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
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

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