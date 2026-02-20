
-- 1. Enum for user roles
CREATE TYPE public.app_role AS ENUM ('advogado', 'medico_generalista', 'especialista');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  oab_number TEXT,
  crm_number TEXT,
  specialization TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- 5. RLS for profiles and user_roles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Cases table
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  patient_name TEXT NOT NULL,
  patient_cpf TEXT,
  process_number TEXT,
  status TEXT NOT NULL DEFAULT 'aberto',
  deadline TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- 7. Case requests (create BEFORE cases RLS that references it)
CREATE TABLE public.case_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  advogado_id UUID REFERENCES auth.users(id) NOT NULL,
  medico_id UUID REFERENCES auth.users(id),
  especialista_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL DEFAULT 'prova_tecnica',
  status TEXT NOT NULL DEFAULT 'pendente',
  description TEXT,
  notes TEXT,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.case_requests ENABLE ROW LEVEL SECURITY;

-- 8. Now create cases RLS (case_requests exists now)
CREATE POLICY "Advogados can manage own cases" ON public.cases FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Medicos can view assigned cases" ON public.cases FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.case_requests cr WHERE cr.case_id = cases.id AND (cr.medico_id = auth.uid() OR cr.especialista_id = auth.uid()))
);

-- 9. Case requests RLS
CREATE POLICY "Advogados manage own requests" ON public.case_requests FOR ALL USING (auth.uid() = advogado_id);
CREATE POLICY "Medicos view assigned requests" ON public.case_requests FOR SELECT USING (auth.uid() = medico_id OR auth.uid() = especialista_id);
CREATE POLICY "Medicos update assigned requests" ON public.case_requests FOR UPDATE USING (auth.uid() = medico_id OR auth.uid() = especialista_id);

-- 10. Consultations
CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_request_id UUID REFERENCES public.case_requests(id) ON DELETE CASCADE NOT NULL,
  medico_id UUID REFERENCES auth.users(id) NOT NULL,
  patient_name TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'agendada',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medicos manage own consultations" ON public.consultations FOR ALL USING (auth.uid() = medico_id);
CREATE POLICY "Advogados view case consultations" ON public.consultations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.case_requests cr WHERE cr.id = consultations.case_request_id AND cr.advogado_id = auth.uid())
);

-- 11. Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Uploaders manage own documents" ON public.documents FOR ALL USING (auth.uid() = uploaded_by);
CREATE POLICY "Case participants view documents" ON public.documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cases c WHERE c.id = documents.case_id AND (
    c.user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.case_requests cr WHERE cr.case_id = c.id AND (cr.medico_id = auth.uid() OR cr.especialista_id = auth.uid()))
  ))
);

-- 12. Document versions
CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  version_number INT NOT NULL DEFAULT 1,
  file_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Version access follows document access" ON public.document_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_versions.document_id AND (
    d.uploaded_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.cases c WHERE c.id = d.case_id AND (
      c.user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.case_requests cr WHERE cr.case_id = c.id AND (cr.medico_id = auth.uid() OR cr.especialista_id = auth.uid()))
    ))
  ))
);
CREATE POLICY "Uploaders can insert versions" ON public.document_versions FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- 13. Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_request_id UUID REFERENCES public.case_requests(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL DEFAULT 'pre_laudo',
  title TEXT NOT NULL,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authors manage own reports" ON public.reports FOR ALL USING (auth.uid() = author_id);
CREATE POLICY "Case participants view reports" ON public.reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.case_requests cr WHERE cr.id = reports.case_request_id AND (cr.advogado_id = auth.uid() OR cr.medico_id = auth.uid() OR cr.especialista_id = auth.uid()))
);

-- 14. Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- 15. Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- 16. LGPD consents
CREATE TABLE public.lgpd_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consent_type TEXT NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT false,
  accepted_at TIMESTAMPTZ,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own consents" ON public.lgpd_consents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own consents" ON public.lgpd_consents FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 17. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_case_requests_updated_at BEFORE UPDATE ON public.case_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON public.consultations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 18. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 19. Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 20. Storage bucket for documents (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('case-documents', 'case-documents', false);

CREATE POLICY "Authenticated users can upload documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'case-documents' AND auth.role() = 'authenticated');
CREATE POLICY "Users can view documents" ON storage.objects FOR SELECT USING (bucket_id = 'case-documents' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own uploads" ON storage.objects FOR DELETE USING (bucket_id = 'case-documents' AND auth.role() = 'authenticated');
