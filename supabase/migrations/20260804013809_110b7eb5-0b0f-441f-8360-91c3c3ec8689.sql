DROP POLICY IF EXISTS "publico le links curtos" ON public.short_links;
REVOKE SELECT ON public.short_links FROM anon;