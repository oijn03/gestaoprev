
-- ============================================================
-- BUG #1: Garantir trigger on_auth_user_created
-- As migrations 20260220212500 e 20260223132914 recriaram a
-- função handle_new_user mas NÃO recriaram o trigger.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- BUG #2: Função SECURITY DEFINER para notificações cross-user
-- Permite que um usuário autenticado insira uma notificação
-- destinada a OUTRO usuário, contornando a RLS policy que
-- exige auth.uid() = user_id no INSERT de notifications.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_user_fn(
  p_user_id  UUID,
  p_title    TEXT,
  p_message  TEXT,
  p_type     TEXT DEFAULT 'info',
  p_link     TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (p_user_id, p_title, p_message, p_type, p_link);
END;
$$;

-- Conceder somente a usuários autenticados
GRANT EXECUTE ON FUNCTION public.notify_user_fn(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
