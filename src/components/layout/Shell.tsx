import { Link } from "@tanstack/react-router";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Logo } from "@/components/brand/Logo";
import { unlockAudio } from "@/lib/audio";
import { useSettings } from "@/lib/stores/settings";
import { useEffect, useState } from "react";

export function Shell({
  children,
  flush,
  hideHeader,
}: {
  children: React.ReactNode;
  flush?: boolean;
  hideHeader?: boolean;
}) {
  const { user, isPending } = useCurrentUserState();
  const hydrate = useSettings((s) => s.hydrateAudio);
  const reduced = useSettings((s) => s.reducedMotion);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    hydrate();
    document.documentElement.classList.toggle("reduce-motion", reduced);
  }, [hydrate, reduced]);

  return (
    <div
      className="oz-app"
      onPointerDown={() => unlockAudio()}
      onKeyDown={() => unlockAudio()}
    >
      {!hideHeader && (
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line px-4 py-3 backdrop-blur-md">
        <Link to="/" className="text-xl text-fg" onClick={() => unlockAudio()}>
          <Logo />
        </Link>
        <nav className="hidden items-center gap-4 text-sm text-muted sm:flex">
          <Link to="/how-to-play" className="hover:text-fg">
            How to play
          </Link>
          <Link to="/leaderboard" className="hover:text-fg">
            Leaderboard
          </Link>
          <Link to="/settings" className="hover:text-fg">
            Settings
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {isPending ? (
            <div className="h-8 w-24 animate-pulse rounded-full bg-bg-subtle" />
          ) : (
            <>
              <SignedIn>
                <Link to="/profile" className="hidden text-sm text-muted hover:text-fg sm:inline">
                  {user?.displayName ?? "Profile"}
                </Link>
                {authEnabled && (
                  <button
                    type="button"
                    disabled={signingOut}
                    className="rounded-[12px] border border-line px-3 py-2 text-sm text-muted hover:text-fg"
                    onClick={() => {
                      setSigningOut(true);
                      void signOut().catch(() => setSigningOut(false));
                    }}
                  >
                    {signingOut ? "…" : "Sign out"}
                  </button>
                )}
              </SignedIn>
              <SignedOut>
                <Link
                  to="/login"
                  className="rounded-[12px] border border-line px-3 py-2 text-sm hover:border-gold hover:text-gold"
                >
                  Sign in
                </Link>
              </SignedOut>
            </>
          )}
        </div>
      </header>
      )}
      <div className={flush ? "" : "mx-auto max-w-6xl px-4 py-6"}>{children}</div>
    </div>
  );
}