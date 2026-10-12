-- Floor material per room, per colour scheme (like wall colours), synced live.

create table house.room_floors (
  scheme_id uuid not null references house.color_schemes (id) on delete cascade,
  room_id text not null,               -- layout room id, e.g. 'g-living'
  material text not null check (material ~ '^[a-z0-9-]{1,40}$'),  -- app material id, e.g. 'oak'
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (scheme_id, room_id)
);

create trigger room_floors_touch before update on house.room_floors
  for each row execute function house.touch_updated_at();

grant select, insert, update, delete on house.room_floors to authenticated;
alter table house.room_floors enable row level security;
create policy "allowed users" on house.room_floors
  for all to authenticated using (house.is_allowed()) with check (house.is_allowed());

alter publication supabase_realtime add table house.room_floors;
