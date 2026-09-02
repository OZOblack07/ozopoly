import { createServerClient } from "@supabase/ssr";
import { getRequest, setCookie } from "@tanstack/react-start/server";

export function createSupabaseServerClient() {
  const request = getRequest();

  if (!request) {
    throw new Error("No request available");
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        const cookieHeader = request.headers.get("cookie") ?? "";

        return cookieHeader
          .split(";")
          .filter(Boolean)
          .map((cookie) => {
            const index = cookie.indexOf("=");
            return {
              name: cookie.slice(0, index).trim(),
              value: cookie.slice(index + 1).trim(),
            };
          });
      },

      setAll(cookies) {
        for (const { name, value, options } of cookies) {
          setCookie(name, value, options);
        }
      },
    },
  });
}
