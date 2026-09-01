export type TileKind =
  | "launch"
  | "timeout"
  | "chill"
  | "detour"
  | "lucky"
  | "fund"
  | "tax"
  | "property"
  | "transit"
  | "utility";

export type ColorGroup =
  | "ember"
  | "azure"
  | "orchid"
  | "amber"
  | "crimson"
  | "solar"
  | "jade"
  | "royal"
  | "transit"
  | "utility";

export type TokenId =
  | "crown"
  | "rocket"
  | "diamond"
  | "car"
  | "ship"
  | "dragon"
  | "lion"
  | "bolt";

export type AiDifficulty = "easy" | "normal" | "hard" | "expert";

export type GamePhase = "lobby" | "playing" | "ended";

export interface TileDef {
  id: number;
  name: string;
  kind: TileKind;
  group?: ColorGroup;
  price?: number;
  rents?: number[];
  buildCost?: number;
  tax?: number;
  short: string;
}

export interface PropertyState {
  ownerId: string | null;
  level: number;
  mortgaged: boolean;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  token: TokenId;
  position: number;
  money: number;
  isBankrupt: boolean;
  isAi: boolean;
  aiDifficulty?: AiDifficulty;
  inTimeout: boolean;
  timeoutTurns: number;
  getOutCards: number;
  consecutiveDoubles: number;
  connected: boolean;
}

export type PendingAction =
  | { type: "roll" }
  | { type: "buy"; tileId: number }
  | { type: "card"; deck: "lucky" | "fund"; cardId: string }
  | {
      type: "raise-funds";
      amount: number;
      creditorId: string | "bank";
      reason: string;
      tileId?: number;
    }
  | { type: "timeout-choice" };

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string;
  offerMoney: number;
  requestMoney: number;
  offerTiles: number[];
  requestTiles: number[];
}

export interface LogEntry {
  id: number;
  turn: number;
  text: string;
}

export interface GameSettings {
  startingMoney: number;
  turnTimerSec: number;
  launchBonus: number;
  timeoutFine: number;
  maxPlayers: number;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  settings: GameSettings;
  players: Player[];
  currentPlayerIndex: number;
  turnNumber: number;
  properties: Record<string, PropertyState>;
  pending: PendingAction | null;
  lastDice: [number, number] | null;
  luckyDeck: string[];
  fundDeck: string[];
  luckyDiscard: string[];
  fundDiscard: string[];
  trade: TradeOffer | null;
  winnerId: string | null;
  log: LogEntry[];
  version: number;
  turnStartedAt: number;
  doubleRentFor: string | null;
  extraTurn: boolean;
  logSeq: number;
}

export type GameEvent =
  | { type: "rolled"; playerId: string; dice: [number, number] }
  | { type: "moved"; playerId: string; from: number; to: number; path: number[] }
  | { type: "passed-launch"; playerId: string; amount: number }
  | { type: "money"; playerId: string; delta: number; reason: string }
  | { type: "purchased"; playerId: string; tileId: number }
  | { type: "rent"; fromId: string; toId: string; amount: number; tileId: number }
  | { type: "card"; playerId: string; deck: "lucky" | "fund"; cardId: string }
  | { type: "built"; playerId: string; tileId: number; level: number }
  | { type: "timeout"; playerId: string }
  | { type: "bankrupt"; playerId: string }
  | { type: "won"; playerId: string }
  | { type: "district"; playerId: string; group: ColorGroup }
  | { type: "turn"; playerId: string }
  | { type: "log"; text: string };

export type GameAction =
  | { type: "roll" }
  | { type: "buy" }
  | { type: "pass" }
  | { type: "acknowledge-card" }
  | { type: "pay-timeout" }
  | { type: "use-pass" }
  | { type: "build"; tileId: number }
  | { type: "mortgage"; tileId: number }
  | { type: "unmortgage"; tileId: number }
  | { type: "sell-upgrade"; tileId: number }
  | {
      type: "propose-trade";
      toId: string;
      offerMoney: number;
      requestMoney: number;
      offerTiles: number[];
      requestTiles: number[];
    }
  | { type: "accept-trade" }
  | { type: "decline-trade" }
  | { type: "bankrupt" };

export interface ActionContext {
  actorId: string;
  rng: Rng;
  now: number;
}

export interface Rng {
  int(min: number, max: number): number;
  shuffle<T>(arr: T[]): T[];
}

export interface ApplyResult {
  ok: boolean;
  error?: string;
  state: GameState;
  events: GameEvent[];
}

export const PLAYER_COLORS = ["#e4c37a", "#5eead4", "#f472b6", "#60a5fa"] as const;

export const TOKEN_LIST: TokenId[] = [
  "crown",
  "rocket",
  "diamond",
  "car",
  "ship",
  "dragon",
  "lion",
  "bolt",
];

export const DEFAULT_SETTINGS: GameSettings = {
  startingMoney: 1_500_000,
  turnTimerSec: 45,
  launchBonus: 200_000,
  timeoutFine: 50_000,
  maxPlayers: 4,
};
