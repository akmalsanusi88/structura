ALTER TABLE material_purchase_orders
ADD COLUMN IF NOT EXISTS ref_quotation_no TEXT,
DROP COLUMN IF EXISTS project_ref_info,
ADD COLUMN IF NOT EXISTS project_name TEXT,
ADD COLUMN IF NOT EXISTS project_no TEXT,
ADD COLUMN IF NOT EXISTS project_po_no TEXT;
