-- ============================================================
-- BEV OS — Onda 0 — Migration 2: Helpers de RLS + Políticas
-- Padrão SECURITY DEFINER herdado da Central da Direx (ADD §4)
-- ============================================================

-- ---------- current_cycle_id(): ciclo vigente ----------
create or replace function public.current_cycle_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.cycles where is_current = true limit 1;
$$;

-- ---------- is_direx(uid): possui occupation role='diretor' no ciclo atual ----------
create or replace function public.is_direx(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.occupations o
    where o.person_id = uid
      and o.role = 'diretor'
      and o.cycle_id = public.current_cycle_id()
  );
$$;

-- ---------- has_role(uid, role, subarea_id): papel + escopo de área ----------
-- Inclui vínculo híbrido (a occupation híbrida tem sua própria subarea_id).
create or replace function public.has_role(uid uuid, r public.role_type, sa uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.occupations o
    where o.person_id = uid
      and o.role = r
      and o.subarea_id = sa
      and o.cycle_id = public.current_cycle_id()
  );
$$;

-- ---------- is_leader_of(uid, subarea_id) ----------
-- Gerente/Coordenador da subárea, OU Diretor da diretoria dona da subárea.
create or replace function public.is_leader_of(uid uuid, sa uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.occupations o
    where o.person_id = uid
      and o.cycle_id = public.current_cycle_id()
      and (
        (o.subarea_id = sa and o.role in ('gerente', 'coordenador'))
        or (
          o.role = 'diretor'
          and o.directorate_id = (select s.directorate_id from public.subareas s where s.id = sa)
        )
      )
  );
$$;

-- ---------- belongs_to_subarea(uid, subarea_id): inclui vínculo híbrido ----------
create or replace function public.belongs_to_subarea(uid uuid, sa uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.occupations o
    where o.person_id = uid
      and o.subarea_id = sa
      and o.cycle_id = public.current_cycle_id()
  );
$$;

-- EXECUTE revogado de PUBLIC/anon, concedido só a authenticated (ADD §4)
revoke execute on function public.current_cycle_id() from public, anon;
revoke execute on function public.is_direx(uuid) from public, anon;
revoke execute on function public.has_role(uuid, public.role_type, uuid) from public, anon;
revoke execute on function public.is_leader_of(uuid, uuid) from public, anon;
revoke execute on function public.belongs_to_subarea(uuid, uuid) from public, anon;

grant execute on function public.current_cycle_id() to authenticated, service_role;
grant execute on function public.is_direx(uuid) to authenticated, service_role;
grant execute on function public.has_role(uuid, public.role_type, uuid) to authenticated, service_role;
grant execute on function public.is_leader_of(uuid, uuid) to authenticated, service_role;
grant execute on function public.belongs_to_subarea(uuid, uuid) to authenticated, service_role;

-- ============================================================
-- RLS + GRANTs por tabela
-- Toda tabela: RLS habilitado, GRANT explícito a authenticated
-- + service_role, sem acesso anon (ADD §4).
-- ============================================================

-- ---------- cycles / directorates / subareas / project_nucleos ----------
-- Estrutura organizacional: leitura para qualquer membro autenticado;
-- escrita somente via service_role (gestão administrativa, sem UI na Onda 0).
alter table public.cycles enable row level security;
alter table public.directorates enable row level security;
alter table public.subareas enable row level security;
alter table public.project_nucleos enable row level security;

revoke all on public.cycles, public.directorates, public.subareas, public.project_nucleos from anon;
grant select on public.cycles, public.directorates, public.subareas, public.project_nucleos to authenticated;
grant all on public.cycles, public.directorates, public.subareas, public.project_nucleos to service_role;

create policy cycles_select on public.cycles
  for select to authenticated using (true);

create policy directorates_select on public.directorates
  for select to authenticated using (true);

create policy subareas_select on public.subareas
  for select to authenticated using (true);

create policy project_nucleos_select on public.project_nucleos
  for select to authenticated using (true);

-- ---------- approved_roster ----------
-- Fonte de verdade do cadastro. Sem acesso direto de membros comuns;
-- leitura apenas para Direx e liderança de Pessoas e Cultura.
-- Escrita (carga do roster) somente via service_role / P&C (dashboard).
alter table public.approved_roster enable row level security;

revoke all on public.approved_roster from anon;
grant select on public.approved_roster to authenticated;
grant all on public.approved_roster to service_role;

create policy approved_roster_select_pc on public.approved_roster
  for select to authenticated
  using (
    public.is_direx((select auth.uid()))
    or public.is_leader_of(
      (select auth.uid()),
      (select s.id from public.subareas s where s.slug = 'pessoas_cultura')
    )
  );

-- ---------- people ----------
-- Diretório de membros: visível a todos os autenticados.
-- Cada pessoa edita apenas o próprio registro (nome/foto).
alter table public.people enable row level security;

revoke all on public.people from anon;
grant select, update on public.people to authenticated;
grant all on public.people to service_role;

create policy people_select on public.people
  for select to authenticated using (true);

create policy people_update_own on public.people
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------- occupations ----------
-- Leitura para todos os autenticados (necessária para seletor de
-- contexto, diretório e visões de liderança). Escrita somente via
-- service_role / trigger de cadastro (SECURITY DEFINER) — inclusive
-- o vínculo híbrido, criado pela P&C quando o programa abre.
-- Dados de ciclos anteriores permanecem legíveis e não editáveis
-- (nenhuma política de UPDATE/DELETE para authenticated).
alter table public.occupations enable row level security;

revoke all on public.occupations from anon;
grant select on public.occupations to authenticated;
grant all on public.occupations to service_role;

create policy occupations_select on public.occupations
  for select to authenticated using (true);
