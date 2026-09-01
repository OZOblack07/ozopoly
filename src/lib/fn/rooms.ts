import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { optionalAuth } from "@/lib/server/optional-auth";
import { resolveActor } from "./identity";
import {
  DEFAULT_SETTINGS,
  PLAYER_COLORS,
  TOKEN_LIST,
  type AiDifficulty,
  type GameState,
  type TokenId,
} from "@/lib/game/types";
import { applyAction, createMatch, netWorthOf, ownedTileIds } from "@/lib/game/engine";
import { pickAiAction } from "@/lib/game/ai";
import { createRng } from "@/lib/game/rng";

const guestCreds = {
  guestId: z.string().optional(),
  guestSecret: z.string().optional(),
  name: z.string().max(20).optional(),
};

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const buf = new Uint32Array(4);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 4; i++) s += alphabet[buf[i]! % alphabet.length];
  return `OZO-${s}`;
}

function memberId() {
  return crypto.randomUUID();
}

type MemberRow = {
  id: string;
  room_id: string;
  player_id: string;
  player_name: string;
  player_color: string;
  player_token: string;
  is_ai: boolean;
  ai_difficulty: string | null;
  is_host: boolean;
  is_ready: boolean;
  player_order: number;
  last_seen: string;
};

type RoomRow = {
  id: string;
  room_code: string;
  host_id: string;
  status: string;
  is_private: boolean;
  max_players: number;
  settings: unknown;
  state: unknown;
  version: number;
};

export type ChatRow = {
  id: number;
  player_id: string;
  player_name: string;
  message: string;
  created_at: string;
};

async function loadRoom(code: string) {
  const sql = await getSql();
  const rooms = await sql<RoomRow>`select id, room_code, host_id, status, is_private, max_players, settings, state, version
    from game_rooms where room_code = ${code.toUpperCase()}`;
  const room = rooms[0];
  if (!room) return null;
  const members = await sql<MemberRow>`select * from game_members where room_id = ${room.id} order by player_order`;
  return { room, members };
}

async function touchMember(roomId: string, playerId: string) {
  const sql = await getSql();
  await sql`update game_members set last_seen = now() where room_id = ${roomId} and player_id = ${playerId}`;
}

function parseState(raw: unknown): GameState | null {
  if (!raw) return null;
  if (typeof raw === "string") return JSON.parse(raw) as GameState;
  return raw as GameState;
}

function parseSettings(raw: unknown) {
  if (!raw) return { ...DEFAULT_SETTINGS };
  if (typeof raw === "string") return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  return { ...DEFAULT_SETTINGS, ...(raw as object) };
}

export const createRoom = createServerFn({ method: "POST" })
  .middleware([optionalAuth])
  .validator(
    z.object({
      ...guestCreds,
      maxPlayers: z.number().min(2).max(4),
      startingMoney: z.number().min(500_000).max(5_000_000),
      turnTimerSec: z.number().min(0).max(120),
      isPrivate: z.boolean(),
      token: z.string().optional(),
      color: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const actor = await resolveActor(context, data);
    const sql = await getSql();
    let code = roomCode();
    for (let i = 0; i < 6; i++) {
      const clash = await sql<{ c: number }>`select count(*)::int as c from game_rooms where room_code = ${code}`;
      if (!clash[0]?.c) break;
      code = roomCode();
    }
    const id = crypto.randomUUID();
    const settings = {
      ...DEFAULT_SETTINGS,
      startingMoney: data.startingMoney,
      turnTimerSec: data.turnTimerSec,
      maxPlayers: data.maxPlayers,
    };
    const token = TOKEN_LIST.includes(data.token as TokenId) ? (data.token as TokenId) : "crown";
    await sql`insert into game_rooms (id, room_code, host_id, status, is_private, max_players, settings)
      values (${id}, ${code}, ${actor.id}, 'lobby', ${data.isPrivate}, ${data.maxPlayers}, ${JSON.stringify(settings)}::jsonb)`;
    await sql`insert into game_members (id, room_id, player_id, player_name, player_color, player_token, is_host, is_ready, player_order)
      values (${memberId()}, ${id}, ${actor.id}, ${actor.name}, ${PLAYER_COLORS[0]}, ${token}, true, true, 0)`;
    return { roomCode: code, roomId: id };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .middleware([optionalAuth])
  .validator(z.object({ ...guestCreds, roomCode: z.string().min(4).max(12), token: z.string().optional() }))
  .handler(async ({ data, context }) => {
    const actor = await resolveActor(context, data);
    const loaded = await loadRoom(data.roomCode);
    if (!loaded) throw new Error("That room code does not exist.");
    const { room, members } = loaded;
    if (room.status !== "lobby") {
      const existing = members.find((m) => m.player_id === actor.id);
      if (existing) return { roomCode: room.room_code, rejoin: true };
      throw new Error("That game has already started.");
    }
    const humans = members.filter((m) => !m.is_ai);
    if (humans.some((m) => m.player_id === actor.id)) return { roomCode: room.room_code, rejoin: true };
    if (members.length >= room.max_players) throw new Error("This room is full.");
    const usedColors = new Set(members.map((m) => m.player_color));
    const color = PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? PLAYER_COLORS[0]!;
    const usedTokens = new Set(members.map((m) => m.player_token));
    const preferred = TOKEN_LIST.includes(data.token as TokenId) ? (data.token as TokenId) : actor.token;
    const token = usedTokens.has(preferred)
      ? (TOKEN_LIST.find((t) => !usedTokens.has(t)) ?? "bolt")
      : preferred;
    const sql = await getSql();
    await sql`insert into game_members (id, room_id, player_id, player_name, player_color, player_token, is_host, is_ready, player_order)
      values (${memberId()}, ${room.id}, ${actor.id}, ${actor.name}, ${color}, ${token}, false, false, ${members.length})`;
    await sql`update game_rooms set updated_at = now() where id = ${room.id}`;
    return { roomCode: room.room_code, rejoin: false };
  });

export const quickMatch = createServerFn({ method: "POST" })
  .middleware([optionalAuth])
  .validator(z.object({ ...guestCreds, token: z.string().optional() }))
  .handler(async ({ data, context }) => {
    const actor = await resolveActor(context, data);
    const sql = await getSql();
    const open = await sql<{ room_code: string }>`
      select r.room_code from game_rooms r
      where r.status = 'lobby' and r.is_private = false
      and (select count(*) from game_members m where m.room_id = r.id) < r.max_players
      order by r.created_at asc
      limit 1`;
    if (open[0]) {
      return joinRoom({
        data: { ...data, roomCode: open[0].room_code, token: data.token },
      });
    }
    return createRoom({
      data: {
        ...data,
        maxPlayers: 4,
        startingMoney: DEFAULT_SETTINGS.startingMoney,
        turnTimerSec: 45,
        isPrivate: false,
        token: data.token,
      },
    });
  });

export const setReady = createServerFn({ method: "POST" })
  .middleware([optionalAuth])
  .validator(z.object({ ...guestCreds, roomCode: z.string(), ready: z.boolean() }))
  .handler(async ({ data, context }) => {
    const actor = await resolveActor(context, data);
    const loaded = await loadRoom(data.roomCode);
    if (!loaded) throw new Error("Room not found");
    const sql = await getSql();
    await sql`update game_members set is_ready = ${data.ready}, last_seen = now()
      where room_id = ${loaded.room.id} and player_id = ${actor.id}`;
    return { ok: true };
  });

export const addAiSlot = createServerFn({ method: "POST" })
  .middleware([optionalAuth])
  .validator(
    z.object({
      ...guestCreds,
      roomCode: z.string(),
      difficulty: z.enum(["easy", "normal", "hard", "expert"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const actor = await resolveActor(context, data);
    const loaded = await loadRoom(data.roomCode);
    if (!loaded) throw new Error("Room not found");
    if (loaded.room.host_id !== actor.id) throw new Error("Only the host can add computer players.");
    if (loaded.room.status !== "lobby") throw new Error("Game already started");
    if (loaded.members.length >= loaded.room.max_players) throw new Error("Room is full");
    const names = ["Nova", "Kade", "Imani", "Riven", "Sol", "Vex"];
    const used = new Set(loaded.members.map((m) => m.player_name));
    const name = names.find((n) => !used.has(n)) ?? `CPU ${loaded.members.length}`;
    const usedColors = new Set(loaded.members.map((m) => m.player_color));
    const color = PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? PLAYER_COLORS[3]!;
    const usedTokens = new Set(loaded.members.map((m) => m.player_token));
    const token = TOKEN_LIST.find((t) => !usedTokens.has(t)) ?? "bolt";
    const sql = await getSql();
    await sql`insert into game_members (id, room_id, player_id, player_name, player_color, player_token, is_ai, ai_difficulty, is_ready, player_order)
      values (${memberId()}, ${loaded.room.id}, ${"ai-" + crypto.randomUUID()}, ${name}, ${color}, ${token}, true, ${data.difficulty}, true, ${loaded.members.length})`;
    return { ok: true };
  });

export const startGame = createServerFn({ method: "POST" })
  .middleware([optionalAuth])
  .validator(z.object({ ...guestCreds, roomCode: z.string() }))
  .handler(async ({ data, context }) => {
    const actor = await resolveActor(context, data);
    const loaded = await loadRoom(data.roomCode);
    if (!loaded) throw new Error("Room not found");
    if (loaded.room.host_id !== actor.id) throw new Error("Only the host can start.");
    if (loaded.members.length < 2) throw new Error("Need at least two players.");
    const humans = loaded.members.filter((m) => !m.is_ai);
    if (humans.some((m) => !m.is_ready)) throw new Error("Every player must be ready.");
    const settings = parseSettings(loaded.room.settings);
    const rng = createRng();
    const state = createMatch({
      id: loaded.room.id,
      now: Date.now(),
      rng,
      settings,
      players: loaded.members.map((m) => ({
        id: m.player_id,
        name: m.player_name,
        color: m.player_color,
        token: m.player_token as TokenId,
        isAi: m.is_ai,
        aiDifficulty: (m.ai_difficulty as AiDifficulty) || undefined,
      })),
    });
    const sql = await getSql();
    await sql`update game_rooms set status = 'playing', state = ${JSON.stringify(state)}::jsonb, version = ${state.version}, updated_at = now()
      where id = ${loaded.room.id} and status = 'lobby'`;
    return { ok: true };
  });

export const getRoom = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .validator(
    z.object({
      ...guestCreds,
      roomCode: z.string(),
      sinceVersion: z.number().optional(),
      sinceChatId: z.number().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const actor = await resolveActor(context, data);
    const loaded = await loadRoom(data.roomCode);
    if (!loaded) throw new Error("Room not found");
    const member = loaded.members.find((m) => m.player_id === actor.id);
    if (!member) throw new Error("You are not in this room.");
    await touchMember(loaded.room.id, actor.id);

    let state = parseState(loaded.room.state);
    if (loaded.room.status === "playing" && state && state.phase === "playing") {
      state = await maybeAdvanceAiAndTimer(loaded.room.id, loaded.room.version, state);
    }

    const sql = await getSql();
    const chat = await sql<ChatRow>`
      select id, player_id, player_name, message, created_at
      from game_chat where room_id = ${loaded.room.id}
      and id > ${data.sinceChatId ?? 0}
      order by id asc
      limit 40`;

    const unchanged =
      data.sinceVersion != null && state != null && state.version === data.sinceVersion;

    return {
      roomCode: loaded.room.room_code,
      status: state?.phase === "ended" ? "ended" : loaded.room.status,
      hostId: loaded.room.host_id,
      maxPlayers: loaded.room.max_players,
      isPrivate: loaded.room.is_private,
      settings: parseSettings(loaded.room.settings),
      members: loaded.members.map((m) => ({
        playerId: m.player_id,
        name: m.player_name,
        color: m.player_color,
        token: m.player_token,
        isAi: m.is_ai,
        aiDifficulty: m.ai_difficulty,
        isHost: m.is_host,
        isReady: m.is_ready,
        lastSeen: m.last_seen,
      })),
      youId: actor.id,
      youName: actor.name,
      state: unchanged ? null : state,
      version: state?.version ?? loaded.room.version,
      chat,
    };
  });

async function recordStats(state: GameState) {
  if (state.phase !== "ended" || !state.winnerId) return;
  const sql = await getSql();
  for (const p of state.players) {
    if (p.isAi || p.id.startsWith("ai-")) continue;
    const won = p.id === state.winnerId;
    const props = ownedTileIds(state, p.id).length;
    const nw = netWorthOf(state, p.id);
    await sql`update profiles set
      games_played = games_played + 1,
      games_won = games_won + ${won ? 1 : 0},
      total_money_earned = total_money_earned + ${p.money},
      total_properties_owned = total_properties_owned + ${props},
      best_net_worth = case when ${nw} > best_net_worth then ${nw} else best_net_worth end,
      current_streak = case when ${won} then current_streak + 1 else 0 end
      where user_id = ${p.id} and is_guest = false`;
  }
}

async function maybeAdvanceAiAndTimer(
  roomId: string,
  version: number,
  state: GameState,
): Promise<GameState> {
  let current = state;
  const rng = createRng();
  const now = Date.now();
  for (let step = 0; step < 6; step++) {
    if (current.phase !== "playing") break;
    const player = current.players[current.currentPlayerIndex];
    if (!player || player.isBankrupt) break;

    const timedOut =
      current.settings.turnTimerSec > 0 &&
      now - current.turnStartedAt > current.settings.turnTimerSec * 1000;

    let action = null as ReturnType<typeof pickAiAction>;
    if (player.isAi) {
      action = pickAiAction(current, player.id);
    } else if (timedOut) {
      action = pickAiAction({ ...current, players: current.players.map((p) => (p.id === player.id ? { ...p, aiDifficulty: "easy" as const, isAi: true } : p)) }, player.id);
    }
    if (!action) break;
    const result = applyAction(current, action, { actorId: player.id, rng, now });
    if (!result.ok) break;
    current = result.state;
  }
  if (current.version !== version) {
    const sql = await getSql();
    const ended = current.phase === "ended";
    await sql`update game_rooms set state = ${JSON.stringify(current)}::jsonb, version = ${current.version},
      status = ${ended ? "ended" : "playing"}, updated_at = now()
      where id = ${roomId} and version = ${version}`;
    if (ended) await recordStats(current);
  }
  return current;
}

export const playAction = createServerFn({ method: "POST" })
  .middleware([optionalAuth])
  .validator(
    z.object({
      ...guestCreds,
      roomCode: z.string(),
      action: z.unknown(),
    }),
  )
  .handler(async ({ data, context }) => {
    const actor = await resolveActor(context, data);
    const loaded = await loadRoom(data.roomCode);
    if (!loaded) throw new Error("Room not found");
    if (loaded.room.status !== "playing") throw new Error("Game is not in progress");
    const member = loaded.members.find((m) => m.player_id === actor.id);
    if (!member) throw new Error("You are not in this room.");
    const state = parseState(loaded.room.state);
    if (!state) throw new Error("Missing game state");
    const action = data.action as Parameters<typeof applyAction>[1];
    if (!action || typeof action !== "object" || !("type" in action)) {
      throw new Error("Invalid action");
    }
    const result = applyAction(state, action, {
      actorId: actor.id,
      rng: createRng(),
      now: Date.now(),
    });
    if (!result.ok) throw new Error(result.error ?? "That move is not allowed.");
    const sql = await getSql();
    const ended = result.state.phase === "ended";
    const updated = await sql<{ id: string }>`update game_rooms
      set state = ${JSON.stringify(result.state)}::jsonb, version = ${result.state.version},
          status = ${ended ? "ended" : "playing"}, updated_at = now()
      where id = ${loaded.room.id} and version = ${loaded.room.version}
      returning id`;
    if (!updated[0]) throw new Error("The board changed. Try again.");
    if (ended) await recordStats(result.state);
    await touchMember(loaded.room.id, actor.id);
    return { state: result.state, events: result.events };
  });

export const sendChat = createServerFn({ method: "POST" })
  .middleware([optionalAuth])
  .validator(
    z.object({
      ...guestCreds,
      roomCode: z.string(),
      message: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ data, context }) => {
    const actor = await resolveActor(context, data);
    const loaded = await loadRoom(data.roomCode);
    if (!loaded) throw new Error("Room not found");
    const member = loaded.members.find((m) => m.player_id === actor.id);
    if (!member) throw new Error("You are not in this room.");
    const text = data.message.trim();
    if (!text) throw new Error("Empty message");
    const sql = await getSql();
    const recent = await sql<{ created_at: string }>`
      select created_at from game_chat
      where room_id = ${loaded.room.id} and player_id = ${actor.id}
      order by id desc limit 1`;
    if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < 900) {
      throw new Error("Slow down a little.");
    }
    await sql`insert into game_chat (room_id, player_id, player_name, message)
      values (${loaded.room.id}, ${actor.id}, ${actor.name}, ${text})`;
    return { ok: true };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .middleware([optionalAuth])
  .validator(z.object({ ...guestCreds, roomCode: z.string() }))
  .handler(async ({ data, context }) => {
    const actor = await resolveActor(context, data);
    const loaded = await loadRoom(data.roomCode);
    if (!loaded) return { ok: true };
    const sql = await getSql();
    if (loaded.room.status === "lobby") {
      await sql`delete from game_members where room_id = ${loaded.room.id} and player_id = ${actor.id}`;
      if (loaded.room.host_id === actor.id) {
        const next = loaded.members.find((m) => m.player_id !== actor.id && !m.is_ai);
        if (next) {
          await sql`update game_rooms set host_id = ${next.player_id}, updated_at = now() where id = ${loaded.room.id}`;
          await sql`update game_members set is_host = true where id = ${next.id}`;
        } else {
          await sql`delete from game_rooms where id = ${loaded.room.id}`;
        }
      }
    }
    return { ok: true };
  });
