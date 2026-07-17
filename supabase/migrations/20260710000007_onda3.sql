-- ============================================================
-- BEV OS — Onda 3: PDI, Warnings (pontos/bandeiras), Frequência,
-- Benchs + liderados_view (ADD §3.7–3.10, §6 item 4)
-- Pesos das bandeiras (a validar): branca 1 · amarela 3 ·
-- vermelha 5 · preta 10. 10 pontos = 1 agravo; 3 agravos =
-- probatório — cadeia 100% via trigger (ADD §3.8).
-- ============================================================

create type public.pdi_goal_status as enum ('aberta', 'concluida');
create type public.justification_status as enum ('pendente', 'aprovado', 'rejeitado');
create type public.flag_cor as enum ('branca', 'amarela', 'vermelha', 'preta');
create type public.probation_status as enum ('em_andamento', 'sucesso', 'desligamento');

create or replace function public.pc_subarea_id()
returns uuid language sql security definer set search_path = public stable as $$
  select id from public.subareas where slug = 'pessoas_cultura';
$$;
revoke execute on function public.pc_subarea_id() from public, anon;
grant execute on function public.pc_subarea_id() to authenticated, service_role;

-- ---------- 3.7 PDI ----------
create table public.pdi_plans (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  avaliador_id uuid not null references public.people (id),
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  visao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, cycle_id)
);
create trigger pdi_plans_updated_at before update on public.pdi_plans
  for each row execute function public.set_updated_at();

create table public.pdi_goals (
  id uuid primary key default gen_random_uuid(),
  pdi_plan_id uuid not null references public.pdi_plans (id) on delete cascade,
  meta text not null,
  status public.pdi_goal_status not null default 'aberta',
  evidencia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger pdi_goals_updated_at before update on public.pdi_goals
  for each row execute function public.set_updated_at();

-- Leitura: avaliado, aplicador ou liderança direta da subárea (ADD §3.7)
create or replace function public.can_see_pdi(uid uuid, plan_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.pdi_plans pl
    where pl.id = plan_id
      and (
        pl.person_id = uid or pl.avaliador_id = uid
        or exists (
          select 1 from public.occupations o
          where o.person_id = pl.person_id
            and o.cycle_id = public.current_cycle_id()
            and public.is_leader_of(uid, o.subarea_id)
        )
      )
  );
$$;

create or replace function public.can_manage_pdi(uid uuid, plan_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.pdi_plans pl
    where pl.id = plan_id
      and (
        pl.avaliador_id = uid
        or exists (
          select 1 from public.occupations o
          where o.person_id = pl.person_id
            and o.cycle_id = public.current_cycle_id()
            and public.is_leader_of(uid, o.subarea_id)
        )
      )
  );
$$;
revoke execute on function public.can_see_pdi(uuid, uuid) from public, anon;
revoke execute on function public.can_manage_pdi(uuid, uuid) from public, anon;
grant execute on function public.can_see_pdi(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_manage_pdi(uuid, uuid) to authenticated, service_role;

alter table public.pdi_plans enable row level security;
revoke all on public.pdi_plans from anon;
grant select, insert, update on public.pdi_plans to authenticated;
grant all on public.pdi_plans to service_role;

create policy pdi_plans_select on public.pdi_plans
  for select to authenticated using (public.can_see_pdi((select auth.uid()), id));
create policy pdi_plans_insert on public.pdi_plans
  for insert to authenticated
  with check (
    avaliador_id = (select auth.uid())
    and cycle_id = public.current_cycle_id()
    and exists (
      select 1 from public.occupations o
      where o.person_id = pdi_plans.person_id
        and o.cycle_id = public.current_cycle_id()
        and public.is_leader_of((select auth.uid()), o.subarea_id)
    )
  );
create policy pdi_plans_update on public.pdi_plans
  for update to authenticated
  using (cycle_id = public.current_cycle_id() and public.can_manage_pdi((select auth.uid()), id))
  with check (cycle_id = public.current_cycle_id());

alter table public.pdi_goals enable row level security;
revoke all on public.pdi_goals from anon;
grant select, insert, update, delete on public.pdi_goals to authenticated;
grant all on public.pdi_goals to service_role;

create policy pdi_goals_select on public.pdi_goals
  for select to authenticated using (public.can_see_pdi((select auth.uid()), pdi_plan_id));
create policy pdi_goals_insert on public.pdi_goals
  for insert to authenticated with check (public.can_manage_pdi((select auth.uid()), pdi_plan_id));
create policy pdi_goals_update on public.pdi_goals
  for update to authenticated using (public.can_manage_pdi((select auth.uid()), pdi_plan_id));
create policy pdi_goals_delete on public.pdi_goals
  for delete to authenticated using (public.can_manage_pdi((select auth.uid()), pdi_plan_id));

-- ---------- 3.8 Warnings ----------
create table public.warning_flags (
  id uuid primary key default gen_random_uuid(),
  cor public.flag_cor not null unique,
  pontos int not null
);
insert into public.warning_flags (cor, pontos) values
  ('branca', 1), ('amarela', 3), ('vermelha', 5), ('preta', 10);

create table public.warnings (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  flag_id uuid not null references public.warning_flags (id),
  justificativa text not null,
  aplicado_por uuid not null references public.people (id),
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  created_at timestamptz not null default now()
);
create index warnings_person_idx on public.warnings (person_id, cycle_id);

create table public.agravos (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  cycle_id uuid not null references public.cycles (id),
  numero int not null,
  created_at timestamptz not null default now(),
  unique (person_id, cycle_id, numero)
);

create table public.probation_periods (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  cycle_id uuid not null references public.cycles (id),
  status public.probation_status not null default 'em_andamento',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, cycle_id)
);
create trigger probation_periods_updated_at before update on public.probation_periods
  for each row execute function public.set_updated_at();

-- Cadeia sistêmica: pontos → agravos (múltiplos de 10) → probatório (3º)
create or replace function public.enforce_warning_chain()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  total int;
  devidos int;
  n int;
begin
  select coalesce(sum(f.pontos), 0) into total
  from public.warnings w join public.warning_flags f on f.id = w.flag_id
  where w.person_id = new.person_id and w.cycle_id = new.cycle_id;
  devidos := total / 10;
  select count(*) into n from public.agravos
  where person_id = new.person_id and cycle_id = new.cycle_id;
  while n < devidos loop
    n := n + 1;
    insert into public.agravos (person_id, cycle_id, numero) values (new.person_id, new.cycle_id, n);
  end loop;
  if n >= 3 then
    insert into public.probation_periods (person_id, cycle_id)
    values (new.person_id, new.cycle_id)
    on conflict (person_id, cycle_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger warnings_chain after insert on public.warnings
  for each row execute function public.enforce_warning_chain();

-- Visibilidade: titular + equipe de P&C (PRD §5 Onda 3)
alter table public.warning_flags enable row level security;
revoke all on public.warning_flags from anon;
grant select on public.warning_flags to authenticated;
grant all on public.warning_flags to service_role;
create policy warning_flags_select on public.warning_flags for select to authenticated using (true);

alter table public.warnings enable row level security;
revoke all on public.warnings from anon;
grant select, insert on public.warnings to authenticated;
grant all on public.warnings to service_role;
create policy warnings_select on public.warnings
  for select to authenticated
  using (
    person_id = (select auth.uid())
    or public.belongs_to_subarea((select auth.uid()), public.pc_subarea_id())
  );
create policy warnings_insert on public.warnings
  for insert to authenticated
  with check (
    aplicado_por = (select auth.uid())
    and cycle_id = public.current_cycle_id()
    and public.belongs_to_subarea((select auth.uid()), public.pc_subarea_id())
  );

alter table public.agravos enable row level security;
revoke all on public.agravos from anon;
grant select on public.agravos to authenticated;
grant all on public.agravos to service_role;
create policy agravos_select on public.agravos
  for select to authenticated
  using (
    person_id = (select auth.uid())
    or public.belongs_to_subarea((select auth.uid()), public.pc_subarea_id())
  );

alter table public.probation_periods enable row level security;
revoke all on public.probation_periods from anon;
grant select, update on public.probation_periods to authenticated;
grant all on public.probation_periods to service_role;
create policy probation_select on public.probation_periods
  for select to authenticated
  using (
    person_id = (select auth.uid())
    or public.belongs_to_subarea((select auth.uid()), public.pc_subarea_id())
  );
create policy probation_update on public.probation_periods
  for update to authenticated
  using (public.is_leader_of((select auth.uid()), public.pc_subarea_id()))
  with check (true);

-- Totais por pessoa no ciclo (gated no WHERE, mesma regra de leitura)
create view public.person_warning_totals as
select w.person_id, w.cycle_id, sum(f.pontos)::int as pontos,
  (select count(*)::int from public.agravos a where a.person_id = w.person_id and a.cycle_id = w.cycle_id) as agravos
from public.warnings w join public.warning_flags f on f.id = w.flag_id
where w.person_id = auth.uid()
   or public.belongs_to_subarea(auth.uid(), public.pc_subarea_id())
group by w.person_id, w.cycle_id;
revoke all on public.person_warning_totals from anon, public;
grant select on public.person_warning_totals to authenticated, service_role;

-- ---------- 3.9 Frequência ----------
create table public.absence_justifications (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  motivo text not null,
  status public.justification_status not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger absence_justifications_updated_at before update on public.absence_justifications
  for each row execute function public.set_updated_at();

alter table public.absence_justifications enable row level security;
revoke all on public.absence_justifications from anon;
grant select, insert, update on public.absence_justifications to authenticated;
grant all on public.absence_justifications to service_role;
create policy absence_select on public.absence_justifications
  for select to authenticated
  using (
    person_id = (select auth.uid())
    or public.can_manage_event((select auth.uid()), event_id)
  );
create policy absence_insert on public.absence_justifications
  for insert to authenticated
  with check (
    person_id = (select auth.uid())
    and public.can_see_event((select auth.uid()), event_id)
  );
create policy absence_update on public.absence_justifications
  for update to authenticated
  using (public.can_manage_event((select auth.uid()), event_id));

-- ---------- 3.10 Benchs ----------
create table public.benchs (
  id uuid primary key default gen_random_uuid(),
  subarea_id uuid not null references public.subareas (id),
  organizacao_parceira text not null,
  data date not null,
  insights text,
  gravacao_url text,
  criado_por uuid not null references public.people (id),
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger benchs_updated_at before update on public.benchs
  for each row execute function public.set_updated_at();

alter table public.benchs enable row level security;
revoke all on public.benchs from anon;
grant select, insert, update, delete on public.benchs to authenticated;
grant all on public.benchs to service_role;
create policy benchs_select on public.benchs
  for select to authenticated
  using (
    public.belongs_to_subarea((select auth.uid()), subarea_id)
    or public.is_direx((select auth.uid()))
  );
create policy benchs_insert on public.benchs
  for insert to authenticated
  with check (
    criado_por = (select auth.uid())
    and cycle_id = public.current_cycle_id()
    and (
      public.belongs_to_subarea((select auth.uid()), subarea_id)
      or public.is_leader_of((select auth.uid()), subarea_id)
    )
  );
create policy benchs_update on public.benchs
  for update to authenticated
  using (
    cycle_id = public.current_cycle_id()
    and (criado_por = (select auth.uid()) or public.is_leader_of((select auth.uid()), subarea_id))
  )
  with check (cycle_id = public.current_cycle_id());
create policy benchs_delete on public.benchs
  for delete to authenticated
  using (
    cycle_id = public.current_cycle_id()
    and (criado_por = (select auth.uid()) or public.is_leader_of((select auth.uid()), subarea_id))
  );

-- ---------- liderados_view (Meus Assessores / Meus Liderados) ----------
-- Gerente/Coordenador: assessores/analistas da própria subárea.
-- Diretor: todos os gerentes/coordenadores/assessores/analistas.
-- engagement_flag: sem PDI, PDI parado há 30+ dias ou agravo recente.
create view public.liderados_view as
select
  p.id as person_id, p.nome, p.foto_url, o.role, o.subarea_id, s.nome as area,
  pl.id as pdi_id, pl.updated_at as pdi_atualizado_em,
  (select count(*)::int from public.pdi_goals g where g.pdi_plan_id = pl.id and g.status = 'aberta') as metas_abertas,
  (select count(*)::int from public.agravos a where a.person_id = p.id and a.cycle_id = o.cycle_id) as agravos,
  (
    pl.id is null
    or pl.updated_at < now() - interval '30 days'
    or exists (
      select 1 from public.agravos a
      where a.person_id = p.id and a.created_at > now() - interval '60 days'
    )
  ) as risco
from public.occupations o
join public.people p on p.id = o.person_id
join public.subareas s on s.id = o.subarea_id
left join public.pdi_plans pl on pl.person_id = p.id and pl.cycle_id = o.cycle_id
where o.cycle_id = public.current_cycle_id()
  and o.is_hibrido = false
  and (
    (o.role in ('assessor', 'analista') and public.is_leader_of(auth.uid(), o.subarea_id))
    or (o.role in ('gerente', 'coordenador', 'assessor', 'analista') and public.is_direx(auth.uid()))
  )
  and p.id <> auth.uid();
revoke all on public.liderados_view from anon, public;
grant select on public.liderados_view to authenticated, service_role;
