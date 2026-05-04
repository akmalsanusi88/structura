
-- Create the companies table to store a shared directory of clients, subcontractors, etc.
CREATE TABLE
  public.companies (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    attn TEXT,
    bank_name TEXT,
    bank_acc_no TEXT,
    bank_address TEXT,
    logo TEXT,
    CONSTRAINT companies_pkey PRIMARY KEY (id)
  );

-- Enable Row Level Security
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to perform all operations on the shared directory
CREATE POLICY "Allow all authenticated users to manage companies" ON public.companies FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant all permissions to the authenticated role
GRANT ALL ON TABLE public.companies TO authenticated;

-- Add comments for clarity
COMMENT ON TABLE public.companies IS 'Shared directory of external companies like clients, subcontractors, and suppliers.';
COMMENT ON POLICY "Allow all authenticated users to manage companies" ON public.companies IS 'This policy enables a shared, global address book for all authenticated users.';
