import { create } from "zustand";
import { applyAction, createMatch } from "@/lib/game/engine";
import { createRng } from "@/lib/game/rng";
import { pickAiAction } from "@/lib/game/ai";
import type { AiDifficulty, GameAction, GameEvent, GameState, TokenId } from "@/lib/game/types";
import { DEFAULT_SETTINGS, PLAYER_COLORS, TOKEN_LIST } from "@/lib/game/types";

const AI_NAMES = ["Nova", "Kade", "Imani", "Riven"];

interface LocalGameStore {
  state: GameState | null;
  meId: string;
  lastEvents: GameEvent[];
  start: (opts: {
    name: string;
    token: TokenId;
    opponents: number;
    difficulty: AiDifficulty;
    startingMoney?: number;
  }) => void;
  dispatch: (action: GameAction) => { ok: boolean; error?: string; events: GameEvent[] };
  runAiTurn: () => GameEvent[];
  reset: () => void;
}

export const useLocalGame = create<LocalGameStore>((set, get) => ({
  state: null,
  meId: "you",
  lastEvents: [],
  start: ({ name, token, opponents, difficulty, startingMoney }) => {
    const rng = createRng();
    const players = [
      {
        id: "you",
        name,
        color: PLAYER_COLORS[0]!,
        token,
        isAi: false,
      },
      ...Array.from({ length: opponents }, (_, i) => ({
        id: `ai-${i}`,
        name: AI_NAMES[i] ?? `CPU ${i + 1}`,
        color: PLAYER_COLORS[i + 1]!,
        token: TOKEN_LIST.filter((t) => t !== token)[i] ?? "bolt",
        isAi: true as const,
        aiDifficulty: difficulty,
      })),
    ];
    const state = createMatch({
      id: `local-${Date.now()}`,
      players,
      rng,
      now: Date.now(),
      settings: {
        ...DEFAULT_SETTINGS,
        startingMoney: startingMoney ?? DEFAULT_SETTINGS.startingMoney,
        turnTimerSec: 0,
      },
    });
    set({ state, meId: "you", lastEvents: [] });
  },
  dispatch: (action) => {
    const { state, meId } = get();
    if (!state) return { ok: false, error: "No game", events: [] };
    const result = applyAction(state, action, { actorId: meId, rng: createRng(), now: Date.now() });
    if (!result.ok) return { ok: false, error: result.error, events: [] };
    set({ state: result.state, lastEvents: result.events });
    return { ok: true, events: result.events };
  },
  runAiTurn: () => {
    const { state } = get();
    if (!state || state.phase !== "playing") return [];
    const player = state.players[state.currentPlayerIndex];
    if (!player?.isAi) return [];
    const action = pickAiAction(state, player.id);
    if (!action) return [];
    const result = applyAction(state, action, { actorId: player.id, rng: createRng(), now: Date.now() });
    if (!result.ok) return [];
    set({ state: result.state, lastEvents: result.events });
    return result.events;
  },
  reset: () => set({ state: null, lastEvents: [] }),
}));
