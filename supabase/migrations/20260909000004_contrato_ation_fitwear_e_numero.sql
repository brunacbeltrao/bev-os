-- ============================================================
-- BEV OS · 09/09/2026 — contrato da Ation Fitwear + número do contrato.
-- APLICADA.
--
-- A planilha do piloto identifica cada contrato por um número
-- (RGM/AJ/CNPJ 00/2026) que não tinha onde morar no sistema. Sem a coluna,
-- o "RGM 34/2026" da Ation se perderia na importação — e a mesma falta
-- apareceria de novo nos outros 31, que ainda vão receber o seu número.
-- ============================================================

alter table public.contratos
  add column if not exists numero text;

comment on column public.contratos.numero is
  'Número do contrato como a EJ o identifica: RGM/AJ/CNPJ seguido de sequencial/ano. Ex.: "RGM 34/2026".';

create unique index if not exists contratos_numero_idx
  on public.contratos(numero) where numero is not null;

-- Ation Fitwear — RGM 34/2026, fechado em 24/08/2026, R$ 1.300,02.
-- `segmento` = 'pme' é inferência a partir do ramo (marca de roupa
-- fitness); os valores possíveis são pme, ej, atletica e outro.
insert into public.contratos
  (cycle_id, cliente, numero, valor, data_fechamento, servico_id, segmento, criado_por, status)
select
  '977cb5b9-2713-4de3-b3cc-ed55bfed4c8a',
  'Ation Fitwear',
  'RGM 34/2026',
  1300.02,
  date '2026-08-24',
  '0e591d92-3deb-48d5-99b4-bd2c07549041',  -- Registro de Marca
  'pme',
  'fd086a4d-034b-4f60-917a-dcf59ebf6f0a',  -- registrado por Bruna Beltrão
  'aprovado'
where not exists (select 1 from public.contratos where numero = 'RGM 34/2026');

-- Sem o ciclo de vida o contrato não aparece no EPEAS: não há trigger que
-- o crie sozinho, e os outros 31 têm o seu.
insert into public.epeas_lifecycle (contrato_id, etapa_macro)
select c.id, 'comercial_contrato_fechado'
from public.contratos c
where c.numero = 'RGM 34/2026'
  and not exists (select 1 from public.epeas_lifecycle l where l.contrato_id = c.id);

-- Efeito no faturamento de 2026: 57.759,01 -> 59.059,03.
