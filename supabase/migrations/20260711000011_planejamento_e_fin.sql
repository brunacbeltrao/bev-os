-- ============================================================
-- BEV OS — Onda 4.1
--  1) Correção: só a ÁREA DE GESTÃO (assessor/gerente/diretor) edita
--     o Financeiro — não a Direx toda.
--  2) Seed do caixa real (semana 01–07/06) — saldo atual 48.576,78.
--  3) Planejamento Estratégico: foco/propósito + Objetivos
--     Estratégicos com OKRs, KPIs e diretorias responsáveis.
--     Todos leem; só Direx edita.
-- ============================================================

begin;

-- ---------- 1) Financeiro: quem edita = área de Gestão ----------
create or replace function public.can_manage_finance(uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.belongs_to_subarea(uid, public.gestao_subarea_id());
$$;

-- ---------- 2) Seed do caixa (idempotente) ----------
do $$
begin
  if not exists (select 1 from public.finance_entries) then
    insert into public.finance_entries (tipo, valor, descricao, data) values
      ('entrada', 48765.45, 'Saldo inicial do caixa (acumulado até 31/05)', '2026-05-31'),
      ('entrada', 222.28, '3ª parcela - Assessoria Jurídica 05/2026 - Microred (Microred Ltda)', '2026-06-02'),
      ('saida', 100.00, 'Estorno - Premiação Grupo 4 - José Guilherme Fragoso Dias Fernandes', '2026-06-01'),
      ('saida', 15.00, 'Reembolso - Impressão - Atas 26.1 - Beatriz Santos de Menezes', '2026-06-02'),
      ('saida', 63.95, 'Reembolso - Coffee Break - Evento Seed - Beatriz Santos de Menezes', '2026-06-02'),
      ('saida', 232.00, 'Pagamento INUP Contabilidade - MAIO - PJBANK Pagamentos S.A.', '2026-06-03');
  end if;
end $$;

-- ---------- 3) Planejamento Estratégico ----------
create table public.strategic_plan (
  cycle_id uuid primary key references public.cycles (id),
  foco text not null default '',
  proposito text not null default '',
  updated_at timestamptz not null default now()
);
create trigger strategic_plan_updated_at before update on public.strategic_plan
  for each row execute function public.set_updated_at();

create table public.strategic_objectives (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  titulo text not null,
  descricao text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger strategic_objectives_updated_at before update on public.strategic_objectives
  for each row execute function public.set_updated_at();

create table public.objective_okrs (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.strategic_objectives (id) on delete cascade,
  texto text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create table public.objective_kpis (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.strategic_objectives (id) on delete cascade,
  nome text not null,
  meta text,
  atual text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create table public.objective_directorates (
  objective_id uuid not null references public.strategic_objectives (id) on delete cascade,
  directorate_id uuid not null references public.directorates (id) on delete cascade,
  primary key (objective_id, directorate_id)
);

-- edição de OKR/KPI/diretoria só pela Direx (ciclo vigente).
-- Definida após as tabelas por referenciar strategic_objectives.
create or replace function public.can_edit_objective(uid uuid, obj_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_direx(uid) and exists (
    select 1 from public.strategic_objectives o
    where o.id = obj_id and o.cycle_id = public.current_cycle_id()
  );
$$;
revoke execute on function public.can_edit_objective(uuid, uuid) from public, anon;
grant execute on function public.can_edit_objective(uuid, uuid) to authenticated, service_role;

-- RLS: todos leem; só Direx (ciclo vigente) escreve.
alter table public.strategic_plan enable row level security;
alter table public.strategic_objectives enable row level security;
alter table public.objective_okrs enable row level security;
alter table public.objective_kpis enable row level security;
alter table public.objective_directorates enable row level security;

revoke all on public.strategic_plan, public.strategic_objectives, public.objective_okrs,
  public.objective_kpis, public.objective_directorates from anon;
grant select, insert, update, delete on public.strategic_plan, public.strategic_objectives,
  public.objective_okrs, public.objective_kpis, public.objective_directorates to authenticated;
grant all on public.strategic_plan, public.strategic_objectives, public.objective_okrs,
  public.objective_kpis, public.objective_directorates to service_role;

create policy sp_select on public.strategic_plan for select to authenticated using (true);
create policy sp_insert on public.strategic_plan for insert to authenticated
  with check (cycle_id = public.current_cycle_id() and public.is_direx((select auth.uid())));
create policy sp_update on public.strategic_plan for update to authenticated
  using (cycle_id = public.current_cycle_id() and public.is_direx((select auth.uid())))
  with check (cycle_id = public.current_cycle_id());

create policy so_select on public.strategic_objectives for select to authenticated using (true);
create policy so_insert on public.strategic_objectives for insert to authenticated
  with check (cycle_id = public.current_cycle_id() and public.is_direx((select auth.uid())));
create policy so_update on public.strategic_objectives for update to authenticated
  using (cycle_id = public.current_cycle_id() and public.is_direx((select auth.uid())))
  with check (cycle_id = public.current_cycle_id());
create policy so_delete on public.strategic_objectives for delete to authenticated
  using (cycle_id = public.current_cycle_id() and public.is_direx((select auth.uid())));

create policy okr_select on public.objective_okrs for select to authenticated using (true);
create policy okr_insert on public.objective_okrs for insert to authenticated
  with check (public.can_edit_objective((select auth.uid()), objective_id));
create policy okr_update on public.objective_okrs for update to authenticated
  using (public.can_edit_objective((select auth.uid()), objective_id));
create policy okr_delete on public.objective_okrs for delete to authenticated
  using (public.can_edit_objective((select auth.uid()), objective_id));

create policy kpi_select on public.objective_kpis for select to authenticated using (true);
create policy kpi_insert on public.objective_kpis for insert to authenticated
  with check (public.can_edit_objective((select auth.uid()), objective_id));
create policy kpi_update on public.objective_kpis for update to authenticated
  using (public.can_edit_objective((select auth.uid()), objective_id));
create policy kpi_delete on public.objective_kpis for delete to authenticated
  using (public.can_edit_objective((select auth.uid()), objective_id));

create policy od_select on public.objective_directorates for select to authenticated using (true);
create policy od_insert on public.objective_directorates for insert to authenticated
  with check (public.can_edit_objective((select auth.uid()), objective_id));
create policy od_delete on public.objective_directorates for delete to authenticated
  using (public.can_edit_objective((select auth.uid()), objective_id));

commit;
