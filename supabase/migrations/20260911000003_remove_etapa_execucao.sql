-- ===========================================================================
-- Remove a coluna `etapa_execucao`, autorizada pela Diretoria.
--
-- Era o modelo de execução da Onda A: uma lista fixa de seis etapas, e só
-- do Registro de Marca. A Onda B substituiu isso por `servico_etapas`, uma
-- trilha por serviço, e desde então a coluna não é mais escrita.
--
-- Estado hoje, medido antes de escrever esta migration:
--   - 0 de 32 contratos com valor em etapa_execucao
--   - 0 de 32 com carimbo em etapa_execucao_em
--   - 0 linhas de epeas_contract_history com campo = 'etapa_execucao'
--
-- Ou seja: a coluna nunca chegou a carregar dado nenhum em produção. Ainda
-- assim a guarda abaixo existe, porque migration é lida e reaplicada em
-- restauração, e ali o número pode não ser zero.
--
-- Uma sessão paralela já tentou este DROP em 09/09 e quebrou a aba EPEAS,
-- porque derrubou a coluna deixando dois gatilhos lendo dela. Os gatilhos
-- vêm primeiro aqui, e é essa a diferença.
--
-- O valor 'etapa_execucao' continua aceito em epeas_contract_history.campo
-- de propósito: se um dia uma restauração trouxer histórico antigo, ele
-- ainda encaixa, e `rotuloEtapa` em lib/epeas.ts sabe traduzi-lo.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Guarda: não derruba coluna que esteja carregando dado
-- ---------------------------------------------------------------------------
do $$
declare
  com_valor integer;
begin
  select count(*) into com_valor
  from public.epeas_lifecycle
  where etapa_execucao is not null or etapa_execucao_em is not null;

  if com_valor > 0 then
    raise exception
      'ABORTADO: % contrato(s) ainda tem etapa_execucao preenchida. Migre para servico_etapas antes de remover.',
      com_valor;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Os gatilhos param de ler a coluna ANTES de ela sair
--
-- Esta é a ordem que faltou em 09/09. Gatilho que referencia coluna
-- inexistente só falha na hora do UPDATE, ou seja, na cara de quem estava
-- tentando mover um contrato.
-- ---------------------------------------------------------------------------
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
    if new.etapa_servico_id is distinct from old.etapa_servico_id then
      new.etapa_servico_em := case when new.etapa_servico_id is null then null else now() end;
    end if;
  end if;
  return new;
end $function$;

create or replace function public.epeas_registra_historico()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_antes  text;
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

  if new.etapa_servico_id is distinct from old.etapa_servico_id then
    select nome into v_antes  from public.servico_etapas where id = old.etapa_servico_id;
    select nome into v_depois from public.servico_etapas where id = new.etapa_servico_id;
    insert into public.epeas_contract_history (contrato_id, campo, etapa_anterior, etapa_nova, alterado_por_id)
    values (new.contrato_id, 'etapa_servico', v_antes, coalesce(v_depois, '— sem etapa —'), auth.uid());
  end if;

  return new;
end $function$;

-- ---------------------------------------------------------------------------
-- 3. Só agora as colunas saem
-- ---------------------------------------------------------------------------
alter table public.epeas_lifecycle
  drop column etapa_execucao,
  drop column etapa_execucao_em;
