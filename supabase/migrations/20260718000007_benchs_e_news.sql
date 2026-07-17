-- 1. Refatoração da tabela benchs
ALTER TABLE public.benchs DROP COLUMN IF EXISTS empresa;
ALTER TABLE public.benchs DROP COLUMN IF EXISTS cargo;
ALTER TABLE public.benchs DROP COLUMN IF EXISTS linkedin_url;
ALTER TABLE public.benchs DROP COLUMN IF EXISTS area_id;

ALTER TABLE public.benchs ADD COLUMN IF NOT EXISTS membro_nome text;
ALTER TABLE public.benchs ADD COLUMN IF NOT EXISTS membro_email text;
ALTER TABLE public.benchs ADD COLUMN IF NOT EXISTS tema text;
ALTER TABLE public.benchs ADD COLUMN IF NOT EXISTS meet_url text;

-- 2. Tabela de Comentários (news_comments)
CREATE TABLE IF NOT EXISTS public.news_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_post_id uuid NOT NULL REFERENCES public.news_posts(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.news_comments TO authenticated;
GRANT ALL ON public.news_comments TO service_role;
CREATE POLICY comments_select ON public.news_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY comments_insert ON public.news_comments FOR INSERT TO authenticated WITH CHECK (person_id = (SELECT auth.uid()));
CREATE POLICY comments_delete ON public.news_comments FOR DELETE TO authenticated USING (person_id = (SELECT auth.uid()));

-- 3. Correção do is_direx que impedia o diretor de negócios de atualizar o faturamento 
-- Garantindo que ele pegue os cargos e ciclos corretos
CREATE OR REPLACE FUNCTION public.is_direx(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.occupations o
    WHERE o.person_id = uid
      AND o.role = 'diretor'
      AND o.cycle_id = public.current_cycle_id()
  );
$$;

-- E recriando a can_edit_dir_metrics para evitar ambiguidades com o auth.uid()
CREATE OR REPLACE FUNCTION public.can_edit_dir_metrics(uid uuid, dir_slug text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.is_direx(uid) OR EXISTS (
    SELECT 1
    FROM public.occupations o
    JOIN public.directorates d ON d.id = o.directorate_id
    WHERE o.person_id = uid
      AND o.cycle_id = public.current_cycle_id()
      AND o.role IN ('diretor','gerente','coordenador')
      AND d.slug = dir_slug
  );
$$;
