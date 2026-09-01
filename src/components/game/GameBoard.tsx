import { BOARD, GROUP_META, tileGridPos } from "@/lib/game/board";
import type { GameState, Player } from "@/lib/game/types";
import { formatNairaCompact } from "@/lib/game/format";
import { TokenGlyph } from "./TokenGlyph";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

function sideOf(id: number): "bottom" | "left" | "top" | "right" {
  if (id <= 10) return "bottom";
  if (id <= 20) return "left";
  if (id <= 30) return "top";
  return "right";
}

export function GameBoard({
  state,
  visualPositions,
  selectedId,
  onSelect,
}: {
  state: GameState;
  visualPositions: Record<string, number>;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="oz-board" role="grid" aria-label="Ozopoly board">
      <div className="oz-center">
        <div className="pointer-events-none absolute inset-8 rounded-[20px] border border-line" />
        <div className="relative z-10 text-center">
          <Logo className="text-3xl text-fg sm:text-5xl" />
          <p className="mt-2 text-[10px] font-medium tracking-[0.28em] text-gold uppercase">
            Roll. Build. Dominate.
          </p>
        </div>
      </div>
      {BOARD.map((tile) => {
        const pos = tileGridPos(tile.id);
        const prop = state.properties[String(tile.id)];
        const owner = prop?.ownerId
          ? state.players.find((p) => p.id === prop.ownerId)
          : undefined;
        const groupColor = tile.group ? GROUP_META[tile.group].color : undefined;
        const side = sideOf(tile.id);
        return (
          <button
            key={tile.id}
            type="button"
            onClick={() => onSelect(tile.id)}
            className={cn(
              "oz-tile text-left",
              selectedId === tile.id && "ring-1 ring-gold z-10",
              tile.kind === "launch" && "bg-[#18221a]",
              tile.kind === "timeout" && "bg-[#241818]",
              tile.kind === "chill" && "bg-[#182028]",
              tile.kind === "detour" && "bg-[#24181f]",
            )}
            style={{ gridRow: pos.row, gridColumn: pos.col }}
            data-side={side}
            aria-label={tile.name}
          >
            {groupColor && tile.kind === "property" && (
              <span className="oz-stripe" style={{ background: groupColor }} />
            )}
            {groupColor && tile.kind !== "property" && (
              <span className="oz-stripe opacity-70" style={{ background: groupColor }} />
            )}
            <span className="flex min-h-0 flex-1 flex-col justify-between p-[3px] sm:p-1">
              <span className="truncate text-[8px] font-semibold leading-tight text-fg sm:text-[10px]">
                {tile.short}
              </span>
              {tile.price ? (
                <span className="text-[8px] tabular-nums text-muted sm:text-[9px]">
                  {formatNairaCompact(tile.price)}
                </span>
              ) : (
                <span className="text-[8px] text-subtle">{tile.kind.toUpperCase()}</span>
              )}
              {owner && (
                <span
                  className="mt-0.5 h-1 w-full rounded-full"
                  style={{ background: owner.color }}
                />
              )}
              {prop && prop.level > 0 && (
                <span className="flex gap-px">
                  {Array.from({ length: Math.min(prop.level, 5) }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-[1px]",
                        prop.level >= 5 ? "bg-gold" : "bg-cyan",
                      )}
                    />
                  ))}
                </span>
              )}
            </span>
          </button>
        );
      })}
      {state.players.map((p, i) => (
        <TokenOnBoard
          key={p.id}
          player={p}
          index={visualPositions[p.id] ?? p.position}
          slot={i}
          total={state.players.length}
        />
      ))}
    </div>
  );
}

function TokenOnBoard({
  player,
  index,
  slot,
  total,
}: {
  player: Player;
  index: number;
  slot: number;
  total: number;
}) {
  const pos = tileGridPos(index);
  const offset = (slot - (total - 1) / 2) * 18;
  return (
    <div
      className={cn(
        "pointer-events-none z-20 grid place-items-center transition-[transform] duration-200",
        player.isBankrupt && "opacity-30",
      )}
      style={{
        gridRow: pos.row,
        gridColumn: pos.col,
        transform: `translate(${offset}%, -8%)`,
      }}
    >
      <span
        className="token-piece hop grid size-6 place-items-center rounded-full border border-line-strong sm:size-7"
        style={{ background: player.color, color: "#10131c" }}
      >
        <TokenGlyph token={player.token} className="size-3.5 sm:size-4" color="#10131c" />
      </span>
    </div>
  );
}
