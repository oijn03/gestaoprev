
-- ============================================================
-- BUG #12: Fluxo de Cancelamento de Solicitações
-- Adiciona coluna para rastrear quem solicitou o cancelamento
-- ============================================================

ALTER TABLE public.case_requests 
ADD COLUMN IF NOT EXISTS cancel_requested_by UUID REFERENCES auth.users(id);

-- Atualizar tipos de status permitidos (informativo, o banco usa TEXT por enquanto)
-- Status novos sugeridos: 'solicitando_cancelamento'

COMMENT ON COLUMN public.case_requests.cancel_requested_by IS 'ID do usuário que iniciou o pedido de cancelamento mútuo';
