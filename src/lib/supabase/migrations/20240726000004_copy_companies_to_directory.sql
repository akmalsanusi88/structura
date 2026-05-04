-- one time script to copy over existing companies to the new directory table
-- this ensures we don't have duplicates if we run this multiple times
INSERT INTO directory (id, name, created_at)
SELECT id, name, created_at
FROM companies
WHERE id NOT IN (SELECT id FROM directory);
