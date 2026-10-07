-- Run this query to specifically enable Realtime for comments
-- Ignore "already member" errors if they appear

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE comments;
  EXCEPTION WHEN duplicate_object OR others THEN
    RAISE NOTICE 'Table comments might already be in publication or other error, continuing...';
  END;
END $$;

-- Check which tables are actually enabled
select * from pg_publication_tables where pubname = 'supabase_realtime';
