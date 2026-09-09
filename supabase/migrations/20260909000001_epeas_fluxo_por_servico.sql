-- ============================================================
-- BEV OS · 09/09/2026 — APLICADA por outra sessão, direto no banco.
-- Reconstruída no repo a partir do catálogo, para o repositório voltar a
-- descrever o sistema. NÃO reaplicar por cima sem conferir.
--
-- Onda B do PRD: a execução deixa de ser uma lista fixa de seis etapas de
-- Registro de Marca e passa a ser configurável por serviço. As 28 linhas
-- de seed vieram da aba "Configurações" da planilha EPEAS_Piloto_2026:
-- 7 serviços x 4 etapas, cada uma com o próprio prazo.
--
-- INCIDENTE, registrado porque explica a coluna legada: esta migration
-- também fez DROP COLUMN etapa_execucao, o que quebrou a aba EPEAS em
-- produção — o deploy publicado ainda a lia. Foi restaurada como text
-- nullable, sem CHECK, e está marcada como legado. Ver 20260909000002.
-- ============================================================

create table if not exists public.servico_etapas (
  id         uuid primary key default gen_random_uuid(),
  servico_id uuid not null references public.project_services(id) on delete cascade,
  ordem      integer not null,
  nome       text not null,
  prazo_dias integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (servico_id, ordem)
);

comment on table public.servico_etapas is
  'Trilha de execução de cada serviço, com prazo por etapa. Mudar o processo é mexer aqui, não num deploy.';

alter table public.servico_etapas enable row level security;

drop policy if exists servico_etapas_select on public.servico_etapas;
create policy servico_etapas_select on public.servico_etapas
  for select to authenticated using (true);

drop policy if exists servico_etapas_manage on public.servico_etapas;
create policy servico_etapas_manage on public.servico_etapas
  for all to authenticated
  using (public.is_direx((select auth.uid())) or public.is_lideranca_projetos((select auth.uid())))
  with check (public.is_direx((select auth.uid())) or public.is_lideranca_projetos((select auth.uid())));

alter table public.epeas_lifecycle
  add column if not exists etapa_servico_id uuid
    references public.servico_etapas(id) on update cascade on delete set null,
  add column if not exists csat_enviado_em  timestamptz,
  add column if not exists termo_enviado_em timestamptz,
  add column if not exists nf_emitida_em    timestamptz;

-- Etapa de execução só faz sentido com o contrato em execução.
alter table public.epeas_lifecycle
  drop constraint if exists epeas_execucao_so_em_execucao;
alter table public.epeas_lifecycle
  add constraint epeas_execucao_so_em_execucao
  check (etapa_servico_id is null
         or etapa_macro in ('projetos_em_execucao','projetos_entregue'));

-- O seed das 28 etapas está no banco; não é repetido aqui para não
-- duplicar em uma reaplicação. Consulte servico_etapas para o vigente.
