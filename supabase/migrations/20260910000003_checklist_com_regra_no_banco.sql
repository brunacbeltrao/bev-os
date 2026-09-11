-- ===========================================================================
-- O checklist deixa de ser texto solto.
--
-- `epeas_checklist_done.etapa` e `.item_key` eram text, sem enum e sem FK.
-- Nada impedia gravar 'gestao_formulario_conferrido' com dois erres, ou um
-- item que não existe em etapa nenhuma — e a regra do que é "pronto" morava
-- só numa constante TypeScript, invisível para o banco e para qualquer
-- consulta.
--
-- Hoje a tabela tem 0 linhas. É a única janela em que essa correção é uma
-- migration de schema; depois que a EJ inteira usar, vira migração de dado.
--
-- O template sai do código e vira tabela, como já aconteceu com a trilha de
-- serviços: mudar o processo passa a ser mexer numa linha, não num deploy.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. O template
-- ---------------------------------------------------------------------------
create table checklist_itens (
  id          uuid primary key default gen_random_uuid(),
  etapa       epeas_etapa_macro not null,
  item_key    text not null,
  label       text not null,
  obrigatorio boolean not null default true,
  ordem       integer not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- (etapa, item_key) é o que a tabela de feitos referencia; sem unique não
  -- há FK composta possível.
  unique (etapa, item_key),

  -- item_key entra em URL, em consulta e em log. Manter o formato fechado
  -- evita a variação com acento e espaço que text livre sempre acaba tendo.
  constraint checklist_itens_key_formato check (item_key ~ '^[a-z][a-z0-9_]*$'),
  constraint checklist_itens_label_nao_vazio check (length(btrim(label)) > 0)
);

create index checklist_itens_etapa_idx on checklist_itens (etapa, ordem);

comment on table checklist_itens is
  'Template do checklist por etapa do fluxo macro: o que precisa estar feito '
  'para a etapa poder avancar. Saiu da constante CHECKLIST de lib/epeas.ts.';
comment on column checklist_itens.obrigatorio is
  'true trava o avanco da etapa enquanto o item nao estiver marcado.';

-- ---------------------------------------------------------------------------
-- 2. O template que já existia no código, sem invenção
--
-- São exatamente os 20 itens da constante CHECKLIST, na mesma ordem e com os
-- mesmos textos. Nada aqui é novo — só mudou de lugar.
-- ---------------------------------------------------------------------------
insert into checklist_itens (etapa, item_key, label, obrigatorio, ordem) values
  ('comercial_contrato_fechado',   'dados_cliente',    'Dados do cliente conferidos',                 true,  1),
  ('comercial_contrato_fechado',   'valor_servico',    'Valor e serviço confirmados com o cliente',   true,  2),
  ('comercial_formulario_enviado', 'form_enviado',     'Formulário enviado ao cliente',               true,  1),
  ('comercial_formulario_enviado', 'form_link',        'Link do formulário registrado aqui',          true,  2),
  ('gestao_formulario_conferido',  'form_preenchido',  'Cliente preencheu o formulário',              true,  1),
  ('gestao_formulario_conferido',  'dados_completos',  'Dados suficientes para redigir o contrato',   true,  2),
  ('gestao_assessor_definido',     'assessor',         'Assessor de Gestão definido',                 true,  1),
  ('gestao_contrato_elaboracao',   'minuta',           'Minuta redigida',                             true,  1),
  ('gestao_contrato_elaboracao',   'revisao',          'Revisada por segunda pessoa',                 false, 2),
  ('gestao_contrato_assinatura',   'autentique',       'Enviado pelo Autentique',                     true,  1),
  ('gestao_contrato_assinatura',   'link_autentique',  'Link do Autentique registrado aqui',          true,  2),
  ('gestao_contrato_assinado',     'assinado_cliente', 'Cliente assinou',                             true,  1),
  ('gestao_contrato_assinado',     'assinado_bev',     'Bevilaqua assinou',                           true,  2),
  ('projetos_aguardando_alocacao', 'nucleo',           'Núcleo escolhido',                            true,  1),
  ('projetos_alocado',             'time',             'Gerente e assessores definidos',              true,  1),
  ('projetos_alocado',             'kickoff',          'Kickoff combinado com o time',                false, 2),
  ('projetos_grupo_criado',        'grupo',            'Grupo de WhatsApp criado com o cliente',      true,  1),
  ('projetos_grupo_criado',        'grupo_link',       'Link do grupo registrado aqui',               true,  2),
  ('projetos_em_execucao',         'entrega',          'Entregável enviado ao cliente',               true,  1),
  ('projetos_em_execucao',         'aceite',           'Cliente confirmou o recebimento',             false, 2);

-- ---------------------------------------------------------------------------
-- 3. A tabela de feitos passa a apontar para o template
--
-- 0 linhas hoje, então o cast e a FK entram sem nada para converter.
-- ---------------------------------------------------------------------------
alter table epeas_checklist_done
  alter column etapa type epeas_etapa_macro using etapa::epeas_etapa_macro;

alter table epeas_checklist_done
  add constraint epeas_checklist_done_item_fkey
  foreign key (etapa, item_key)
  references checklist_itens (etapa, item_key)
  on update cascade
  on delete cascade;

comment on constraint epeas_checklist_done_item_fkey on epeas_checklist_done is
  'Garante que o item marcado existe E pertence aquela etapa. So o enum na '
  'coluna etapa nao impediria marcar um item de outra etapa.';

-- ---------------------------------------------------------------------------
-- 4. RLS — mesmo desenho de servico_etapas e feriados: todo mundo lê a
--    configuração, só quem responde pelo processo escreve.
-- ---------------------------------------------------------------------------
alter table checklist_itens enable row level security;

create policy checklist_itens_select on checklist_itens
  for select to authenticated
  using (true);

create policy checklist_itens_manage on checklist_itens
  for all to authenticated
  using (public.is_direx((select auth.uid())) or public.is_lideranca_projetos((select auth.uid())))
  with check (public.is_direx((select auth.uid())) or public.is_lideranca_projetos((select auth.uid())));

create trigger checklist_itens_updated_at
  before update on checklist_itens
  for each row execute function public.set_updated_at();
