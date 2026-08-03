CREATE TABLE public.email_import_staging (
  phone text PRIMARY KEY,
  email text NOT NULL
);
GRANT ALL ON public.email_import_staging TO service_role;
GRANT SELECT, INSERT ON public.email_import_staging TO authenticated;
ALTER TABLE public.email_import_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin gerencia staging de e-mails"
  ON public.email_import_staging FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));