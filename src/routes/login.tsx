import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Shell } from "@/components/layout/Shell";
import { supabase } from "@/lib/supabase/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === "up") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: email.split("@")[0] ?? "Player",
            },
          },
        });

        if (err) throw err;

        setError("Account created. Check your email if confirmation is required.");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (err) throw err;

        window.location.href = "/";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    setError(null);

    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (err) throw err;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <Shell>
      <main className="mx-auto grid min-h-[70dvh] max-w-sm place-items-center">
        <div className="oz-panel w-full rounded-[28px] p-6">
          <Logo className="text-2xl" />

          <h1 className="mt-4 font-display text-2xl">
            {mode === "in" ? "Sign in" : "Create account"}
          </h1>

          <p className="mt-1 text-sm text-muted">
            Save stats, climb the board, host ranked rooms.
          </p>

          <div className="mt-5 space-y-3">
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={onGoogle}
            >
              Continue with Google
            </Button>

            <div className="relative py-2 text-center text-xs text-subtle">
              or email
            </div>

            <form className="space-y-2" onSubmit={onEmail}>
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 w-full rounded-[12px] border border-line bg-bg-subtle px-3 text-sm"
              />

              <input
                type="password"
                required
                minLength={8}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11 w-full rounded-[12px] border border-line bg-bg-subtle px-3 text-sm"
              />

              {error && (
                <p className="text-sm text-danger">
                  {error}
                </p>
              )}

              <Button className="w-full" disabled={busy} type="submit">
                {busy
                  ? "Please wait..."
                  : mode === "in"
                    ? "Sign in"
                    : "Create account"}
              </Button>
            </form>

            <button
              type="button"
              className="w-full text-xs text-muted hover:text-fg"
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setError(null);
              }}
            >
              {mode === "in"
                ? "Need an account? Sign up"
                : "Have an account? Sign in"}
            </button>
          </div>

          <Link
            to="/"
            className="mt-6 block text-center text-sm text-muted hover:text-fg"
          >
            Play as guest
          </Link>
        </div>
      </main>
    </Shell>
  );
}
