-- To-dos: wishes and bug reports for the app itself, written from inside it.

create table house.todos (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(text) between 1 and 2000),
  done boolean not null default false,
  author text default lower(auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on house.todos to authenticated;

alter table house.todos enable row level security;

create policy "allowed users" on house.todos
  for all to authenticated using (house.is_allowed()) with check (house.is_allowed());

alter publication supabase_realtime add table house.todos;
