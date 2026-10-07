DO $$
DECLARE
    r RECORD;
    current_year INTEGER;
    next_val INTEGER;
BEGIN
    current_year := date_part('year', now())::INTEGER;
    
    -- Iterate over incidents that have no display_id
    FOR r IN SELECT id FROM public.incidents WHERE display_id IS NULL OR display_id = '' ORDER BY created_at ASC LOOP
        
        -- Ensure sequence exists for this year
        INSERT INTO public.incident_sequences (year, last_val)
        VALUES (current_year, 0)
        ON CONFLICT (year) DO NOTHING;

        -- Get next value
        UPDATE public.incident_sequences
        SET last_val = last_val + 1
        WHERE year = current_year
        RETURNING last_val INTO next_val;

        -- Update the incident
        UPDATE public.incidents 
        SET display_id = 'INC-' || current_year::TEXT || '-' || lpad(next_val::TEXT, 6, '0')
        WHERE id = r.id;
        
        RAISE NOTICE 'Fixed incident % with new ID %', r.id, 'INC-' || current_year::TEXT || '-' || lpad(next_val::TEXT, 6, '0');
    END LOOP;
END $$;
