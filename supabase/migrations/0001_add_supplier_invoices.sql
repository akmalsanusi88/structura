-- Create the supplier_invoices table for general material procurement
CREATE TABLE public.supplier_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    material_purchase_order_id uuid NOT NULL REFERENCES public.material_purchase_orders(id) ON DELETE CASCADE,
    delivery_order_ids uuid[] NOT NULL,
    invoice_no text NOT NULL,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    supplier text NOT NULL,
    amount numeric NOT NULL,
    status text DEFAULT 'Draft'::text NOT NULL
);

-- Add comments for clarity
COMMENT ON TABLE public.supplier_invoices IS 'Stores invoices received from suppliers for general material purchases.';
COMMENT ON COLUMN public.supplier_invoices.delivery_order_ids IS 'Array of delivery_orders.id that this invoice covers.';

-- Add a unique constraint to prevent duplicate invoice numbers for the same company
ALTER TABLE public.supplier_invoices ADD CONSTRAINT supplier_invoices_company_id_invoice_no_key UNIQUE (company_id, invoice_no);

-- Enable Row Level Security
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

-- Create policy for RLS
-- This policy allows users to see invoices that belong to their company.
CREATE POLICY "Allow company members to access their invoices"
ON public.supplier_invoices
FOR ALL
USING (
  auth.uid() IN (
    SELECT user_id FROM company_users WHERE company_id = public.supplier_invoices.company_id
  )
);
