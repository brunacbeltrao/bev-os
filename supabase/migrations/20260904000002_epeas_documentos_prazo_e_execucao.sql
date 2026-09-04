-- ============================================================
-- BEV OS · 04/09/2026 — EPEAS ganha o que faltava para executar o serviço.
-- APLICADA (no banco: epeas_documentos_prazo_e_execucao).
--
-- O que existia parava no rastreamento: etapa, checklist, conversa e três
-- links. O que uma banca precisa para tocar o caso — o contrato assinado
-- em PDF, o prazo prometido ao cliente, com quem falar do lado dele e o
-- número do processo no INPI — não tinha onde morar, e vivia no WhatsApp
-- de quem lembrasse.
-- ============================================================

-- ------------------------------------------------------------------
-- 1. Contrato é de Negócios: a diretoria inteira corrige o registro.
--    Criar e apagar contrato segue com a liderança.
-- ------------------------------------------------------------------
drop policy if exists contratos_update on public.contratos;
create policy contratos_update on public.contratos
  for update to authenticated
  using      (public.can_edit_dir_metrics((select auth.uid()), 'negocios')
              or public.pertence_diretoria((select auth.uid()), 'negocios'))
  with check (public.can_edit_dir_metrics((select auth.uid()), 'negocios')
              or public.pertence_diretoria((select auth.uid()), 'negocios'));

-- ------------------------------------------------------------------
-- 2. Documentos do contrato
--
-- Tipado de propósito: "anexo" solto vira pasta bagunçada, e a checagem
-- "o contrato assinado está aqui?" precisa de resposta de máquina, não de
-- leitura de nome de arquivo.
-- ------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname='epeas_documento_tipo') then
    create type public.epeas_documento_tipo as enum (
      'contrato_assinado','procuracao','comprovante_pagamento','gru',
      'documento_cliente','entregavel','outro'
    );
  end if;
end $$;

create table if not exists public.epeas_documentos (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid not null references public.contratos(id) on delete cascade,
  tipo         public.epeas_documento_tipo not null default 'outro',
  nome         text not null,
  path         text not null,
  enviado_por  uuid references public.people(id) on update cascade on delete set null,
  created_at   timestamptz not null default now()
);

comment on table public.epeas_documentos is
  'Documentos do contrato no bucket privado `epeas`. `path` é caminho do objeto (<contrato_id>/…), não URL: assine na leitura.';

create index if not exists epeas_documentos_contrato_idx
  on public.epeas_documentos(contrato_id, created_at desc);

alter table public.epeas_documentos enable row level security;

drop policy if exists epeas_documentos_select on public.epeas_documentos;
create policy epeas_documentos_select on public.epeas_documentos
  for select to authenticated using (public.epeas_pode_ver(contrato_id));

drop policy if exists epeas_documentos_insert on public.epeas_documentos;
create policy epeas_documentos_insert on public.epeas_documentos
  for insert to authenticated
  with check (public.epeas_pode_editar(contrato_id) and enviado_por = (select auth.uid()));

drop policy if exists epeas_documentos_delete on public.epeas_documentos;
create policy epeas_documentos_delete on public.epeas_documentos
  for delete to authenticated
  using (public.epeas_pode_editar(contrato_id));

-- ------------------------------------------------------------------
-- 3. Prazo, contato do cliente e dados de execução
-- ------------------------------------------------------------------
alter table public.epeas_lifecycle
  add column if not exists prazo_entrega            date,
  add column if not exists cliente_contato_nome     text,
  add column if not exists cliente_contato_email    text,
  add column if not exists cliente_contato_telefone text,
  add column if not exists inpi_processo            text,
  add column if not exists inpi_classe              text,
  add column if not exists inpi_data_protocolo      date;

comment on column public.epeas_lifecycle.prazo_entrega is
  'Data prometida ao cliente. O SLA por etapa mede o processo interno; este mede a promessa comercial, que é a que o cliente cobra.';
comment on column public.epeas_lifecycle.cliente_contato_nome is
  'Quem responde pelo cliente. Sem isto, quem assume o caso no meio não sabe com quem falar.';
comment on column public.epeas_lifecycle.inpi_processo is
  'Número do processo no INPI (Registro de Marca). É por ele que se acompanha na RPI.';
comment on column public.epeas_lifecycle.inpi_classe is
  'Classe de Nice do registro.';
