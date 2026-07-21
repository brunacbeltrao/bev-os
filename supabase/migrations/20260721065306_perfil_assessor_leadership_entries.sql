-- ============================================================
-- BEV OS — Perfil do Assessor — parte 2/5
-- Aba 2: Diário de Liderança (1:1, reconhecimentos, acompanhamentos).
-- O assessor NÃO enxerga acompanhamentos formais (PRD §6.2 / §8).
-- ============================================================

create table if not exists public.leadership_entries (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.people (id) on delete cascade,
  author_id     uuid not null references public.people (id),
  cycle_id      uuid not null references public.cycles (id) default public.current_cycle_id(),
  tipo          text not null check (tipo in ('one_on_one', 'reconhecimento', 'acompanhamento')),
  data          date not null default current_date,
  pontos_fortes text,
  pontos_atencao text,
  plano_acao    text,
  proxima_1a1   date,
  reconhecimento_tipo text,
  motivo            text,
  combinado         text,
  prazo_verificacao date,
  gerou_advertencia boolean not null default false,
  descricao   text,
  event_id    uuid references public.events (id) on delete set null,
  warning_id  uuid references public.warnings (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leadership_entries_person_cycle_idx
  on public.leadership_entries (person_id, cycle_id, data desc);

drop trigger if exists leadership_entries_updated_at on public.leadership_entries;
create trigger leadership_entries_updated_at before update on public.leadership_entries
  for each row execute function public.set_updated_at();

alter table public.leadership_entries enable row level security;
revoke all on public.leadership_entries from anon;
grant select, insert, update, delete on public.leadership_entries to authenticated;
grant all on public.leadership_entries to service_role;

drop policy if exists leadership_entries_select on public.leadership_entries;
create policy leadership_entries_select on public.leadership_entries
  for select to authenticated
  using (
    public.lidera_pessoa((select auth.uid()), person_id)
    or (person_id = (select auth.uid()) and tipo <> 'acompanhamento')
  );

drop policy if exists leadership_entries_insert on public.leadership_entries;
create policy leadership_entries_insert on public.leadership_entries
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.lidera_pessoa((select auth.uid()), person_id)
  );

drop policy if exists leadership_entries_update on public.leadership_entries;
create policy leadership_entries_update on public.leadership_entries
  for update to authenticated
  using (public.lidera_pessoa((select auth.uid()), person_id))
  with check (public.lidera_pessoa((select auth.uid()), person_id));

drop policy if exists leadership_entries_delete on public.leadership_entries;
create policy leadership_entries_delete on public.leadership_entries
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_pc((select auth.uid())));
