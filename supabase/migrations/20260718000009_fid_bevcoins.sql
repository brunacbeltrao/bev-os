-- ============================================================
-- BEV OS — Módulo FID (Fundo Individual de Desenvolvimento)
-- Cria as tabelas e funções para gerenciar os BevCoins
-- ============================================================

begin;

-- Tipos Enum
create type public.bevcoins_transaction_type as enum ('credit', 'debit');
create type public.bevcoins_transaction_status as enum ('pending', 'approved', 'rejected');

-- Tabela principal de extrato
create table public.bevcoins_transactions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  type public.bevcoins_transaction_type not null,
  amount numeric(10,2) not null check (amount > 0),
  description text not null,
  status public.bevcoins_transaction_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Triggers de updated_at
create trigger handle_updated_at before update on public.bevcoins_transactions
  for each row execute function extensions.moddatetime('updated_at');

-- ============================================================
-- Helper Functions para Permissões e Elegibilidade
-- ============================================================

create or replace function public.is_diretor_gestao(uid uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.occupations o
    join public.directorates d on d.id = o.directorate_id
    join public.cycles c on c.id = o.cycle_id
    where o.person_id = uid and c.is_current = true
    and d.slug = 'gestao' and o.role = 'diretor'
  );
$$;

create or replace function public.is_diretora_negocios(uid uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.occupations o
    join public.directorates d on d.id = o.directorate_id
    join public.cycles c on c.id = o.cycle_id
    where o.person_id = uid and c.is_current = true
    and d.slug = 'negocios' and o.role = 'diretor'
  );
$$;

create or replace function public.is_eligible_for_bevcoins(uid uuid)
returns boolean
language sql security definer stable
as $$
  select not (public.is_diretor_gestao(uid) or public.is_diretora_negocios(uid));
$$;

-- Calcula o saldo disponível (créditos aprovados - débitos aprovados e pendentes)
create or replace function public.get_available_bevcoins(p_person_id uuid, p_cycle_id uuid)
returns numeric
language sql security definer stable
as $$
  select coalesce(
    (select sum(amount) from public.bevcoins_transactions 
     where person_id = p_person_id and cycle_id = p_cycle_id 
     and type = 'credit' and status = 'approved') 
    - 
    (select sum(amount) from public.bevcoins_transactions 
     where person_id = p_person_id and cycle_id = p_cycle_id 
     and type = 'debit' and status in ('approved', 'pending'))
  , 0);
$$;

-- Calcula o ganho total (soma de créditos aprovados) para o Ranking
create or replace function public.get_total_earned_bevcoins(p_person_id uuid, p_cycle_id uuid)
returns numeric
language sql security definer stable
as $$
  select coalesce(
    (select sum(amount) from public.bevcoins_transactions 
     where person_id = p_person_id and cycle_id = p_cycle_id 
     and type = 'credit' and status = 'approved')
  , 0);
$$;

-- View para o Ranking Institucional (transparente)
create or replace view public.bevcoins_ranking as
select 
  p.id as person_id,
  p.nome,
  p.foto_url,
  c.id as cycle_id,
  public.get_total_earned_bevcoins(p.id, c.id) as total_earned
from public.people p
cross join public.cycles c
where public.get_total_earned_bevcoins(p.id, c.id) > 0
and public.is_eligible_for_bevcoins(p.id);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table public.bevcoins_transactions enable row level security;

grant select, insert, update on public.bevcoins_transactions to authenticated;
grant select on public.bevcoins_ranking to authenticated;

-- Políticas para bevcoins_transactions
-- 1. Qualquer membro pode ler o seu próprio extrato
drop policy if exists bevcoins_select_own on public.bevcoins_transactions;
create policy bevcoins_select_own on public.bevcoins_transactions
  for select to authenticated
  using (person_id = (select auth.uid()));

-- 2. Lideranças responsáveis podem ler todos os extratos
drop policy if exists bevcoins_select_direx on public.bevcoins_transactions;
create policy bevcoins_select_direx on public.bevcoins_transactions
  for select to authenticated
  using (public.is_diretor_gestao((select auth.uid())) or public.is_diretora_negocios((select auth.uid())));

-- 3. Membros elegíveis podem INSERIR apenas 'debits' como 'pending' para si mesmos
drop policy if exists bevcoins_insert_own_debit on public.bevcoins_transactions;
create policy bevcoins_insert_own_debit on public.bevcoins_transactions
  for insert to authenticated
  with check (
    person_id = (select auth.uid()) 
    and type = 'debit' 
    and status = 'pending'
    and amount <= public.get_available_bevcoins((select auth.uid()), cycle_id)
    and public.is_eligible_for_bevcoins((select auth.uid()))
  );

-- 4. Diretoria de Negócios pode INSERIR créditos aprovados para qualquer um
drop policy if exists bevcoins_insert_direx on public.bevcoins_transactions;
create policy bevcoins_insert_direx on public.bevcoins_transactions
  for insert to authenticated
  with check (
    public.is_diretora_negocios((select auth.uid()))
    and type = 'credit'
    and status = 'approved'
  );

-- 5. Diretoria de Gestão pode ATUALIZAR status de solicitações
drop policy if exists bevcoins_update_direx on public.bevcoins_transactions;
create policy bevcoins_update_direx on public.bevcoins_transactions
  for update to authenticated
  using (public.is_diretor_gestao((select auth.uid())))
  with check (public.is_diretor_gestao((select auth.uid())));

commit;
