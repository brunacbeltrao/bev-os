-- ============================================================
-- BEV OS — Onda 3.2: Reuniões de Área (RA) — gestão dedicada
-- Reaproveita os eventos RA (public.events, meeting_type slug='ra')
-- e o RLS existente (can_see_event / can_manage_event). Adiciona:
--  1) ra_details  — conteúdo estruturado da reunião (tipo, insights,
--     observações, transcrição da IA, repasses, ações). Pautas ficam
--     em events.pauta (compartilhado com o Calendário).
--  2) ra_attendance — presença por reunião, chaveada por E-MAIL do
--     roster (não por person_id) para permitir marcar assessores que
--     ainda não ativaram a conta, igual a "Meus Liderados".
-- ============================================================

begin;

create type public.ra_tipo as enum ('brainstorming', 'alinhamento', 'repasse', 'capacitacao');

-- ---------- 1) ra_details ----------
create table public.ra_details (
  event_id uuid primary key references public.events (id) on delete cascade,
  tipo public.ra_tipo,
  insights text,
  observacoes text,
  transcricao text,
  repasses text,
  acoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger ra_details_updated_at before update on public.ra_details
  for each row execute function public.set_updated_at();

alter table public.ra_details enable row level security;
revoke all on public.ra_details from anon;
grant select, insert, update, delete on public.ra_details to authenticated;
grant all on public.ra_details to service_role;

-- Leitura: quem vê o evento (membro da subárea / liderança / direx).
create policy ra_details_select on public.ra_details
  for select to authenticated
  using (public.can_see_event((select auth.uid()), event_id));
-- Escrita: só liderança da subárea da RA.
create policy ra_details_insert on public.ra_details
  for insert to authenticated
  with check (public.can_manage_event((select auth.uid()), event_id));
create policy ra_details_update on public.ra_details
  for update to authenticated
  using (public.can_manage_event((select auth.uid()), event_id))
  with check (public.can_manage_event((select auth.uid()), event_id));
create policy ra_details_delete on public.ra_details
  for delete to authenticated
  using (public.can_manage_event((select auth.uid()), event_id));

-- ---------- 2) ra_attendance ----------
create table public.ra_attendance (
  event_id uuid not null references public.events (id) on delete cascade,
  email text not null check (email = lower(email)),
  presente boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, email)
);
create trigger ra_attendance_updated_at before update on public.ra_attendance
  for each row execute function public.set_updated_at();

alter table public.ra_attendance enable row level security;
revoke all on public.ra_attendance from anon;
grant select, insert, update, delete on public.ra_attendance to authenticated;
grant all on public.ra_attendance to service_role;

create policy ra_attendance_select on public.ra_attendance
  for select to authenticated
  using (public.can_see_event((select auth.uid()), event_id));
create policy ra_attendance_insert on public.ra_attendance
  for insert to authenticated
  with check (public.can_manage_event((select auth.uid()), event_id));
create policy ra_attendance_update on public.ra_attendance
  for update to authenticated
  using (public.can_manage_event((select auth.uid()), event_id))
  with check (public.can_manage_event((select auth.uid()), event_id));
create policy ra_attendance_delete on public.ra_attendance
  for delete to authenticated
  using (public.can_manage_event((select auth.uid()), event_id));

-- ---------- 3) roster legível pela liderança da própria subárea ----------
-- Necessário para a liderança montar a lista de chamada da RA (inclui
-- quem ainda não ativou a conta). Soma-se às policies existentes
-- (P&C / Direx). Assessores continuam sem acesso ao roster.
create policy approved_roster_select_lider on public.approved_roster
  for select to authenticated
  using (public.is_leader_of((select auth.uid()), subarea_id));

commit;
