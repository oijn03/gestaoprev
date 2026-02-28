-- Clean up case-related data for fresh testing
-- Run this in the Supabase SQL Editor

TRUNCATE public.reports CASCADE;
TRUNCATE public.consultations CASCADE;
TRUNCATE public.case_messages CASCADE;
TRUNCATE public.case_requests CASCADE;
TRUNCATE public.documents CASCADE;
TRUNCATE public.cases CASCADE;
TRUNCATE public.notifications CASCADE;
TRUNCATE public.audit_logs CASCADE;

-- Optional: Resetting specific sequences if needed
-- ALTER SEQUENCE public.cases_id_seq RESTART WITH 1;
-- (Add others if they are SERIAL instead of UUID)

-- Note: CASCADE will ensure that dependent records are removed if any were missed, 
-- though the order above is generally safe.
