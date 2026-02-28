-- ============================================================
-- TABELA DE MENSAGENS POR CASO (CHAT)
-- Permite colaboração direta entre advogados e médicos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.case_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.case_messages ENABLE ROW LEVEL SECURITY;

-- Política de Visualização: apenas as partes envolvidas no caso
CREATE POLICY "Envolvidos podem ver mensagens" ON public.case_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.cases c
            LEFT JOIN public.case_requests cr ON c.id = cr.case_id
            WHERE c.id = case_id
            AND (c.user_id = auth.uid() OR cr.medico_id = auth.uid() OR cr.advogado_id = auth.uid())
        )
    );

-- Política de Inserção: apenas membros participantes do caso
CREATE POLICY "Participantes podem enviar mensagens" ON public.case_messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.cases c
            LEFT JOIN public.case_requests cr ON c.id = cr.case_id
            WHERE c.id = case_id
            AND (c.user_id = auth.uid() OR cr.medico_id = auth.uid() OR cr.advogado_id = auth.uid())
        )
        AND sender_id = auth.uid()
    );

-- Grant permissões
GRANT ALL ON public.case_messages TO authenticated;

-- Adicionar comentário explicativo
COMMENT ON TABLE public.case_messages IS 'Armazena as mensagens de chat trocadas entre advogados e médicos sobre um caso específico';
