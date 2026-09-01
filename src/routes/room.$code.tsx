import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GameView } from "@/components/game/GameView";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";
import { TokenGlyph } from "@/components/game/TokenGlyph";
import { Logo } from "@/components/brand/Logo";
import { useGuest, randomGuestName } from "@/lib/stores/identity";
import { useSettings } from "@/lib/stores/settings";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ensureGuest } from "@/lib/fn/identity";
import {
  addAiSlot,
  getRoom,
  leaveRoom,
  playAction,
  sendChat,
  setReady,
  startGame,
  type ChatRow,
} from "@/lib/fn/rooms";
import type { GameAction, GameEvent, GameState, TokenId } from "@/lib/game/types";
import { playSfx, unlockAudio } from "@/lib/audio";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/room/$code")({ component: RoomPage });

type Snapshot = Awaited<ReturnType<typeof getRoom>>;

function RoomPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const guest = useGuest();
  const settings = useSettings();
  const { user } = useCurrentUserState();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<"connected" | "reconnecting" | "disconnected">("connecting" as never);
  const [chat, setChat] = useState<ChatRow[]>([]);
  const versionRef = useRef(0);
  const chatRef = useRef(0);
  const credsRef = useRef<{ guestId?: string; guestSecret?: string; name?: string }>({});

  const creds = useCallback(async () => {
    const name = settings.displayName || guest.guestName || user?.displayName || randomGuestName();
    const res = await ensureGuest({
      data: {
        name,
        guestId: guest.guestId ?? undefined,
        guestSecret: guest.guestSecret ?? undefined,
      },
    });
    if (res.guestSecret) guest.setGuest(res.id, res.guestSecret, res.name);
    const c = {
      guestId: res.guestSecret ? res.id : guest.guestId ?? undefined,
      guestSecret: res.guestSecret ?? guest.guestSecret ?? undefined,
      name: res.name,
    };
    credsRef.current = c;
    return c;
  }, [guest, settings.displayName, user?.displayName]);

  const poll = useCallback(async () => {
    try {
      const c = credsRef.current.guestSecret || credsRef.current.guestId ? credsRef.current : await creds();
      const data = await getRoom({
        data: {
          ...c,
          roomCode: code,
          sinceVersion: versionRef.current || undefined,
          sinceChatId: chatRef.current || undefined,
        },
      });
      setSnap(data);
      if (data.state) {
        setState(data.state);
        versionRef.current = data.state.version;
      } else if (data.version) {
        versionRef.current = data.version;
      }
      if (data.chat.length) {
        setChat((prev) => {
          const next = [...prev, ...data.chat];
          chatRef.current = next[next.length - 1]?.id ?? chatRef.current;
          return next.slice(-80);
        });
      }
      setConnection("connected");
      setError(null);
    } catch (e) {
      setConnection("disconnected");
      setError(e instanceof Error ? e.message : "Lost connection to the game.");
    }
  }, [code, creds]);

  useEffect(() => {
    unlockAudio();
    void creds().then(() => poll());
    const t = window.setInterval(() => void poll(), 900);
    return () => window.clearInterval(t);
  }, [poll, creds]);

  async function dispatch(action: GameAction): Promise<{ ok: boolean; error?: string; events: GameEvent[] }> {
    try {
      const c = credsRef.current;
      const res = await playAction({ data: { ...c, roomCode: code, action } });
      setState(res.state);
      versionRef.current = res.state.version;
      return { ok: true, events: res.events };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Action failed", events: [] };
    }
  }

  if (error && !snap) {
    return (
      <Shell>
        <div className="grid min-h-[60dvh] place-items-center text-center">
          <div className="oz-panel max-w-md rounded-[28px] p-6">
            <h1 className="font-display text-2xl">Could not open room</h1>
            <p className="mt-2 text-sm text-muted">{error}</p>
            <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
              Return home
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  if (!snap) {
    return (
      <Shell>
        <div className="grid min-h-[70dvh] place-items-center">
          <div className="text-center">
            <Logo className="text-4xl" />
            <p className="mt-4 text-sm text-muted">Preparing the board…</p>
          </div>
        </div>
      </Shell>
    );
  }

  if (snap.status === "lobby") {
    return (
      <Shell>
        <Lobby
          snap={snap}
          code={code}
          creds={() => credsRef.current}
          onRefresh={() => void poll()}
          onLeave={async () => {
            await leaveRoom({ data: { ...credsRef.current, roomCode: code } });
            void navigate({ to: "/" });
          }}
        />
      </Shell>
    );
  }

  if (!state) {
    return (
      <Shell>
        <div className="grid min-h-[60dvh] place-items-center text-muted">Loading match…</div>
      </Shell>
    );
  }

  return (
    <Shell flush hideHeader>
      <GameView
        state={state}
        meId={snap.youId}
        dispatch={dispatch}
        onExit={() => navigate({ to: "/" })}
        roomCode={code}
        connection={connection === "connecting" ? "reconnecting" : connection}
        chat={chat}
        onChat={async (text) => {
          try {
            await sendChat({ data: { ...credsRef.current, roomCode: code, message: text } });
            playSfx("chat", settings.animQuality);
            void poll();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Chat failed");
          }
        }}
      />
      {error && connection !== "connected" && (
        <div className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,28rem)] -translate-x-1/2 oz-panel rounded-[18px] p-3 text-center text-sm">
          <p>Oops. We lost connection to the game.</p>
          <div className="mt-2 flex gap-2">
            <Button className="flex-1" onClick={() => void poll()}>
              Reconnect
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => navigate({ to: "/" })}>
              Return home
            </Button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Lobby({
  snap,
  code,
  creds,
  onRefresh,
  onLeave,
}: {
  snap: Snapshot;
  code: string;
  creds: () => { guestId?: string; guestSecret?: string; name?: string };
  onRefresh: () => void;
  onLeave: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const you = snap.members.find((m) => m.playerId === snap.youId);
  const isHost = snap.hostId === snap.youId;
  const allReady = snap.members.filter((m) => !m.isAi).every((m) => m.isReady);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* ignore */
    }
  };

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <p className="text-[11px] tracking-[0.25em] text-gold uppercase">Lobby</p>
      <h1 className="mt-2 font-display text-3xl">Room {code}</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void copy()}>
          Copy code
        </Button>
        <Button variant="ghost" onClick={onLeave}>
          Leave
        </Button>
      </div>
      <ul className="mt-6 space-y-2">
        {snap.members.map((m) => (
          <li key={m.playerId} className="oz-panel flex items-center gap-3 rounded-[18px] p-3">
            <span
              className="grid size-10 place-items-center rounded-full"
              style={{ background: m.color, color: "#10131c" }}
            >
              <TokenGlyph token={m.token as TokenId} color="#10131c" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {m.name} {m.isHost && <span className="text-gold">Host</span>}
              </p>
              <p className="text-xs text-muted">{m.isAi ? `Computer · ${m.aiDifficulty}` : m.isReady ? "Ready" : "Not ready"}</p>
            </div>
          </li>
        ))}
      </ul>
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {!you?.isAi && (
          <Button
            variant={you?.isReady ? "secondary" : "primary"}
            className="flex-1"
            disabled={busy}
            onClick={() => run(() => setReady({ data: { ...creds(), roomCode: code, ready: !you?.isReady } }))}
          >
            {you?.isReady ? "Unready" : "I'm ready"}
          </Button>
        )}
        {isHost && snap.members.length < snap.maxPlayers && (
          <Button
            variant="secondary"
            className="flex-1"
            disabled={busy}
            onClick={() => run(() => addAiSlot({ data: { ...creds(), roomCode: code, difficulty: "normal" } }))}
          >
            Add computer
          </Button>
        )}
        {isHost && (
          <Button
            className={cn("flex-1", !allReady && "opacity-60")}
            disabled={busy || !allReady || snap.members.length < 2}
            onClick={() => run(() => startGame({ data: { ...creds(), roomCode: code } }))}
          >
            Start game
          </Button>
        )}
      </div>
    </div>
  );
}
