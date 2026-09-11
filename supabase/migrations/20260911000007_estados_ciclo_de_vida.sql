-- ===========================================================================
-- ITEM 3 — Estado de ciclo de vida do contrato.
--
-- Até aqui um contrato só tinha ETAPA. Não havia como dizer "este está
-- pausado", "este foi distratado" — a etapa continuava andando, ou parava
-- sem explicação, e a carteira ativa incluía contrato que ninguém mais
-- tocava.
--
-- Estado é outro eixo, perpendicular à etapa: um contrato PAUSADO continua
-- na etapa em que estava, e volta dela quando retomar.
--
-- RELAÇÃO COM `contratos.status`
--
-- `contratos.status` (aprovado/distratado/pendente) já existe e é o que o
-- Comercial usa para decidir o que entra no faturamento. São eixos
-- diferentes — execução e cobrança — mas não podem se contradizer, que é
-- exatamente o erro dos dois motores de prazo desta semana. Um gatilho
-- mantém os dois em acordo: DISTRATADO ou CANCELADO no EPEAS derrubam o
-- contrato do faturamento; qualquer outro estado o devolvem.
-- ===========================================================================

create type epeas_estado as enum (
  'em_execucao', 'pausado', 'distratado', 'cancelado', 'concluido'
);

-- ---------------------------------------------------------------------------
-- 1. Motivos — lista fechada, mas editável sem deploy
--
-- Tabela em vez de enum: a lista de motivos muda com a operação, e enum novo
-- exige migration. A FK garante que continua fechada.
-- ---------------------------------------------------------------------------
create table epeas_estado_motivos (
  id     uuid primary key default gen_random_uuid(),
  estado epeas_estado not null,
  codigo text not null,
  label  text not null,
  ordem  integer not null default 1,
  ativo  boolean not null default true,
  unique (estado, codigo),
  constraint epeas_estado_motivos_codigo_formato check (codigo ~ '^[a-z][a-z0-9_]*$')
);

comment on table epeas_estado_motivos is
  'Motivos aceitos para cada estado. Lista fechada por FK, editavel pela '
  'Direx sem migration. Desativar (ativo=false) preserva o historico de quem '
  'ja usou o motivo; apagar, nao.';

insert into epeas_estado_motivos (estado, codigo, label, ordem) values
  ('em_execucao', 'inicio',                    'Início da execução',                    1),
  ('em_execucao', 'retomada',                  'Retomada após pausa',                   2),
  ('em_execucao', 'reversao_engano',           'Reversão de mudança feita por engano',  3),

  ('pausado',     'aguardando_cliente',        'Aguardando o cliente',                  1),
  ('pausado',     'aguardando_orgao_publico',  'Aguardando órgão público',              2),
  ('pausado',     'pausa_pedida_cliente',      'Pausa pedida pelo cliente',             3),
  ('pausado',     'pendencia_financeira',      'Pendência financeira',                  4),
  ('pausado',     'capacidade_interna',        'Sem capacidade interna no momento',     5),

  ('distratado',  'pedido_do_cliente',         'Distrato pedido pelo cliente',          1),
  ('distratado',  'inadimplencia',             'Inadimplência',                         2),
  ('distratado',  'escopo_inviavel',           'Escopo se mostrou inviável',            3),
  ('distratado',  'acordo_mutuo',              'Acordo entre as partes',                4),

  ('cancelado',   'antes_de_comecar',          'Cancelado antes de a execução começar', 1),
  ('cancelado',   'duplicidade',               'Registro duplicado',                    2),
  ('cancelado',   'erro_de_cadastro',          'Erro de cadastro',                      3),
  ('cancelado',   'cliente_desistiu',          'Cliente desistiu antes da assinatura',  4),

  ('concluido',   'entregue_e_aceito',         'Entregue e aceito pelo cliente',        1),
  ('concluido',   'entregue_sem_retorno',      'Entregue, sem retorno do cliente',      2);

-- ---------------------------------------------------------------------------
-- 2. O estado no contrato
-- ---------------------------------------------------------------------------
alter table epeas_lifecycle
  add column estado            epeas_estado not null default 'em_execucao',
  add column estado_em         timestamptz not null default now(),
  add column estado_motivo_id  uuid references epeas_estado_motivos(id),
  add column estado_observacao text;

comment on column epeas_lifecycle.estado is
  'Eixo perpendicular a etapa: contrato PAUSADO continua na etapa em que '
  'estava. Distratado e cancelado saem da carteira ativa.';

-- Estado diferente do inicial exige motivo. `em_execucao` nasce sem motivo
-- porque é o default de todo contrato que entra — cobrar motivo ali seria
-- cobrar justificativa por existir.
alter table epeas_lifecycle
  add constraint epeas_lifecycle_estado_tem_motivo
  check (estado = 'em_execucao' or estado_motivo_id is not null);

-- ---------------------------------------------------------------------------
-- 3. O motivo tem que ser do estado certo
--
-- Sem isto dava para marcar CONCLUIDO com motivo "Inadimplência". Uma FK
-- simples não consegue checar isso; a composta consegue.
-- ---------------------------------------------------------------------------
alter table epeas_estado_motivos add constraint epeas_estado_motivos_id_estado unique (id, estado);

alter table epeas_lifecycle
  add constraint epeas_lifecycle_motivo_do_estado
  foreign key (estado_motivo_id, estado)
  references epeas_estado_motivos (id, estado);

-- ---------------------------------------------------------------------------
-- 4. Execução e cobrança não podem discordar
-- ---------------------------------------------------------------------------
create or replace function public.epeas_sincroniza_status_comercial()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return new;
  end if;

  if new.estado in ('distratado', 'cancelado') then
    update public.contratos
    set status = 'distratado',
        distratado_em = coalesce(distratado_em, current_date)
    where id = new.contrato_id and status <> 'distratado';
  else
    -- Volta para o faturamento, e limpa a data para não ficar um distrato
    -- fantasma na tela do Comercial.
    update public.contratos
    set status = 'aprovado', distratado_em = null
    where id = new.contrato_id and status = 'distratado';
  end if;

  return new;
end $function$;

revoke execute on function public.epeas_sincroniza_status_comercial() from public, anon;

create trigger epeas_lifecycle_sincroniza_status
  after insert or update of estado on epeas_lifecycle
  for each row execute function public.epeas_sincroniza_status_comercial();

-- ---------------------------------------------------------------------------
-- 5. Exceção ganha tipo — é daqui que sai o relatório de causas
--
-- A exceção sinaliza sem mudar etapa nem estado: o contrato segue onde
-- está, mas a tela mostra que há algo travando. Sem o tipo, 30 exceções são
-- 30 textos livres e não viram contagem por causa.
-- ---------------------------------------------------------------------------
create type epeas_excecao_tipo as enum (
  'cliente_parado', 'retrabalho', 'mudanca_escopo', 'problema_interno', 'orgao_publico'
);

alter table epeas_contract_exceptions
  add column tipo epeas_excecao_tipo not null default 'problema_interno';

-- O default existe só para as linhas que já estão lá (hoje nenhuma). Daqui
-- em diante a tela obriga a escolher, e o default deixa de fazer sentido.
alter table epeas_contract_exceptions alter column tipo drop default;

comment on column epeas_contract_exceptions.tipo is
  'Causa da excecao. Alimenta o relatorio de causas: sem isto, excecao e '
  'texto livre e nao vira contagem.';

-- ---------------------------------------------------------------------------
-- 6. RLS dos motivos
-- ---------------------------------------------------------------------------
alter table epeas_estado_motivos enable row level security;

create policy epeas_estado_motivos_select on epeas_estado_motivos
  for select to authenticated using (true);

create policy epeas_estado_motivos_manage on epeas_estado_motivos
  for all to authenticated
  using (public.is_direx((select auth.uid())))
  with check (public.is_direx((select auth.uid())));
