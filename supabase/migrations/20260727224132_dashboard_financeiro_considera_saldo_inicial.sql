-- O saldo do painel da Direx passa a bater com a tela de Financeiro:
-- saldo inicial do ciclo + entradas - saídas.
create or replace function public.dashboard_financeiro()
returns table(saldo numeric, entradas numeric, saidas numeric)
language sql stable security definer set search_path to 'public' as $function$
  with mov as (
    select
      coalesce(sum(case when tipo = 'entrada' then valor else 0 end), 0) as entradas,
      coalesce(sum(case when tipo = 'saida' then valor else 0 end), 0) as saidas
    from public.finance_entries
    where cycle_id = public.current_cycle_id()
  ),
  inicial as (
    select coalesce(max(saldo_inicial), 0) as saldo_inicial
    from public.financeiro_meta
    where cycle_id = public.current_cycle_id()
  )
  select inicial.saldo_inicial + mov.entradas - mov.saidas, mov.entradas, mov.saidas
  from mov, inicial;
$function$;
