/**
 * Legacy Grok/Better Auth popup handler.
 *
 * Supabase Auth now handles OAuth directly from the client, so this
 * server-side popup handler is intentionally kept as a no-op compatibility
 * module for any development tooling that still imports it.
 */

export async function handleAuthPopupRequest(
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);

  return new Response(
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Authentication</title>
</head>
<body>
  <p>Authentication is handled by Supabase. You can close this window.</p>
  <script>
    if (window.opener) {
      window.opener.location.reload();
    }
    window.close();
  </script>
</body>
</html>`,
    {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
