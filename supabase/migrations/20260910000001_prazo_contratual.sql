-- ===========================================================================
-- A camada contratual do prazo ganha vocabulário próprio.
--
-- Até aqui o prazo do contrato só sabia dizer "N dias úteis após um evento".
-- As cláusulas reais não são assim: a aba "Prazos Contratuais" da planilha
-- traz "40 dias úteis", "60 a 90 dias úteis", "2 meses", "4 meses",
-- "vigência de 12 meses". Faixa, mês e dia corrido não cabiam no modelo, e
-- o que não cabe acaba virando texto solto em outro lugar.
--
-- Nada aqui é destrutivo: `prazo_dias_uteis` é RENOMEADA (0 linhas
-- preenchidas hoje, nenhum dado se perde) em vez de duplicada, para não
-- deixar duas colunas disputando o mesmo significado.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. O tipo de prazo não é mais só "dias úteis"
--
-- Renomear valor de enum preserva as linhas que já o usam: o valor é
-- referenciado por OID, não pelo texto. `servico_etapas.prazo_tipo` tem
-- default `'dias_uteis_apos_evento'::prazo_tipo` e acompanha o rename.
-- ---------------------------------------------------------------------------
alter type prazo_tipo rename value 'dias_uteis_apos_evento' to 'apos_evento';

-- ---------------------------------------------------------------------------
-- 2. Unidade
--
-- Não existe unidade global certa: depende de quem executa a etapa. Etapa
-- da nossa equipe corre em dia útil; espera por órgão público (INPI, Junta
-- Comercial, Receita, prefeitura) é calendário.
-- ---------------------------------------------------------------------------
create type unidade_prazo as enum ('dias_uteis', 'dias_corridos', 'meses');

-- ---------------------------------------------------------------------------
-- 3. Prazo contratual em epeas_lifecycle
-- ---------------------------------------------------------------------------
alter table epeas_lifecycle rename column prazo_dias_uteis to prazo_quantidade;

alter table epeas_lifecycle
  add column prazo_unidade unidade_prazo not null default 'dias_uteis',
  add column prazo_quantidade_min integer,
  add column prazo_clausula text;

comment on column epeas_lifecycle.prazo_quantidade is
  'Quanto, na unidade de prazo_unidade. Em cláusula com faixa ("60 a 90"), '
  'aqui vai o TETO: é ele que gera responsabilidade perante o cliente.';
comment on column epeas_lifecycle.prazo_quantidade_min is
  'Piso da faixa, apenas para exibição ("60 a 90"). Não entra no cálculo.';
comment on column epeas_lifecycle.prazo_clausula is
  'Redação literal da cláusula, como está no contrato assinado. É a prova '
  'de onde o número saiu; a tela mostra ao lado do prazo calculado.';
comment on column epeas_lifecycle.prazo_unidade is
  'Como contar. Prazo de órgão público costuma ser dias corridos.';

-- Faixa invertida é erro de digitação, e vira prazo menor do que o piso
-- prometido — melhor barrar na escrita do que descobrir na cobrança.
alter table epeas_lifecycle
  add constraint epeas_lifecycle_faixa_prazo_coerente
  check (
    prazo_quantidade_min is null
    or (prazo_quantidade is not null and prazo_quantidade_min <= prazo_quantidade)
  );

-- Quantidade negativa ou zero não é prazo.
alter table epeas_lifecycle
  add constraint epeas_lifecycle_prazo_quantidade_positiva
  check (prazo_quantidade is null or prazo_quantidade > 0);
