-- ===========================================================================
-- Reclassificação das 28 etapas da trilha, revisada pela Diretoria.
--
-- A migration anterior devolveu os 28 prazos ao significado original da
-- planilha: dias corridos. Esta aplica a decisão de negócio sobre quais
-- passam a dias úteis, e em quanto.
--
-- Critério: dias ÚTEIS quando o relógio é nosso; dias CORRIDOS quando o
-- relógio é de quem está do outro lado — órgão público, ou uma assembleia
-- com data marcada. Espera por cliente não muda a unidade: para isso existe
-- a suspensão, que congela o contador com justificativa e trilha de quem
-- pausou.
--
-- CONVERSÃO DO NÚMERO, e não só da unidade.
--
-- Trocar a unidade mantendo o número afrouxaria o SLA em ~40%: "minuta em 5"
-- deixaria de significar 5 dias de calendário e passaria a significar 7, sem
-- ninguém ter decidido isso. Como a decisão foi manter o prazo real, cada
-- número convertido encolhe na mesma proporção:
--
--     úteis = arredonda(corridos × 5/7), mínimo 1
--
-- 5/7 é a fração de dias úteis numa semana — a proporção que preserva a
-- janela de calendário em prazos curtos, que é o caso de todos estes.
-- Feriado não entra na conta: em janela de 2 a 10 dias ele é exceção, e o
-- motor já o desconta quando aparece de fato.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Etapa condicionada precisa poder existir sem número
--
-- "Monitoramento de oposição e deferimento" não tem prazo nosso: espera
-- decisão do INPI. Prazo condicionado nunca aparece como atrasado, porque
-- cobrar quem não pode agir não move nada.
-- ---------------------------------------------------------------------------
alter table servico_etapas add column prazo_condicao text;

alter table servico_etapas alter column prazo_quantidade drop not null;

alter table servico_etapas drop constraint servico_etapas_prazo_positivo;

-- Amarra tipo e número um ao outro. De quebra barra `data_fixa` na trilha:
-- etapa de processo não tem data de calendário fixa, e não há coluna para
-- guardá-la aqui — permitir o valor só criaria etapa sem prazo nenhum.
alter table servico_etapas
  add constraint servico_etapas_prazo_coerente
  check (
    (prazo_tipo = 'apos_evento' and prazo_quantidade is not null and prazo_quantidade > 0)
    or (prazo_tipo = 'condicionado' and prazo_quantidade is null)
  );

comment on column servico_etapas.prazo_condicao is
  'Para prazo_tipo = condicionado: o que se esta esperando, em texto, para a '
  'tela dizer o motivo em vez de so mostrar "aguardando".';

-- ---------------------------------------------------------------------------
-- 2. As 22 etapas que passam a dias úteis, com o número já convertido
-- ---------------------------------------------------------------------------
update servico_etapas e
set unidade_prazo   = 'dias_uteis',
    prazo_quantidade = v.uteis
from (values
  -- serviço                                  ordem  corridos -> úteis
  ('Abertura de CNPJ',                        1, 2),   -- 3 corridos
  ('Assessoria Jurídica',                     1, 4),   -- 5
  ('Assessoria Jurídica',                     2, 7),   -- 10
  ('Assessoria Jurídica',                     3, 4),   -- 5
  ('Assessoria Jurídica',                     4, 4),   -- 5
  ('Registro de Marca',                       1, 4),   -- 5
  ('Registro de Marca',                       2, 7),   -- 10
  ('Revisão e Elaboração de Atas',            1, 1),   -- 2
  ('Revisão e Elaboração de Atas',            2, 2),   -- 3
  ('Revisão e Elaboração de Atas',            3, 1),   -- 2
  ('Revisão e Elaboração de Atas',            4, 2),   -- 3
  ('Revisão e Elaboração de Contratos',       1, 2),   -- 3
  ('Revisão e Elaboração de Contratos',       2, 4),   -- 5
  ('Revisão e Elaboração de Contratos',       3, 2),   -- 3
  ('Revisão e Elaboração de Contratos',       4, 1),   -- 2
  ('Revisão e Elaboração do Estatuto Social', 1, 2),   -- 3
  ('Revisão e Elaboração do Estatuto Social', 2, 5),   -- 7
  ('Revisão e Elaboração do Estatuto Social', 3, 4),   -- 5
  ('Termos de Uso e Política de Privacidade', 1, 2),   -- 3
  ('Termos de Uso e Política de Privacidade', 2, 5),   -- 7
  ('Termos de Uso e Política de Privacidade', 3, 2),   -- 3
  ('Termos de Uso e Política de Privacidade', 4, 1)    -- 2
) as v(servico, ordem, uteis)
join project_services s on s.nome = v.servico
where e.servico_id = s.id and e.ordem = v.ordem;

-- ---------------------------------------------------------------------------
-- 3. As 5 que continuam em dias corridos, e por quê
--
--   CNPJ 2   registro na Junta Comercial  -> a fila da Junta domina
--   CNPJ 3   Receita, Sefaz e prefeitura  -> relógio de três órgãos
--   CNPJ 4   emissão de alvarás           -> prefeitura
--   Marca 3  exame formal e publicação    -> relógio do INPI
--   Estatuto 4 aprovação em assembleia    -> a assembleia tem data marcada
--
-- Nenhuma linha a mexer: já estão corridas com o número da planilha. Ficam
-- registradas aqui para a próxima pessoa não achar que foram esquecidas.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 4. Monitoramento de oposição e deferimento vira condicionado
-- ---------------------------------------------------------------------------
update servico_etapas e
set prazo_tipo      = 'condicionado',
    prazo_quantidade = null,
    prazo_condicao  = 'Decisão do INPI sobre oposição e deferimento'
from project_services s
where e.servico_id = s.id
  and s.nome = 'Registro de Marca'
  and e.ordem = 4;
