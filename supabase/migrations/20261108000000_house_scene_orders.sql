-- Each person's own scenes on the phone: the ones shown over the rooms in order, then the rest of the list, by scene id.

create table house.scene_orders (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  main text[] not null default '{}',
  minor text[] not null default '{}',
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on house.scene_orders to authenticated;

alter table house.scene_orders enable row level security;

create policy "own order" on house.scene_orders
  for all to authenticated
  using (house.is_allowed() and user_id = auth.uid())
  with check (house.is_allowed() and user_id = auth.uid());
