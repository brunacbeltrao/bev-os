-- ============================================================
-- BevCoins / FID
--  · lançar crédito: lideranças da Diretoria de Negócios
--  · atestar / reprovar resgate: apenas o Diretor de Gestão
-- ============================================================

create or replace function public.can_launch_bevcoins(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select exists (
    select 1
    from public.occupations o
    join public.directorates d on d.id = o.directorate_id
    where o.person_id = uid
      and o.cycle_id = public.current_cycle_id()
      and d.slug = 'negocios'
      and o.role in ('diretor', 'gerente', 'coordenador')
  );
$fn$;

-- quem lança crédito não acumula BevCoins, assim como o Diretor de Gestão
create or replace function public.is_eligible_for_bevcoins(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select not (public.is_diretor_gestao(uid) or public.can_launch_bevcoins(uid));
$fn$;

drop policy if exists bevcoins_insert_direx on public.bevcoins_transactions;
create policy bevcoins_insert_credito on public.bevcoins_transactions
  for insert to authenticated
  with check (
    public.can_launch_bevcoins((select auth.uid()))
    and type = 'credit'::bevcoins_transaction_type
    and status = 'approved'::bevcoins_transaction_status
  );

drop policy if exists bevcoins_select_direx on public.bevcoins_transactions;
create policy bevcoins_select_admin on public.bevcoins_transactions
  for select to authenticated
  using (
    public.is_diretor_gestao((select auth.uid()))
    or public.can_launch_bevcoins((select auth.uid()))
  );

-- exclusão de crédito lançado por engano fica com quem lançou
drop policy if exists bevcoins_delete_credito on public.bevcoins_transactions;
create policy bevcoins_delete_credito on public.bevcoins_transactions
  for delete to authenticated
  using (
    public.can_launch_bevcoins((select auth.uid()))
    and type = 'credit'::bevcoins_transaction_type
  );
