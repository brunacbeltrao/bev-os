-- ============================================================
-- BEV OS — Onda 0 — Migration 1: Núcleo de Identidade
-- cycles, directorates, subareas, project_nucleos,
-- approved_roster, people, occupations + fluxo de cadastro
-- ============================================================

-- ---------- Enum de papéis (Regimento Interno) ----------
create type public.role_type as enum (
  'diretor',
  'gerente',
  'coordenador',
  'analista',
  'assessor'
);

-- ---------- Trigger genérico de updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- cycles: ciclos semestrais ----------
create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique, -- ex: "2026.2"
  data_inicio date not null,
  data_fim date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cycles_datas_validas check (data_fim > data_inicio)
);

-- Garante no máximo um ciclo vigente
create unique index cycles_only_one_current
  on public.cycles (is_current)
  where is_current = true;

create trigger cycles_updated_at
  before update on public.cycles
  for each row execute function public.set_updated_at();

-- ---------- directorates: as 5 diretorias ----------
create table public.directorates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, -- negocios | projetos | gestao | pessoas_cultura | institucional
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger directorates_updated_at
  before update on public.directorates
  for each row execute function public.set_updated_at();

-- ---------- subareas: só Negócios tem 2 (comercial, marketing) ----------
create table public.subareas (
  id uuid primary key default gen_random_uuid(),
  directorate_id uuid not null references public.directorates (id),
  slug text not null unique,
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subareas_updated_at
  before update on public.subareas
  for each row execute function public.set_updated_at();

-- ---------- project_nucleos: Capiba e Suassuna (fixos) ----------
create table public.project_nucleos (
  id uuid primary key default gen_random_uuid(),
  directorate_id uuid not null references public.directorates (id),
  slug text not null unique, -- capiba | suassuna
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger project_nucleos_updated_at
  before update on public.project_nucleos
  for each row execute function public.set_updated_at();

-- ---------- approved_roster: fonte de verdade do quem-pode-entrar ----------
-- Pré-carregada por Bru/P&C antes de abrir o cadastro.
create table public.approved_roster (
  email text primary key check (email = lower(email)),
  nome text not null,
  role public.role_type not null,
  directorate_id uuid not null references public.directorates (id),
  subarea_id uuid not null references public.subareas (id),
  cycle_id uuid not null references public.cycles (id),
  claimed boolean not null default false,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger approved_roster_updated_at
  before update on public.approved_roster
  for each row execute function public.set_updated_at();

-- ---------- people: integrado ao auth.users ----------
create table public.people (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique check (email = lower(email)),
  foto_url text,
  entrou_em date not null default current_date, -- base para "tempo de EJ" no Perfil
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger people_updated_at
  before update on public.people
  for each row execute function public.set_updated_at();

-- ---------- occupations: tabela-chave do RBAC ----------
-- Uma pessoa pode ter mais de uma linha ativa no mesmo ciclo
-- (vínculo principal + vínculo híbrido), mas nunca duas linhas
-- de vínculo PRINCIPAL no mesmo ciclo (índice parcial abaixo).
create table public.occupations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  cycle_id uuid not null references public.cycles (id),
  directorate_id uuid not null references public.directorates (id),
  subarea_id uuid not null references public.subareas (id),
  role public.role_type not null,
  is_hibrido boolean not null default false, -- true = vínculo secundário (híbrido)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Híbrido só existe para assessor (PRD §3, Vínculos especiais)
  constraint occupations_hibrido_so_assessor
    check (not is_hibrido or role = 'assessor'),
  -- No máximo um vínculo (principal OU híbrido) por pessoa/subárea/ciclo
  constraint occupations_unica_por_subarea unique (person_id, cycle_id, subarea_id)
);

-- Nunca duas linhas de vínculo principal no mesmo ciclo
create unique index occupations_um_principal_por_ciclo
  on public.occupations (person_id, cycle_id)
  where is_hibrido = false;

create trigger occupations_updated_at
  before update on public.occupations
  for each row execute function public.set_updated_at();

create index occupations_person_idx on public.occupations (person_id);
create index occupations_subarea_idx on public.occupations (subarea_id);
create index occupations_cycle_idx on public.occupations (cycle_id);

-- ============================================================
-- Fluxo de cadastro (ADD §2):
-- pessoa se cadastra com e-mail/senha → trigger em auth.users
-- verifica approved_roster (claimed = false) → se ok, cria
-- people + occupations e marca claimed = true; se não, REJEITA
-- na hora (decisão validada com Bru: sem fila de revisão).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  roster_row public.approved_roster%rowtype;
begin
  select * into roster_row
  from public.approved_roster
  where email = lower(new.email);

  if not found then
    raise exception 'BEV_OS_EMAIL_NAO_APROVADO: e-mail não está na lista aprovada. Fale com Pessoas e Cultura.';
  end if;

  if roster_row.claimed then
    raise exception 'BEV_OS_EMAIL_JA_UTILIZADO: este e-mail já foi usado para criar uma conta.';
  end if;

  insert into public.people (id, nome, email)
  values (new.id, roster_row.nome, lower(new.email));

  insert into public.occupations
    (person_id, cycle_id, directorate_id, subarea_id, role, is_hibrido)
  values
    (new.id, roster_row.cycle_id, roster_row.directorate_id,
     roster_row.subarea_id, roster_row.role, false);

  update public.approved_roster
  set claimed = true, claimed_at = now()
  where email = roster_row.email;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RPC de pré-checagem do cadastro: permite à tela de cadastro
-- validar o e-mail ANTES de chamar signUp e exibir cargo/área
-- preenchidos automaticamente a partir do roster (PRD Onda 0).
-- ============================================================
create or replace function public.check_roster_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  roster_row record;
begin
  select r.nome, r.role, r.claimed,
         d.nome as diretoria, s.nome as area
  into roster_row
  from public.approved_roster r
  join public.directorates d on d.id = r.directorate_id
  join public.subareas s on s.id = r.subarea_id
  where r.email = lower(p_email);

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if roster_row.claimed then
    return jsonb_build_object('status', 'claimed');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'nome', roster_row.nome,
    'cargo', roster_row.role,
    'area', roster_row.area,
    'diretoria', roster_row.diretoria
  );
end;
$$;

revoke execute on function public.check_roster_email(text) from public;
grant execute on function public.check_roster_email(text) to anon, authenticated, service_role;
