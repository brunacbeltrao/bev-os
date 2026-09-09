-- ============================================================
-- BEV OS · 09/09/2026 — faz a trilha por serviço funcionar. APLICADA.
--
-- A Onda B trouxe `servico_etapas` com `prazo_dias` e
-- `epeas_lifecycle.etapa_servico_id`. Faltavam as duas peças que dão
-- sentido ao prazo:
--
--   1. nada carimbava QUANDO o contrato entrou na etapa, então não havia
--      data de onde contar os `prazo_dias` — o campo era decorativo;
--   2. o gatilho de histórico observa etapa_macro e etapa_execucao, mas
--      não etapa_servico_id, então avançar a trilha não deixava rastro.
--
-- Sem isto a trilha registra onde o contrato está e esquece desde quando,
-- que é exatamente o que o EPEAS existe para responder.
--
-- Verificado depois de aplicar, em transação revertida: entrar numa etapa
-- carimba, avançar registra "etapa anterior -> etapa nova" com o nome
-- legível, e limpar a etapa zera o carimbo.
-- ============================================================

alter table public.epeas_lifecycle
  add column if not exists etapa_servico_em timestamptz;

comment on column public.epeas_lifecycle.etapa_servico_em is
  'Quando o contrato entrou na etapa de serviço atual. É a data de onde sai o prazo (servico_etapas.prazo_dias).';

comment on column public.epeas_lifecycle.etapa_execucao is
  'LEGADO da Onda A (texto livre). Substituída por etapa_servico_id -> servico_etapas. '
  'Mantida só enquanto houver deploy publicado que a leia; não escreva mais nela.';

alter table public.epeas_contract_history
  drop constraint if exists epeas_contract_history_campo_check;
alter table public.epeas_contract_history
  add constraint epeas_contract_history_campo_check
  check (campo = any (array['etapa_macro','etapa_execucao','etapa_servico']));

create or replace function public.epeas_carimba_etapa()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.etapa_macro is distinct from old.etapa_macro then
      new.etapa_macro_em := now();
    end if;
    if new.etapa_execucao is distinct from old.etapa_execucao then
      new.etapa_execucao_em := case when new.etapa_execucao is null then null else now() end;
    end if;
    if new.etapa_servico_id is distinct from old.etapa_servico_id then
      new.etapa_servico_em := case when new.etapa_servico_id is null then null else now() end;
    end if;
  end if;
  return new;
end $function$;

-- O histórico guarda o NOME da etapa, não o uuid: quem lê a linha do tempo
-- precisa entender sem consultar outra tabela.
create or replace function public.epeas_registra_historico()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_antes text;
  v_depois text;
begin
  if tg_op = 'INSERT' then
    insert into public.epeas_contract_history (contrato_id, campo, etapa_anterior, etapa_nova, alterado_por_id)
    values (new.contrato_id, 'etapa_macro', null, new.etapa_macro::text, auth.uid());
    return new;
  end if;

  if new.etapa_macro is distinct from old.etapa_macro then
    insert into public.epeas_contract_history (contrato_id, campo, etapa_anterior, etapa_nova, alterado_por_id)
    values (new.contrato_id, 'etapa_macro', old.etapa_macro::text, new.etapa_macro::text, auth.uid());
  end if;

  if new.etapa_execucao is distinct from old.etapa_execucao and new.etapa_execucao is not null then
    insert into public.epeas_contract_history (contrato_id, campo, etapa_anterior, etapa_nova, alterado_por_id)
    values (new.contrato_id, 'etapa_execucao', old.etapa_execucao, new.etapa_execucao, auth.uid());
  end if;

  if new.etapa_servico_id is distinct from old.etapa_servico_id then
    select nome into v_antes  from public.servico_etapas where id = old.etapa_servico_id;
    select nome into v_depois from public.servico_etapas where id = new.etapa_servico_id;
    insert into public.epeas_contract_history (contrato_id, campo, etapa_anterior, etapa_nova, alterado_por_id)
    values (new.contrato_id, 'etapa_servico', v_antes, coalesce(v_depois, '— sem etapa —'), auth.uid());
  end if;

  return new;
end $function$;
