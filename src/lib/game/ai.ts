import { BOARD, GROUP_META, tileById } from "./board";
import { canBuild, getProp, ownedTileIds, ownsGroup, rentDue } from "./engine";
import type { AiDifficulty, GameAction, GameState, Player } from "./types";

function reserveFor(diff: AiDifficulty, money: number): number {
  switch (diff) {
    case "easy":
      return 40_000;
    case "normal":
      return 180_000;
    case "hard":
      return Math.max(250_000, Math.floor(money * 0.18));
    case "expert":
      return Math.max(350_000, Math.floor(money * 0.22));
  }
}

function groupProgress(state: GameState, playerId: string, group: keyof typeof GROUP_META): number {
  return GROUP_META[group].ids.filter((id) => getProp(state, id).ownerId === playerId).length;
}

function opponentNearComplete(state: GameState, tileId: number, selfId: string): boolean {
  const tile = tileById(tileId);
  if (!tile.group) return false;
  const ids = GROUP_META[tile.group].ids;
  const owners = new Map<string, number>();
  for (const id of ids) {
    const o = getProp(state, id).ownerId;
    if (o && o !== selfId) owners.set(o, (owners.get(o) ?? 0) + 1);
  }
  const need = ids.length;
  for (const count of owners.values()) {
    if (count >= need - 1) return true;
  }
  return false;
}

function propertyScore(state: GameState, player: Player, tileId: number, diff: AiDifficulty): number {
  const tile = tileById(tileId);
  const price = tile.price ?? 0;
  let score = (tile.rents?.[0] ?? 10_000) / Math.max(price, 1);
  if (tile.group && tile.group !== "transit" && tile.group !== "utility") {
    const have = groupProgress(state, player.id, tile.group);
    const total = GROUP_META[tile.group].ids.length;
    score += have * 0.6;
    if (have + 1 === total) score += 2.5;
    if (tile.group === "royal" || tile.group === "jade") score += 0.4;
    if (tile.group === "ember") score += 0.15;
  }
  if (tile.kind === "transit") score += 0.35 * countKind(state, player.id, "transit");
  if (tile.kind === "utility") score += 0.2;
  if (diff !== "easy" && opponentNearComplete(state, tileId, player.id)) score += 1.8;
  return score;
}

function countKind(state: GameState, playerId: string, kind: "transit" | "utility") {
  return BOARD.filter((t) => t.kind === kind && getProp(state, t.id).ownerId === playerId).length;
}

function expectedThreat(state: GameState, selfId: string): number {
  let threat = 0;
  for (const p of state.players) {
    if (p.id === selfId || p.isBankrupt) continue;
    for (const id of ownedTileIds(state, p.id)) {
      threat = Math.max(threat, rentDue(state, id, 7));
    }
  }
  return threat;
}

function raiseFundsAction(state: GameState, player: Player): GameAction {
  const pending = state.pending;
  const need =
    pending?.type === "raise-funds" ? pending.amount - player.money : 1;
  const owned = ownedTileIds(state, player.id);
  const withLevel = owned
    .map((id) => ({ id, prop: getProp(state, id), tile: tileById(id) }))
    .filter((x) => x.prop.level > 0)
    .sort((a, b) => a.prop.level - b.prop.level || (a.tile.price ?? 0) - (b.tile.price ?? 0));
  if (withLevel[0]) return { type: "sell-upgrade", tileId: withLevel[0].id };

  const mortgageable = owned
    .map((id) => ({ id, prop: getProp(state, id), tile: tileById(id) }))
    .filter((x) => !x.prop.mortgaged && x.prop.level === 0)
    .sort((a, b) => {
      const aSet = a.tile.group && a.tile.group !== "transit" ? groupProgress(state, player.id, a.tile.group) : 0;
      const bSet = b.tile.group && b.tile.group !== "transit" ? groupProgress(state, player.id, b.tile.group) : 0;
      if (aSet !== bSet) return aSet - bSet;
      return (a.tile.price ?? 0) - (b.tile.price ?? 0);
    });
  if (mortgageable[0] && need > 0) return { type: "mortgage", tileId: mortgageable[0].id };
  return { type: "bankrupt" };
}

function pickBuild(state: GameState, player: Player, diff: AiDifficulty): GameAction | null {
  if (diff === "easy") return null;
  const reserve = reserveFor(diff, player.money) + (diff === "expert" ? expectedThreat(state, player.id) * 0.5 : 0);
  const options = ownedTileIds(state, player.id)
    .filter((id) => !canBuild(state, player.id, id))
    .map((id) => {
      const tile = tileById(id);
      const nextRent = tile.rents?.[getProp(state, id).level + 1] ?? 0;
      const curRent = tile.rents?.[getProp(state, id).level] ?? 0;
      return { id, cost: tile.buildCost ?? 0, gain: nextRent - curRent };
    })
    .filter((x) => player.money - x.cost >= reserve)
    .sort((a, b) => b.gain / Math.max(a.cost, 1) - a.gain / Math.max(b.cost, 1));
  if (!options[0]) return null;
  if (diff === "normal" && Math.random() < 0.45) return null;
  return { type: "build", tileId: options[0].id };
}

function shouldBuy(state: GameState, player: Player, tileId: number, diff: AiDifficulty): boolean {
  const tile = tileById(tileId);
  const price = tile.price ?? 0;
  if (player.money < price) return false;
  const leftover = player.money - price;
  const reserve = reserveFor(diff, player.money);
  const score = propertyScore(state, player, tileId, diff);
  if (diff === "easy") return leftover >= 20_000 && Math.random() < 0.55 + score * 0.1;
  if (tile.group && ownsGroup(state, player.id, tile.group) === false) {
    const have = groupProgress(state, player.id, tile.group);
    const total = GROUP_META[tile.group].ids.length;
    if (have + 1 === total && leftover >= reserve * 0.4) return true;
  }
  if (diff !== "easy" && opponentNearComplete(state, tileId, player.id) && leftover >= 80_000) {
    return true;
  }
  if (leftover < reserve && score < 1.4) return false;
  if (diff === "normal") return leftover >= reserve * 0.6 && score > 0.12;
  if (diff === "hard") return leftover >= reserve * 0.5 && score > 0.08;
  return leftover >= reserve * 0.35 && score > 0.05;
}

function considerTrade(state: GameState, player: Player, diff: AiDifficulty): GameAction | null {
  const trade = state.trade;
  if (!trade || trade.toId !== player.id) return null;
  if (diff === "easy") return Math.random() < 0.5 ? { type: "accept-trade" } : { type: "decline-trade" };

  const offerValue =
    trade.offerMoney +
    trade.offerTiles.reduce((s, id) => s + (tileById(id).price ?? 0) * (opponentNearComplete(state, id, player.id) ? 1.8 : 1), 0);
  const requestValue =
    trade.requestMoney +
    trade.requestTiles.reduce((s, id) => {
      const tile = tileById(id);
      const setBonus =
        tile.group && groupProgress(state, player.id, tile.group) + 0 >= GROUP_META[tile.group].ids.length - 1
          ? 1.6
          : 1;
      return s + (tile.price ?? 0) * setBonus;
    }, 0);

  const ratio = offerValue / Math.max(requestValue, 1);
  if (diff === "normal") return ratio >= 0.95 ? { type: "accept-trade" } : { type: "decline-trade" };
  if (diff === "hard") return ratio >= 1.05 ? { type: "accept-trade" } : { type: "decline-trade" };
  return ratio >= 1.15 ? { type: "accept-trade" } : { type: "decline-trade" };
}

export function pickAiAction(state: GameState, playerId: string): GameAction | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.isBankrupt) return null;
  const diff: AiDifficulty = player.aiDifficulty ?? "normal";
  const pending = state.pending;
  const current = state.players[state.currentPlayerIndex];

  const tradeAct = considerTrade(state, player, diff);
  if (tradeAct) return tradeAct;

  if (!current || current.id !== playerId) return null;

  if (pending?.type === "raise-funds") return raiseFundsAction(state, player);
  if (pending?.type === "card") return { type: "acknowledge-card" };
  if (pending?.type === "buy") {
    return shouldBuy(state, player, pending.tileId, diff) ? { type: "buy" } : { type: "pass" };
  }
  if (pending?.type === "timeout-choice") {
    if (player.getOutCards > 0) return { type: "use-pass" };
    if (player.money > state.settings.timeoutFine + reserveFor(diff, player.money) && diff !== "easy") {
      return { type: "pay-timeout" };
    }
    return { type: "roll" };
  }
  if (pending?.type === "roll") {
    const build = pickBuild(state, player, diff);
    if (build) return build;
    return { type: "roll" };
  }
  return null;
}
