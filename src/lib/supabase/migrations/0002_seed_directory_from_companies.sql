-- This script copies existing companies into the new directory table.
-- It's designed to be run once and is safe to re-run (it won't create duplicates).

-- First, ensure the name column in the directory is unique to prevent duplicates.
ALTER TABLE public.directory
ADD CONSTRAINT directory_name_unique UNIQUE (name);

-- Now, insert all companies from the old `companies` table into the new `directory` table.
-- ON CONFLICT (name) DO NOTHING ensures that if a company with the same name already exists
-- in the directory, it will not be inserted again, preventing duplicates if this script is run multiple times.
INSERT INTO public.directory (id, name, created_at, updated_at)
SELECT id, name, created_at, updated_at
FROM public.companies
ON CONFLICT (name) DO NOTHING;
