-- Execute this in the Supabase SQL Editor to ensure Realtime works perfectly
-- This ensures that the full row is sent on every update, not just changed columns

BEGIN;

  -- 1. Ensure the publication exists
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END $$;

  -- 2. Safely add tables to the publication
  DO $$
  DECLARE
    tbl_name TEXT;
    tables_to_add TEXT[] := ARRAY[
      'equipment', 'inventory', 'purchase_orders', 
      'purchase_order_items', 'work_orders', 
      'comments', 'profiles', 'sections', 'preventive_plans'
    ];
  BEGIN
    FOREACH tbl_name IN ARRAY tables_to_add
    LOOP
      BEGIN
        -- We check if the table exists in the public schema first
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl_name) THEN
          -- Then check if it's already in the publication
          IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = tbl_name
          ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl_name);
          END IF;
        END IF;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not add table % to publication: %', tbl_name, SQLERRM;
      END;
    END LOOP;
  END $$;

  -- 3. Set REPLICA IDENTITY FULL to ensure all columns are sent on UPDATE/DELETE
  -- This is what guarantees that the frontend receives all fields even if only one changed
  DO $$
  DECLARE
    tbl_name TEXT;
    tables_to_fix TEXT[] := ARRAY['equipment', 'inventory', 'purchase_orders', 'purchase_order_items', 'work_orders', 'profiles'];
  BEGIN
    FOREACH tbl_name IN ARRAY tables_to_fix
    LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl_name) THEN
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl_name);
      END IF;
    END LOOP;
  END $$;

COMMIT;
