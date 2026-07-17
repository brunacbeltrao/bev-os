-- ============================================================
-- BEV OS — Onda 4: Maturidade Institucional
--  1) finance_entries — caixa único (Diretoria de Gestão). Todos
--     LEEM (saldo, entradas e saídas com descrição); Gestão + Direx
--     lançam. subarea_id é só dimensão de relatório.
--  2) memory_docs — POPs/atas/templates/contratos com busca. Só
--     P&C + Direx publicam; todos leem.
--  3) views de dashboard: dashboard_entrega (liderança) e
--     dashboard_warnings (Direx + P&C).
-- ============================================================

begin;

-- helper: subárea da Gestão (para RLS do financeiro)
create or replace function public.gestao_subarea_id()
returns uuid language sql security definer set search_path = public stable as $$
  select id from public.subareas where slug = 'gestao';
$$;
revoke execute on function public.gestao_subarea_id() from public, anon;
grant execute on function public.gestao_subarea_id() to authenticated, service_role;

-- quem gerencia o caixa: Direx ou liderança da Gestão
create or replace function public.can_manage_finance(uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_direx(uid) or public.is_leader_of(uid, public.gestao_subarea_id());
$$;
revoke execute on function public.can_manage_finance(uuid) from public, anon;
grant execute on function public.can_manage_finance(uuid) to authenticated, service_role;

-- ---------- 1) Financeiro ----------
create type public.finance_tipo as enum ('entrada', 'saida');
create table public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  tipo public.finance_tipo not null,
  valor numeric(14, 2) not null check (valor >= 0),
  descricao text not null,
  data date not null default current_date,
  subarea_id uuid references public.subareas (id), -- dimensão de relatório (nullable)
  aprovado_por uuid references public.people (id),
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger finance_entries_updated_at before update on public.finance_entries
  for each row execute function public.set_updated_at();

alter table public.finance_entries enable row level security;
revoke all on public.finance_entries from anon;
grant select, insert, update, delete on public.finance_entries to authenticated;
grant all on public.finance_entries to service_role;

-- Todos os membros veem o caixa (transparência institucional).
create policy finance_select on public.finance_entries
  for select to authenticated using (true);
create policy finance_insert on public.finance_entries
  for insert to authenticated
  with check (
    cycle_id = public.current_cycle_id()
    and public.can_manage_finance((select auth.uid()))
  );
create policy finance_update on public.finance_entries
  for update to authenticated
  using (cycle_id = public.current_cycle_id() and public.can_manage_finance((select auth.uid())))
  with check (cycle_id = public.current_cycle_id());
create policy finance_delete on public.finance_entries
  for delete to authenticated
  using (cycle_id = public.current_cycle_id() and public.can_manage_finance((select auth.uid())));

-- ---------- 2) Memória Institucional ----------
create type public.memory_tipo as enum ('pop', 'ata', 'template', 'contrato');
create table public.memory_docs (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  conteudo text not null default '',
  tipo public.memory_tipo not null,
  subarea_id uuid references public.subareas (id),
  autor_id uuid not null references public.people (id),
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger memory_docs_updated_at before update on public.memory_docs
  for each row execute function public.set_updated_at();

alter table public.memory_docs enable row level security;
revoke all on public.memory_docs from anon;
grant select, insert, update, delete on public.memory_docs to authenticated;
grant all on public.memory_docs to service_role;

-- quem publica: Direx ou liderança de P&C
create or replace function public.can_manage_memory(uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_direx(uid) or public.is_leader_of(uid, public.pc_subarea_id());
$$;
revoke execute on function public.can_manage_memory(uuid) from public, anon;
grant execute on function public.can_manage_memory(uuid) to authenticated, service_role;

create policy memory_select on public.memory_docs
  for select to authenticated using (true);
create policy memory_insert on public.memory_docs
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and cycle_id = public.current_cycle_id()
    and public.can_manage_memory((select auth.uid()))
  );
create policy memory_update on public.memory_docs
  for update to authenticated
  using (cycle_id = public.current_cycle_id() and public.can_manage_memory((select auth.uid())))
  with check (cycle_id = public.current_cycle_id());
create policy memory_delete on public.memory_docs
  for delete to authenticated
  using (cycle_id = public.current_cycle_id() and public.can_manage_memory((select auth.uid())));

-- ---------- 3) Views de dashboard ----------
-- Taxa de entrega por subárea (liderança vê a organização inteira —
-- contagem de demandas não é sigilosa).
create view public.dashboard_entrega as
select
  s.id as subarea_id,
  s.nome as area,
  s.directorate_id,
  count(dm.id)::int as total,
  (count(dm.id) filter (where dm.status = 'concluido'))::int as concluidas
from public.subareas s
left join public.demands dm
  on dm.subarea_id = s.id and dm.cycle_id = public.current_cycle_id()
where public.is_lideranca(auth.uid()) or public.is_direx(auth.uid())
group by s.id, s.nome, s.directorate_id;
revoke all on public.dashboard_entrega from anon, public;
grant select on public.dashboard_entrega to authenticated, service_role;

-- Warnings consolidados por diretoria (só Direx e P&C — dado sensível).
create view public.dashboard_warnings as
select
  d.id as directorate_id,
  d.nome as diretoria,
  (
    select count(*)::int from public.agravos a
    join public.occupations o on o.person_id = a.person_id and o.cycle_id = a.cycle_id and o.is_hibrido = false
    where o.directorate_id = d.id and a.cycle_id = public.current_cycle_id()
  ) as agravos,
  (
    select count(*)::int from public.probation_periods p
    join public.occupations o on o.person_id = p.person_id and o.cycle_id = p.cycle_id and o.is_hibrido = false
    where o.directorate_id = d.id and p.cycle_id = public.current_cycle_id() and p.status = 'em_andamento'
  ) as probatorios
from public.directorates d
where public.is_direx(auth.uid())
   or public.is_leader_of(auth.uid(), public.pc_subarea_id());
revoke all on public.dashboard_warnings from anon, public;
grant select on public.dashboard_warnings to authenticated, service_role;

commit;
