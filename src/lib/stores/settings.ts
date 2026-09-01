import { create } from "zustand";
import { persist } from "zustand/middleware";
import { configureAudio } from "@/lib/audio";

export type AnimQuality = "low" | "medium" | "high";

interface SettingsState {
  master: number;
  music: number;
  sfx: number;
  musicOn: boolean;
  sfxOn: boolean;
  animQuality: AnimQuality;
  particles: boolean;
  reducedMotion: boolean;
  turnTimer: boolean;
  confirmPurchases: boolean;
  displayName: string;
  token: string;
  set: (p: Partial<Omit<SettingsState, "set" | "hydrateAudio">>) => void;
  hydrateAudio: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      master: 0.7,
      music: 0.28,
      sfx: 0.75,
      musicOn: true,
      sfxOn: true,
      animQuality: "high",
      particles: true,
      reducedMotion: false,
      turnTimer: true,
      confirmPurchases: true,
      displayName: "",
      token: "crown",
      set: (p) => {
        set(p);
        const s = get();
        configureAudio({
          master: s.master,
          music: s.music,
          sfx: s.sfx,
          musicOn: s.musicOn,
          sfxOn: s.sfxOn,
          muted: false,
        });
      },
      hydrateAudio: () => {
        const s = get();
        configureAudio({
          master: s.master,
          music: s.music,
          sfx: s.sfx,
          musicOn: s.musicOn,
          sfxOn: s.sfxOn,
          muted: false,
        });
      },
    }),
    { name: "ozopoly-settings" },
  ),
);
