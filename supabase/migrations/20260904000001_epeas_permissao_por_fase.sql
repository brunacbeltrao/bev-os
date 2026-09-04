-- ============================================================
-- BEV OS · 04/09/2026 — quem edita o EPEAS segue a fase do contrato.
-- APLICADA (no banco: epeas_permissao_por_fase).
--
-- Antes a regra era assimétrica sem querer:
--   Gestão   -> is_gestao: a diretoria inteira, qualquer cargo
--   Projetos -> is_lideranca_projetos: só diretor/gerente/coordenador
--   Negócios -> is_diretora_negocios: só a diretora
--
-- Agora vale o mesmo critério para as três: o contrato está numa etapa, a
-- etapa pertence a uma diretoria, e quem é daquela diretoria mexe —
-- independente do cargo. Quando a bola passa, a caneta passa junto.
--
-- Verificado depois de aplicar, contando linhas afetadas (um UPDATE que o
-- RLS filtra não dá erro, apenas afeta zero linhas):
--   negócios / etapa comercial  -> 1     projetos / etapa comercial -> 0
--   projetos / etapa projetos   -> 1     negócios / etapa projetos  -> 0
-- ============================================================

create or replace function public.pertence_diretoria(uid uuid, p_slug text)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.occupations o
    join public.directorates d on d.id = o.directorate_id
    where o.person_id = uid
      and o.cycle_id = public.current_cycle_id()
      and d.slug = p_slug
  );
$$;

comment on function public.pertence_diretoria(uuid, text) is
  'Pessoa está lotada nesta diretoria no ciclo atual, em qualquer cargo.';

create or replace function public.epeas_diretoria_da_etapa(e public.epeas_etapa_macro)
returns text
language sql immutable
as $$
  select case
    when e::text like 'comercial\_%' then 'negocios'
    when e::text like 'gestao\_%'    then 'gestao'
    else 'projetos'
  end;
$$;

comment on function public.epeas_diretoria_da_etapa(public.epeas_etapa_macro) is
  'Diretoria dona da etapa: comercial_* = negocios, gestao_* = gestao, projetos_* = projetos.';

-- Ver: as três diretorias que tocam o contrato enxergam todos, mais a
-- Diretoria, o time nominalmente alocado e quem fechou o contrato.
create or replace function public.epeas_pode_ver(p_contrato uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.contratos c
    left join public.epeas_lifecycle l on l.contrato_id = c.id
    where c.id = p_contrato
      and (
        public.is_direx((select auth.uid()))
        or public.pertence_diretoria((select auth.uid()), 'negocios')
        or public.pertence_diretoria((select auth.uid()), 'gestao')
        or public.pertence_diretoria((select auth.uid()), 'projetos')
        or c.responsavel_id = (select auth.uid())
        or c.criado_por     = (select auth.uid())
        or l.gestao_responsavel_id = (select auth.uid())
        or l.gerente_nucleo_id     = (select auth.uid())
        or l.scrum_master_id       = (select auth.uid())
        or (select auth.uid()) = any (coalesce(l.assessores_projeto_ids, '{}'))
      )
  );
$$;

-- Editar: a diretoria dona da etapa atual, mais a Diretoria e o time
-- nominalmente alocado — que é quem toca a execução e precisa registrar o
-- andamento mesmo quando a etapa ainda não virou.
create or replace function public.epeas_pode_editar(p_contrato uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.contratos c
    left join public.epeas_lifecycle l on l.contrato_id = c.id
    where c.id = p_contrato
      and (
        public.is_direx((select auth.uid()))
        or public.pertence_diretoria(
             (select auth.uid()),
             public.epeas_diretoria_da_etapa(
               coalesce(l.etapa_macro, 'comercial_contrato_fechado'::public.epeas_etapa_macro))
           )
        or l.gestao_responsavel_id = (select auth.uid())
        or l.gerente_nucleo_id     = (select auth.uid())
        or l.scrum_master_id       = (select auth.uid())
        or (select auth.uid()) = any (coalesce(l.assessores_projeto_ids, '{}'))
      )
  );
$$;

comment on function public.epeas_pode_editar(uuid) is
  'Edita quem é da diretoria dona da etapa atual (qualquer cargo), a Diretoria, ou quem está nominalmente alocado no contrato.';

revoke execute on function public.pertence_diretoria(uuid, text) from public;
revoke execute on function public.epeas_diretoria_da_etapa(public.epeas_etapa_macro) from public;
grant execute on function public.pertence_diretoria(uuid, text) to authenticated, service_role;
grant execute on function public.epeas_diretoria_da_etapa(public.epeas_etapa_macro) to authenticated, service_role;
