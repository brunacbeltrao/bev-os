-- ============================================================
-- BEV OS — Auditoria de Segurança (RLS, helpers e integridade)
--
-- Correções desta migration:
-- 1. is_pc(): SECURITY DEFINER sem search_path fixo (risco de
--    hijack), sem STABLE e baseada em approved_roster (fora do
--    padrão RBAC). Reescrita sobre occupations, ciclo vigente.
-- 2. Policies de otos consultavam approved_roster diretamente —
--    o RLS do roster (só Direx/P&C leem) se aplica DENTRO da
--    policy, então o branch do gerente sempre retornava vazio:
--    gerentes não viam os próprios OTOs. Trocado por
--    is_leader_of() (SECURITY DEFINER, occupations, ciclo atual),
--    que já escopa diretor à própria diretoria.
-- 3. one_on_ones: is_direx() dava a qualquer diretor acesso aos
--    1:1s de TODAS as diretorias. Escopado para a diretoria do
--    próprio diretor via is_diretor_of_person(). INSERT agora
--    exige que o liderado pertença a uma subárea que o gerente
--    lidera.
-- 4. Integridade: trigger de updated_at, índices de FK, check de
--    pretensao_lideranca e validação subarea ∈ diretoria no OTO.
-- 5. Hygiene de search_path nos helpers do módulo FID.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) is_pc(): reescrita segura (occupations + ciclo vigente)
-- ------------------------------------------------------------
create or replace function public.is_pc(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.occupations o
    join public.subareas s on s.id = o.subarea_id
    where o.person_id = uid
      and o.cycle_id = public.current_cycle_id()
      and s.slug = 'pessoas_cultura'
  );
$$;

revoke execute on function public.is_pc(uuid) from public, anon;
grant execute on function public.is_pc(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- Helper novo: diretor (ciclo vigente) da diretoria em que a
-- pessoa-alvo possui vínculo. Usado para escopar 1:1s.
-- ------------------------------------------------------------
create or replace function public.is_diretor_of_person(uid uuid, target uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.occupations od
    join public.occupations ot
      on ot.directorate_id = od.directorate_id
     and ot.cycle_id = od.cycle_id
    where od.person_id = uid
      and od.role = 'diretor'
      and od.cycle_id = public.current_cycle_id()
      and ot.person_id = target
  );
$$;

revoke execute on function public.is_diretor_of_person(uuid, uuid) from public, anon;
grant execute on function public.is_diretor_of_person(uuid, uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- 2) otos: policies corretas e escopadas
--    is_leader_of(uid, subarea_id) cobre gerente/coordenador da
--    subárea E diretor da diretoria dona — sem tocar no roster.
-- ------------------------------------------------------------
drop policy if exists otos_select on public.otos;
drop policy if exists otos_all on public.otos;

create policy otos_select on public.otos
  for select to authenticated
  using (
    public.is_leader_of((select auth.uid()), subarea_id)
    or public.is_pc((select auth.uid()))
  );

create policy otos_insert on public.otos
  for insert to authenticated
  with check (
    public.is_leader_of((select auth.uid()), subarea_id)
    -- integridade: a subárea precisa pertencer à diretoria declarada
    and exists (
      select 1 from public.subareas s
      where s.id = subarea_id and s.directorate_id = otos.directorate_id
    )
  );

create policy otos_update on public.otos
  for update to authenticated
  using (public.is_leader_of((select auth.uid()), subarea_id))
  with check (
    public.is_leader_of((select auth.uid()), subarea_id)
    and exists (
      select 1 from public.subareas s
      where s.id = subarea_id and s.directorate_id = otos.directorate_id
    )
  );

create policy otos_delete on public.otos
  for delete to authenticated
  using (public.is_leader_of((select auth.uid()), subarea_id));

-- ------------------------------------------------------------
-- 3) one_on_ones: acesso escopado por papel
--    - gerente autor: tudo (mas só pode registrar 1:1 de quem lidera)
--    - liderado: lê o próprio registro
--    - P&C: leitura global (função da área)
--    - diretor: leitura apenas dos 1:1s da própria diretoria
-- ------------------------------------------------------------
drop policy if exists one_on_ones_select on public.one_on_ones;
drop policy if exists one_on_ones_all on public.one_on_ones;

create policy one_on_ones_select on public.one_on_ones
  for select to authenticated
  using (
    gerente_id = (select auth.uid())
    or liderado_id = (select auth.uid())
    or public.is_pc((select auth.uid()))
    or public.is_diretor_of_person((select auth.uid()), gerente_id)
  );

create policy one_on_ones_insert on public.one_on_ones
  for insert to authenticated
  with check (
    gerente_id = (select auth.uid())
    -- o liderado precisa ter vínculo, no ciclo vigente, em uma
    -- subárea que o autor lidera (gerente/coordenador/diretor)
    and exists (
      select 1 from public.occupations ol
      where ol.person_id = liderado_id
        and ol.cycle_id = public.current_cycle_id()
        and public.is_leader_of((select auth.uid()), ol.subarea_id)
    )
  );

create policy one_on_ones_update on public.one_on_ones
  for update to authenticated
  using (gerente_id = (select auth.uid()))
  with check (gerente_id = (select auth.uid()));

create policy one_on_ones_delete on public.one_on_ones
  for delete to authenticated
  using (gerente_id = (select auth.uid()));

-- ------------------------------------------------------------
-- 4) Integridade e performance
-- ------------------------------------------------------------
-- Triggers de updated_at (faltavam; o client compensava na mão)
drop trigger if exists otos_updated_at on public.otos;
create trigger otos_updated_at
  before update on public.otos
  for each row execute function public.set_updated_at();

drop trigger if exists one_on_ones_updated_at on public.one_on_ones;
create trigger one_on_ones_updated_at
  before update on public.one_on_ones
  for each row execute function public.set_updated_at();

-- Índices de FK usados pelas queries do painel e pelas policies
create index if not exists otos_subarea_idx on public.otos (subarea_id);
create index if not exists otos_directorate_idx on public.otos (directorate_id);
create index if not exists otos_cycle_idx on public.otos (cycle_id);
create index if not exists one_on_ones_gerente_idx on public.one_on_ones (gerente_id);
create index if not exists one_on_ones_liderado_idx on public.one_on_ones (liderado_id);
create index if not exists one_on_ones_cycle_idx on public.one_on_ones (cycle_id);

-- pretensao_lideranca era text livre com valores documentados só
-- em comentário; normaliza dados fora do domínio e trava o check.
update public.one_on_ones
  set pretensao_lideranca = null
  where pretensao_lideranca is not null
    and pretensao_lideranca not in ('sim', 'nao', 'talvez');

alter table public.one_on_ones
  drop constraint if exists one_on_ones_pretensao_check;
alter table public.one_on_ones
  add constraint one_on_ones_pretensao_check
  check (pretensao_lideranca is null or pretensao_lideranca in ('sim', 'nao', 'talvez'));

-- Grants explícitos (padrão ADD §4: nada para anon)
revoke all on public.otos, public.one_on_ones from anon;
grant select, insert, update, delete on public.otos, public.one_on_ones to authenticated;
grant all on public.otos, public.one_on_ones to service_role;

-- ------------------------------------------------------------
-- 5) Hygiene: search_path fixo nos SECURITY DEFINER do FID
--    (sem search_path fixo, um schema malicioso no path pode
--    sombrear tabelas/funções referenciadas)
-- ------------------------------------------------------------
alter function public.is_diretor_gestao(uuid) set search_path = public;
alter function public.is_diretora_negocios(uuid) set search_path = public;
alter function public.is_eligible_for_bevcoins(uuid) set search_path = public;
alter function public.get_available_bevcoins(uuid, uuid) set search_path = public;
alter function public.get_total_earned_bevcoins(uuid, uuid) set search_path = public;

revoke execute on function public.is_diretor_gestao(uuid) from public, anon;
revoke execute on function public.is_diretora_negocios(uuid) from public, anon;
revoke execute on function public.is_eligible_for_bevcoins(uuid) from public, anon;
revoke execute on function public.get_available_bevcoins(uuid, uuid) from public, anon;
revoke execute on function public.get_total_earned_bevcoins(uuid, uuid) from public, anon;

grant execute on function public.is_diretor_gestao(uuid) to authenticated, service_role;
grant execute on function public.is_diretora_negocios(uuid) to authenticated, service_role;
grant execute on function public.is_eligible_for_bevcoins(uuid) to authenticated, service_role;
grant execute on function public.get_available_bevcoins(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_total_earned_bevcoins(uuid, uuid) to authenticated, service_role;

commit;
