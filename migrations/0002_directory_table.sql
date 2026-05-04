
-- Create the new "directory" table to store company information globally.
CREATE TABLE IF NOT EXISTS public.directory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    attn TEXT,
    bank_name TEXT,
    bank_acc_no TEXT,
    bank_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a trigger to automatically update the "updated_at" timestamp.
CREATE OR REPLACE TRIGGER set_directory_updated_at
BEFORE UPDATE ON public.directory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS) on the new table.
ALTER TABLE public.directory ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors on re-run
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.directory;

-- Create a new policy that allows any logged-in user to perform any action on the directory.
-- This makes it a shared resource across all companies in the application.
CREATE POLICY "Allow all access to authenticated users"
ON public.directory
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
