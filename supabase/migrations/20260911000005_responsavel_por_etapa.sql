-- ===========================================================================
-- ITEM 1 — Responsável pela etapa atual.
--
-- Hoje o EPEAS sabe quem está alocado no contrato (gestão, gerente de
-- núcleo, scrum master, assessores, responsável comercial), mas não sabe
-- QUAL desses papéis responde pela etapa em que o contrato está. A fila
-- "Precisa de mim" é montada por fase — comercial/gestão/projetos — então
-- toda a Gestão vê todo contrato em etapa de Gestão, e ninguém em
-- particular é o dono.
--
-- A etapa passa a declarar o papel; o papel mais a alocação do contrato
-- resolvem a pessoa. Quando não resolve, isso é ERRO VISÍVEL na tela — a
-- etapa não tem dono, e alguém precisa alocar.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Os papéis que uma etapa pode exigir
--
-- Não é o `role_type` da organização (diretor/gerente/assessor): é o papel
-- DENTRO do contrato. A mesma pessoa pode ser gerente de núcleo num
-- contrato e assessora em outro.
-- ---------------------------------------------------------------------------
create type epeas_papel as enum (
  'comercial',         -- contratos.responsavel_id, quem fechou
  'gestao',            -- epeas_lifecycle.gestao_responsavel_id
  'gerente_nucleo',    -- epeas_lifecycle.gerente_nucleo_id
  'scrum_master',      -- epeas_lifecycle.scrum_master_id
  'assessor_projeto'   -- epeas_lifecycle.assessores_projeto_ids (time todo)
);

comment on type epeas_papel is
  'Papel dentro do contrato, nao na organizacao. Resolve para pessoa pela '
  'alocacao em epeas_lifecycle/contratos.';

-- ---------------------------------------------------------------------------
-- 2. A trilha declara o papel de cada etapa
--
-- Default 'assessor_projeto': etapa de execucao e do time que executa. As
-- 28 etapas existentes sao todas de execucao, entao o default ja as cobre —
-- a excecao vai logo abaixo.
-- ---------------------------------------------------------------------------
alter table servico_etapas
  add column papel_responsavel epeas_papel not null default 'assessor_projeto';

comment on column servico_etapas.papel_responsavel is
  'Quem responde por esta etapa. Com a alocacao do contrato, resolve para '
  'uma pessoa; quando nao resolve, a tela mostra erro em vez de silencio.';

-- As etapas de espera por órgão público não são do assessor: quem acompanha
-- protocolo e publicação é a Gestão, que tem a procuração e o acesso.
update servico_etapas e
set papel_responsavel = 'gestao'
from project_services s
where e.servico_id = s.id
  and (
    (s.nome = 'Registro de Marca' and e.ordem in (3, 4))
    or (s.nome = 'Abertura de CNPJ' and e.ordem in (2, 3, 4))
  );

-- ---------------------------------------------------------------------------
-- 3. Escalonamento — quanto de atraso sobe, e para quem
--
-- Tabela em vez de constante para que a Diretoria mude o limiar sem deploy.
-- Os valores vêm do briefing: 3 dias úteis sobe para o gerente do núcleo,
-- 7 para a Diretoria de Negócios.
-- ---------------------------------------------------------------------------
create table epeas_escalonamento (
  id            uuid primary key default gen_random_uuid(),
  ordem         integer not null unique,
  dias_uteis    integer not null,
  papel         epeas_papel not null,
  /* quando o papel não resolve (ex.: contrato sem núcleo), cai para a
     diretoria pelo slug — é o último degrau e não pode ficar sem ninguém */
  diretoria_slug text,
  rotulo        text not null,
  constraint epeas_escalonamento_dias_positivo check (dias_uteis > 0),
  constraint epeas_escalonamento_tem_destino
    check (papel is not null or diretoria_slug is not null)
);

insert into epeas_escalonamento (ordem, dias_uteis, papel, diretoria_slug, rotulo) values
  (1, 3, 'gerente_nucleo', null,       'Atraso acima de 3 dias úteis'),
  (2, 7, 'gerente_nucleo', 'negocios', 'Atraso acima de 7 dias úteis');

comment on table epeas_escalonamento is
  'Degraus de escalonamento por atraso. O degrau 2 sobe para a Diretoria de '
  'Negocios pelo slug, porque contrato sem nucleo nao tem gerente a quem subir.';

alter table epeas_escalonamento enable row level security;

create policy epeas_escalonamento_select on epeas_escalonamento
  for select to authenticated using (true);

create policy epeas_escalonamento_manage on epeas_escalonamento
  for all to authenticated
  using (public.is_direx((select auth.uid())))
  with check (public.is_direx((select auth.uid())));
