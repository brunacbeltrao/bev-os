-- ============================================================
-- BEV OS · 09/09/2026 — o nome pelo qual o cliente é chamado. APLICADA.
--
-- `contratos.cliente` guarda a razão social, que é o que vale no contrato:
-- "MULTIPLA SERVICOS PARTICIPACOES E INVESTIMENTOS LTDA". Mas ninguém
-- chama o cliente assim: no fluxo e na pasta do Drive ele é "Plury".
-- Sete clientes apareciam com dois nomes e já foram confundidos com
-- contratos novos.
--
-- Chamei de `nome_comercial` em vez de "nome no Drive" de propósito: é a
-- marca do cliente, e continua verdade se um dia a EJ sair do Drive.
-- ============================================================

alter table public.contratos
  add column if not exists nome_comercial text;

comment on column public.contratos.nome_comercial is
  'Marca pela qual o cliente é conhecido, quando difere da razão social em `cliente`. É o nome usado na pasta do Drive e na conversa do dia a dia.';

-- Os sete casos confirmados pela Diretoria de Negócios (09/09).
update public.contratos set nome_comercial = 'Gavoa'              where cliente = 'Rafael Andrade Lima Sá De Melo';
update public.contratos set nome_comercial = 'CardioCentro'       where cliente = 'J B Clínica e Exames Cardiológicos';
update public.contratos set nome_comercial = 'Papo de residência' where cliente = 'JVVGP Consultoria em Educação LTDA';
update public.contratos set nome_comercial = 'Imunoped'           where cliente = 'Ana Carla Augusto Moura Falcão';
update public.contratos set nome_comercial = 'Plury'              where cliente = 'MULTIPLA SERVICOS PARTICIPACOES E INVESTIMENTOS LTDA';
update public.contratos set nome_comercial = 'O Mapa Mentoria'    where cliente = 'NC SERVIÇOS EDUCACIONAIS LTDA';
update public.contratos set nome_comercial = 'Ton Ton Lámen'      where cliente = 'Renato Hayashi Correia de Oliveira';

create index if not exists contratos_nome_comercial_idx
  on public.contratos(nome_comercial) where nome_comercial is not null;
