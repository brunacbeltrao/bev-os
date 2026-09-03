-- ============================================================
-- BEV OS · 03/09/2026 — corrige a 000006. APLICADA.
-- (no banco: 20260903034429_corrige_pin_aberto_por_id)
--
-- O with_check que eu tinha escrito para fixar aberto_por_id estava
-- errado: dentro da subconsulta, `id` resolvia para e.id (escopo mais
-- interno), então `e.id = id` era sempre verdadeiro e não fixava nada.
--
-- RLS não compara linha velha com linha nova — USING vê a antiga,
-- WITH CHECK vê a nova, e as duas não se encontram. Para travar coluna
-- o instrumento certo é trigger.
-- ============================================================

create or replace function public.epeas_excecao_trava_autoria()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.aberto_por_id is distinct from old.aberto_por_id then
    raise exception 'BEV_OS_AUTORIA_IMUTAVEL: não dá para trocar quem abriu a exceção.';
  end if;
  if new.contrato_id is distinct from old.contrato_id then
    raise exception 'BEV_OS_CONTRATO_IMUTAVEL: não dá para mover a exceção de contrato.';
  end if;
  return new;
end $$;

drop trigger if exists epeas_excecao_trava_autoria on public.epeas_contract_exceptions;
create trigger epeas_excecao_trava_autoria
  before update on public.epeas_contract_exceptions
  for each row execute function public.epeas_excecao_trava_autoria();
