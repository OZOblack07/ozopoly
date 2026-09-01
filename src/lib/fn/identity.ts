import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { optionalAuth } from "@/lib/server/optional-auth";
import { getSql } from "@/lib/db";
import { TOKEN_LIST, type TokenId } from "@/lib/game/types";

function randomId() {
  return crypto.randomUUID();
}

function randomName() {
  const n = 1000 + Math.floor(Math.random() * 9000);
  return `Guest_${n}`;
}

function sanitizeName(raw: string) {
  const cleaned = raw.replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 20);
  return cleaned || randomName();
}

export type Actor = {
  id: string;
  name: string;
  isGuest: boolean;
  email: string | null;
  token: TokenId;
  avatar: string;
};

async function upsertProfile(
  userId: string,
  name: string,
  isGuest: boolean,
  token?: string,
): Promise<Actor> {
  const sql = await getSql();
  const safeToken = TOKEN_LIST.includes(token as TokenId) ? (token as TokenId) : "crown";
  const existing = await sql<{
    user_id: string;
    username: string;
    token: string;
    avatar: string;
    is_guest: boolean;
  }>`select user_id, username, token, avatar, is_guest from profiles where user_id = ${userId}`;
  if (existing[0]) {
    if (!existing[0].is_guest && name && name !== existing[0].username) {
      await sql`update profiles set username = ${sanitizeName(name)} where user_id = ${userId}`;
      return {
        id: userId,
        name: sanitizeName(name),
        isGuest: false,
        email: null,
        token: existing[0].token as TokenId,
        avatar: existing[0].avatar,
      };
    }
    return {
      id: userId,
      name: existing[0].username,
      isGuest: existing[0].is_guest,
      email: null,
      token: existing[0].token as TokenId,
      avatar: existing[0].avatar,
    };
  }
  const username = sanitizeName(name);
  await sql`insert into profiles (user_id, username, avatar, token, is_guest)
    values (${userId}, ${username}, ${safeToken}, ${safeToken}, ${isGuest})`;
  return {
    id: userId,
    name: username,
    isGuest,
    email: null,
    token: safeToken,
    avatar: safeToken,
  };
}

export async function resolveActor(
  context: { userId: string | null; email: string | null },
  guest?: { guestId?: string; guestSecret?: string; name?: string },
): Promise<Actor> {
  if (context.userId) {
    const fallback = context.email?.split("@")[0] ?? "Player";
    return upsertProfile(context.userId, guest?.name || fallback, false);
  }
  const sql = await getSql();
  if (guest?.guestId && guest.guestSecret) {
    const rows = await sql<{ id: string; name: string; secret: string }>`
      select id, name, secret from guest_identities where id = ${guest.guestId}`;
    if (rows[0] && rows[0].secret === guest.guestSecret) {
      return upsertProfile(rows[0].id, rows[0].name, true);
    }
  }
  throw new Error("Please continue as guest or sign in.");
}

export const ensureGuest = createServerFn({ method: "POST" })
  .middleware([optionalAuth])
  .validator(
    z.object({
      name: z.string().max(20).optional(),
      guestId: z.string().optional(),
      guestSecret: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (context.userId) {
      const actor = await resolveActor(context, { name: data.name });
      return { ...actor, guestSecret: null as string | null };
    }
    const sql = await getSql();
    if (data.guestId && data.guestSecret) {
      const rows = await sql<{ id: string; name: string; secret: string }>`
        select id, name, secret from guest_identities where id = ${data.guestId}`;
      if (rows[0] && rows[0].secret === data.guestSecret) {
        const actor = await upsertProfile(rows[0].id, data.name || rows[0].name, true);
        return { ...actor, guestSecret: data.guestSecret };
      }
    }
    const id = randomId();
    const secret = randomId() + randomId();
    const name = sanitizeName(data.name || randomName());
    await sql`insert into guest_identities (id, secret, name) values (${id}, ${secret}, ${name})`;
    const actor = await upsertProfile(id, name, true);
    return { ...actor, guestSecret: secret };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .handler(async ({ context }) => {
    if (!context.userId) return null;
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      username: string;
      avatar: string;
      token: string;
      games_played: number;
      games_won: number;
      total_money_earned: number;
      total_properties_owned: number;
      best_net_worth: number;
      current_streak: number;
      achievements: string;
      created_at: string;
    }>`select user_id, username, avatar, token, games_played, games_won,
       total_money_earned, total_properties_owned, best_net_worth, current_streak,
       achievements, created_at from profiles where user_id = ${context.userId}`;
    return rows[0] ?? null;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([optionalAuth])
  .validator(
    z.object({
      username: z.string().min(2).max(20),
      token: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!context.userId) throw new Error("Sign in to edit your profile.");
    const sql = await getSql();
    const token = TOKEN_LIST.includes(data.token as TokenId) ? data.token : "crown";
    await sql`update profiles set username = ${sanitizeName(data.username)}, token = ${token}, avatar = ${token}
      where user_id = ${context.userId}`;
    return { ok: true };
  });

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  return sql<{
    user_id: string;
    username: string;
    token: string;
    games_played: number;
    games_won: number;
    total_money_earned: number;
    best_net_worth: number;
    current_streak: number;
  }>`select user_id, username, token, games_played, games_won, total_money_earned, best_net_worth, current_streak
     from profiles
     where is_guest = false and games_played > 0
     order by games_won desc, games_played asc, best_net_worth desc
     limit 25`;
});
