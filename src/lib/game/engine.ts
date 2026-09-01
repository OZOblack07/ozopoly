import { BOARD, GROUP_META, OWNABLE_KINDS, pathTiles, tileById } from "./board";
import { ALL_CARDS, FUND_CARDS, LUCKY_CARDS, cardById } from "./cards";
import type { CardEffect } from "./cards";
import type {
  ActionContext,
  ApplyResult,
  ColorGroup,
  GameAction,
  GameEvent,
  GameSettings,
  GameState,
  LogEntry,
  PendingAction,
  Player,
  PropertyState,
  Rng,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";

export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function fail(state: GameState, error: string): ApplyResult {
  return { ok: false, error, state, events: [] };
}

function pushLog(state: GameState, text: string, events: GameEvent[]) {
  state.logSeq += 1;
  const entry: LogEntry = { id: state.logSeq, turn: state.turnNumber, text };
  state.log.push(entry);
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
  events.push({ type: "log", text });
}

function currentPlayer(state: GameState): Player {
  const p = state.players[state.currentPlayerIndex];
  if (!p) throw new Error("No current player");
  return p;
}

function propKey(id: number) {
  return String(id);
}

export function getProp(state: GameState, tileId: number): PropertyState {
  const key = propKey(tileId);
  const existing = state.properties[key];
  if (existing) return existing;
  const created: PropertyState = { ownerId: null, level: 0, mortgaged: false };
  state.properties[key] = created;
  return created;
}

export function ownedTileIds(state: GameState, playerId: string): number[] {
  return Object.entries(state.properties)
    .filter(([, p]) => p.ownerId === playerId)
    .map(([k]) => Number(k));
}

export function ownsGroup(state: GameState, playerId: string, group: ColorGroup): boolean {
  const ids = GROUP_META[group].ids;
  return ids.every((id) => getProp(state, id).ownerId === playerId && !getProp(state, id).mortgaged);
}

function groupOwner(state: GameState, group: ColorGroup): string | null {
  const ids = GROUP_META[group].ids;
  const first = getProp(state, ids[0]!).ownerId;
  if (!first) return null;
  return ids.every((id) => getProp(state, id).ownerId === first) ? first : null;
}

export function countOwnedKind(
  state: GameState,
  playerId: string,
  kind: "transit" | "utility",
): number {
  return BOARD.filter((t) => t.kind === kind && getProp(state, t.id).ownerId === playerId).length;
}

export function rentDue(
  state: GameState,
  tileId: number,
  diceSum: number,
): number {
  const tile = tileById(tileId);
  const prop = getProp(state, tileId);
  if (!prop.ownerId || prop.mortgaged) return 0;
  if (tile.kind === "transit") {
    const n = countOwnedKind(state, prop.ownerId, "transit");
    const table = tile.rents ?? [25_000, 50_000, 100_000, 200_000];
    return table[Math.max(0, n - 1)] ?? 0;
  }
  if (tile.kind === "utility") {
    const n = countOwnedKind(state, prop.ownerId, "utility");
    const mult = n >= 2 ? 10_000 : 4_000;
    return diceSum * mult;
  }
  if (tile.kind === "property" && tile.rents) {
    const level = Math.max(0, Math.min(5, prop.level));
    let rent = tile.rents[level] ?? 0;
    if (level === 0 && tile.group && ownsGroup(state, prop.ownerId, tile.group)) {
      rent *= 2;
    }
    return rent;
  }
  return 0;
}

export function assetValue(state: GameState, playerId: string): number {
  let v = 0;
  for (const id of ownedTileIds(state, playerId)) {
    const tile = tileById(id);
    const prop = getProp(state, id);
    const price = tile.price ?? 0;
    const build = tile.buildCost ?? 0;
    if (prop.mortgaged) v += Math.floor(price / 2);
    else v += price + prop.level * build;
  }
  return v;
}

export function netWorthOf(state: GameState, playerId: string): number {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return 0;
  return p.money + assetValue(state, playerId);
}

function liquidateValue(state: GameState, playerId: string): number {
  let v = 0;
  for (const id of ownedTileIds(state, playerId)) {
    const tile = tileById(id);
    const prop = getProp(state, id);
    const price = tile.price ?? 0;
    const build = tile.buildCost ?? 0;
    v += Math.floor(prop.level * build * 0.5);
    if (!prop.mortgaged) v += Math.floor(price / 2);
  }
  return v;
}

function credit(state: GameState, player: Player, amount: number, reason: string, events: GameEvent[]) {
  if (amount === 0) return;
  player.money += amount;
  events.push({ type: "money", playerId: player.id, delta: amount, reason });
}

function tryDebit(
  state: GameState,
  player: Player,
  amount: number,
  creditorId: string | "bank",
  reason: string,
  events: GameEvent[],
  tileId?: number,
): boolean {
  if (amount <= 0) return true;
  if (player.money >= amount) {
    player.money -= amount;
    events.push({ type: "money", playerId: player.id, delta: -amount, reason });
    if (creditorId !== "bank") {
      const other = state.players.find((p) => p.id === creditorId);
      if (other && !other.isBankrupt) {
        other.money += amount;
        events.push({ type: "money", playerId: other.id, delta: amount, reason });
      }
    }
    return true;
  }
  const maxRaise = player.money + liquidateValue(state, player.id);
  if (maxRaise < amount) {
    bankruptPlayer(state, player, creditorId, events);
    return false;
  }
  state.pending = { type: "raise-funds", amount, creditorId, reason, tileId };
  return false;
}

function bankruptPlayer(
  state: GameState,
  player: Player,
  creditorId: string | "bank",
  events: GameEvent[],
) {
  player.isBankrupt = true;
  player.inTimeout = false;
  events.push({ type: "bankrupt", playerId: player.id });
  pushLog(state, `${player.name} has been eliminated.`, events);

  const ids = ownedTileIds(state, player.id);
  if (creditorId === "bank") {
    for (const id of ids) {
      const prop = getProp(state, id);
      prop.ownerId = null;
      prop.level = 0;
      prop.mortgaged = false;
    }
    player.money = 0;
  } else {
    const cred = state.players.find((p) => p.id === creditorId && !p.isBankrupt);
    if (cred) {
      cred.money += player.money;
      if (player.money) {
        events.push({
          type: "money",
          playerId: cred.id,
          delta: player.money,
          reason: "Bankruptcy transfer",
        });
      }
      for (const id of ids) {
        const prop = getProp(state, id);
        prop.ownerId = cred.id;
        prop.level = 0;
      }
      cred.getOutCards += player.getOutCards;
    } else {
      for (const id of ids) {
        const prop = getProp(state, id);
        prop.ownerId = null;
        prop.level = 0;
        prop.mortgaged = false;
      }
    }
    player.money = 0;
    player.getOutCards = 0;
  }

  if (state.trade && (state.trade.fromId === player.id || state.trade.toId === player.id)) {
    state.trade = null;
  }

  checkWin(state, events);
}

function checkWin(state: GameState, events: GameEvent[]) {
  const alive = state.players.filter((p) => !p.isBankrupt);
  if (alive.length === 1 && alive[0]) {
    state.phase = "ended";
    state.winnerId = alive[0].id;
    state.pending = null;
    events.push({ type: "won", playerId: alive[0].id });
    pushLog(state, `${alive[0].name} is the Ozopoly Champion.`, events);
  }
}

function nextAliveIndex(state: GameState, from: number): number {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    const p = state.players[idx];
    if (p && !p.isBankrupt) return idx;
  }
  return from;
}

function advanceTurn(state: GameState, events: GameEvent[], extra: boolean) {
  if (state.phase === "ended") return;
  if (extra) {
    const p = currentPlayer(state);
    p.consecutiveDoubles = 0;
    state.extraTurn = false;
    state.pending = p.inTimeout ? { type: "timeout-choice" } : { type: "roll" };
    state.turnStartedAt = Date.now();
    events.push({ type: "turn", playerId: p.id });
    return;
  }
  const cur = currentPlayer(state);
  cur.consecutiveDoubles = 0;
  state.currentPlayerIndex = nextAliveIndex(state, state.currentPlayerIndex);
  state.turnNumber += 1;
  const next = currentPlayer(state);
  state.pending = next.inTimeout ? { type: "timeout-choice" } : { type: "roll" };
  state.turnStartedAt = Date.now();
  events.push({ type: "turn", playerId: next.id });
  pushLog(state, `${next.name}'s turn.`, events);
}

function sendToTimeout(state: GameState, player: Player, events: GameEvent[]) {
  const from = player.position;
  player.position = 10;
  player.inTimeout = true;
  player.timeoutTurns = 0;
  player.consecutiveDoubles = 0;
  state.extraTurn = false;
  events.push({ type: "timeout", playerId: player.id });
  events.push({ type: "moved", playerId: player.id, from, to: 10, path: [10] });
  pushLog(state, `${player.name} is sent to Timeout Zone.`, events);
}

function movePlayer(
  state: GameState,
  player: Player,
  steps: number,
  events: GameEvent[],
  collectLaunch: boolean,
) {
  const from = player.position;
  const path = pathTiles(from, steps);
  const to = path[path.length - 1] ?? from;
  if (collectLaunch) {
    for (const id of path) {
      if (id === 0) {
        credit(state, player, state.settings.launchBonus, "Launch bonus", events);
        events.push({
          type: "passed-launch",
          playerId: player.id,
          amount: state.settings.launchBonus,
        });
        pushLog(state, `${player.name} collected a launch bonus.`, events);
      }
    }
  }
  player.position = to;
  events.push({ type: "moved", playerId: player.id, from, to, path });
}

function goToTile(
  state: GameState,
  player: Player,
  tileId: number,
  collectLaunch: boolean,
  events: GameEvent[],
) {
  const steps = (tileId - player.position + 40) % 40;
  if (steps === 0 && tileId === 0) {
    movePlayer(state, player, 40, events, collectLaunch);
  } else {
    movePlayer(state, player, steps === 0 ? 0 : steps, events, collectLaunch);
    if (steps === 0) player.position = tileId;
  }
}

function drawCard(state: GameState, deck: "lucky" | "fund", rng: Rng): string {
  const pile = deck === "lucky" ? state.luckyDeck : state.fundDeck;
  const discard = deck === "lucky" ? state.luckyDiscard : state.fundDiscard;
  if (pile.length === 0) {
    const shuffled = rng.shuffle(discard);
    discard.length = 0;
    pile.push(...shuffled);
  }
  const id = pile.shift();
  if (!id) throw new Error("Empty card deck");
  return id;
}

function repairsCost(state: GameState, playerId: string, perHouse: number, perTower: number): number {
  let cost = 0;
  for (const id of ownedTileIds(state, playerId)) {
    const prop = getProp(state, id);
    if (prop.level >= 5) cost += perTower;
    else cost += prop.level * perHouse;
  }
  return cost;
}

function afterLand(
  state: StateWithRng,
  player: Player,
  diceSum: number,
  events: GameEvent[],
  rng: Rng,
) {
  const tile = tileById(player.position);
  switch (tile.kind) {
    case "launch":
    case "chill":
    case "timeout":
      finishMove(state, player, events);
      return;
    case "detour":
      sendToTimeout(state, player, events);
      if (state.phase !== "ended") advanceTurn(state, events, false);
      return;
    case "tax": {
      const amount = tile.tax ?? 0;
      pushLog(state, `${player.name} owes ${tile.name}.`, events);
      const paid = tryDebit(state, player, amount, "bank", tile.name, events, tile.id);
      if (paid) finishMove(state, player, events);
      return;
    }
    case "lucky":
    case "fund": {
      const deck = tile.kind === "lucky" ? "lucky" : "fund";
      const cardId = drawCard(state, deck, rng);
      state.pending = { type: "card", deck, cardId };
      events.push({ type: "card", playerId: player.id, deck, cardId });
      const card = cardById(cardId);
      pushLog(state, `${player.name} drew ${card.title}.`, events);
      return;
    }
    case "property":
    case "transit":
    case "utility": {
      const prop = getProp(state, tile.id);
      if (!prop.ownerId) {
        state.pending = { type: "buy", tileId: tile.id };
        return;
      }
      if (prop.ownerId === player.id || prop.mortgaged) {
        finishMove(state, player, events);
        return;
      }
      let amount = rentDue(state, tile.id, diceSum);
      if (state.doubleRentFor === prop.ownerId) {
        amount *= 2;
        state.doubleRentFor = null;
      }
      const owner = state.players.find((p) => p.id === prop.ownerId);
      if (!owner || owner.isBankrupt || owner.inTimeout) {
        finishMove(state, player, events);
        return;
      }
      events.push({
        type: "rent",
        fromId: player.id,
        toId: owner.id,
        amount,
        tileId: tile.id,
      });
      pushLog(state, `${player.name} pays rent on ${tile.name} to ${owner.name}.`, events);
      const paid = tryDebit(state, player, amount, owner.id, `Rent: ${tile.name}`, events, tile.id);
      if (paid) finishMove(state, player, events);
      return;
    }
  }
}

function finishMove(state: GameState, player: Player, events: GameEvent[]) {
  if (state.phase === "ended") return;
  const extra = state.extraTurn;
  state.extraTurn = false;
  if (extra && !player.inTimeout) {
    state.pending = { type: "roll" };
    state.turnStartedAt = Date.now();
    pushLog(state, `${player.name} rolled doubles and goes again.`, events);
    return;
  }
  advanceTurn(state, events, false);
}

// Stash rng on state only during a single apply — never serialized as part of public API.
type StateWithRng = GameState & { __rng?: Rng };

function applyCardEffect(
  state: StateWithRng,
  player: Player,
  effect: CardEffect,
  events: GameEvent[],
) {
  const diceSum = (state.lastDice?.[0] ?? 2) + (state.lastDice?.[1] ?? 2);
  switch (effect.kind) {
    case "collect":
      credit(state, player, effect.amount, "Event card", events);
      finishMove(state, player, events);
      return;
    case "pay": {
      const paid = tryDebit(state, player, effect.amount, "bank", "Event card", events);
      if (paid) finishMove(state, player, events);
      return;
    }
    case "collect-each": {
      for (const other of state.players) {
        if (other.id === player.id || other.isBankrupt) continue;
        const take = Math.min(other.money, effect.amount);
        other.money -= take;
        player.money += take;
        events.push({ type: "money", playerId: other.id, delta: -take, reason: "Card" });
        events.push({ type: "money", playerId: player.id, delta: take, reason: "Card" });
      }
      finishMove(state, player, events);
      return;
    }
    case "pay-each": {
      const alive = state.players.filter((p) => p.id !== player.id && !p.isBankrupt);
      const total = effect.amount * alive.length;
      const paid = tryDebit(state, player, total, "bank", "Card payments", events);
      if (paid) {
        for (const other of alive) {
          other.money += effect.amount;
          events.push({
            type: "money",
            playerId: other.id,
            delta: effect.amount,
            reason: "Card",
          });
        }
        finishMove(state, player, events);
      }
      return;
    }
    case "repairs": {
      const cost = repairsCost(state, player.id, effect.perHouse, effect.perTower);
      const paid = tryDebit(state, player, cost, "bank", "Repairs", events);
      if (paid) finishMove(state, player, events);
      return;
    }
    case "go-to":
      goToTile(state, player, effect.tileId, effect.collectLaunch, events);
      afterLand(state, player, diceSum, events, state.__rng!);
      return;
    case "go-relative": {
      const steps = effect.steps;
      if (steps >= 0) movePlayer(state, player, steps, events, true);
      else {
        const to = (player.position + steps + 40) % 40;
        const from = player.position;
        player.position = to;
        events.push({ type: "moved", playerId: player.id, from, to, path: [to] });
      }
      afterLand(state, player, diceSum, events, state.__rng!);
      return;
    }
    case "timeout":
      sendToTimeout(state, player, events);
      if (state.phase !== "ended") advanceTurn(state, events, false);
      return;
    case "get-out":
      player.getOutCards += 1;
      pushLog(state, `${player.name} gained a Timeout Pass.`, events);
      finishMove(state, player, events);
      return;
    case "double-rent":
      state.doubleRentFor = player.id;
      pushLog(state, `${player.name}'s next rent collection is doubled.`, events);
      finishMove(state, player, events);
      return;
    case "festival":
      for (const p of state.players) {
        if (!p.isBankrupt) credit(state, p, effect.amount, "City Festival", events);
      }
      finishMove(state, player, events);
      return;
  }
}

function maybeCompleteDistrict(state: GameState, player: Player, tileId: number, events: GameEvent[]) {
  const tile = tileById(tileId);
  if (!tile.group || tile.group === "transit" || tile.group === "utility") return;
  if (ownsGroup(state, player.id, tile.group)) {
    events.push({ type: "district", playerId: player.id, group: tile.group });
    pushLog(state, `${player.name} completed the ${GROUP_META[tile.group].label}.`, events);
  }
}

export function canBuild(state: GameState, playerId: string, tileId: number): string | null {
  const tile = tileById(tileId);
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.isBankrupt) return "Not available";
  if (tile.kind !== "property" || !tile.group || !tile.buildCost) return "Cannot upgrade this space";
  const prop = getProp(state, tileId);
  if (prop.ownerId !== playerId) return "You do not own this";
  if (prop.mortgaged) return "Mortgaged properties cannot be upgraded";
  if (prop.level >= 5) return "Already a skyscraper";
  if (!ownsGroup(state, playerId, tile.group)) return "Own the full district first";
  const ids = GROUP_META[tile.group].ids;
  if (ids.some((id) => getProp(state, id).mortgaged)) return "Unmortgage the district first";
  const levels = ids.map((id) => getProp(state, id).level);
  const min = Math.min(...levels);
  if (prop.level > min) return "Build evenly across the district";
  if (player.money < tile.buildCost) return "Not enough funds";
  return null;
}

function doRoll(state: StateWithRng, ctx: ActionContext, events: GameEvent[]): ApplyResult {
  const player = currentPlayer(state);
  if (player.id !== ctx.actorId) return fail(state, "Not your turn");
  const pending = state.pending;
  if (pending?.type !== "roll" && pending?.type !== "timeout-choice") {
    return fail(state, "You cannot roll right now");
  }

  const d1 = ctx.rng.int(1, 6);
  const d2 = ctx.rng.int(1, 6);
  state.lastDice = [d1, d2];
  events.push({ type: "rolled", playerId: player.id, dice: [d1, d2] });
  pushLog(state, `${player.name} rolled ${d1 + d2} (${d1}+${d2}).`, events);

  const doubles = d1 === d2;

  if (player.inTimeout) {
    if (doubles) {
      player.inTimeout = false;
      player.timeoutTurns = 0;
      player.consecutiveDoubles = 0;
      pushLog(state, `${player.name} rolled doubles and left Timeout Zone.`, events);
      movePlayer(state, player, d1 + d2, events, true);
      afterLand(state, player, d1 + d2, events, ctx.rng);
      return { ok: true, state, events };
    }
    player.timeoutTurns += 1;
    if (player.timeoutTurns >= 3) {
      const paid = tryDebit(
        state,
        player,
        state.settings.timeoutFine,
        "bank",
        "Timeout fine",
        events,
      );
      if (!paid) return { ok: true, state, events };
      player.inTimeout = false;
      player.timeoutTurns = 0;
      movePlayer(state, player, d1 + d2, events, true);
      afterLand(state, player, d1 + d2, events, ctx.rng);
      return { ok: true, state, events };
    }
    pushLog(state, `${player.name} stays in Timeout Zone.`, events);
    advanceTurn(state, events, false);
    return { ok: true, state, events };
  }

  if (doubles) player.consecutiveDoubles += 1;
  else player.consecutiveDoubles = 0;

  if (player.consecutiveDoubles >= 3) {
    sendToTimeout(state, player, events);
    advanceTurn(state, events, false);
    return { ok: true, state, events };
  }

  state.extraTurn = doubles;
  movePlayer(state, player, d1 + d2, events, true);
  afterLand(state, player, d1 + d2, events, ctx.rng);
  return { ok: true, state, events };
}

function assertCurrent(state: GameState, actorId: string): string | null {
  const p = currentPlayer(state);
  if (p.id !== actorId) return "Not your turn";
  if (p.isBankrupt) return "You are out of the game";
  return null;
}

function trySettleDebt(state: GameState, events: GameEvent[]) {
  const pending = state.pending;
  if (pending?.type !== "raise-funds") return;
  const player = currentPlayer(state);
  if (player.money >= pending.amount) {
    const paid = tryDebit(
      state,
      player,
      pending.amount,
      pending.creditorId,
      pending.reason,
      events,
      pending.tileId,
    );
    if (paid) finishMove(state, player, events);
  }
}

export function applyAction(input: GameState, action: GameAction, ctx: ActionContext): ApplyResult {
  if (input.phase !== "playing") return fail(input, "Game is not in progress");
  const state = cloneState(input) as StateWithRng;
  state.__rng = ctx.rng;
  const events: GameEvent[] = [];
  const player = state.players.find((p) => p.id === ctx.actorId);
  if (!player) return fail(input, "You are not in this game");

  const asCurrent = () => assertCurrent(state, ctx.actorId);

  switch (action.type) {
    case "roll": {
      const err = asCurrent();
      if (err) return fail(input, err);
      return strip(doRoll(state, ctx, events));
    }
    case "buy": {
      const err = asCurrent();
      if (err) return fail(input, err);
      if (state.pending?.type !== "buy") return fail(input, "Nothing to buy");
      const tile = tileById(state.pending.tileId);
      const prop = getProp(state, tile.id);
      if (prop.ownerId) return fail(input, "Already owned");
      const price = tile.price ?? 0;
      if (player.money < price) return fail(input, "Not enough funds");
      player.money -= price;
      prop.ownerId = player.id;
      events.push({ type: "money", playerId: player.id, delta: -price, reason: "Purchase" });
      events.push({ type: "purchased", playerId: player.id, tileId: tile.id });
      pushLog(state, `${player.name} purchased ${tile.name}.`, events);
      maybeCompleteDistrict(state, player, tile.id, events);
      finishMove(state, player, events);
      return strip({ ok: true, state, events });
    }
    case "pass": {
      const err = asCurrent();
      if (err) return fail(input, err);
      if (state.pending?.type !== "buy") return fail(input, "Nothing to pass");
      pushLog(state, `${player.name} passed on ${tileById(state.pending.tileId).name}.`, events);
      finishMove(state, player, events);
      return strip({ ok: true, state, events });
    }
    case "acknowledge-card": {
      const err = asCurrent();
      if (err) return fail(input, err);
      if (state.pending?.type !== "card") return fail(input, "No card to resolve");
      const card = cardById(state.pending.cardId);
      const discard = state.pending.deck === "lucky" ? state.luckyDiscard : state.fundDiscard;
      if (card.effect.kind !== "get-out") discard.push(card.id);
      applyCardEffect(state, player, card.effect, events);
      return strip({ ok: true, state, events });
    }
    case "pay-timeout": {
      const err = asCurrent();
      if (err) return fail(input, err);
      if (!player.inTimeout) return fail(input, "You are not in Timeout Zone");
      const paid = tryDebit(
        state,
        player,
        state.settings.timeoutFine,
        "bank",
        "Timeout fine",
        events,
      );
      if (!paid) return strip({ ok: true, state, events });
      player.inTimeout = false;
      player.timeoutTurns = 0;
      state.pending = { type: "roll" };
      pushLog(state, `${player.name} paid the Timeout fine.`, events);
      return strip({ ok: true, state, events });
    }
    case "use-pass": {
      const err = asCurrent();
      if (err) return fail(input, err);
      if (!player.inTimeout) return fail(input, "You are not in Timeout Zone");
      if (player.getOutCards <= 0) return fail(input, "No Timeout Pass");
      player.getOutCards -= 1;
      player.inTimeout = false;
      player.timeoutTurns = 0;
      state.pending = { type: "roll" };
      pushLog(state, `${player.name} used a Timeout Pass.`, events);
      return strip({ ok: true, state, events });
    }
    case "build": {
      const err = asCurrent();
      if (err) return fail(input, err);
      if (state.pending?.type === "buy" || state.pending?.type === "card") {
        return fail(input, "Finish the current action first");
      }
      const reason = canBuild(state, player.id, action.tileId);
      if (reason) return fail(input, reason);
      const tile = tileById(action.tileId);
      const prop = getProp(state, action.tileId);
      player.money -= tile.buildCost!;
      prop.level += 1;
      events.push({
        type: "money",
        playerId: player.id,
        delta: -tile.buildCost!,
        reason: "Upgrade",
      });
      events.push({ type: "built", playerId: player.id, tileId: tile.id, level: prop.level });
      pushLog(state, `${player.name} upgraded ${tile.name} to level ${prop.level}.`, events);
      trySettleDebt(state, events);
      return strip({ ok: true, state, events });
    }
    case "mortgage": {
      if (player.isBankrupt) return fail(input, "Out of the game");
      const prop = getProp(state, action.tileId);
      if (prop.ownerId !== player.id) return fail(input, "You do not own this");
      if (prop.mortgaged) return fail(input, "Already mortgaged");
      if (prop.level > 0) return fail(input, "Sell upgrades first");
      const tile = tileById(action.tileId);
      const amount = Math.floor((tile.price ?? 0) / 2);
      prop.mortgaged = true;
      credit(state, player, amount, "Mortgage", events);
      pushLog(state, `${player.name} mortgaged ${tile.name}.`, events);
      trySettleDebt(state, events);
      return strip({ ok: true, state, events });
    }
    case "unmortgage": {
      const err = asCurrent();
      if (err) return fail(input, err);
      const prop = getProp(state, action.tileId);
      if (prop.ownerId !== player.id) return fail(input, "You do not own this");
      if (!prop.mortgaged) return fail(input, "Not mortgaged");
      const tile = tileById(action.tileId);
      const cost = Math.ceil((tile.price ?? 0) / 2 * 1.1);
      if (player.money < cost) return fail(input, "Not enough funds");
      player.money -= cost;
      prop.mortgaged = false;
      events.push({ type: "money", playerId: player.id, delta: -cost, reason: "Unmortgage" });
      pushLog(state, `${player.name} unmortgaged ${tile.name}.`, events);
      return strip({ ok: true, state, events });
    }
    case "sell-upgrade": {
      const prop = getProp(state, action.tileId);
      if (prop.ownerId !== player.id) return fail(input, "You do not own this");
      if (prop.level <= 0) return fail(input, "No upgrades to sell");
      const tile = tileById(action.tileId);
      if (tile.group) {
        const ids = GROUP_META[tile.group].ids;
        const max = Math.max(...ids.map((id) => getProp(state, id).level));
        if (prop.level < max) return fail(input, "Sell evenly across the district");
      }
      const refund = Math.floor((tile.buildCost ?? 0) / 2);
      prop.level -= 1;
      credit(state, player, refund, "Sold upgrade", events);
      pushLog(state, `${player.name} sold an upgrade on ${tile.name}.`, events);
      trySettleDebt(state, events);
      return strip({ ok: true, state, events });
    }
    case "propose-trade": {
      const err = asCurrent();
      if (err) return fail(input, err);
      if (state.pending?.type === "buy" || state.pending?.type === "card") {
        return fail(input, "Finish the current action first");
      }
      const target = state.players.find((p) => p.id === action.toId);
      if (!target || target.isBankrupt || target.id === player.id) {
        return fail(input, "Invalid trade partner");
      }
      if (action.offerMoney < 0 || action.requestMoney < 0) return fail(input, "Invalid money");
      if (player.money < action.offerMoney) return fail(input, "Not enough funds to offer");
      for (const id of action.offerTiles) {
        const prop = getProp(state, id);
        if (prop.ownerId !== player.id) return fail(input, "You do not own an offered property");
        if (prop.level > 0) return fail(input, "Sell upgrades before trading");
      }
      for (const id of action.requestTiles) {
        const prop = getProp(state, id);
        if (prop.ownerId !== target.id) return fail(input, "They do not own a requested property");
        if (prop.level > 0) return fail(input, "They must sell upgrades first");
      }
      state.trade = {
        id: `tr-${ctx.now}`,
        fromId: player.id,
        toId: target.id,
        offerMoney: action.offerMoney,
        requestMoney: action.requestMoney,
        offerTiles: action.offerTiles,
        requestTiles: action.requestTiles,
      };
      pushLog(state, `${player.name} proposed a trade to ${target.name}.`, events);
      return strip({ ok: true, state, events });
    }
    case "accept-trade": {
      if (!state.trade) return fail(input, "No trade pending");
      if (ctx.actorId !== state.trade.toId) return fail(input, "This trade is not for you");
      const trade = state.trade;
      const from = state.players.find((p) => p.id === trade.fromId);
      const to = state.players.find((p) => p.id === trade.toId);
      if (!from || !to || from.isBankrupt || to.isBankrupt) {
        state.trade = null;
        return fail(input, "Trade is no longer valid");
      }
      if (from.money < trade.offerMoney || to.money < trade.requestMoney) {
        return fail(input, "Someone cannot afford this trade");
      }
      from.money -= trade.offerMoney;
      to.money += trade.offerMoney;
      to.money -= trade.requestMoney;
      from.money += trade.requestMoney;
      if (trade.offerMoney) {
        events.push({ type: "money", playerId: from.id, delta: -trade.offerMoney, reason: "Trade" });
        events.push({ type: "money", playerId: to.id, delta: trade.offerMoney, reason: "Trade" });
      }
      if (trade.requestMoney) {
        events.push({ type: "money", playerId: to.id, delta: -trade.requestMoney, reason: "Trade" });
        events.push({ type: "money", playerId: from.id, delta: trade.requestMoney, reason: "Trade" });
      }
      for (const id of trade.offerTiles) getProp(state, id).ownerId = to.id;
      for (const id of trade.requestTiles) getProp(state, id).ownerId = from.id;
      pushLog(state, `${to.name} accepted a trade with ${from.name}.`, events);
      state.trade = null;
      return strip({ ok: true, state, events });
    }
    case "decline-trade": {
      if (!state.trade) return fail(input, "No trade pending");
      if (ctx.actorId !== state.trade.toId && ctx.actorId !== state.trade.fromId) {
        return fail(input, "Not your trade");
      }
      pushLog(state, `Trade declined.`, events);
      state.trade = null;
      return strip({ ok: true, state, events });
    }
    case "bankrupt": {
      const err = asCurrent();
      if (err) return fail(input, err);
      const creditor =
        state.pending?.type === "raise-funds" ? state.pending.creditorId : "bank";
      bankruptPlayer(state, player, creditor, events);
      if (state.phase !== "ended") advanceTurn(state, events, false);
      return strip({ ok: true, state, events });
    }
    default:
      return fail(input, "Unknown action");
  }
}

function strip(result: ApplyResult): ApplyResult {
  const s = result.state as StateWithRng;
  delete s.__rng;
  s.version = (s.version ?? 0) + 1;
  return result;
}

export function createMatch(opts: {
  id: string;
  players: Omit<Player, "position" | "money" | "isBankrupt" | "inTimeout" | "timeoutTurns" | "getOutCards" | "consecutiveDoubles" | "connected">[];
  settings?: Partial<GameSettings>;
  rng: Rng;
  now: number;
}): GameState {
  const settings = { ...DEFAULT_SETTINGS, ...opts.settings };
  const properties: Record<string, PropertyState> = {};
  for (const t of BOARD) {
    if (OWNABLE_KINDS.includes(t.kind)) {
      properties[String(t.id)] = { ownerId: null, level: 0, mortgaged: false };
    }
  }
  const players: Player[] = opts.players.map((p) => ({
    ...p,
    position: 0,
    money: settings.startingMoney,
    isBankrupt: false,
    inTimeout: false,
    timeoutTurns: 0,
    getOutCards: 0,
    consecutiveDoubles: 0,
    connected: true,
  }));
  const first = players[0];
  const state: GameState = {
    id: opts.id,
    phase: "playing",
    settings,
    players,
    currentPlayerIndex: 0,
    turnNumber: 1,
    properties,
    pending: { type: "roll" },
    lastDice: null,
    luckyDeck: opts.rng.shuffle(LUCKY_CARDS.map((c) => c.id)),
    fundDeck: opts.rng.shuffle(FUND_CARDS.map((c) => c.id)),
    luckyDiscard: [],
    fundDiscard: [],
    trade: null,
    winnerId: null,
    log: [],
    version: 1,
    turnStartedAt: opts.now,
    doubleRentFor: null,
    extraTurn: false,
    logSeq: 0,
  };
  if (first) {
    state.logSeq = 1;
    state.log.push({ id: 1, turn: 1, text: `${first.name}'s turn.` });
  }
  return state;
}

export function autoResolveIfNeeded(state: GameState, ctx: ActionContext): ApplyResult | null {
  const pending = state.pending;
  const player = currentPlayer(state);
  if (player.id !== ctx.actorId) return null;
  if (pending?.type === "card" && ALL_CARDS[pending.cardId]) {
    return applyAction(state, { type: "acknowledge-card" }, ctx);
  }
  return null;
}

export function legalManagement(state: GameState, playerId: string) {
  const builds: number[] = [];
  const mortgages: number[] = [];
  const unmortgages: number[] = [];
  const sells: number[] = [];
  for (const id of ownedTileIds(state, playerId)) {
    if (!canBuild(state, playerId, id)) builds.push(id);
    const prop = getProp(state, id);
    if (!prop.mortgaged && prop.level === 0) mortgages.push(id);
    if (prop.mortgaged) unmortgages.push(id);
    if (prop.level > 0) sells.push(id);
  }
  return { builds, mortgages, unmortgages, sells };
}

export function pendingLabel(pending: PendingAction | null): string {
  if (!pending) return "";
  switch (pending.type) {
    case "roll":
      return "Roll the dice";
    case "buy":
      return "Buy or pass";
    case "card":
      return "Event card";
    case "raise-funds":
      return "Raise funds";
    case "timeout-choice":
      return "Timeout Zone";
  }
}
