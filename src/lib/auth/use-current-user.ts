import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: boolean;
};

export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  isDevFallback: true,
};

export type CurrentUserState = {
  user: AppUser | null;
  isPending: boolean;
};

export function useCurrentUserState(): CurrentUserState {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setUser(
        supabaseUser
          ? {
              id: supabaseUser.id,
              displayName:
                supabaseUser.user_metadata?.name ??
                supabaseUser.email?.split("@")[0] ??
                null,
              primaryEmail: supabaseUser.email ?? null,
              profileImageUrl:
                supabaseUser.user_metadata?.avatar_url ??
                supabaseUser.user_metadata?.picture ??
                null,
              isDevFallback: false,
            }
          : null,
      );

      setIsPending(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const supabaseUser = session?.user ?? null;

      setUser(
        supabaseUser
          ? {
              id: supabaseUser.id,
              displayName:
                supabaseUser.user_metadata?.name ??
                supabaseUser.email?.split("@")[0] ??
                null,
              primaryEmail: supabaseUser.email ?? null,
              profileImageUrl:
                supabaseUser.user_metadata?.avatar_url ??
                supabaseUser.user_metadata?.picture ??
                null,
              isDevFallback: false,
            }
          : null,
      );

      setIsPending(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, isPending };
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
