-- ============================================================
-- BEV OS · 14/08/2026 — JÁ APLICADO no Supabase.
-- Arquivo mantido para o histórico do repositório.
-- ============================================================

-- 1) Um contrato pode vender mais de um serviço.
--    O Portal BJ conta 31 "ações colaborativas" para 24 contratos.
--    contratos.servico_id vira o "serviço principal"; a verdade é esta tabela.
create table if not exists public.contrato_servicos (
  id          uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  servico_id  uuid not null references public.project_services(id) on delete restrict,
  valor       numeric(12,2),          -- null = ainda não rateado
  principal   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (contrato_id, servico_id)
);
create index if not exists contrato_servicos_contrato_idx on public.contrato_servicos(contrato_id);
create index if not exists contrato_servicos_servico_idx  on public.contrato_servicos(servico_id);
create trigger handle_updated_at before update on public.contrato_servicos
  for each row execute function public.set_updated_at();

alter table public.contrato_servicos enable row level security;
grant select, insert, update, delete on public.contrato_servicos to authenticated;

drop policy if exists contrato_servicos_select on public.contrato_servicos;
create policy contrato_servicos_select on public.contrato_servicos
  for select to authenticated
  using (exists (select 1 from public.contratos c where c.id = contrato_id));

drop policy if exists contrato_servicos_manage on public.contrato_servicos;
create policy contrato_servicos_manage on public.contrato_servicos
  for all to authenticated
  using (public.is_diretora_negocios((select auth.uid())) or public.is_direx((select auth.uid())))
  with check (public.is_diretora_negocios((select auth.uid())) or public.is_direx((select auth.uid())));

-- 2) Advertência aplicada por engano precisa poder ser revogada.
--    A tabela só tinha SELECT e INSERT.
drop policy if exists warnings_delete on public.warnings;
create policy warnings_delete on public.warnings
  for delete to authenticated
  using (public.belongs_to_subarea((select auth.uid()), public.pc_subarea_id()));

drop policy if exists warnings_update on public.warnings;
create policy warnings_update on public.warnings
  for update to authenticated
  using (public.belongs_to_subarea((select auth.uid()), public.pc_subarea_id()))
  with check (public.belongs_to_subarea((select auth.uid()), public.pc_subarea_id()));

-- 3) Índice em toda chave estrangeira de coluna única que não tinha.
--    Eram 89. Invisível com a base de hoje, caro quando o semestre encher.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass::text tbl, a.attname col
    from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.contype='f' and c.connamespace='public'::regnamespace
      and array_length(c.conkey,1)=1
      and not exists (select 1 from pg_index i
                      where i.indrelid=c.conrelid and i.indkey[0]=c.conkey[1])
  loop
    execute format('create index if not exists %I on %s(%I)',
                   replace(r.tbl,'public.','')||'_'||r.col||'_idx', r.tbl, r.col);
  end loop;
end $$;
