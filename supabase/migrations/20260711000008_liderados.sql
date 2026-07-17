-- ============================================================
-- BEV OS — Onda 3.1: Meus Liderados (refinamento)
-- 1) liderados_view: escopo por DIRETORIA (não org inteira) e
--    separação por papel (o front divide GERENTES × ASSESSORES).
--    · Diretor: gerentes/coordenadores + assessores/analistas da
--      PRÓPRIA diretoria (via is_leader_of, que já resolve diretoria).
--    · Gerente/Coordenador: apenas assessores/analistas da subárea.
-- 2) pdi_checkins: registro das 1:1 do PDI (data + notas), para o
--    histórico de acompanhamento perfil a perfil.
-- Reaproveita helpers existentes: is_leader_of, is_direx,
-- can_see_pdi, can_manage_pdi, set_updated_at.
-- ============================================================

begin;

-- ---------- 1) liderados_view (baseada no approved_roster) ----------
-- Mostra TODOS os membros do roster do ciclo — mesmo quem ainda não
-- ativou a conta (ativo = false) — enriquecendo com PDI/agravos quando
-- a pessoa já existe em public.people (join por e-mail). Colunas novas:
-- email, ativo. person_id vira nulo para quem não ativou.
drop view if exists public.liderados_view;
create view public.liderados_view as
select
  p.id as person_id,
  r.email,
  coalesce(p.nome, r.nome) as nome,
  p.foto_url,
  r.role,
  r.subarea_id,
  s.nome as area,
  (p.id is not null) as ativo,
  pl.id as pdi_id,
  pl.updated_at as pdi_atualizado_em,
  (select count(*)::int from public.pdi_goals g where g.pdi_plan_id = pl.id and g.status = 'aberta') as metas_abertas,
  (select count(*)::int from public.agravos a where a.person_id = p.id and a.cycle_id = r.cycle_id) as agravos,
  (
    p.id is not null
    and (
      pl.id is null
      or pl.updated_at < now() - interval '30 days'
      or exists (
        select 1 from public.agravos a
        where a.person_id = p.id and a.created_at > now() - interval '60 days'
      )
    )
  ) as risco
from public.approved_roster r
join public.subareas s on s.id = r.subarea_id
left join public.people p on lower(p.email) = r.email
left join public.pdi_plans pl on pl.person_id = p.id and pl.cycle_id = r.cycle_id
where r.cycle_id = public.current_cycle_id()
  and (p.id is null or p.id <> auth.uid())
  -- is_leader_of(uid, sa): gerente/coord da subárea OU diretor da
  -- diretoria dona da subárea. Já limita o diretor à própria diretoria.
  and public.is_leader_of(auth.uid(), r.subarea_id)
  and (
    -- Diretor vê a liderança e a base da diretoria dele.
    (public.is_direx(auth.uid()) and r.role in ('gerente', 'coordenador', 'assessor', 'analista'))
    -- Gerente/Coordenador vê apenas a base da própria subárea.
    or (not public.is_direx(auth.uid()) and r.role in ('assessor', 'analista'))
  );
revoke all on public.liderados_view from anon, public;
grant select on public.liderados_view to authenticated, service_role;

-- ---------- 2) pdi_checkins (1:1 do PDI) ----------
create table if not exists public.pdi_checkins (
  id uuid primary key default gen_random_uuid(),
  pdi_plan_id uuid not null references public.pdi_plans (id) on delete cascade,
  lider_id uuid not null references public.people (id),
  data date not null default current_date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger pdi_checkins_updated_at before update on public.pdi_checkins
  for each row execute function public.set_updated_at();

alter table public.pdi_checkins enable row level security;
revoke all on public.pdi_checkins from anon;
grant select, insert, update, delete on public.pdi_checkins to authenticated;
grant all on public.pdi_checkins to service_role;

-- Leitura: mesma visibilidade do PDI (avaliado, avaliador, liderança).
create policy pdi_checkins_select on public.pdi_checkins
  for select to authenticated
  using (public.can_see_pdi((select auth.uid()), pdi_plan_id));

-- Registro: só quem gerencia o PDI (avaliador ou liderança direta).
create policy pdi_checkins_insert on public.pdi_checkins
  for insert to authenticated
  with check (
    lider_id = (select auth.uid())
    and public.can_manage_pdi((select auth.uid()), pdi_plan_id)
  );

create policy pdi_checkins_update on public.pdi_checkins
  for update to authenticated
  using (public.can_manage_pdi((select auth.uid()), pdi_plan_id))
  with check (public.can_manage_pdi((select auth.uid()), pdi_plan_id));

create policy pdi_checkins_delete on public.pdi_checkins
  for delete to authenticated
  using (public.can_manage_pdi((select auth.uid()), pdi_plan_id));

commit;
