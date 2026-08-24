-- ============================================================
-- BEV OS · 24/08/2026 — JÁ APLICADO no Supabase.
-- Comercial alimentado pela planilha do Portal BJ (24/08).
-- ============================================================

-- Contrato distratado sai do faturamento sem sumir do histórico.
do $$
begin
  if not exists (select 1 from pg_type where typname='contrato_status') then
    create type public.contrato_status as enum ('aprovado','distratado','pendente');
  end if;
end $$;

alter table public.contratos
  add column if not exists status public.contrato_status not null default 'aprovado',
  add column if not exists distratado_em date;

comment on column public.contratos.status is
  'aprovado conta no faturamento; distratado permanece no histórico mas é excluído dos totais; pendente aguarda segunda fase.';

create index if not exists contratos_status_idx on public.contratos(status);

-- O dashboard somava TODOS os contratos: com a Agrocells distratada
-- mostrava 57.759,01 no lugar dos 55.239,01 reais.
create or replace function public.faturamento_ano(p_ano integer)
returns table(ano integer, mes integer, meta numeric, realizado_manual numeric, realizado_contratos numeric)
language sql stable security definer set search_path to 'public'
as $function$
  with meses as (select generate_series(1,12) as mes),
  contratos_mes as (
    select extract(month from data_fechamento)::int as mes, sum(valor) as total
    from public.contratos
    where extract(year from data_fechamento)::int = p_ano
      and status = 'aprovado'
    group by 1
  )
  select
    p_ano, m.mes, coalesce(f.meta, 0)::numeric, f.realizado,
    coalesce(sum(cm.total) over (order by m.mes rows between unbounded preceding and current row), 0)::numeric
  from meses m
  left join public.faturamento_mensal f on f.ano = p_ano and f.mes = m.mes
  left join contratos_mes cm on cm.mes = m.mes
  order by m.mes;
$function$;
