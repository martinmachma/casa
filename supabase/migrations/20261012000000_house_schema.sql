-- Casa: everything lives in the `house` schema so it never collides with Haru's tables.
-- Access: a signed-in user whose email is in house.allowed_emails. Enforced by RLS on every table.

create schema if not exists house;

-- ── Allow list ──────────────────────────────────────────────────────────────
create table house.allowed_emails (
  email text primary key check (email = lower(email)),
  note text,
  created_at timestamptz not null default now()
);

-- security definer so policies can read the allow list without granting it to clients.
create or replace function house.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from house.allowed_emails
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function house.is_allowed() from public;
grant execute on function house.is_allowed() to authenticated;

-- ── Layout metadata ─────────────────────────────────────────────────────────
-- The geometry itself lives in the app (src/layout/house.json); these ids match that file.
create table house.rooms (
  id text primary key,                 -- layout room id, e.g. 'g-living'
  floor text not null,                 -- layout floor id, e.g. 'ground'
  name text not null,
  notes text,
  updated_at timestamptz not null default now()
);

-- ── Colour schemes ──────────────────────────────────────────────────────────
-- A scheme is a full set of wall colours, so alternatives can be compared later.
create table house.color_schemes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index color_schemes_one_active on house.color_schemes (is_active) where is_active;

-- ── Walls: the paint on each face of a layout wall, per scheme ──────────────
create table house.walls (
  scheme_id uuid not null references house.color_schemes (id) on delete cascade,
  wall_id text not null,               -- layout wall id, e.g. 'g-north'
  side text not null check (side in ('a', 'b')),  -- 'a' = left of from→to, 'b' = right
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (scheme_id, wall_id, side)
);

-- ── Furniture ───────────────────────────────────────────────────────────────
create table house.furniture_items (
  id uuid primary key default gen_random_uuid(),
  floor text not null,                 -- layout floor id
  name text not null default 'Box',
  width numeric not null check (width > 0),    -- metres, along the item's x axis
  depth numeric not null check (depth > 0),
  height numeric not null check (height > 0),
  x numeric not null default 0,        -- plan position of the centre, metres
  y numeric not null default 0,
  rotation numeric not null default 0, -- radians, plan angle
  color text not null default '#b9a58c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index furniture_items_floor on house.furniture_items (floor);

create or replace function house.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rooms_touch before update on house.rooms
  for each row execute function house.touch_updated_at();
create trigger walls_touch before update on house.walls
  for each row execute function house.touch_updated_at();
create trigger furniture_touch before update on house.furniture_items
  for each row execute function house.touch_updated_at();

-- ── Privileges + RLS ────────────────────────────────────────────────────────
grant usage on schema house to authenticated;
grant select, insert, update, delete on house.rooms, house.color_schemes, house.walls, house.furniture_items
  to authenticated;
grant select on house.allowed_emails to authenticated;

alter table house.allowed_emails enable row level security;
alter table house.rooms enable row level security;
alter table house.color_schemes enable row level security;
alter table house.walls enable row level security;
alter table house.furniture_items enable row level security;

-- The allow list is edited in SQL only; a user may see just their own row.
create policy "own row" on house.allowed_emails
  for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "allowed users" on house.rooms
  for all to authenticated using (house.is_allowed()) with check (house.is_allowed());
create policy "allowed users" on house.color_schemes
  for all to authenticated using (house.is_allowed()) with check (house.is_allowed());
create policy "allowed users" on house.walls
  for all to authenticated using (house.is_allowed()) with check (house.is_allowed());
create policy "allowed users" on house.furniture_items
  for all to authenticated using (house.is_allowed()) with check (house.is_allowed());

-- ── Storage bucket `house` (private) ────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('house', 'house', false)
on conflict (id) do nothing;

create policy "house bucket: allowed users read" on storage.objects
  for select to authenticated using (bucket_id = 'house' and house.is_allowed());
create policy "house bucket: allowed users insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'house' and house.is_allowed());
create policy "house bucket: allowed users update" on storage.objects
  for update to authenticated
  using (bucket_id = 'house' and house.is_allowed())
  with check (bucket_id = 'house' and house.is_allowed());
create policy "house bucket: allowed users delete" on storage.objects
  for delete to authenticated using (bucket_id = 'house' and house.is_allowed());

-- ── Seed ────────────────────────────────────────────────────────────────────
insert into house.color_schemes (name, is_active) values ('Default', true);

-- Add the two of you (lower-case). Edit and run after the migration:
-- insert into house.allowed_emails (email, note) values
--   ('martin@example.com', 'Martin'),
--   ('her@example.com', 'Her');
