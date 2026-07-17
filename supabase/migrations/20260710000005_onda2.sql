-- ============================================================
-- BEV OS — Onda 2: Comercial (herdado do Bevilaqua Connect,
-- SEM gamificação) e Projetos (ADD §3.5–3.6, §6 item 3)
-- Decisão validada (Bruna, 10/07/2026): alocação de núcleo é
-- MANUAL — o projeto nasce sem núcleo e a liderança de Projetos
-- aloca Capiba/Suassuna depois.
-- ============================================================

-- ---------- Enums ----------
create type public.lead_etapa as enum
  ('qualificacao', 'prospeccao', 'reuniao', 'proposta', 'negociacao', 'fechado', 'perdido');
create type public.lead_segmento as enum ('pme', 'ej', 'atletica', 'outro');
create type public.project_status as enum ('em_andamento', 'concluido');

-- ============================================================
-- 3.5 Comercial
-- ============================================================
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  nome_cliente text not null,
  assessor_responsavel_id uuid not null references public.people (id),
  etapa_atual public.lead_etapa not null default 'qualificacao',
  segmento public.lead_segmento not null default 'outro',
  valor_fechado numeric(12, 2),
  servicos_vendidos text[],
  motivo_perda text,
  criado_por uuid not null references public.people (id),
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
create index leads_etapa_idx on public.leads (etapa_atual);
create index leads_cycle_idx on public.leads (cycle_id);
create index leads_assessor_idx on public.leads (assessor_responsavel_id);

-- Trilha de mudança de etapa (herdada do schema do Connect)
create table public.lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  etapa_anterior public.lead_etapa,
  etapa_nova public.lead_etapa not null,
  changed_by uuid references public.people (id),
  created_at timestamptz not null default now()
);
create index lead_stage_history_lead_idx on public.lead_stage_history (lead_id);

-- Regras de negócio do funil (PRD §5 Onda 2 / Blueprint §7):
-- Fechado exige valor_fechado; Perdido exige motivo_perda.
create or replace function public.enforce_lead_rules()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.etapa_atual = 'fechado' and (new.valor_fechado is null or new.valor_fechado <= 0) then
    raise exception 'BEV_OS_LEAD_FECHADO_SEM_VALOR: para fechar o lead, informe o valor fechado.';
  end if;
  if new.etapa_atual = 'perdido'
     and (new.motivo_perda is null or length(trim(new.motivo_perda)) = 0) then
    raise exception 'BEV_OS_LEAD_PERDIDO_SEM_MOTIVO: para marcar como perdido, informe o motivo da perda.';
  end if;
  return new;
end;
$$;
create trigger leads_enforce_rules before insert or update on public.leads
  for each row execute function public.enforce_lead_rules();

-- Registra a trilha de etapas automaticamente
create or replace function public.record_lead_stage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_stage_history (lead_id, etapa_anterior, etapa_nova, changed_by)
    values (new.id, null, new.etapa_atual, auth.uid());
  elsif old.etapa_atual is distinct from new.etapa_atual then
    insert into public.lead_stage_history (lead_id, etapa_anterior, etapa_nova, changed_by)
    values (new.id, old.etapa_atual, new.etapa_atual, auth.uid());
  end if;
  return new;
end;
$$;
create trigger leads_record_stage after insert or update on public.leads
  for each row execute function public.record_lead_stage();

-- ============================================================
-- 3.6 Projetos
-- ============================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid unique references public.leads (id), -- origem da venda
  cliente text not null,
  nucleo_id uuid references public.project_nucleos (id), -- null até a liderança alocar
  status public.project_status not null default 'em_andamento',
  prazo date,
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create index projects_status_idx on public.projects (status);
create index projects_cycle_idx on public.projects (cycle_id);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, person_id)
);

-- Fluxo Comercial → Projetos (PRD §7): ao fechar contrato, o
-- Comercial gera um Projeto automaticamente, SEM núcleo — a
-- liderança de Projetos aloca manualmente (decisão da Bruna).
create or replace function public.create_project_from_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.etapa_atual = 'fechado'
     and (tg_op = 'INSERT' or old.etapa_atual is distinct from 'fechado')
     and not exists (select 1 from public.projects p where p.lead_id = new.id) then
    insert into public.projects (lead_id, cliente, nucleo_id, status, cycle_id)
    values (new.id, new.nome_cliente, null, 'em_andamento', new.cycle_id);
  end if;
  return new;
end;
$$;
create trigger leads_create_project after insert or update on public.leads
  for each row execute function public.create_project_from_lead();

-- ============================================================
-- RLS + GRANTs
-- ============================================================

-- ---------- leads ----------
-- Visível para a subárea Comercial (inclui híbridos) e Direx;
-- edição pelo responsável, criador ou liderança de Comercial
-- (que inclui a Diretora de Negócios via is_leader_of).
alter table public.leads enable row level security;
revoke all on public.leads from anon;
grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;

create policy leads_select on public.leads
  for select to authenticated
  using (
    public.belongs_to_subarea(
      (select auth.uid()),
      (select s.id from public.subareas s where s.slug = 'comercial')
    )
    or public.is_direx((select auth.uid()))
  );

create policy leads_insert on public.leads
  for insert to authenticated
  with check (
    criado_por = (select auth.uid())
    and cycle_id = public.current_cycle_id()
    and (
      public.belongs_to_subarea(
        (select auth.uid()),
        (select s.id from public.subareas s where s.slug = 'comercial')
      )
      or public.is_leader_of(
        (select auth.uid()),
        (select s.id from public.subareas s where s.slug = 'comercial')
      )
    )
  );

create policy leads_update on public.leads
  for update to authenticated
  using (
    cycle_id = public.current_cycle_id()
    and (
      assessor_responsavel_id = (select auth.uid())
      or criado_por = (select auth.uid())
      or public.is_leader_of(
        (select auth.uid()),
        (select s.id from public.subareas s where s.slug = 'comercial')
      )
    )
  )
  with check (cycle_id = public.current_cycle_id());

create policy leads_delete on public.leads
  for delete to authenticated
  using (
    cycle_id = public.current_cycle_id()
    and public.is_leader_of(
      (select auth.uid()),
      (select s.id from public.subareas s where s.slug = 'comercial')
    )
  );

-- ---------- lead_stage_history ----------
-- Escrita apenas via trigger (SECURITY DEFINER); leitura segue os leads.
alter table public.lead_stage_history enable row level security;
revoke all on public.lead_stage_history from anon;
grant select on public.lead_stage_history to authenticated;
grant all on public.lead_stage_history to service_role;

create policy lead_stage_history_select on public.lead_stage_history
  for select to authenticated
  using (
    public.belongs_to_subarea(
      (select auth.uid()),
      (select s.id from public.subareas s where s.slug = 'comercial')
    )
    or public.is_direx((select auth.uid()))
  );

-- ---------- projects ----------
-- Visível para a subárea Projetos e Direx; gestão (alocar núcleo,
-- prazo, status) pela liderança de Projetos.
alter table public.projects enable row level security;
revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;

create policy projects_select on public.projects
  for select to authenticated
  using (
    public.belongs_to_subarea(
      (select auth.uid()),
      (select s.id from public.subareas s where s.slug = 'projetos')
    )
    or public.is_direx((select auth.uid()))
  );

create policy projects_insert on public.projects
  for insert to authenticated
  with check (
    cycle_id = public.current_cycle_id()
    and public.is_leader_of(
      (select auth.uid()),
      (select s.id from public.subareas s where s.slug = 'projetos')
    )
  );

create policy projects_update on public.projects
  for update to authenticated
  using (
    cycle_id = public.current_cycle_id()
    and public.is_leader_of(
      (select auth.uid()),
      (select s.id from public.subareas s where s.slug = 'projetos')
    )
  )
  with check (cycle_id = public.current_cycle_id());

create policy projects_delete on public.projects
  for delete to authenticated
  using (
    cycle_id = public.current_cycle_id()
    and public.is_leader_of(
      (select auth.uid()),
      (select s.id from public.subareas s where s.slug = 'projetos')
    )
  );

-- ---------- project_members ----------
alter table public.project_members enable row level security;
revoke all on public.project_members from anon;
grant select, insert, delete on public.project_members to authenticated;
grant all on public.project_members to service_role;

create policy project_members_select on public.project_members
  for select to authenticated
  using (
    public.belongs_to_subarea(
      (select auth.uid()),
      (select s.id from public.subareas s where s.slug = 'projetos')
    )
    or public.is_direx((select auth.uid()))
  );

create policy project_members_insert on public.project_members
  for insert to authenticated
  with check (
    public.is_leader_of(
      (select auth.uid()),
      (select s.id from public.subareas s where s.slug = 'projetos')
    )
  );

create policy project_members_delete on public.project_members
  for delete to authenticated
  using (
    public.is_leader_of(
      (select auth.uid()),
      (select s.id from public.subareas s where s.slug = 'projetos')
    )
  );
