import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/db-types";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  sessionLoading: boolean;
  profileLoading: boolean;
  loading: boolean;
  profileError: { code?: string; message: string } | null;
  profileMissing: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<{ code?: string; message: string } | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const profileRequestId = useRef(0);

  const clearProfileState = useCallback(() => {
    profileRequestId.current += 1;
    setProfile(null);
    setProfileError(null);
    setProfileMissing(false);
    setProfileLoading(false);
  }, []);

  const loadProfile = useCallback(async (uid: string) => {
    const requestId = ++profileRequestId.current;
    setProfileLoading(true);
    setProfileError(null);
    setProfileMissing(false);
    console.info("[auth] loading public.users profile", uid);

    const { data, error } = await supabase
      .from("users")
      .select("id,email,full_name,phone,role,created_at,updated_at")
      .eq("id", uid)
      .maybeSingle();

    // Ignore a stale response from a previous user/session.
    if (requestId !== profileRequestId.current) return;

    if (error) {
      console.error("[auth] profile fetch error", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      setProfile(null);
      setProfileError({ code: error.code, message: error.message });
      setProfileLoading(false);
      return;
    }

    if (!data) {
      console.warn("[auth] public.users row not found", uid);
      setProfile(null);
      setProfileMissing(true);
      setProfileLoading(false);
      return;
    }

    setProfile(data as Profile);
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    let initialSessionResolved = false;
    let loadedUserId: string | null = null;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!initialSessionResolved) {
        initialSessionResolved = true;
        setSessionLoading(false);
      }

      const nextUserId = nextSession?.user?.id ?? null;
      if (!nextUserId) {
        loadedUserId = null;
        clearProfileState();
        return;
      }

      // getSession() and INITIAL_SESSION can resolve almost together. Only one
      // profile request is needed for the same authenticated user.
      if (loadedUserId === nextUserId) return;
      loadedUserId = nextUserId;

      setTimeout(() => {
        if (mounted) void loadProfile(nextUserId);
      }, 0);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.info("[auth] state change", event, nextSession?.user?.id ?? null);
      applySession(nextSession);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("[auth] getSession error", {
          code: (error as { code?: string }).code,
          message: error.message,
        });
      }
      if (!initialSessionResolved) applySession(data.session);
    });

    return () => {
      mounted = false;
      profileRequestId.current += 1;
      subscription.subscription.unsubscribe();
    };
  }, [clearProfileState, loadProfile]);

  const value: AuthCtx = {
    user,
    session,
    profile,
    sessionLoading,
    profileLoading,
    loading:
      sessionLoading ||
      (!!user && profileLoading && !profile && !profileError && !profileMissing),
    profileError,
    profileMissing,
    isAdmin: profile?.role === "admin",
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[auth] signOut error", { message: error.message });
      }
    },
    refreshProfile: async () => {
      if (user) await loadProfile(user.id);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const context = useContext(Ctx);
  if (!context) throw new Error("useAuth outside provider");
  return context;
}
