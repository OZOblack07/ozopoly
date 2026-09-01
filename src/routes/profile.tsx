import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";
import { TokenGlyph, TOKEN_LABEL } from "@/components/game/TokenGlyph";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { getMyProfile, updateMyProfile } from "@/lib/fn/identity";
import { TOKEN_LIST, type TokenId } from "@/lib/game/types";
import { formatNaira } from "@/lib/game/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const [row, setRow] = useState<Awaited<ReturnType<typeof getMyProfile>>>(null);
  const [name, setName] = useState("");
  const [token, setToken] = useState<TokenId>("crown");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getMyProfile().then((p) => {
      setRow(p);
      setName(p?.username ?? user.displayName ?? "");
      setToken((p?.token as TokenId) || "crown");
    });
  }, [user]);

  if (isPending) {
    return (
      <Shell>
        <div className="h-40 animate-pulse rounded-[28px] bg-bg-subtle" />
      </Shell>
    );
  }
  if (!user) return <RedirectToSignIn />;

  const played = row?.games_played ?? 0;
  const won = row?.games_won ?? 0;
  const rate = played ? Math.round((won / played) * 100) : 0;
  const achievements = [
    { id: "first", label: "First win", on: won >= 1 },
    { id: "mil", label: "Millionaire", on: (row?.best_net_worth ?? 0) >= 1_000_000 },
    { id: "tycoon", label: "Property tycoon", on: (row?.total_properties_owned ?? 0) >= 20 },
    { id: "king", label: "Ozopoly king", on: won >= 10 },
    { id: "streak", label: "Hot streak", on: (row?.current_streak ?? 0) >= 3 },
  ];

  return (
    <Shell>
      <h1 className="font-display text-3xl">Profile</h1>
      <div className="oz-panel mt-6 max-w-xl rounded-[28px] p-5">
        <div className="flex items-center gap-3">
          {user.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="" className="size-14 rounded-full object-cover" />
          ) : (
            <span className="grid size-14 place-items-center rounded-full bg-gold text-gold-fg">
              <TokenGlyph token={token} className="size-6" color="#1a1408" />
            </span>
          )}
          <div>
            <p className="font-display text-xl">{row?.username ?? user.displayName ?? "Player"}</p>
            <p className="text-sm text-muted">{user.primaryEmail}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Stat k="Games played" v={String(played)} />
          <Stat k="Wins" v={String(won)} />
          <Stat k="Win rate" v={`${rate}%`} />
          <Stat k="Best net worth" v={formatNaira(row?.best_net_worth ?? 0)} />
          <Stat k="Properties bought" v={String(row?.total_properties_owned ?? 0)} />
          <Stat k="Current streak" v={String(row?.current_streak ?? 0)} />
        </dl>
        <label className="mt-6 block text-xs text-muted">
          Username
          <input
            className="mt-1 min-h-11 w-full rounded-[12px] border border-line bg-bg-subtle px-3 text-sm text-fg"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p className="mt-4 text-xs text-muted">Token</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TOKEN_LIST.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setToken(t)}
              className={cn(
                "grid size-11 place-items-center rounded-[12px] border",
                token === t ? "border-gold text-gold" : "border-line text-muted",
              )}
              aria-label={TOKEN_LABEL[t]}
            >
              <TokenGlyph token={t} />
            </button>
          ))}
        </div>
        <Button
          className="mt-5"
          onClick={async () => {
            await updateMyProfile({ data: { username: name, token } });
            setSaved(true);
          }}
        >
          Save
        </Button>
        {saved && <p className="mt-2 text-xs text-ok">Saved.</p>}
      </div>
      <h2 className="mt-8 font-display text-xl">Achievements</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {achievements.map((a) => (
          <li
            key={a.id}
            className={cn("oz-panel rounded-[18px] p-3 text-sm", a.on ? "text-gold" : "text-muted")}
          >
            {a.label}
          </li>
        ))}
      </ul>
      <Link to="/" className="mt-8 inline-block text-sm text-muted hover:text-fg">
        Home
      </Link>
    </Shell>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
