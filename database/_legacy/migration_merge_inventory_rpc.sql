-- RPC function to merge two inventory items atomically
-- Replaces the client-side mergeItems() logic with a DB transaction
-- Usage: SELECT merge_inventory_items('keep-uuid', 'delete-uuid');

CREATE OR REPLACE FUNCTION public.merge_inventory_items(keep_id UUID, delete_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    keep_record RECORD;
    delete_record RECORD;
    combined_equipment_ids UUID[];
    wo_record RECORD;
    updated_parts JSONB;
BEGIN
    -- 1. Fetch both items within the transaction
    SELECT * INTO keep_record FROM public.inventory WHERE id = keep_id;
    SELECT * INTO delete_record FROM public.inventory WHERE id = delete_id;

    IF NOT FOUND OR keep_record.id IS NULL THEN
        RAISE EXCEPTION 'Item to keep not found: %', keep_id;
    END IF;

    IF delete_record.id IS NULL THEN
        RAISE EXCEPTION 'Item to delete not found: %', delete_id;
    END IF;

    -- 2. Re-link inventory movements
    UPDATE public.inventory_movements
    SET item_id = keep_id
    WHERE item_id = delete_id;

    -- 3. Re-link purchase order items
    UPDATE public.purchase_order_items
    SET part_id = keep_id
    WHERE part_id = delete_id;

    -- 4. Update work_orders JSONB used_parts
    FOR wo_record IN
        SELECT id, used_parts FROM public.work_orders
        WHERE used_parts @> jsonb_build_array(jsonb_build_object('partId', delete_id))
    LOOP
        updated_parts := (
            SELECT jsonb_agg(
                CASE
                    WHEN item->>'partId' = delete_id::text
                    THEN jsonb_set(item, '{partId}', to_jsonb(keep_id::text))
                    ELSE item
                END
            )
            FROM jsonb_array_elements(wo_record.used_parts) AS item
        );
        UPDATE public.work_orders
        SET used_parts = updated_parts
        WHERE id = wo_record.id;
    END LOOP;

    -- 5. Consolidate stock and info into keep item
    combined_equipment_ids := ARRAY(
        SELECT DISTINCT unnest(
            COALESCE(keep_record.linked_equipment_ids, '{}') ||
            COALESCE(delete_record.linked_equipment_ids, '{}')
        )
    );

    UPDATE public.inventory
    SET
        quantity = COALESCE(keep_record.quantity, 0) + COALESCE(delete_record.quantity, 0),
        linked_equipment_ids = combined_equipment_ids,
        image = COALESCE(keep_record.image, delete_record.image),
        manufacturer = COALESCE(keep_record.manufacturer, delete_record.manufacturer),
        supplier = COALESCE(keep_record.supplier, delete_record.supplier),
        location = COALESCE(keep_record.location, delete_record.location)
    WHERE id = keep_id;

    -- 6. Delete the duplicate item
    DELETE FROM public.inventory WHERE id = delete_id;

    RETURN keep_id;
END;
$$;
