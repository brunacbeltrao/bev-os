-- ============================================================
-- BevSkills — 3/3: catálogo da Home em uma chamada só.
-- security invoker de propósito: a RLS de bev_courses continua
-- valendo, então rascunho só aparece para quem administra a diretoria.
-- ============================================================

create or replace function public.bev_catalogo()
returns table (
  id uuid,
  directorate_id uuid,
  diretoria text,
  diretoria_slug text,
  titulo text,
  descricao text,
  instrutor text,
  status text,
  capa_url text,
  ordem int,
  total_aulas int,
  aulas_concluidas int,
  ultima_aula_em timestamptz,
  pode_gerir boolean
) language sql stable security invoker set search_path = public as $$
  select
    c.id, c.directorate_id, d.nome, d.slug, c.titulo, c.descricao, c.instrutor,
    c.status, c.capa_url, c.ordem,
    (select count(*)::int
       from public.bev_lessons l
       join public.bev_modules m on m.id = l.module_id
      where m.course_id = c.id),
    (select count(*)::int
       from public.bev_progress p
       join public.bev_lessons l on l.id = p.lesson_id
       join public.bev_modules m on m.id = l.module_id
      where m.course_id = c.id
        and p.person_id = (select auth.uid())
        and p.concluida_em is not null),
    (select max(p.visto_em)
       from public.bev_progress p
       join public.bev_lessons l on l.id = p.lesson_id
       join public.bev_modules m on m.id = l.module_id
      where m.course_id = c.id and p.person_id = (select auth.uid())),
    public.pode_gerir_bevskills((select auth.uid()), c.directorate_id)
  from public.bev_courses c
  join public.directorates d on d.id = c.directorate_id
  order by c.ordem, c.titulo;
$$;

grant execute on function public.bev_catalogo() to authenticated, service_role;
