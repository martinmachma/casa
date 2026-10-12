-- Live sync: stream changes to walls and furniture to every signed-in device.
-- Realtime still applies the RLS policies, so only allowed users receive rows.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table house.walls, house.furniture_items;
