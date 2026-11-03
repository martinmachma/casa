-- A short name shown next to each person's avatar.
alter table house.allowed_emails add column if not exists nickname text;

update house.allowed_emails set nickname = 'Martin' where email = '123martin.mach@gmail.com';
update house.allowed_emails set nickname = 'Sara' where email = 'sarapm19@gmail.com';

-- The signed-in user's nickname; security definer as the allow list isn't readable by clients.
create or replace function house.my_nickname()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nickname from house.allowed_emails
  where email = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

revoke all on function house.my_nickname() from public;
grant execute on function house.my_nickname() to authenticated;
