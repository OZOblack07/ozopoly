import { supabase } from "@/lib/supabase/client";

export const authEnabled = true;

export async function signIn(
  providerId: string,
  opts: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  if (providerId !== "google") {
    throw new Error(`Unsupported sign-in provider: ${providerId}`);
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}${opts.callbackURL ?? "/"}`,
    },
  });

  if (error) {
    throw error;
  }
}

export async function signOut(redirectTo = "/"): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  window.location.href = redirectTo;
}
