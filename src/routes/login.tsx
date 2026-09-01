import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Shell } from "@/components/layout/Shell";

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
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: email.split("@")[0] ?? "Player",
        });
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) throw new Error(err.message);
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <main className="mx-auto grid min-h-[70dvh] max-w-sm place-items-center">
        <div className="oz-panel w-full rounded-[28px] p-6">
          <Logo className="text-2xl" />
          <h1 className="mt-4 font-display text-2xl">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Save stats, climb the board, host ranked rooms.</p>
          {authEnabled ? (
            <div className="mt-5 space-y-3">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  variant="secondary"
                  className="w-full"
                  onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                >
                  Continue with {p.label}
                </Button>
              ))}
              <div className="relative py-2 text-center text-xs text-subtle">or email</div>
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
                {error && <p className="text-sm text-danger">{error}</p>}
                <Button className="w-full" disabled={busy} type="submit">
                  {mode === "in" ? "Sign in" : "Create account"}
                </Button>
              </form>
              <button
                type="button"
                className="w-full text-xs text-muted hover:text-fg"
                onClick={() => setMode(mode === "in" ? "up" : "in")}
              >
                {mode === "in" ? "Need an account? Sign up" : "Have an account? Sign in"}
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Sign-in is disabled in this environment.</p>
          )}
          <Link to="/" className="mt-6 block text-center text-sm text-muted hover:text-fg">
            Play as guest
          </Link>
        </div>
      </main>
    </Shell>
  );
}
