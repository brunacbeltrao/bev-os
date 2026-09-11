-- ===========================================================================
-- ITEM 2 — Requisitos que bloqueiam a saída da etapa.
--
-- O checklist já existe e trava o avanço, mas ele é declaração humana: a
-- pessoa marca "Contrato assinado" sem que exista contrato assinado no
-- sistema. Requisito é diferente — ele é verificado contra o dado:
--
--   - requisito de DOCUMENTO: existe documento daquele tipo, não substituído?
--   - requisito de CAMPO: a coluna está preenchida?
--
-- Marcar caixinha é promessa; requisito é fato. Os dois convivem: o
-- checklist cobre o que só a pessoa sabe ("cliente confirmou por telefone"),
-- o requisito cobre o que o banco pode provar.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Documento ganha etapa, versão e substituição
--
-- "Substituição preservando versões": a versão antiga NÃO é apagada nem
-- sobrescrita — ela aponta para a nova. Quem precisa saber o que foi
-- enviado ao cliente em março ainda consegue.
-- ---------------------------------------------------------------------------
alter table epeas_documentos
  add column versao           integer not null default 1,
  add column substituido_por  uuid references epeas_documentos(id) on delete set null,
  add column etapa_macro      epeas_etapa_macro,
  add column servico_etapa_id uuid references servico_etapas(id) on delete set null,
  add column observacao       text;

comment on column epeas_documentos.substituido_por is
  'Versao seguinte deste documento. NULL = e a versao vigente. A antiga '
  'continua no banco e no bucket: substituir nao apaga.';
comment on column epeas_documentos.versao is
  'Comeca em 1 e sobe a cada substituicao do mesmo tipo no mesmo contrato.';
comment on column epeas_documentos.etapa_macro is
  'A qual etapa do fluxo macro este documento pertence. NULL = documento do '
  'contrato como um todo, sem etapa especifica.';

create index epeas_documentos_vigentes_idx
  on epeas_documentos (contrato_id, tipo)
  where substituido_por is null;

-- ---------------------------------------------------------------------------
-- 2. O catálogo de requisitos
--
-- Uma linha declara: "para sair DESTA etapa, precisa DISTO". A etapa é do
-- fluxo macro OU da trilha do serviço, nunca as duas.
-- ---------------------------------------------------------------------------
create type epeas_requisito_tipo as enum ('documento', 'campo');

create table epeas_requisitos (
  id               uuid primary key default gen_random_uuid(),
  etapa_macro      epeas_etapa_macro,
  servico_etapa_id uuid references servico_etapas(id) on delete cascade,
  tipo             epeas_requisito_tipo not null,
  /* tipo = documento */
  documento_tipo   epeas_documento_tipo,
  /* tipo = campo: nome da coluna em epeas_lifecycle ou contratos */
  campo            text,
  label            text not null,
  ajuda            text,
  obrigatorio      boolean not null default true,
  ordem            integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Pertence a exatamente uma etapa, de um dos dois tipos.
  constraint epeas_requisitos_uma_etapa check (
    (etapa_macro is not null and servico_etapa_id is null)
    or (etapa_macro is null and servico_etapa_id is not null)
  ),
  -- O tipo manda no campo que precisa estar preenchido.
  constraint epeas_requisitos_coerente check (
    (tipo = 'documento' and documento_tipo is not null and campo is null)
    or (tipo = 'campo' and campo is not null and documento_tipo is null)
  ),
  constraint epeas_requisitos_label_nao_vazio check (length(btrim(label)) > 0)
);

create unique index epeas_requisitos_macro_doc_idx
  on epeas_requisitos (etapa_macro, documento_tipo)
  where etapa_macro is not null and tipo = 'documento';
create unique index epeas_requisitos_macro_campo_idx
  on epeas_requisitos (etapa_macro, campo)
  where etapa_macro is not null and tipo = 'campo';

comment on table epeas_requisitos is
  'O que precisa EXISTIR no sistema para a etapa poder ser deixada para tras. '
  'Diferente do checklist, que e declaracao humana: requisito e verificado '
  'contra o dado.';

-- ---------------------------------------------------------------------------
-- 3. Dispensa — com justificativa, sempre
--
-- Gerente ou diretor pode liberar o avanço sem o requisito. O que não pode
-- é isso acontecer sem deixar rastro: a justificativa é NOT NULL e a
-- dispensa entra no histórico por gatilho (item 4).
-- ---------------------------------------------------------------------------
create table epeas_requisito_dispensas (
  id             uuid primary key default gen_random_uuid(),
  contrato_id    uuid not null references contratos(id) on delete cascade,
  requisito_id   uuid not null references epeas_requisitos(id) on delete cascade,
  justificativa  text not null,
  dispensado_por uuid references people(id) on update cascade on delete set null,
  created_at     timestamptz not null default now(),
  unique (contrato_id, requisito_id),
  constraint epeas_dispensa_justificativa_real
    check (length(btrim(justificativa)) >= 10)
);

comment on constraint epeas_dispensa_justificativa_real on epeas_requisito_dispensas is
  'Dez caracteres nao fazem ninguem escrever bem, mas impedem o "ok" que '
  'esvazia o registro.';

-- ---------------------------------------------------------------------------
-- 4. Os requisitos do processo de hoje
--
-- Tirados do checklist que já existia e do que a operação de fato precisa
-- provar. Nada inventado: cada linha corresponde a um item que a equipe já
-- conferia na mão.
-- ---------------------------------------------------------------------------
insert into epeas_requisitos (etapa_macro, tipo, documento_tipo, campo, label, ajuda, ordem) values
  ('comercial_formulario_enviado', 'campo', null, 'link_formulario_notion',
   'Link do formulário', 'Cole o link do formulário enviado ao cliente.', 1),

  ('gestao_contrato_assinatura', 'campo', null, 'link_autentique',
   'Link do Autentique', 'O link da assinatura, para acompanhar sem sair daqui.', 1),

  ('gestao_contrato_assinado', 'documento', 'contrato_assinado', null,
   'Contrato assinado (PDF)', 'O PDF assinado pelas duas partes.', 1),

  ('projetos_grupo_criado', 'campo', null, 'link_grupo_whatsapp',
   'Link do grupo de WhatsApp', 'O grupo com o cliente, para quem entrar depois achar.', 1),

  ('projetos_em_execucao', 'documento', 'entregavel', null,
   'Entregável enviado', 'O que foi entregue ao cliente.', 1);

-- Contato do cliente: sem ele a Gestão não consegue tocar o contrato, e é o
-- que mais falta quando o contrato chega de importação.
insert into epeas_requisitos (etapa_macro, tipo, campo, label, ajuda, obrigatorio, ordem) values
  ('gestao_formulario_conferido', 'campo', 'cliente_contato_email',
   'E-mail de contato do cliente', 'Para onde vão contrato e cobranças.', true, 1),
  ('gestao_formulario_conferido', 'campo', 'cliente_contato_nome',
   'Nome de quem responde pelo cliente', 'Quem assina e quem responde no dia a dia.', true, 2);

-- ---------------------------------------------------------------------------
-- 5. RLS
--
-- Catálogo: todo mundo lê, liderança escreve. Dispensa: quem vê o contrato
-- lê; só gerente de núcleo, liderança de Projetos ou Direx dispensa.
-- ---------------------------------------------------------------------------
alter table epeas_requisitos enable row level security;
alter table epeas_requisito_dispensas enable row level security;

create policy epeas_requisitos_select on epeas_requisitos
  for select to authenticated using (true);

create policy epeas_requisitos_manage on epeas_requisitos
  for all to authenticated
  using (public.is_direx((select auth.uid())) or public.is_lideranca_projetos((select auth.uid())))
  with check (public.is_direx((select auth.uid())) or public.is_lideranca_projetos((select auth.uid())));

create policy epeas_dispensas_select on epeas_requisito_dispensas
  for select to authenticated
  using (public.epeas_pode_ver(contrato_id));

create policy epeas_dispensas_insert on epeas_requisito_dispensas
  for insert to authenticated
  with check (
    public.epeas_pode_ver(contrato_id)
    and (
      public.is_direx((select auth.uid()))
      or public.is_lideranca_projetos((select auth.uid()))
      or exists (
        select 1 from epeas_lifecycle l
        where l.contrato_id = epeas_requisito_dispensas.contrato_id
          and l.gerente_nucleo_id = (select auth.uid())
      )
    )
  );

create policy epeas_dispensas_delete on epeas_requisito_dispensas
  for delete to authenticated
  using (public.is_direx((select auth.uid())) or public.is_lideranca_projetos((select auth.uid())));

create trigger epeas_requisitos_updated_at
  before update on epeas_requisitos
  for each row execute function public.set_updated_at();
