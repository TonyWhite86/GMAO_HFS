-- Execute this in the Supabase SQL Editor to ensure Realtime is enabled for these tables
begin;
  -- Remove tables if they are already in the publication to avoid errors (optional, but safe)
  -- alter publication supabase_realtime drop table work_orders;
  -- alter publication supabase_realtime drop table comments;

  -- Add tables to the publication
  alter publication supabase_realtime add table work_orders;
  alter publication supabase_realtime add table comments;
commit;
