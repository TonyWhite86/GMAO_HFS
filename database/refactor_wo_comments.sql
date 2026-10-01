-- Add attachments column to comments table
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- Optional: Migrate existing attachments if any (this is a bit complex as we'd need to join tables)
-- For a demo environment, it's often better to just start fresh or let existing ones be.
-- But let's try a simple migration for existing data:
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'attachments') THEN
        UPDATE public.comments c
        SET attachments = (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', a.id,
                    'name', a.name,
                    'url', a.url,
                    'type', a.type
                )
            )
            FROM public.attachments a
            WHERE a.parent_id = c.id::text AND a.parent_type = 'comment'
        )
        WHERE EXISTS (
            SELECT 1 FROM public.attachments a 
            WHERE a.parent_id = c.id::text AND a.parent_type = 'comment'
        );
    END IF;
END $$;
