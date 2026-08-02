-- Permite que o redirecionador público de links curtos funcione sem login.
GRANT SELECT, UPDATE ON public.short_links TO anon;
GRANT INSERT ON public.short_link_clicks TO anon;

CREATE POLICY "publico le links curtos"
ON public.short_links FOR SELECT TO anon USING (true);

CREATE POLICY "publico contabiliza clique"
ON public.short_links FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "publico registra clique"
ON public.short_link_clicks FOR INSERT TO anon WITH CHECK (true);