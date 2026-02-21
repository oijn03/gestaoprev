-- Securely delete the authenticated user from auth.users
-- This function must be run as SECURITY DEFINER to have permission to delete from auth.users
CREATE OR REPLACE FUNCTION public.delete_own_user()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 1. Delete associated data in public schema (cascades should handle this, but we'll be explicit)
  DELETE FROM public.profiles WHERE user_id = auth.uid();
  DELETE FROM public.user_roles WHERE user_id = auth.uid();
  DELETE FROM public.lgpd_consents WHERE user_id = auth.uid();
  
  -- 2. Delete the user from auth.users
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_own_user() TO authenticated;
