-- Ozopoly game data. user_id columns are TEXT (Better Auth ids / guest ids).

create table if not exists profiles (
  user_id text primary key,
  username text not null,
  avatar text not null default 'crown',
  token text not null default 'crown',
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  games_played integer not null default 0,
  games_won integer not null default 0,
  total_money_earned bigint not null default 0,
  total_properties_owned integer not null default 0,
  best_net_worth bigint not null default 0,
  current_streak integer not null default 0,
  achievements text not null default '[]'
);

create table if not exists guest_identities (
  id text primary key,
  secret text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists game_rooms (
  id text primary key,
  room_code text not null unique,
  host_id text not null,
  status text not null default 'lobby',
  is_private boolean not null default true,
  max_players integer not null default 4,
  settings jsonb not null default '{}'::jsonb,
  state jsonb,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists game_rooms_status_idx on game_rooms (status, is_private, updated_at desc);
create index if not exists game_rooms_host_idx on game_rooms (host_id);

create table if not exists game_members (
  id text primary key,
  room_id text not null references game_rooms(id) on delete cascade,
  player_id text not null,
  player_name text not null,
  player_color text not null,
  player_token text not null,
  is_ai boolean not null default false,
  ai_difficulty text,
  is_host boolean not null default false,
  is_ready boolean not null default false,
  player_order integer not null default 0,
  last_seen timestamptz not null default now(),
  unique (room_id, player_id)
);

create index if not exists game_members_room_idx on game_members (room_id);

create table if not exists game_chat (
  id serial primary key,
  room_id text not null references game_rooms(id) on delete cascade,
  player_id text not null,
  player_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists game_chat_room_idx on game_chat (room_id, created_at desc);
