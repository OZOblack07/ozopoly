import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/layout/Shell";
import { TokenGlyph } from "@/components/game/TokenGlyph";
import { getLeaderboard } from "@/lib/fn/identity";
import { formatNairaCompact } from "@/lib/game/format";
import type { TokenId } from "@/lib/game/types";

export const Route = createFileRoute("/leaderboard")({ component: Board });

function Board() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getLeaderboard>>>([]);
  useEffect(() => {
    void getLeaderboard().then(setRows);
  }, []);
  return (
    <Shell>
      <h1 className="font-display text-3xl">Global Ozopoly</h1>
      <p className="mt-2 text-sm text-muted">Ranked by wins, then experience, then peak fortune.</p>
      <ol className="mt-6 space-y-2">
        {rows.length === 0 && <li className="text-sm text-muted">No ranked matches yet. Win a signed-in game to appear here.</li>}
        {rows.map((r, i) => (
          <li key={r.user_id} className="oz-panel flex items-center gap-3 rounded-[18px] p-3">
            <span className="w-8 font-display text-lg text-gold">{i + 1}</span>
            <TokenGlyph token={r.token as TokenId} className="size-5 text-fg" />
            <div className="flex-1">
              <p className="text-sm font-medium">{r.username}</p>
              <p className="text-xs text-muted">
                {r.games_won} wins · {r.games_played} games
                {r.games_played ? ` · ${Math.round((r.games_won / r.games_played) * 100)}%` : ""}
              </p>
            </div>
            <span className="tabular-nums text-xs text-muted">{formatNairaCompact(r.best_net_worth)}</span>
          </li>
        ))}
      </ol>
    </Shell>
  );
}
