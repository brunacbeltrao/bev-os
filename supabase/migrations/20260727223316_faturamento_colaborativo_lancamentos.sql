-- ============================================================
-- Faturamento colaborativo (Institucional)
-- Passa de número agregado para lançamentos individuais:
-- tipo de serviço, EJ parceira, valor total do contrato,
-- valor que fica com o BEV (o que conta no faturamento) e
-- quem fechou.
-- ============================================================

create table if not exists public.colab_faturamentos (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  servico_id uuid references public.project_services(id),
  servico_outro text,
  ej_parceira text not null,
  valor_total numeric(12,2) not null check (valor_total >= 0),
  valor_bev numeric(12,2) not null check (valor_bev >= 0),
  fechado_por uuid references public.people(id) on update cascade,
  data_fechamento date not null default current_date,
  observacoes text,
  criado_por uuid not null references public.people(id) on update cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint colab_valor_bev_menor check (valor_bev <= valor_total),
  constraint colab_servico_informado check (servico_id is not null or servico_outro is not null)
);

create index if not exists colab_faturamentos_cycle_idx
  on public.colab_faturamentos (cycle_id, data_fechamento desc);

drop trigger if exists set_updated_at on public.colab_faturamentos;
create trigger set_updated_at before update on public.colab_faturamentos
  for each row execute function public.set_updated_at();

alter table public.colab_faturamentos enable row level security;

drop policy if exists colab_select on public.colab_faturamentos;
create policy colab_select on public.colab_faturamentos
  for select to authenticated using (true);

drop policy if exists colab_insert on public.colab_faturamentos;
create policy colab_insert on public.colab_faturamentos
  for insert to authenticated
  with check (public.can_edit_dir_metrics((select auth.uid()), 'institucional'));

drop policy if exists colab_update on public.colab_faturamentos;
create policy colab_update on public.colab_faturamentos
  for update to authenticated
  using (public.can_edit_dir_metrics((select auth.uid()), 'institucional'))
  with check (public.can_edit_dir_metrics((select auth.uid()), 'institucional'));

drop policy if exists colab_delete on public.colab_faturamentos;
create policy colab_delete on public.colab_faturamentos
  for delete to authenticated
  using (public.can_edit_dir_metrics((select auth.uid()), 'institucional'));

-- Projeto de impacto sai do painel geral. A coluna fica no banco por
-- compatibilidade com a versao anterior em producao; remover depois do
-- deploy com: alter table public.bev_indicadores drop column projeto_impacto;
comment on column public.bev_indicadores.projeto_impacto is
  'Descontinuado - removido da interface em 27/07/2026. Mantido so por compatibilidade.';
