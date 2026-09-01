# OZOPOLY

Premium original property-trading board game. Roll. Build. Dominate.

This app runs on **TanStack Start + React + Neon Postgres** (PGLite in the live preview). Online matches are **server-authoritative**: dice, cash, ownership, and turns are validated in server functions, not in the browser.

## Play

- **Versus computer** — full local match with Easy / Normal / Hard / Expert AI. No account required.
- **Online / private / quick match** — create or join a room. Guests get a server-issued identity; signed-in players keep stats.

## Local development

```bash
npm install
npm run dev
```

The preview binds `0.0.0.0:8080`.

## Database

Schema lives in `migrations/`:

1. `0001_auth.sql` — Better Auth (copied from `migrations/auth/`)
2. `0002_ozopoly.sql` — profiles, rooms, members, chat, guest identities

Preview uses embedded PGLite and applies migrations on startup. Production uses Neon via `DATABASE_URL` (injected on deploy; do not write a `.env` file).

## Authentication

Sign-in is enabled:

- Google and X through the Grok auth broker
- Email + password (`src/lib/auth/email-password.ts`)

Guest play works for versus-computer and online rooms via `guest_identities`. Leaderboard rows are signed-in players only.

## Multiplayer

1. Player A: **Play → Private room → Create**.
2. Copy the `OZO-XXXX` code.
3. Player B: **Join with code**.
4. Ready up. Host starts.
5. Turns, dice, purchases, rent, trades, and chat sync through Postgres + polling (~900ms). Reconnect keeps your seat.

Important mutations go through `playAction` and `applyAction` in `src/lib/game/engine.ts`. Clients cannot pick dice results or edit money.

## Environment

No secrets belong in the client. Deploy injects:

- `DATABASE_URL` — Neon
- Auth broker credentials

Optional: `VITE_STUN_URLS` (unused; this game is not WebRTC).

There is **no Supabase service-role key**. Realtime is implemented with durable Postgres state + authenticated server functions rather than a client-writable socket.

## Deploy (Vercel)

```bash
npm run build
```

The platform provisions Neon, applies migrations, and serves the production build.

## Project map

- `src/lib/game/` — board, cards, engine, AI (shared by client and server)
- `src/lib/fn/` — room, identity, and profile server functions
- `src/components/game/` — board, dice, HUD, modals
- `src/routes/` — pages (`/`, `/play`, `/room/$code`, `/profile`, `/leaderboard`)
