-- A contagem de cliques passa a ser feita no servidor com credencial privilegiada.
DROP POLICY IF EXISTS "publico contabiliza clique" ON public.short_links;
DROP POLICY IF EXISTS "publico registra clique" ON public.short_link_clicks;
REVOKE UPDATE ON public.short_links FROM anon;
REVOKE INSERT ON public.short_link_clicks FROM anon;