-- Migration to add status and manufacturer columns to inventory
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS manufacturer TEXT;

-- Update existing items to 'Active' status if they are null
UPDATE inventory SET status = 'Active' WHERE status IS NULL;
