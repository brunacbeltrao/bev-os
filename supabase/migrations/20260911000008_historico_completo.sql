-- ===========================================================================
-- ITEM 4 — O histórico passa a registrar tudo que muda.
--
-- Hoje ele só observa etapa. Alocação, prazo, suspensão, documento, estado e
-- dispensa de requisito acontecem sem deixar linha — e é desse log que os
-- indicadores vão sair depois. Tempo médio por etapa, causa de atraso,
-- quantas vezes um contrato trocou de gerente: nada disso é reconstituível
-- se o log não viu acontecer.
--
-- As colunas `etapa_anterior`/`etapa_nova` são RENOMEADAS para
-- `valor_anterior`/`valor_novo`. Rename, não drop: as linhas existentes
-- continuam lá. "Etapa" no nome já mente hoje — a linha de `etapa_servico`
-- guarda nome de etapa, e as novas vão guardar nome de pessoa e de estado.
-- ===========================================================================

alter table epeas_contract_history rename column etapa_anterior to valor_anterior;
alter table epeas_contract_history rename column etapa_nova     to valor_novo;

-- `valor_novo` era NOT NULL. Remoção (documento apagado, alocação limpa) não
-- tem valor novo, e forçar string vazia ali seria mentir no log.
alter table epeas_contract_history alter column valor_novo drop not null;

alter table epeas_contract_history
  add column detalhe jsonb;

comment on column epeas_contract_history.detalhe is
  'Contexto estruturado que nao cabe em valor_anterior/valor_novo: '
  'justificativa de dispensa, motivo de estado, tipo de documento.';

-- O check antigo listava só as três de etapa.
alter table epeas_contract_history drop constraint if exists epeas_contract_history_campo_check;

alter table epeas_contract_history
  add constraint epeas_contract_history_campo_check
  check (campo = any (array[
    'etapa_macro', 'etapa_execucao', 'etapa_servico',
    'alocacao', 'prazo', 'suspensao', 'documento', 'estado', 'requisito_dispensado'
  ]));

create index if not exists epeas_contract_history_contrato_idx
  on epeas_contract_history (contrato_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 1. Alocação, prazo e estado — tudo em epeas_lifecycle
--
-- Um gatilho só, porque as três moram na mesma tabela e um UPDATE pode
-- mexer em mais de uma ao mesmo tempo.
-- ---------------------------------------------------------------------------
create or replace function public.epeas_registra_mudancas()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_antes  text;
  v_depois text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- ---- alocação: cinco papéis, cada um com a sua linha ----
  if new.gestao_responsavel_id is distinct from old.gestao_responsavel_id then
    select nome into v_antes  from public.people where id = old.gestao_responsavel_id;
    select nome into v_depois from public.people where id = new.gestao_responsavel_id;
    insert into public.epeas_contract_history
      (contrato_id, campo, valor_anterior, valor_novo, alterado_por_id, detalhe)
    values (new.contrato_id, 'alocacao', v_antes, v_depois, auth.uid(),
            jsonb_build_object('papel', 'gestao'));
  end if;

  if new.gerente_nucleo_id is distinct from old.gerente_nucleo_id then
    select nome into v_antes  from public.people where id = old.gerente_nucleo_id;
    select nome into v_depois from public.people where id = new.gerente_nucleo_id;
    insert into public.epeas_contract_history
      (contrato_id, campo, valor_anterior, valor_novo, alterado_por_id, detalhe)
    values (new.contrato_id, 'alocacao', v_antes, v_depois, auth.uid(),
            jsonb_build_object('papel', 'gerente_nucleo'));
  end if;

  if new.scrum_master_id is distinct from old.scrum_master_id then
    select nome into v_antes  from public.people where id = old.scrum_master_id;
    select nome into v_depois from public.people where id = new.scrum_master_id;
    insert into public.epeas_contract_history
      (contrato_id, campo, valor_anterior, valor_novo, alterado_por_id, detalhe)
    values (new.contrato_id, 'alocacao', v_antes, v_depois, auth.uid(),
            jsonb_build_object('papel', 'scrum_master'));
  end if;

  if new.nucleo_id is distinct from old.nucleo_id then
    select nome into v_antes  from public.project_nucleos where id = old.nucleo_id;
    select nome into v_depois from public.project_nucleos where id = new.nucleo_id;
    insert into public.epeas_contract_history
      (contrato_id, campo, valor_anterior, valor_novo, alterado_por_id, detalhe)
    values (new.contrato_id, 'alocacao', v_antes, v_depois, auth.uid(),
            jsonb_build_object('papel', 'nucleo'));
  end if;

  if new.assessores_projeto_ids is distinct from old.assessores_projeto_ids then
    select string_agg(nome, ', ' order by nome) into v_antes
      from public.people where id = any(old.assessores_projeto_ids);
    select string_agg(nome, ', ' order by nome) into v_depois
      from public.people where id = any(new.assessores_projeto_ids);
    insert into public.epeas_contract_history
      (contrato_id, campo, valor_anterior, valor_novo, alterado_por_id, detalhe)
    values (new.contrato_id, 'alocacao', v_antes, v_depois, auth.uid(),
            jsonb_build_object('papel', 'assessor_projeto'));
  end if;

  -- ---- prazo contratual: a cláusula mudou ----
  if new.prazo_tipo       is distinct from old.prazo_tipo
     or new.prazo_quantidade is distinct from old.prazo_quantidade
     or new.prazo_unidade    is distinct from old.prazo_unidade
     or new.prazo_entrega    is distinct from old.prazo_entrega
     or new.prazo_condicao   is distinct from old.prazo_condicao then
    insert into public.epeas_contract_history
      (contrato_id, campo, valor_anterior, valor_novo, alterado_por_id, detalhe)
    values (
      new.contrato_id, 'prazo',
      concat_ws(' ', old.prazo_tipo::text, old.prazo_quantidade::text, old.prazo_unidade::text),
      concat_ws(' ', new.prazo_tipo::text, new.prazo_quantidade::text, new.prazo_unidade::text),
      auth.uid(),
      jsonb_build_object('clausula', new.prazo_clausula, 'data_fixa', new.prazo_entrega)
    );
  end if;

  -- ---- estado de ciclo de vida ----
  if new.estado is distinct from old.estado then
    select label into v_depois from public.epeas_estado_motivos where id = new.estado_motivo_id;
    insert into public.epeas_contract_history
      (contrato_id, campo, valor_anterior, valor_novo, alterado_por_id, detalhe)
    values (new.contrato_id, 'estado', old.estado::text, new.estado::text, auth.uid(),
            jsonb_build_object('motivo', v_depois, 'observacao', new.estado_observacao));
  end if;

  return new;
end $function$;

revoke execute on function public.epeas_registra_mudancas() from public, anon;

create trigger epeas_lifecycle_registra_mudancas
  after update on epeas_lifecycle
  for each row execute function public.epeas_registra_mudancas();

-- ---------------------------------------------------------------------------
-- 2. Estado carimba a própria data
-- ---------------------------------------------------------------------------
create or replace function public.epeas_carimba_estado()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    new.estado_em := now();
  end if;
  return new;
end $function$;

revoke execute on function public.epeas_carimba_estado() from public, anon;

create trigger epeas_lifecycle_carimba_estado
  before update on epeas_lifecycle
  for each row execute function public.epeas_carimba_estado();

-- ---------------------------------------------------------------------------
-- 3. Suspensão de prazo
-- ---------------------------------------------------------------------------
create or replace function public.epeas_registra_suspensao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.epeas_contract_history
      (contrato_id, campo, valor_anterior, valor_novo, alterado_por_id, detalhe)
    values (new.contrato_id, 'suspensao', null, 'Prazo suspenso', auth.uid(),
            jsonb_build_object('motivo', new.motivo::text, 'justificativa', new.justificativa));
  elsif new.retomada_em is not null and old.retomada_em is null then
    insert into public.epeas_contract_history
      (contrato_id, campo, valor_anterior, valor_novo, alterado_por_id, detalhe)
    values (new.contrato_id, 'suspensao', 'Prazo suspenso', 'Prazo retomado', auth.uid(),
            jsonb_build_object('motivo', new.motivo::text, 'nota', new.nota_retomada));
  end if;
  return new;
end $function$;

revoke execute on function public.epeas_registra_suspensao() from public, anon;

create trigger epeas_suspensoes_registra_historico
  after insert or update on epeas_suspensoes
  for each row execute function public.epeas_registra_suspensao();

-- ---------------------------------------------------------------------------
-- 4. Documento enviado, substituído ou removido
-- ---------------------------------------------------------------------------
create or replace function public.epeas_registra_documento()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.epeas_contract_history
      (contrato_id, campo, valor_anterior, valor_novo, alterado_por_id, detalhe)
    values (new.contrato_id, 'documento', null, new.nome, auth.uid(),
            jsonb_build_object('tipo', new.tipo::text, 'versao', new.versao, 'acao', 'enviado'));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Só interessa a transição para substituído: o resto é ruído.
    if new.substituido_por is not null and old.substituido_por is null then
      insert into public.epeas_contract_history
        (contrato_id, campo, valor_anterior, valor_novo, alterado_por_id, detalhe)
      values (new.contrato_id, 'documento', new.nome, null, auth.uid(),
              jsonb_build_object('tipo', new.tipo::text, 'versao', new.versao, 'acao', 'substituido'));
    end if;
    return new;
  end if;

  insert into public.epeas_contract_history
    (contrato_id, campo, valor_anterior, valor_novo, alterado_por_id, detalhe)
  values (old.contrato_id, 'documento', old.nome, null, auth.uid(),
          jsonb_build_object('tipo', old.tipo::text, 'versao', old.versao, 'acao', 'removido'));
  return old;
end $function$;

revoke execute on function public.epeas_registra_documento() from public, anon;

create trigger epeas_documentos_registra_historico
  after insert or update or delete on epeas_documentos
  for each row execute function public.epeas_registra_documento();

-- ---------------------------------------------------------------------------
-- 5. Dispensa de requisito — o registro que dá sentido à permissão
--
-- Dispensar é poder pular uma exigência. Sem esta linha no histórico, a
-- justificativa obrigatória viraria campo que ninguém lê.
-- ---------------------------------------------------------------------------
create or replace function public.epeas_registra_dispensa()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_label text;
begin
  select label into v_label from public.epeas_requisitos where id = new.requisito_id;
  insert into public.epeas_contract_history
    (contrato_id, campo, valor_anterior, valor_novo, alterado_por_id, detalhe)
  values (new.contrato_id, 'requisito_dispensado', v_label, 'Dispensado', new.dispensado_por,
          jsonb_build_object('justificativa', new.justificativa));
  return new;
end $function$;

revoke execute on function public.epeas_registra_dispensa() from public, anon;

create trigger epeas_dispensas_registra_historico
  after insert on epeas_requisito_dispensas
  for each row execute function public.epeas_registra_dispensa();
