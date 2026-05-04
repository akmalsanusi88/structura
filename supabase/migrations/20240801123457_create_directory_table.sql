
-- Function to automatically update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the directory table
CREATE TABLE IF NOT EXISTS public.directory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text,
    phone text,
    address text,
    attn text,
    bank_name text,
    bank_acc_no text,
    bank_address text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add comments to the table and columns for clarity
COMMENT ON TABLE public.directory IS 'A global directory for all companies (clients, subcontractors, suppliers)';
COMMENT ON COLUMN public.directory.name IS 'The legal name of the company.';
COMMENT ON COLUMN public.directory.attn IS 'The main point of contact person for the company.';
COMMENT ON COLUMN public.directory.bank_name IS 'The name of the company''s primary bank.';
COMMENT ON COLUMN public.directory.bank_acc_no IS 'The bank account number for the company.';
COMMENT ON COLUMN public.directory.bank_address IS 'The address of the bank branch.';

-- Create the trigger to update the 'updated_at' column on any change
CREATE TRIGGER set_directory_updated_at
BEFORE UPDATE ON public.directory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS) for the directory table
ALTER TABLE public.directory ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to perform all operations on the directory.
-- This makes it a shared address book for all users of the application.
CREATE POLICY "Allow all access to authenticated users"
ON public.directory
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

