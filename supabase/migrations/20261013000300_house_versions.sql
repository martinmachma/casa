-- Versions: each save of the editor is a new, unchanging snapshot of everything placed in the house (wall paint,
-- floor finishes, furniture). One of them, or none (the bare house), is "live": the current state of the house.
-- Replaces the per-item tables walls, room_floors and furniture_items, which stay until main no longer reads them.

create table house.versions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  -- { walls: [{ wallId, side, color }], floors: [{ roomId, material }], furniture: [FurnitureItem] }
  data jsonb not null,
  based_on uuid references house.versions (id) on delete set null,
  author text default lower(auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);

-- A single row pointing at the live version; null means the bare house.
create table house.live_version (
  id boolean primary key default true check (id),
  version_id uuid references house.versions (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into house.live_version (id, version_id) values (true, null);

create trigger live_version_touch before update on house.live_version
  for each row execute function house.touch_updated_at();

grant select, insert, delete on house.versions to authenticated;
grant select, update on house.live_version to authenticated;

alter table house.versions enable row level security;
alter table house.live_version enable row level security;

create policy "allowed users" on house.versions
  for all to authenticated using (house.is_allowed()) with check (house.is_allowed());
create policy "allowed users" on house.live_version
  for all to authenticated using (house.is_allowed()) with check (house.is_allowed());

alter publication supabase_realtime add table house.versions, house.live_version;
