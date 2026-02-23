
-- 1. Update handle_new_user to also insert LGPD consent
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, oab_number, crm_number, specialization)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'oab_number',
    NEW.raw_user_meta_data->>'crm_number',
    NEW.raw_user_meta_data->>'specialization'
  );

  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::public.app_role);
  END IF;

  INSERT INTO public.lgpd_consents (user_id, consent_type, accepted, accepted_at)
  VALUES (NEW.id, 'termos_uso_e_privacidade', true, now());

  RETURN NEW;
END;
$$;

-- 2. Fix audit_logs INSERT RLS
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert own audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Fix notifications INSERT RLS
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications"
  ON public.notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4. Enable realtime for case_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_requests;
