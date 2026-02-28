-- ============================================================
-- MELHORIA DE UX DO MÉDICO: PREVISÃO DE LAUDO
-- ============================================================

-- Adiciona campo de previsão de entrega de laudo na solicitação
ALTER TABLE public.case_requests 
ADD COLUMN IF NOT EXISTS report_forecast_date TIMESTAMPTZ;

COMMENT ON COLUMN public.case_requests.report_forecast_date IS 'Data estimada pelo médico para a entrega do laudo técnico';
