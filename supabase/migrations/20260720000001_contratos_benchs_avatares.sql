-- ============================================================
-- BEV OS — 20/07/2026 — APLICADA EM PRODUÇÃO
-- 1) Contratos fechados (Negócios) + faturamento automático
-- 2) Benchs: registro classificado + gamificado
-- 3) Bucket de fotos de perfil
--
-- NOTA: as migrations 20260717000001_dashboard_diretorias.sql e
-- 20260718000009_fid_bevcoins.sql NUNCA haviam sido aplicadas em
-- produção — foram aplicadas em 20/07/2026 junto com esta.
-- ============================================================

create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) default public.current_cycle_id(),
  cliente text not null,
  valor numeric(14,2) not null check (valor >= 0),
  data_fechamento date not null,
  servico_id uuid references public.project_services(id),
  responsavel_id uuid references public.people(id),
  segmento text not null default 'outro' check (segmento in ('pme','ej','atletica','governo','ies','outro')),
  observacoes text,
  criado_por uuid not null references public.people(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contratos_data_idx on public.contratos (data_fechamento);

alter table public.contratos enable row level security;
revoke all on public.contratos from anon;
grant select, insert, update, delete on public.contratos to authenticated;
grant all on public.contratos to service_role;

drop trigger if exists set_contratos_updated_at on public.contratos;
create trigger set_contratos_updated_at before update on public.contratos
  for each row execute function public.set_updated_at();

drop policy if exists contratos_select on public.contratos;
drop policy if exists contratos_insert on public.contratos;
drop policy if exists contratos_update on public.contratos;
drop policy if exists contratos_delete on public.contratos;
create policy contratos_select on public.contratos for select to authenticated using (true);
create policy contratos_insert on public.contratos for insert to authenticated
  with check (public.can_edit_dir_metrics((select auth.uid()), 'negocios'));
create policy contratos_update on public.contratos for update to authenticated
  using (public.can_edit_dir_metrics((select auth.uid()), 'negocios'))
  with check (public.can_edit_dir_metrics((select auth.uid()), 'negocios'));
create policy contratos_delete on public.contratos for delete to authenticated
  using (public.can_edit_dir_metrics((select auth.uid()), 'negocios'));

create or replace function public.faturamento_ano(p_ano int)
returns table(ano int, mes int, meta numeric, realizado_manual numeric, realizado_contratos numeric)
language sql security definer set search_path = public stable as $$
  with meses as (select generate_series(1,12) as mes),
  contratos_mes as (
    select extract(month from data_fechamento)::int as mes, sum(valor) as total
    from public.contratos
    where extract(year from data_fechamento)::int = p_ano
    group by 1
  )
  select
    p_ano,
    m.mes,
    coalesce(f.meta, 0)::numeric,
    f.realizado,
    coalesce(sum(cm.total) over (order by m.mes rows between unbounded preceding and current row), 0)::numeric
  from meses m
  left join public.faturamento_mensal f on f.ano = p_ano and f.mes = m.mes
  left join contratos_mes cm on cm.mes = m.mes
  order by m.mes;
$$;
revoke execute on function public.faturamento_ano(int) from public, anon;
grant execute on function public.faturamento_ano(int) to authenticated, service_role;

do $$ begin
  create type public.bench_tipo as enum ('ej','pos_junior','membro_bev','outro');
exception when duplicate_object then null; end $$;

alter table public.benchs add column if not exists tipo public.bench_tipo not null default 'ej';
alter table public.benchs add column if not exists aprendizados text;
alter table public.benchs add column if not exists avaliacao int check (avaliacao between 1 and 5);
alter table public.benchs alter column organizacao_parceira drop not null;
alter table public.benchs alter column data type timestamptz using data::timestamptz;

create table if not exists public.bench_participantes (
  id uuid primary key default gen_random_uuid(),
  bench_id uuid not null references public.benchs(id) on delete cascade,
  nome text not null,
  email text,
  organizacao text,
  tipo public.bench_tipo not null default 'ej',
  created_at timestamptz not null default now()
);
create index if not exists bench_participantes_bench_idx on public.bench_participantes (bench_id);

alter table public.bench_participantes enable row level security;
revoke all on public.bench_participantes from anon;
grant select, insert, update, delete on public.bench_participantes to authenticated;
grant all on public.bench_participantes to service_role;

drop policy if exists bench_part_select on public.bench_participantes;
drop policy if exists bench_part_write on public.bench_participantes;
create policy bench_part_select on public.bench_participantes for select to authenticated using (true);
create policy bench_part_write on public.bench_participantes for all to authenticated
  using (exists (
    select 1 from public.benchs b
    where b.id = bench_id
      and b.cycle_id = public.current_cycle_id()
      and (b.criado_por = (select auth.uid()) or public.is_leader_of((select auth.uid()), b.subarea_id))
  ))
  with check (exists (
    select 1 from public.benchs b
    where b.id = bench_id
      and b.cycle_id = public.current_cycle_id()
      and (b.criado_por = (select auth.uid()) or public.is_leader_of((select auth.uid()), b.subarea_id))
  ));

insert into public.bench_participantes (bench_id, nome, email, organizacao, tipo)
select b.id, b.membro_nome, b.membro_email, b.organizacao_parceira, 'ej'
from public.benchs b
where b.membro_nome is not null
  and not exists (select 1 from public.bench_participantes p where p.bench_id = b.id);

drop policy if exists benchs_select on public.benchs;
create policy benchs_select on public.benchs for select to authenticated using (true);

insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do update set public = true;

drop policy if exists avatares_public_read on storage.objects;
drop policy if exists avatares_insert_own on storage.objects;
drop policy if exists avatares_update_own on storage.objects;
drop policy if exists avatares_delete_own on storage.objects;

create policy avatares_public_read on storage.objects for select
  using (bucket_id = 'avatares');
create policy avatares_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatares_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatares_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
