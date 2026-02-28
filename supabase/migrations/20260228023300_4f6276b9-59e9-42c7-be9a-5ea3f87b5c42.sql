
-- Add file_path column to reports table for laudo file uploads
ALTER TABLE public.reports ADD COLUMN file_path text;

-- Create reports storage bucket for laudo files
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for reports bucket
CREATE POLICY "Authors can upload reports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Case participants can view reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'reports' AND auth.role() = 'authenticated');

CREATE POLICY "Authors can update own reports"
ON storage.objects FOR UPDATE
USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);
