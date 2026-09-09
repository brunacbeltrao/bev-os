-- ============================================================
-- BEV OS · 09/09/2026 — motor de prazos do EPEAS. APLICADA.
--
-- O motor antigo contava dias corridos a partir da entrada na etapa. Para
-- operação jurídica isso é falso em três pontos:
--   1. prazo jurídico corre em dias ÚTEIS;
--   2. nasce de um EVENTO (assinatura, protocolo, pagamento de GRU), não
--      da data em que alguém cadastrou o contrato — contrato migrado
--      herdava a data da migração como se fosse assinatura;
--   3. PARA quando a bola está com o cliente ou com o órgão público.
-- Daí 97% da carteira aparecer atrasada.
--
-- O cálculo mora em src/lib/prazos.ts, puro e coberto por testes. Aqui
-- ficam só os fatos: eventos, suspensões e feriados.
-- ============================================================

create type public.prazo_tipo as enum ('data_fixa','dias_uteis_apos_evento','condicionado');

create type public.epeas_evento_tipo as enum (
  'assinatura','protocolo_inpi','entrega_documentos_cliente',
  'pagamento_gru','publicacao_rpi','outro');

create type public.suspensao_motivo as enum ('aguardando_cliente','aguardando_orgao_publico');

-- Feriados em tabela, não em código: a EJ precisa acrescentar ponto
-- facultativo e feriado municipal sem esperar deploy.
create table if not exists public.feriados (
  data        date primary key,
  nome        text not null,
  abrangencia text not null check (abrangencia in ('nacional','pe','recife')),
  created_at  timestamptz not null default now()
);

alter table public.feriados enable row level security;
create policy feriados_select on public.feriados for select to authenticated using (true);
create policy feriados_manage on public.feriados for all to authenticated
  using (public.is_direx((select auth.uid()))) with check (public.is_direx((select auth.uid())));

-- Páscoa por Meeus/Jones/Butcher: os móveis saem dela, e calcular é mais
-- seguro que digitar ano a ano. Conferido: 2026-04-05 e 2027-03-28.
create or replace function public.domingo_de_pascoa(p_ano int)
returns date language plpgsql immutable as $$
declare a int; b int; c int; d int; e int; f int; g int; h int;
        i int; k int; l int; m int; mes int; dia int;
begin
  a := p_ano % 19;      b := p_ano / 100;    c := p_ano % 100;
  d := b / 4;           e := b % 4;          f := (b + 8) / 25;
  g := (b - f + 1) / 3; h := (19*a + b - d - g + 15) % 30;
  i := c / 4;           k := c % 4;
  l := (32 + 2*e + 2*i - h - k) % 7;
  m := (a + 11*h + 22*l) / 451;
  mes := (h + l - 7*m + 114) / 31;
  dia := ((h + l - 7*m + 114) % 31) + 1;
  return make_date(p_ano, mes, dia);
end $$;

create or replace function public.semear_feriados(p_ano int)
returns void language plpgsql as $$
declare pascoa date := public.domingo_de_pascoa(p_ano);
begin
  insert into public.feriados (data, nome, abrangencia) values
    (make_date(p_ano,1,1),   'Confraternização Universal',      'nacional'),
    (make_date(p_ano,4,21),  'Tiradentes',                      'nacional'),
    (make_date(p_ano,5,1),   'Dia do Trabalho',                 'nacional'),
    (make_date(p_ano,9,7),   'Independência',                   'nacional'),
    (make_date(p_ano,10,12), 'Nossa Senhora Aparecida',         'nacional'),
    (make_date(p_ano,11,2),  'Finados',                         'nacional'),
    (make_date(p_ano,11,15), 'Proclamação da República',        'nacional'),
    (make_date(p_ano,11,20), 'Consciência Negra',               'nacional'),
    (make_date(p_ano,12,25), 'Natal',                           'nacional'),
    (pascoa - 48,            'Carnaval (segunda)',              'nacional'),
    (pascoa - 47,            'Carnaval (terça)',                'nacional'),
    (pascoa - 2,             'Sexta-feira Santa',               'nacional'),
    (pascoa + 60,            'Corpus Christi',                  'nacional'),
    (make_date(p_ano,3,6),   'Revolução Pernambucana (Data Magna de PE)', 'pe'),
    (make_date(p_ano,12,8),  'Nossa Senhora da Conceição (padroeira do Recife)', 'recife')
  on conflict (data) do nothing;
end $$;

select public.semear_feriados(ano) from generate_series(2026, 2029) as ano;

-- Eventos: é deles que o prazo nasce. Sem evento não há baseline, e sem
-- baseline não existe atraso — só falta de informação.
create table if not exists public.epeas_eventos (
  id             uuid primary key default gen_random_uuid(),
  contrato_id    uuid not null references public.contratos(id) on delete cascade,
  tipo           public.epeas_evento_tipo not null,
  ocorrido_em    date not null,
  observacao     text,
  registrado_por uuid references public.people(id) on update cascade on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists epeas_eventos_contrato_idx on public.epeas_eventos(contrato_id, tipo, ocorrido_em);
alter table public.epeas_eventos enable row level security;
create policy epeas_eventos_select on public.epeas_eventos for select to authenticated
  using (public.epeas_pode_ver(contrato_id));
create policy epeas_eventos_insert on public.epeas_eventos for insert to authenticated
  with check (public.epeas_pode_editar(contrato_id) and registrado_por = (select auth.uid()));
create policy epeas_eventos_delete on public.epeas_eventos for delete to authenticated
  using (public.epeas_pode_editar(contrato_id));

-- Suspensões congelam o contador enquanto a bola não é nossa.
create table if not exists public.epeas_suspensoes (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid not null references public.contratos(id) on delete cascade,
  motivo        public.suspensao_motivo not null,
  justificativa text not null,
  iniciada_em   timestamptz not null default now(),
  iniciada_por  uuid references public.people(id) on update cascade on delete set null,
  retomada_em   timestamptz,
  retomada_por  uuid references public.people(id) on update cascade on delete set null,
  nota_retomada text,
  created_at    timestamptz not null default now(),
  constraint suspensao_retomada_depois check (retomada_em is null or retomada_em >= iniciada_em)
);
-- Uma pausa aberta por vez: duas simultâneas descontariam em dobro.
create unique index if not exists epeas_suspensao_uma_aberta
  on public.epeas_suspensoes(contrato_id) where retomada_em is null;
create index if not exists epeas_suspensoes_contrato_idx on public.epeas_suspensoes(contrato_id, iniciada_em);
alter table public.epeas_suspensoes enable row level security;
create policy epeas_suspensoes_select on public.epeas_suspensoes for select to authenticated
  using (public.epeas_pode_ver(contrato_id));
create policy epeas_suspensoes_insert on public.epeas_suspensoes for insert to authenticated
  with check (public.epeas_pode_editar(contrato_id) and iniciada_por = (select auth.uid()));
create policy epeas_suspensoes_update on public.epeas_suspensoes for update to authenticated
  using (public.epeas_pode_editar(contrato_id)) with check (public.epeas_pode_editar(contrato_id));

-- Configuração do prazo, por etapa da trilha e por contrato.
alter table public.servico_etapas
  add column if not exists prazo_tipo     public.prazo_tipo not null default 'dias_uteis_apos_evento',
  add column if not exists evento_gatilho public.epeas_evento_tipo;

alter table public.epeas_lifecycle
  add column if not exists prazo_tipo           public.prazo_tipo,
  add column if not exists prazo_dias_uteis     integer,
  add column if not exists prazo_evento_gatilho public.epeas_evento_tipo,
  add column if not exists prazo_condicao       text;
