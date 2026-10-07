-- Purchase Orders and Requests table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number TEXT NOT NULL UNIQUE,
    supplier TEXT,
    status TEXT NOT NULL DEFAULT 'Solicitado',
    requested_by UUID REFERENCES public.profiles(id),
    requested_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    order_date TIMESTAMP WITH TIME ZONE,
    expected_date TIMESTAMP WITH TIME ZONE,
    received_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    total_amount DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Order Items table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    part_id UUID REFERENCES public.inventory(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) DEFAULT 0,
    received_quantity INTEGER DEFAULT 0,
    equipment_id UUID REFERENCES public.equipment(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to purchase_orders" ON public.purchase_orders FOR ALL USING (true);
CREATE POLICY "Allow all access to purchase_order_items" ON public.purchase_order_items FOR ALL USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_order_items;
