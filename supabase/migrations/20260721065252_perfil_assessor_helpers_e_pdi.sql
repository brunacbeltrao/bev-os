-- ============================================================
-- BEV OS — Perfil do Assessor (PRD v1.0, Onda 5) — parte 1/5
-- Helpers de escopo por PESSOA + campos de PDI do header.
-- ============================================================

-- Verdadeiro se `uid` lidera `pid` no ciclo vigente (gerente/coord da
-- subárea, diretor da diretoria) ou pertence a Pessoas & Cultura.
create or replace function public.lidera_pessoa(uid uuid, pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_pc(uid)
    or exists (
      select 1 from public.occupations o
      where o.person_id = pid
        and o.cycle_id = public.current_cycle_id()
        and public.is_leader_of(uid, o.subarea_id)
    );
$$;

-- Verdadeiro se `uid` pode abrir o Perfil de `pid` (liderança, P&C ou
-- a própria pessoa na visão pessoal).
create or replace function public.ve_perfil(uid uuid, pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select uid = pid or public.lidera_pessoa(uid, pid);
$$;

grant execute on function public.lidera_pessoa(uuid, uuid) to authenticated, service_role;
grant execute on function public.ve_perfil(uuid, uuid) to authenticated, service_role;

alter table public.pdi_plans
  add column if not exists foco_area text,
  add column if not exists busca_estagio boolean not null default false;
