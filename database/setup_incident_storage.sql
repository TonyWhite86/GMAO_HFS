-- Create storage bucket for incident files
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-files', 'incident-files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for incident-files
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'incident-files' );

CREATE POLICY "Allow All"
ON storage.objects FOR ALL
USING ( bucket_id = 'incident-files' )
WITH CHECK ( bucket_id = 'incident-files' );
