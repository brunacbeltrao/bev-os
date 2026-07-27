-- ============================================================
-- Financeiro
--  · solicitações de reembolso / investimento pelos membros
--  · aprovação pelas lideranças de Gestão
--  · lançamentos classificáveis + saldo inicial do caixa
-- ============================================================

create or replace function public.is_gestao_lideranca(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select exists (
    select 1
    from public.occupations o
    join public.directorates d on d.id = o.directorate_id
    where o.person_id = uid
      and o.cycle_id = public.current_cycle_id()
      and d.slug = 'gestao'
      and o.role in ('diretor', 'gerente', 'coordenador')
  );
$fn$;

-- ---------- classificação dos lançamentos ----------
do $$ begin
  create type public.finance_categoria as enum (
    'contrato', 'faturamento_colaborativo', 'patrocinio', 'mensalidade',
    'evento', 'reembolso', 'investimento', 'fornecedor', 'material',
    'taxa_bancaria', 'viagem', 'marketing', 'ajuste', 'outros'
  );
exception when duplicate_object then null; end $$;

alter table public.finance_entries
  add column if not exists categoria public.finance_categoria not null default 'outros',
  add column if not exists comprovante_url text,
  add column if not exists criado_por uuid references public.people(id) on update cascade;

alter table public.financeiro_meta
  add column if not exists saldo_inicial numeric(12,2) not null default 0;

-- ---------- solicitações ----------
do $$ begin
  create type public.finance_request_tipo as enum ('reembolso', 'investimento');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.finance_request_status as enum ('pendente', 'aprovado', 'rejeitado');
exception when duplicate_object then null; end $$;

create table if not exists public.finance_requests (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  solicitante_id uuid not null references public.people(id) on delete cascade on update cascade,
  tipo public.finance_request_tipo not null,
  titulo text not null,
  descricao text,
  valor numeric(12,2) not null check (valor > 0),
  categoria public.finance_categoria not null default 'outros',
  comprovante_url text,
  status public.finance_request_status not null default 'pendente',
  avaliado_por uuid references public.people(id) on update cascade,
  avaliado_em timestamptz,
  resposta text,
  finance_entry_id uuid references public.finance_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- reembolso exige comprovante
  constraint finance_request_comprovante
    check (tipo <> 'reembolso' or comprovante_url is not null)
);

create index if not exists finance_requests_cycle_idx
  on public.finance_requests (cycle_id, status, created_at desc);

drop trigger if exists set_updated_at on public.finance_requests;
create trigger set_updated_at before update on public.finance_requests
  for each row execute function public.set_updated_at();

alter table public.finance_requests enable row level security;

drop policy if exists finreq_select on public.finance_requests;
create policy finreq_select on public.finance_requests
  for select to authenticated
  using (
    solicitante_id = (select auth.uid())
    or public.is_gestao_lideranca((select auth.uid()))
  );

drop policy if exists finreq_insert on public.finance_requests;
create policy finreq_insert on public.finance_requests
  for insert to authenticated
  with check (
    solicitante_id = (select auth.uid())
    and cycle_id = public.current_cycle_id()
    and status = 'pendente'::public.finance_request_status
  );

-- o solicitante pode cancelar/corrigir enquanto estiver pendente
drop policy if exists finreq_update_own on public.finance_requests;
create policy finreq_update_own on public.finance_requests
  for update to authenticated
  using (solicitante_id = (select auth.uid()) and status = 'pendente'::public.finance_request_status)
  with check (solicitante_id = (select auth.uid()) and status = 'pendente'::public.finance_request_status);

drop policy if exists finreq_update_gestao on public.finance_requests;
create policy finreq_update_gestao on public.finance_requests
  for update to authenticated
  using (public.is_gestao_lideranca((select auth.uid())))
  with check (public.is_gestao_lideranca((select auth.uid())));

drop policy if exists finreq_delete_own on public.finance_requests;
create policy finreq_delete_own on public.finance_requests
  for delete to authenticated
  using (solicitante_id = (select auth.uid()) and status = 'pendente'::public.finance_request_status);

-- ---------- bucket de comprovantes ----------
insert into storage.buckets (id, name, public)
values ('financeiro', 'financeiro', true)
on conflict (id) do nothing;

drop policy if exists financeiro_read on storage.objects;
create policy financeiro_read on storage.objects
  for select to authenticated using (bucket_id = 'financeiro');

drop policy if exists financeiro_write on storage.objects;
create policy financeiro_write on storage.objects
  for insert to authenticated with check (bucket_id = 'financeiro');

drop policy if exists financeiro_delete on storage.objects;
create policy financeiro_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'financeiro' and (owner = (select auth.uid()) or public.is_gestao_lideranca((select auth.uid()))));
