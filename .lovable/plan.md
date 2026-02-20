

# Sistema de Gestão Previdenciária — Plano de Implementação

## Visão Geral
Sistema web para gerenciar o fluxo de trabalho entre advogados previdenciaristas, médicos generalistas e especialistas, com conformidade LGPD. Organização única, backend via Lovable Cloud (Supabase).

---

## 1. Autenticação e Perfis de Usuário
- Tela de login e registro com seleção de tipo de usuário (Advogado, Médico Generalista, Especialista)
- Campos profissionais: OAB (advogado), CRM + especialização (médicos)
- Termos de consentimento LGPD obrigatórios no cadastro
- Tabela `profiles` com dados profissionais e tabela `user_roles` para controle de acesso
- Sessão com timeout de 30 minutos de inatividade

## 2. Design e Navegação
- Tema corporativo: azul (#1e40af), cinza (#64748b), verde (#059669)
- Sidebar com navegação por módulos, colapsável
- Layout mobile-first responsivo (375px → 768px → 1024px+)
- Cards para casos/solicitações, tabelas responsivas, modais para formulários
- Botões touch-friendly (mínimo 44px)

## 3. Dashboard por Tipo de Usuário
- **Advogado**: lista de casos, solicitações pendentes, prazos fatais com indicadores visuais
- **Médico Generalista**: solicitações recebidas, consultas agendadas, pré-laudos em andamento
- **Especialista**: laudos solicitados, documentos para análise, laudos finalizados
- Cada dashboard com contadores, filtros e busca

## 4. Fluxo de Trabalho Completo
- Advogado cria caso → define prazos fatais → solicita prova técnica
- Médico recebe solicitação → agenda consulta → solicita exames → prepara pré-laudo → solicita laudo do especialista
- Especialista acessa documentos → elabora laudo final
- Pipeline visual de status em tempo real para cada etapa do caso
- Transições de status com validação (cada etapa só avança quando a anterior está completa)

## 5. Gestão de Documentos
- Upload seguro de PDFs e imagens via Supabase Storage com bucket privado
- Visualizador de documentos integrado (PDF inline, imagens)
- Versionamento: histórico de versões por documento
- Download controlado com registro em log de auditoria
- Organização por caso/paciente

## 6. Conformidade LGPD
- Termo de consentimento detalhado obrigatório no cadastro
- Página de política de privacidade
- Painel do usuário para consultar seus dados pessoais (relatório)
- Funcionalidade de exclusão de dados (direito ao esquecimento) com confirmação
- Controle de retenção: marcação de dados para exclusão após período definido

## 7. Segurança e Auditoria
- RLS (Row Level Security) em todas as tabelas com políticas por tipo de usuário
- Logs de auditoria: todas as ações de usuário registradas (criação, edição, acesso a documentos, downloads)
- Tabela de audit_logs com timestamp, user_id, ação, recurso afetado
- Queries parametrizadas (padrão Supabase, sem SQL raw)
- CORS restrito

## 8. Notificações
- Notificações in-app em tempo real via Supabase Realtime
- Alertas visuais para prazos fatais (badge na sidebar + toast)
- Centro de notificações com histórico e status lido/não lido
- Email será adicionado em fase futura (quando um provedor for escolhido)

## 9. Tabelas Principais do Banco de Dados
- `profiles` — dados profissionais (CRM, OAB, especialização)
- `user_roles` — controle de papéis (advogado, medico_generalista, especialista)
- `cases` — casos criados por advogados
- `case_requests` — solicitações de prova técnica
- `consultations` — consultas agendadas por médicos
- `documents` — metadados de arquivos enviados
- `document_versions` — versionamento
- `reports` — pré-laudos e laudos finais
- `notifications` — notificações in-app
- `audit_logs` — logs de auditoria
- `lgpd_consents` — registro de consentimentos LGPD

