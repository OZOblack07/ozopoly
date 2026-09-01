import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  MessageCircle,
  ScrollText,
  Swords,
  Timer,
} from "lucide-react";
import { GameBoard } from "./GameBoard";
import { Dice } from "./Dice";
import { TokenGlyph } from "./TokenGlyph";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/brand/Logo";
import { tileById } from "@/lib/game/board";
import { cardById } from "@/lib/game/cards";
import { formatNaira, formatNairaCompact } from "@/lib/game/format";
import { canBuild, getProp, netWorthOf, ownedTileIds, pendingLabel, rentDue } from "@/lib/game/engine";
import type { GameAction, GameEvent, GameState } from "@/lib/game/types";
import { playSfx, type SfxName } from "@/lib/audio";
import { useSettings } from "@/lib/stores/settings";
import { cn, sleep } from "@/lib/utils";

export interface GameViewProps {
  state: GameState;
  meId: string;
  dispatch: (action: GameAction) => Promise<{ ok: boolean; error?: string; events: GameEvent[] }>;
  runAi?: () => Promise<GameEvent[]>;
  onExit: () => void;
  roomCode?: string;
  connection?: "connected" | "reconnecting" | "disconnected";
  chat?: { id: number; player_name: string; message: string }[];
  onChat?: (text: string) => void;
}

function sfxFor(events: GameEvent[]): SfxName[] {
  const out: SfxName[] = [];
  for (const e of events) {
    if (e.type === "rolled") out.push("dice");
    if (e.type === "purchased") out.push("buy");
    if (e.type === "rent" || (e.type === "money" && e.delta < 0)) out.push("pay");
    if (e.type === "money" && e.delta > 0) out.push("coin");
    if (e.type === "card") out.push("card");
    if (e.type === "built") out.push("build");
    if (e.type === "timeout") out.push("timeout");
    if (e.type === "bankrupt") out.push("bankrupt");
    if (e.type === "won") out.push("win");
  }
  return out;
}

export function GameView({
  state,
  meId,
  dispatch,
  runAi,
  onExit,
  roomCode,
  connection,
  chat,
  onChat,
}: GameViewProps) {
  const quality = useSettings((s) => s.animQuality);
  const reduced = useSettings((s) => s.reducedMotion);
  const [visual, setVisual] = useState<Record<string, number>>(() =>
    Object.fromEntries(state.players.map((p) => [p.id, p.position])),
  );
  const [busy, setBusy] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [floaters, setFloaters] = useState<{ id: number; text: string; good: boolean }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"log" | "chat" | "assets">("log");
  const [tradeOpen, setTradeOpen] = useState(false);
  const [intro, setIntro] = useState(true);
  const lock = useRef(false);
  const chatRef = useRef<HTMLInputElement>(null);

  const me = state.players.find((p) => p.id === meId);
  const current = state.players[state.currentPlayerIndex];
  const myTurn = current?.id === meId && !busy && state.phase === "playing";

  useEffect(() => {
    const t = window.setTimeout(() => setIntro(false), reduced ? 400 : 2200);
    return () => window.clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (busy) return;
    setVisual(Object.fromEntries(state.players.map((p) => [p.id, p.position])));
  }, [state.version, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  async function playEvents(events: GameEvent[], nextState: GameState) {
    const hop = reduced || quality === "low" ? 40 : 160;
    for (const e of events) {
      if (e.type === "moved") {
        if (reduced) {
          setVisual((v) => ({ ...v, [e.playerId]: e.to }));
        } else {
          for (const step of e.path) {
            setVisual((v) => ({ ...v, [e.playerId]: step }));
            await sleep(hop);
          }
        }
      }
      if (e.type === "money") {
        const id = Date.now() + Math.random();
        setFloaters((f) => [
          ...f.slice(-5),
          { id, text: `${e.delta > 0 ? "+" : ""}${formatNaira(e.delta)}`, good: e.delta > 0 },
        ]);
        window.setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 900);
      }
      if (e.type === "purchased") setNotice(`${nextState.players.find((p) => p.id === e.playerId)?.name} acquired ${tileById(e.tileId).name}`);
      if (e.type === "district") setNotice("District completed");
      if (e.type === "bankrupt") setNotice("Player eliminated");
    }
    for (const s of sfxFor(events)) playSfx(s, quality);
    if (events.some((e) => e.type === "rolled")) {
      await sleep(reduced ? 80 : 280);
      playSfx("dice-land", quality);
    }
  }

  async function act(action: GameAction) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    if (action.type === "roll") {
      setRolling(true);
      playSfx("dice", quality);
      await sleep(reduced || quality === "low" ? 280 : 800);
    }
    try {
      const result = await dispatch(action);
      setRolling(false);
      if (!result.ok) {
        setError(result.error ?? "That action failed.");
        playSfx("error", quality);
      } else {
        await playEvents(result.events, state);
      }
    } catch (err) {
      setRolling(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      playSfx("error", quality);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (busy || lock.current || intro) return;
    if (state.phase !== "playing") return;
    if (!current?.isAi || !runAi) return;
    const delay = reduced || quality === "low" ? 280 : 700;
    const t = window.setTimeout(() => {
      void (async () => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        try {
          if (state.pending?.type === "roll") {
            setRolling(true);
            playSfx("dice", quality);
            await sleep(reduced || quality === "low" ? 280 : 700);
          }
          const events = await runAi();
          setRolling(false);
          await playEvents(events, state);
        } finally {
          lock.current = false;
          setBusy(false);
          setRolling(false);
        }
      })();
    }, delay);
    return () => window.clearTimeout(t);
  }, [state.version, state.currentPlayerIndex, state.pending?.type, busy, intro]); // eslint-disable-line

  const selectedTile = selected != null ? tileById(selected) : null;
  const remaining =
    state.settings.turnTimerSec > 0
      ? Math.max(0, state.settings.turnTimerSec - Math.floor((Date.now() - state.turnStartedAt) / 1000))
      : null;

  const inspect = useMemo(() => {
    if (!selectedTile) return null;
    const prop = getProp(state, selectedTile.id);
    const owner = prop.ownerId ? state.players.find((p) => p.id === prop.ownerId) : undefined;
    const rent = owner ? rentDue(state, selectedTile.id, (state.lastDice?.[0] ?? 4) + (state.lastDice?.[1] ?? 3)) : selectedTile.rents?.[0];
    return { prop, owner, rent };
  }, [selectedTile, state]);

  return (
    <div className="relative flex min-h-dvh flex-col lg:flex-row">
      {intro && <IntroOverlay />}

      <aside className="flex max-h-[28vh] flex-col gap-2 overflow-auto p-3 lg:max-h-none lg:w-72 lg:border-r lg:border-line">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={onExit} className="flex items-center gap-2 text-sm text-muted hover:text-fg">
            <ArrowLeft className="size-4" />
            Exit
          </button>
          {roomCode && <span className="font-mono text-xs text-gold">{roomCode}</span>}
        </div>
        {connection && (
          <p className="text-[11px] uppercase tracking-wider text-muted">
            {connection === "connected" && <span className="text-ok">Connected</span>}
            {connection === "reconnecting" && <span className="text-gold">Reconnecting</span>}
            {connection === "disconnected" && <span className="text-danger">Connection lost</span>}
          </p>
        )}
        {state.players.map((p) => (
          <div
            key={p.id}
            className={cn(
              "oz-panel rounded-[18px] p-3",
              current?.id === p.id && "border-gold/50",
              p.isBankrupt && "opacity-50",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className="grid size-8 place-items-center rounded-full"
                style={{ background: p.color, color: "#10131c" }}
              >
                <TokenGlyph token={p.token} color="#10131c" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {p.name} {p.id === meId && <span className="text-muted">(you)</span>}
                </p>
                <p className="tabular-nums text-xs text-gold">{formatNaira(p.money)}</p>
              </div>
              {current?.id === p.id && <Timer className="size-4 text-gold" />}
            </div>
            <p className="mt-1 text-[11px] text-muted">
              {ownedTileIds(state, p.id).length} properties
              {p.inTimeout ? " · Timeout" : ""}
              {p.isAi ? ` · ${p.aiDifficulty}` : ""}
            </p>
          </div>
        ))}
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col items-center justify-center p-2 sm:p-4">
        <div className="mb-2 flex w-full max-w-[92dvh] items-center justify-between gap-2 px-1">
          <p className="font-display text-sm tracking-tight sm:text-lg">
            {state.phase === "ended"
              ? "Match complete"
              : `${current?.name ?? "Player"}'s turn`}
          </p>
          {remaining != null && state.phase === "playing" && (
            <span className="tabular-nums text-xs text-muted">
              {myTurn ? "Your turn" : "Turn"} · {remaining}s
            </span>
          )}
        </div>
        <GameBoard
          state={state}
          visualPositions={visual}
          selectedId={selected}
          onSelect={setSelected}
        />
        <div className="pointer-events-none absolute inset-x-0 top-16 flex flex-col items-center gap-1">
          {floaters.map((f) => (
            <span
              key={f.id}
              className={cn("money-pop font-display text-lg tabular-nums", f.good ? "text-ok" : "text-danger")}
            >
              {f.text}
            </span>
          ))}
          {notice && (
            <span className="rounded-full border border-line bg-bg-elevated px-3 py-1 text-xs">{notice}</span>
          )}
        </div>
      </main>

      <aside className="flex flex-col gap-3 border-t border-line p-3 lg:h-dvh lg:w-80 lg:overflow-auto lg:border-t-0 lg:border-l">
        <div className="oz-panel flex items-center justify-between rounded-[18px] p-3">
          <div>
            <p className="text-[11px] tracking-wider text-muted uppercase">Last roll</p>
            <p className="font-display text-xl tabular-nums">
              {state.lastDice ? state.lastDice[0] + state.lastDice[1] : "—"}
            </p>
          </div>
          <div className="flex gap-2">
            <Dice value={state.lastDice?.[0] ?? 1} rolling={rolling} size={48} />
            <Dice value={state.lastDice?.[1] ?? 1} rolling={rolling} size={48} />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <ActionDock
          state={state}
          meId={meId}
          myTurn={myTurn}
          busy={busy}
          onAct={(a) => void act(a)}
          onTrade={() => setTradeOpen(true)}
        />

        {selectedTile && inspect && (
          <div className="oz-panel rounded-[18px] p-3">
            <p className="font-display text-base">{selectedTile.name}</p>
            <p className="text-xs text-muted">{selectedTile.kind}</p>
            {selectedTile.price != null && (
              <p className="mt-1 text-sm tabular-nums text-gold">{formatNaira(selectedTile.price)}</p>
            )}
            {inspect.owner && (
              <p className="mt-1 text-xs">
                Owned by <span style={{ color: inspect.owner.color }}>{inspect.owner.name}</span>
                {inspect.prop.mortgaged ? " · mortgaged" : ""}
                {inspect.prop.level ? ` · L${inspect.prop.level}` : ""}
              </p>
            )}
            {inspect.rent != null && inspect.rent > 0 && (
              <p className="text-xs text-muted">Rent {formatNaira(inspect.rent)}</p>
            )}
            {me && selectedTile.kind === "property" && inspect.prop.ownerId === me.id && myTurn && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  className="min-h-9 text-xs"
                  disabled={!!canBuild(state, me.id, selectedTile.id)}
                  onClick={() => void act({ type: "build", tileId: selectedTile.id })}
                >
                  Upgrade
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-9 text-xs"
                  onClick={() =>
                    void act(
                      inspect.prop.mortgaged
                        ? { type: "unmortgage", tileId: selectedTile.id }
                        : { type: "mortgage", tileId: selectedTile.id },
                    )
                  }
                >
                  {inspect.prop.mortgaged ? "Unmortgage" : "Mortgage"}
                </Button>
                {inspect.prop.level > 0 && (
                  <Button
                    variant="ghost"
                    className="min-h-9 text-xs"
                    onClick={() => void act({ type: "sell-upgrade", tileId: selectedTile.id })}
                  >
                    Sell upgrade
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-1 rounded-[12px] bg-bg-subtle p-1 text-xs">
          {(
            [
              ["log", ScrollText, "Log"],
              ["assets", Building2, "Assets"],
              ...(onChat ? ([["chat", MessageCircle, "Chat"]] as const) : []),
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-[10px] py-2",
                tab === id ? "bg-bg-elevated text-fg" : "text-muted",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === "log" && (
          <ol className="max-h-40 space-y-1 overflow-auto text-xs text-muted lg:max-h-none lg:flex-1">
            {[...state.log].reverse().map((e) => (
              <li key={e.id}>{e.text}</li>
            ))}
          </ol>
        )}
        {tab === "assets" && me && (
          <ul className="max-h-40 space-y-1 overflow-auto text-xs lg:max-h-none">
            {ownedTileIds(state, me.id).map((id) => {
              const t = tileById(id);
              const p = getProp(state, id);
              return (
                <li key={id} className="flex justify-between gap-2">
                  <button type="button" className="text-left hover:text-gold" onClick={() => setSelected(id)}>
                    {t.name}
                  </button>
                  <span className="text-muted">
                    {p.mortgaged ? "Mortgaged" : `L${p.level}`}
                  </span>
                </li>
              );
            })}
            {ownedTileIds(state, me.id).length === 0 && <li className="text-muted">No properties yet.</li>}
          </ul>
        )}
        {tab === "chat" && onChat && (
          <div className="flex min-h-0 flex-1 flex-col">
            <ul className="max-h-32 flex-1 space-y-1 overflow-auto text-xs lg:max-h-none">
              {(chat ?? []).map((m) => (
                <li key={m.id}>
                  <span className="text-gold">{m.player_name}: </span>
                  {m.message}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-1">
              {["Nice roll!", "Trade?", "GG", "Well played"].map((q) => (
                <button
                  key={q}
                  type="button"
                  className="rounded-full border border-line px-2 py-1 text-[11px] text-muted hover:text-fg"
                  onClick={() => onChat(q)}
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = chatRef.current?.value.trim();
                if (v) {
                  onChat(v);
                  if (chatRef.current) chatRef.current.value = "";
                }
              }}
            >
              <input
                ref={chatRef}
                className="min-h-11 flex-1 rounded-[12px] border border-line bg-bg-subtle px-3 text-sm"
                maxLength={200}
                placeholder="Message"
                aria-label="Chat message"
              />
              <Button className="min-h-11 px-3" type="submit">
                Send
              </Button>
            </form>
          </div>
        )}
      </aside>

      {state.pending?.type === "buy" && myTurn && (
        <BuyModal
          state={state}
          tileId={state.pending.tileId}
          onBuy={() => void act({ type: "buy" })}
          onPass={() => void act({ type: "pass" })}
        />
      )}
      {state.pending?.type === "card" && myTurn && (
        <CardModal cardId={state.pending.cardId} onOk={() => void act({ type: "acknowledge-card" })} />
      )}
      {state.pending?.type === "raise-funds" && myTurn && (
        <FundsModal
          state={state}
          meId={meId}
          amount={state.pending.amount}
          reason={state.pending.reason}
          onMortgage={(id) => void act({ type: "mortgage", tileId: id })}
          onSell={(id) => void act({ type: "sell-upgrade", tileId: id })}
          onBankrupt={() => void act({ type: "bankrupt" })}
        />
      )}
      {state.trade && (state.trade.toId === meId || state.trade.fromId === meId) && (
        <TradeIncoming
          state={state}
          meId={meId}
          onAccept={() => void act({ type: "accept-trade" })}
          onDecline={() => void act({ type: "decline-trade" })}
        />
      )}
      {tradeOpen && me && (
        <TradeBuilder
          state={state}
          meId={meId}
          onClose={() => setTradeOpen(false)}
          onPropose={(a) => {
            setTradeOpen(false);
            void act(a);
          }}
        />
      )}
      {state.phase === "ended" && state.winnerId && (
        <Victory
          state={state}
          winnerId={state.winnerId}
          meId={meId}
          onExit={onExit}
        />
      )}
    </div>
  );
}

function ActionDock({
  state,
  meId,
  myTurn,
  busy,
  onAct,
  onTrade,
}: {
  state: GameState;
  meId: string;
  myTurn: boolean;
  busy: boolean;
  onAct: (a: GameAction) => void;
  onTrade: () => void;
}) {
  const me = state.players.find((p) => p.id === meId);
  const pending = state.pending;
  if (state.phase !== "playing") return null;
  return (
    <div className="oz-panel space-y-2 rounded-[18px] p-3">
      <p className="text-[11px] tracking-wider text-muted uppercase">{pendingLabel(pending)}</p>
      {myTurn && (pending?.type === "roll" || pending?.type === "timeout-choice") && (
        <Button className="w-full min-h-12 text-base" disabled={busy} onClick={() => onAct({ type: "roll" })}>
          Roll dice
        </Button>
      )}
      {myTurn && pending?.type === "timeout-choice" && me && (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => onAct({ type: "pay-timeout" })}>
            Pay {formatNairaCompact(state.settings.timeoutFine)}
          </Button>
          {me.getOutCards > 0 && (
            <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => onAct({ type: "use-pass" })}>
              Use pass
            </Button>
          )}
        </div>
      )}
      {!myTurn && state.phase === "playing" && (
        <p className="text-sm text-muted">Waiting for {state.players[state.currentPlayerIndex]?.name}…</p>
      )}
      {myTurn && pending?.type === "roll" && (
        <Button variant="secondary" className="w-full" onClick={onTrade}>
          <Swords className="size-4" />
          Propose trade
        </Button>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4 backdrop-blur-[2px]">
      <div className="oz-panel w-full max-w-md rounded-[28px] p-5">{children}</div>
    </div>
  );
}

function BuyModal({
  state,
  tileId,
  onBuy,
  onPass,
}: {
  state: GameState;
  tileId: number;
  onBuy: () => void;
  onPass: () => void;
}) {
  const tile = tileById(tileId);
  const me = state.players[state.currentPlayerIndex];
  const can = (me?.money ?? 0) >= (tile.price ?? 0);
  return (
    <Overlay>
      <p className="text-[11px] tracking-[0.2em] text-gold uppercase">Unowned property</p>
      <h2 className="mt-1 font-display text-2xl">{tile.name}</h2>
      <p className="mt-2 text-sm text-muted">
        Price <span className="text-gold tabular-nums">{formatNaira(tile.price ?? 0)}</span>
      </p>
      {tile.rents && (
        <p className="text-sm text-muted">
          Base rent <span className="tabular-nums">{formatNaira(tile.rents[0] ?? 0)}</span>
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" disabled={!can} onClick={onBuy}>
          Buy property
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onPass}>
          Pass
        </Button>
      </div>
    </Overlay>
  );
}

function CardModal({ cardId, onOk }: { cardId: string; onOk: () => void }) {
  const card = cardById(cardId);
  return (
    <Overlay>
      <p className="text-[11px] tracking-[0.2em] text-cyan uppercase">
        {card.deck === "lucky" ? "Lucky Break" : "Ozo Fund"}
      </p>
      <h2 className="mt-1 font-display text-2xl">{card.title}</h2>
      <p className="mt-3 text-sm text-muted">{card.body}</p>
      <Button className="mt-5 w-full" onClick={onOk}>
        Continue
      </Button>
    </Overlay>
  );
}

function FundsModal({
  state,
  meId,
  amount,
  reason,
  onMortgage,
  onSell,
  onBankrupt,
}: {
  state: GameState;
  meId: string;
  amount: number;
  reason: string;
  onMortgage: (id: number) => void;
  onSell: (id: number) => void;
  onBankrupt: () => void;
}) {
  const me = state.players.find((p) => p.id === meId);
  const ids = ownedTileIds(state, meId);
  return (
    <Overlay>
      <h2 className="font-display text-2xl">Raise funds</h2>
      <p className="mt-1 text-sm text-muted">
        {reason}. Need <span className="text-gold tabular-nums">{formatNaira(amount)}</span>
        {me ? ` · you have ${formatNaira(me.money)}` : ""}
      </p>
      <ul className="mt-3 max-h-48 space-y-2 overflow-auto">
        {ids.map((id) => {
          const t = tileById(id);
          const p = getProp(state, id);
          return (
            <li key={id} className="flex items-center justify-between gap-2 text-sm">
              <span>{t.name}</span>
              <span className="flex gap-1">
                {p.level > 0 && (
                  <Button variant="secondary" className="min-h-9 px-2 text-xs" onClick={() => onSell(id)}>
                    Sell L{p.level}
                  </Button>
                )}
                {!p.mortgaged && p.level === 0 && (
                  <Button variant="secondary" className="min-h-9 px-2 text-xs" onClick={() => onMortgage(id)}>
                    Mortgage
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <Button variant="danger" className="mt-4 w-full" onClick={onBankrupt}>
        Declare bankruptcy
      </Button>
    </Overlay>
  );
}

function TradeIncoming({
  state,
  meId,
  onAccept,
  onDecline,
}: {
  state: GameState;
  meId: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const trade = state.trade!;
  const from = state.players.find((p) => p.id === trade.fromId);
  const mine = trade.toId === meId;
  return (
    <Overlay>
      <h2 className="font-display text-2xl">Trade</h2>
      <p className="mt-1 text-sm text-muted">{from?.name} offers</p>
      <ul className="mt-2 text-sm">
        {trade.offerTiles.map((id) => (
          <li key={id}>{tileById(id).name}</li>
        ))}
        {trade.offerMoney > 0 && <li>{formatNaira(trade.offerMoney)}</li>}
      </ul>
      <p className="mt-3 text-sm text-muted">for</p>
      <ul className="mt-1 text-sm">
        {trade.requestTiles.map((id) => (
          <li key={id}>{tileById(id).name}</li>
        ))}
        {trade.requestMoney > 0 && <li>{formatNaira(trade.requestMoney)}</li>}
      </ul>
      {mine ? (
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={onAccept}>
            Accept
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onDecline}>
            Decline
          </Button>
        </div>
      ) : (
        <Button variant="secondary" className="mt-4 w-full" onClick={onDecline}>
          Cancel
        </Button>
      )}
    </Overlay>
  );
}

function TradeBuilder({
  state,
  meId,
  onClose,
  onPropose,
}: {
  state: GameState;
  meId: string;
  onClose: () => void;
  onPropose: (a: GameAction) => void;
}) {
  const others = state.players.filter((p) => p.id !== meId && !p.isBankrupt);
  const [toId, setToId] = useState(others[0]?.id ?? "");
  const [offerMoney, setOfferMoney] = useState(0);
  const [requestMoney, setRequestMoney] = useState(0);
  const [offerTiles, setOfferTiles] = useState<number[]>([]);
  const [requestTiles, setRequestTiles] = useState<number[]>([]);
  const mine = ownedTileIds(state, meId).filter((id) => getProp(state, id).level === 0);
  const theirs = ownedTileIds(state, toId).filter((id) => getProp(state, id).level === 0);
  function tog(list: number[], id: number, set: (n: number[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }
  return (
    <Overlay>
      <h2 className="font-display text-2xl">Propose trade</h2>
      <label className="mt-3 block text-xs text-muted">
        Partner
        <select
          className="mt-1 min-h-11 w-full rounded-[12px] border border-line bg-bg-subtle px-2"
          value={toId}
          onChange={(e) => {
            setToId(e.target.value);
            setRequestTiles([]);
          }}
        >
          {others.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-3 text-xs text-muted">You offer</p>
      <div className="flex flex-wrap gap-1">
        {mine.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => tog(offerTiles, id, setOfferTiles)}
            className={cn(
              "rounded-full border px-2 py-1 text-[11px]",
              offerTiles.includes(id) ? "border-gold text-gold" : "border-line text-muted",
            )}
          >
            {tileById(id).short}
          </button>
        ))}
      </div>
      <input
        type="number"
        min={0}
        className="mt-2 min-h-11 w-full rounded-[12px] border border-line bg-bg-subtle px-3 text-sm"
        value={offerMoney}
        onChange={(e) => setOfferMoney(Number(e.target.value) || 0)}
        aria-label="Money to offer"
      />
      <p className="mt-3 text-xs text-muted">You want</p>
      <div className="flex flex-wrap gap-1">
        {theirs.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => tog(requestTiles, id, setRequestTiles)}
            className={cn(
              "rounded-full border px-2 py-1 text-[11px]",
              requestTiles.includes(id) ? "border-cyan text-cyan" : "border-line text-muted",
            )}
          >
            {tileById(id).short}
          </button>
        ))}
      </div>
      <input
        type="number"
        min={0}
        className="mt-2 min-h-11 w-full rounded-[12px] border border-line bg-bg-subtle px-3 text-sm"
        value={requestMoney}
        onChange={(e) => setRequestMoney(Number(e.target.value) || 0)}
        aria-label="Money to request"
      />
      <div className="mt-4 flex gap-2">
        <Button
          className="flex-1"
          disabled={!toId}
          onClick={() =>
            onPropose({
              type: "propose-trade",
              toId,
              offerMoney,
              requestMoney,
              offerTiles,
              requestTiles,
            })
          }
        >
          Propose
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Overlay>
  );
}

function Victory({
  state,
  winnerId,
  meId,
  onExit,
}: {
  state: GameState;
  winnerId: string;
  meId: string;
  onExit: () => void;
}) {
  const winner = state.players.find((p) => p.id === winnerId);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/70 p-4">
      {Array.from({ length: 28 }).map((_, i) => (
        <span
          key={i}
          className="confetti-dot"
          style={{
            left: `${(i * 17) % 100}%`,
            top: `-${(i % 7) * 8}px`,
            background: i % 2 ? "#e4c37a" : "#5eead4",
            animationDelay: `${(i % 8) * 80}ms`,
          }}
        />
      ))}
      <div className="oz-panel relative z-10 w-full max-w-lg rounded-[28px] p-6 text-center">
        <p className="text-[11px] tracking-[0.25em] text-gold uppercase">Victory</p>
        <h2 className="mt-2 font-display text-3xl">{winner?.name} is the Ozopoly Champion</h2>
        <ul className="mt-5 space-y-2 text-sm">
          {state.players
            .slice()
            .sort((a, b) => netWorthOf(state, b.id) - netWorthOf(state, a.id))
            .map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {p.name}
                  {p.id === meId ? " (you)" : ""}
                </span>
                <span className="tabular-nums text-gold">{formatNaira(netWorthOf(state, p.id))}</span>
              </li>
            ))}
        </ul>
        <div className="mt-6 flex gap-2">
          <Button className="flex-1" onClick={onExit}>
            Return home
          </Button>
          <Link to="/" className="flex-1">
            <Button variant="secondary" className="w-full">
              Play again
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function IntroOverlay() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg">
      <div className="text-center">
        <Logo className="text-5xl" />
        <p className="mt-3 text-xs tracking-[0.32em] text-gold uppercase">Roll. Build. Dominate.</p>
      </div>
    </div>
  );
}

