-- ===========================================================================
-- Unidade por etapa da trilha, e a correção do significado dos 28 prazos.
--
-- Os 28 números da aba "Configurações" da planilha eram DIAS CORRIDOS. A
-- prova está na fórmula da própria planilha: soma direta de data
-- (I5 + VLOOKUP(Configurações...)), sem nenhuma função de dia útil — não há
-- WORKDAY em lugar nenhum do arquivo.
--
-- Em 09/09 o motor de prazos passou a lê-los como dias ÚTEIS sem migrar o
-- dado. Um prazo de 10 virou ~14 dias de calendário; os 60 e 90 do Registro
-- de Marca viraram 12 e 18 semanas em vez de 2 e 3 meses. Ninguém sentiu
-- porque nenhum contrato chegou à execução, mas estava errado desde então.
--
-- Esta migration restaura o significado original. A reclassificação etapa a
-- etapa (quais passam a dias úteis) é decisão de negócio e vem depois, com
-- a tabela revisada — não se adivinha aqui.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Simetria de nome com a camada contratual: prazo_dias -> prazo_quantidade
--
-- Rename, não drop: nenhum dado se perde. Com a unidade ao lado, "dias" no
-- nome da coluna passaria a mentir na hora em que uma etapa for em meses.
-- ---------------------------------------------------------------------------
alter table servico_etapas rename column prazo_dias to prazo_quantidade;

-- ---------------------------------------------------------------------------
-- 2. A unidade
--
-- Não existe regra global: a unidade depende de quem executa a etapa.
--   - etapa executada pela nossa equipe  -> dias úteis
--   - espera por órgão público (INPI, Junta Comercial, Receita, prefeitura)
--     -> dias corridos, porque o relógio de fora não conhece nosso calendário
--
-- Nasce nula, recebe 'dias_corridos' nas 28 linhas existentes (restaurando a
-- planilha) e só então vira NOT NULL. O DEFAULT para linhas futuras é
-- 'dias_uteis': etapa nova quase sempre é da nossa equipe.
-- ---------------------------------------------------------------------------
alter table servico_etapas add column unidade_prazo unidade_prazo;

update servico_etapas set unidade_prazo = 'dias_corridos';

alter table servico_etapas
  alter column unidade_prazo set not null,
  alter column unidade_prazo set default 'dias_uteis';

comment on column servico_etapas.unidade_prazo is
  'Como contar o prazo_quantidade desta etapa. Etapa da nossa equipe: '
  'dias_uteis. Espera por orgao publico: dias_corridos. As 28 etapas do '
  'piloto entraram como dias_corridos porque era assim que a planilha de '
  'origem contava.';

comment on column servico_etapas.prazo_quantidade is
  'SLA INTERNO da etapa, na unidade de unidade_prazo. Estimativa nossa para '
  'a equipe se cobrar -- nao e o prazo prometido ao cliente, que fica em '
  'epeas_lifecycle.prazo_quantidade.';

alter table servico_etapas
  add constraint servico_etapas_prazo_positivo
  check (prazo_quantidade > 0);
