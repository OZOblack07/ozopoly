import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: () =>
        new Response("Authentication is handled by Supabase.", {
          status: 404,
        }),
      POST: () =>
        new Response("Authentication is handled by Supabase.", {
          status: 404,
        }),
    },
  },
});
