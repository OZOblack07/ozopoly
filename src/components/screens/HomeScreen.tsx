import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bot, Globe2, KeyRound, Swords } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Dice } from "@/components/game/Dice";
import { TokenGlyph, TOKEN_LABEL } from "@/components/game/TokenGlyph";
import { useLocalGame } from "@/lib/stores/local-game";
import { useSettings } from "@/lib/stores/settings";
import { useGuest, randomGuestName } from "@/lib/stores/identity";
import { ensureGuest } from "@/lib/fn/identity";
import { createRoom, joinRoom, quickMatch } from "@/lib/fn/rooms";
import { playSfx, unlockAudio } from "@/lib/audio";
import { TOKEN_LIST, type AiDifficulty, type TokenId } from "@/lib/game/types";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatNaira } from "@/lib/game/format";
import { cn } from "@/lib/utils";

type Mode = "home" | "modes" | "cpu" | "online" | "join" | "create";

export function HomeScreen() {
  const [mode, setMode] = useState<Mode>("home");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const settings = useSettings();
  const guest = useGuest();

  function go(next: Mode) {
    unlockAudio();
    playSfx("click", settings.animQuality);
    setErr(null);
    setMode(next);
  }

  async function guestCreds() {
    const name = settings.displayName || guest.guestName || user?.displayName || randomGuestName();
    const res = await ensureGuest({
      data: {
        name,
        guestId: guest.guestId ?? undefined,
        guestSecret: guest.guestSecret ?? undefined,
      },
    });
    if (res.guestSecret) guest.setGuest(res.id, res.guestSecret, res.name);
    return {
      guestId: res.guestSecret ? res.id : guest.guestId ?? undefined,
      guestSecret: res.guestSecret ?? guest.guestSecret ?? undefined,
      name: res.name,
      token: settings.token,
    };
  }

  return (
    <div className="relative overflow-hidden">
      <FloatingDecor />
      {mode === "home" && (
        <section className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center py-10 text-center">
          <p className="text-[11px] tracking-[0.35em] text-gold uppercase">Original property trading</p>
          <Logo className="mt-4 text-6xl sm:text-8xl" />
          <p className="mt-4 font-display text-sm tracking-[0.28em] text-muted uppercase sm:text-base">
            Roll. Build. Dominate.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button className="min-w-40 min-h-12" onClick={() => go("modes")}>
              Play
            </Button>
            <Button variant="secondary" className="min-w-40 min-h-12" onClick={() => go("online")}>
              Online
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-muted">
            <Link to="/how-to-play" className="hover:text-fg">
              How to play
            </Link>
            <Link to="/profile" className="hover:text-fg">
              Profile
            </Link>
            <Link to="/settings" className="hover:text-fg">
              Settings
            </Link>
            <Link to="/leaderboard" className="hover:text-fg">
              Leaderboard
            </Link>
          </div>
        </section>
      )}

      {mode === "modes" && (
        <section className="mx-auto max-w-4xl py-8">
          <button type="button" className="text-sm text-muted hover:text-fg" onClick={() => go("home")}>
            Back
          </button>
          <h1 className="mt-4 font-display text-3xl">Choose a mode</h1>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ModeCard icon={Bot} title="Versus computer" body="One human, up to three strategic AI rivals." onClick={() => go("cpu")} />
            <ModeCard icon={Globe2} title="Online multiplayer" body="Host or join a live room. Turns stay in sync." onClick={() => go("online")} />
            <ModeCard icon={KeyRound} title="Private room" body="Generate a short code and share it with friends." onClick={() => go("create")} />
            <ModeCard
              icon={Swords}
              title="Quick match"
              body="Jump into an open public lobby."
              onClick={async () => {
                setLoading(true);
                setErr(null);
                try {
                  const creds = await guestCreds();
                  const res = await quickMatch({ data: creds });
                  const code = "roomCode" in res ? res.roomCode : undefined;
                  if (code) navigate({ to: "/room/$code", params: { code } });
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Could not find a match.");
                } finally {
                  setLoading(false);
                }
              }}
            />
          </div>
          {err && <p className="mt-4 text-sm text-danger">{err}</p>}
          {loading && <p className="mt-4 text-sm text-muted">Finding a table…</p>}
        </section>
      )}

      {mode === "cpu" && (
        <CpuSetup
          defaultName={settings.displayName || user?.displayName || guest.guestName || randomGuestName()}
          token={settings.token as TokenId}
          onBack={() => go("modes")}
          onStart={(opts) => {
            useLocalGame.getState().start(opts);
            navigate({ to: "/play" });
          }}
        />
      )}

      {mode === "online" && (
        <section className="mx-auto max-w-lg py-8">
          <button type="button" className="text-sm text-muted hover:text-fg" onClick={() => go("modes")}>
            Back
          </button>
          <h1 className="mt-4 font-display text-3xl">Online</h1>
          <p className="mt-2 text-sm text-muted">
            Rooms are server-authoritative. Dice, money, and ownership cannot be edited in the browser.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button className="min-h-12" onClick={() => go("create")}>
              Create room
            </Button>
            <Button variant="secondary" className="min-h-12" onClick={() => go("join")}>
              Join with code
            </Button>
          </div>
        </section>
      )}

      {mode === "create" && (
        <CreateRoom
          onBack={() => go("online")}
          error={err}
          loading={loading}
          onCreate={async (cfg) => {
            setLoading(true);
            setErr(null);
            try {
              const creds = await guestCreds();
              const res = await createRoom({ data: { ...creds, ...cfg } });
              navigate({ to: "/room/$code", params: { code: res.roomCode } });
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Could not create the room.");
            } finally {
              setLoading(false);
            }
          }}
        />
      )}

      {mode === "join" && (
        <JoinRoom
          onBack={() => go("online")}
          error={err}
          loading={loading}
          onJoin={async (code) => {
            setLoading(true);
            setErr(null);
            try {
              const creds = await guestCreds();
              const res = await joinRoom({ data: { ...creds, roomCode: code } });
              navigate({ to: "/room/$code", params: { code: res.roomCode } });
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Could not join.");
            } finally {
              setLoading(false);
            }
          }}
        />
      )}
    </div>
  );
}

function ModeCard({
  icon: Icon,
  title,
  body,
  onClick,
}: {
  icon: typeof Bot;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="oz-panel rounded-[28px] p-5 text-left transition-transform duration-150 hover:-translate-y-0.5"
    >
      <Icon className="size-6 text-gold" />
      <h2 className="mt-3 font-display text-xl">{title}</h2>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </button>
  );
}

function CpuSetup({
  defaultName,
  token,
  onBack,
  onStart,
}: {
  defaultName: string;
  token: TokenId;
  onBack: () => void;
  onStart: (opts: { name: string; token: TokenId; opponents: number; difficulty: AiDifficulty; startingMoney: number }) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [tok, setTok] = useState<TokenId>(token);
  const [opponents, setOpponents] = useState(2);
  const [difficulty, setDifficulty] = useState<AiDifficulty>("normal");
  const [money, setMoney] = useState(1_500_000);
  return (
    <section className="mx-auto max-w-lg py-8">
      <button type="button" className="text-sm text-muted hover:text-fg" onClick={onBack}>
        Back
      </button>
      <h1 className="mt-4 font-display text-3xl">Versus computer</h1>
      <label className="mt-6 block text-xs text-muted">
        Display name
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
            onClick={() => setTok(t)}
            className={cn(
              "grid size-11 place-items-center rounded-[12px] border",
              tok === t ? "border-gold text-gold" : "border-line text-muted",
            )}
            aria-label={TOKEN_LABEL[t]}
          >
            <TokenGlyph token={t} />
          </button>
        ))}
      </div>
      <label className="mt-4 block text-xs text-muted">
        Computer rivals · {opponents}
        <input
          type="range"
          min={1}
          max={3}
          value={opponents}
          onChange={(e) => setOpponents(Number(e.target.value))}
          className="mt-2 w-full"
        />
      </label>
      <p className="mt-4 text-xs text-muted">Difficulty</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(["easy", "normal", "hard", "expert"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDifficulty(d)}
            className={cn(
              "rounded-full border px-3 py-2 text-xs capitalize",
              difficulty === d ? "border-gold text-gold" : "border-line text-muted",
            )}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">Starting cash · {formatNaira(money)}</p>
      <input
        type="range"
        min={800000}
        max={2500000}
        step={100000}
        value={money}
        onChange={(e) => setMoney(Number(e.target.value))}
        className="mt-2 w-full"
      />
      <Button className="mt-6 min-h-12 w-full" onClick={() => onStart({ name, token: tok, opponents, difficulty, startingMoney: money })}>
        Start match
      </Button>
    </section>
  );
}

function CreateRoom({
  onBack,
  onCreate,
  error,
  loading,
}: {
  onBack: () => void;
  onCreate: (cfg: { maxPlayers: number; startingMoney: number; turnTimerSec: number; isPrivate: boolean }) => void;
  error: string | null;
  loading: boolean;
}) {
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [money, setMoney] = useState(1_500_000);
  const [timer, setTimer] = useState(45);
  const [isPrivate, setIsPrivate] = useState(true);
  return (
    <section className="mx-auto max-w-lg py-8">
      <button type="button" className="text-sm text-muted hover:text-fg" onClick={onBack}>
        Back
      </button>
      <h1 className="mt-4 font-display text-3xl">{isPrivate ? "Private room" : "Public room"}</h1>
      <label className="mt-6 flex items-center justify-between text-sm">
        Private code
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
      </label>
      <label className="mt-4 block text-xs text-muted">
        Max players · {maxPlayers}
        <input type="range" min={2} max={4} value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} className="mt-2 w-full" />
      </label>
      <p className="mt-4 text-xs text-muted">Starting cash · {formatNaira(money)}</p>
      <input type="range" min={800000} max={2500000} step={100000} value={money} onChange={(e) => setMoney(Number(e.target.value))} className="mt-2 w-full" />
      <label className="mt-4 block text-xs text-muted">
        Turn timer · {timer ? `${timer}s` : "Off"}
        <input type="range" min={0} max={90} step={15} value={timer} onChange={(e) => setTimer(Number(e.target.value))} className="mt-2 w-full" />
      </label>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <Button
        className="mt-6 min-h-12 w-full"
        disabled={loading}
        onClick={() => onCreate({ maxPlayers, startingMoney: money, turnTimerSec: timer, isPrivate })}
      >
        {loading ? "Creating…" : "Create room"}
      </Button>
    </section>
  );
}

function JoinRoom({
  onBack,
  onJoin,
  error,
  loading,
}: {
  onBack: () => void;
  onJoin: (code: string) => void;
  error: string | null;
  loading: boolean;
}) {
  const [code, setCode] = useState("OZO-");
  return (
    <section className="mx-auto max-w-lg py-8">
      <button type="button" className="text-sm text-muted hover:text-fg" onClick={onBack}>
        Back
      </button>
      <h1 className="mt-4 font-display text-3xl">Join room</h1>
      <label className="mt-6 block text-xs text-muted">
        Room code
        <input
          className="mt-1 min-h-12 w-full rounded-[12px] border border-line bg-bg-subtle px-3 font-mono text-lg uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </label>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <Button className="mt-6 min-h-12 w-full" disabled={loading || code.length < 8} onClick={() => onJoin(code)}>
        {loading ? "Joining…" : "Enter lobby"}
      </Button>
    </section>
  );
}

function FloatingDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="float-y absolute top-24 right-[12%] opacity-70">
        <Dice value={5} rolling={false} size={56} />
      </div>
      <div className="float-y absolute bottom-28 left-[10%] opacity-50" style={{ animationDelay: "1.2s" }}>
        <Dice value={2} rolling={false} size={44} />
      </div>
      <div className="absolute top-1/3 left-1/2 size-72 -translate-x-1/2 rounded-full bg-gold/5 blur-3xl" />
    </div>
  );
}

