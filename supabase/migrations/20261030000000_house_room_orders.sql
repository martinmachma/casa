-- Each person's own order of the room menu: the big rooms, then the small ones, by room id.

create table house.room_orders (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  main text[] not null default '{}',
  minor text[] not null default '{}',
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on house.room_orders to authenticated;

alter table house.room_orders enable row level security;

create policy "own order" on house.room_orders
  for all to authenticated
  using (house.is_allowed() and user_id = auth.uid())
  with check (house.is_allowed() and user_id = auth.uid());
