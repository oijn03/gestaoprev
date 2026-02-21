-- Update handle_new_user trigger to support roles and professional data from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Insert Profile with all metadata
  INSERT INTO public.profiles (user_id, full_name, oab_number, crm_number, specialization)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'oab_number',
    NEW.raw_user_meta_data->>'crm_number',
    NEW.raw_user_meta_data->>'specialization'
  );

  -- 2. Insert Role from metadata
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::public.app_role);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
