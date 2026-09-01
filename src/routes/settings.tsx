import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/layout/Shell";
import { useSettings, type AnimQuality } from "@/lib/stores/settings";
import { TOKEN_LIST, type TokenId } from "@/lib/game/types";
import { TokenGlyph, TOKEN_LABEL } from "@/components/game/TokenGlyph";
import { unlockAudio } from "@/lib/audio";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const s = useSettings();
  return (
    <Shell>
      <h1 className="font-display text-3xl">Settings</h1>
      <section className="oz-panel mt-6 max-w-lg space-y-5 rounded-[28px] p-5">
        <h2 className="font-display text-lg">Audio</h2>
        <Slider label="Master" value={s.master} onChange={(v) => { unlockAudio(); s.set({ master: v }); }} />
        <Slider label="Music" value={s.music} onChange={(v) => { unlockAudio(); s.set({ music: v, musicOn: v > 0 }); }} />
        <Slider label="Sound" value={s.sfx} onChange={(v) => { unlockAudio(); s.set({ sfx: v, sfxOn: v > 0 }); }} />
        <Toggle label="Music on" on={s.musicOn} onChange={(v) => s.set({ musicOn: v })} />
        <Toggle label="Sound on" on={s.sfxOn} onChange={(v) => s.set({ sfxOn: v })} />
      </section>
      <section className="oz-panel mt-4 max-w-lg space-y-4 rounded-[28px] p-5">
        <h2 className="font-display text-lg">Graphics</h2>
        <p className="text-xs text-muted">Animation quality</p>
        <div className="flex gap-2">
          {(["low", "medium", "high"] as AnimQuality[]).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => s.set({ animQuality: q })}
              className={cn(
                "rounded-full border px-3 py-2 text-xs capitalize",
                s.animQuality === q ? "border-gold text-gold" : "border-line text-muted",
              )}
            >
              {q}
            </button>
          ))}
        </div>
        <Toggle label="Particle effects" on={s.particles} onChange={(v) => s.set({ particles: v })} />
        <Toggle label="Reduce motion" on={s.reducedMotion} onChange={(v) => s.set({ reducedMotion: v })} />
      </section>
      <section className="oz-panel mt-4 max-w-lg space-y-4 rounded-[28px] p-5">
        <h2 className="font-display text-lg">Gameplay</h2>
        <Toggle label="Turn timer (online)" on={s.turnTimer} onChange={(v) => s.set({ turnTimer: v })} />
        <Toggle label="Confirm purchases" on={s.confirmPurchases} onChange={(v) => s.set({ confirmPurchases: v })} />
        <label className="block text-xs text-muted">
          Display name
          <input
            className="mt-1 min-h-11 w-full rounded-[12px] border border-line bg-bg-subtle px-3 text-sm"
            value={s.displayName}
            onChange={(e) => s.set({ displayName: e.target.value })}
          />
        </label>
        <p className="text-xs text-muted">Default token</p>
        <div className="flex flex-wrap gap-2">
          {TOKEN_LIST.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => s.set({ token: t })}
              className={cn(
                "grid size-11 place-items-center rounded-[12px] border",
                s.token === t ? "border-gold text-gold" : "border-line text-muted",
              )}
              aria-label={TOKEN_LABEL[t]}
            >
              <TokenGlyph token={t as TokenId} />
            </button>
          ))}
        </div>
      </section>
    </Shell>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between text-muted">
        {label}
        <span className="tabular-nums">{Math.round(value * 100)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full"
      />
    </label>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between text-sm">
      {label}
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
