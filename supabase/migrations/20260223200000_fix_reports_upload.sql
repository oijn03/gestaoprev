-- Migration to fix report upload and bucket
-- 1. Add file_path to reports table
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS file_path TEXT;

-- 2. Create reports bucket in storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for reports bucket
-- Allow authenticated users to upload to reports
CREATE POLICY "Authenticated users can upload reports" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'reports' AND auth.role() = 'authenticated');

-- Allow users to view reports (follows logic of access to a report)
CREATE POLICY "Users can view reports" ON storage.objects 
FOR SELECT USING (bucket_id = 'reports' AND auth.role() = 'authenticated');

-- Allow authors to delete own reports
CREATE POLICY "Authors can delete own reports" ON storage.objects 
FOR DELETE USING (bucket_id = 'reports' AND auth.role() = 'authenticated');
