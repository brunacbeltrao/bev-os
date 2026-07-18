-- ============================================================
-- APLICAR BEVSKILLS — versão idempotente (reset + apply)
--
-- Pode rodar quantas vezes quiser. Ela primeiro APAGA qualquer
-- objeto do BevSkills que tenha sobrado de tentativas anteriores e
-- depois recria tudo do zero. NÃO depende de is_direx/is_leader_of/
-- current_cycle_id (que faltam neste banco) — o admin é calculado
-- direto das tabelas base occupations/subareas/cycles.
--
-- ATENÇÃO: apaga dados do BevSkills (cursos/aulas/progresso). Seguro
-- agora porque o módulo ainda não entrou no ar. NÃO rode isto depois
-- que houver conteúdo/alunos reais sem antes fazer backup.
--
-- Como rodar: Dashboard Supabase -> SQL Editor -> New query ->
-- cole TODO este arquivo -> Run.
-- ============================================================

-- ---------- 0. Limpeza (remove restos de tentativas anteriores) ----------
drop table if exists public.course_category_relations cascade;
drop table if exists public.course_categories       cascade;
drop table if exists public.certificates            cascade;
drop table if exists public.user_course_progress    cascade;
drop table if exists public.user_lesson_progress    cascade;
drop table if exists public.lesson_attachments      cascade;
drop table if exists public.lessons                 cascade;
drop table if exists public.modules                 cascade;
drop table if exists public.courses                 cascade;
drop table if exists public.learning_paths          cascade;
drop function if exists public.update_course_progress()   cascade;
drop function if exists public.issue_course_certificate() cascade;
drop function if exists public.is_bevskills_admin(uuid)   cascade;
drop type if exists public.lesson_type cascade;

-- ---------- 1. Dependência: função de updated_at (pode faltar em prod) ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- 2. Tabelas + enum ----------
create type public.lesson_type as enum ('video', 'text', 'pdf', 'attachment');

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  cover_image text,
  is_required boolean not null default false,
  estimated_hours integer not null default 0,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger learning_paths_updated_at before update on public.learning_paths
  for each row execute function public.set_updated_at();

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  learning_path_id uuid references public.learning_paths(id) on delete set null,
  title text not null,
  slug text not null unique,
  description text,
  cover_image text,
  level text default 'Iniciante',
  estimated_minutes integer not null default 0,
  is_published boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger modules_updated_at before update on public.modules
  for each row execute function public.set_updated_at();

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  description text,
  lesson_type public.lesson_type not null default 'video',
  video_url text,
  content text,
  duration_minutes integer not null default 0,
  order_index integer not null default 0,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger lessons_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();

create table public.lesson_attachments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text,
  created_at timestamptz not null default now()
);

create table public.user_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  progress_percentage integer not null default 0,
  last_position_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);
create trigger user_lesson_progress_updated_at before update on public.user_lesson_progress
  for each row execute function public.set_updated_at();

create table public.user_course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  progress_percentage integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, course_id)
);
create trigger user_course_progress_updated_at before update on public.user_course_progress
  for each row execute function public.set_updated_at();

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  certificate_code text not null unique,
  issued_at timestamptz not null default now(),
  file_url text,
  unique(user_id, course_id)
);

create table public.course_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.course_category_relations (
  course_id uuid not null references public.courses(id) on delete cascade,
  category_id uuid not null references public.course_categories(id) on delete cascade,
  primary key (course_id, category_id)
);

create index idx_courses_published on public.courses(is_published);
create index idx_courses_learning_path on public.courses(learning_path_id);
create index idx_modules_course on public.modules(course_id);
create index idx_lessons_module on public.lessons(module_id);
create index idx_user_lesson_prog_user on public.user_lesson_progress(user_id);
create index idx_user_course_prog_user on public.user_course_progress(user_id);
create index idx_certificates_user on public.certificates(user_id);

-- ---------- 3. Admin autossuficiente (não usa is_direx/is_leader_of) ----------
create or replace function public.is_bevskills_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.occupations o
    join public.cycles cy on cy.id = o.cycle_id and cy.is_current = true
    left join public.subareas sa on sa.id = o.subarea_id
    where o.person_id = uid
      and (
        o.role = 'diretor'
        or (o.role in ('gerente', 'coordenador') and sa.slug = 'pessoas_cultura')
      )
  );
$$;
grant execute on function public.is_bevskills_admin(uuid) to authenticated, service_role;

-- ---------- 4. RLS ----------
alter table public.learning_paths enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_attachments enable row level security;
alter table public.user_lesson_progress enable row level security;
alter table public.user_course_progress enable row level security;
alter table public.certificates enable row level security;
alter table public.course_categories enable row level security;
alter table public.course_category_relations enable row level security;

create policy learning_paths_select on public.learning_paths
  for select to authenticated using (true);
create policy courses_select on public.courses
  for select to authenticated
  using (is_published = true or public.is_bevskills_admin((select auth.uid())));
create policy modules_select on public.modules
  for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.is_published = true)
    or public.is_bevskills_admin((select auth.uid())));
create policy lessons_select on public.lessons
  for select to authenticated
  using (exists (select 1 from public.modules m join public.courses c on c.id = m.course_id
      where m.id = module_id and c.is_published = true)
    or public.is_bevskills_admin((select auth.uid())));
create policy lesson_attachments_select on public.lesson_attachments
  for select to authenticated
  using (exists (select 1 from public.lessons l join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id where l.id = lesson_id and c.is_published = true)
    or public.is_bevskills_admin((select auth.uid())));
create policy course_categories_select on public.course_categories
  for select to authenticated using (true);
create policy course_category_relations_select on public.course_category_relations
  for select to authenticated using (true);

create policy user_lesson_prog_select on public.user_lesson_progress
  for select to authenticated using (user_id = (select auth.uid()) or public.is_bevskills_admin((select auth.uid())));
create policy user_lesson_prog_insert on public.user_lesson_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_lesson_prog_update on public.user_lesson_progress
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_course_prog_select on public.user_course_progress
  for select to authenticated using (user_id = (select auth.uid()) or public.is_bevskills_admin((select auth.uid())));
create policy certificates_select on public.certificates
  for select to authenticated using (user_id = (select auth.uid()) or public.is_bevskills_admin((select auth.uid())));

create policy learning_paths_all on public.learning_paths
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));
create policy courses_all on public.courses
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));
create policy modules_all on public.modules
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));
create policy lessons_all on public.lessons
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));
create policy lesson_attachments_all on public.lesson_attachments
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));
create policy course_categories_all on public.course_categories
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));
create policy course_category_relations_all on public.course_category_relations
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));

-- ---------- 5. Triggers de progresso + certificado ----------
create or replace function public.update_course_progress()
returns trigger language plpgsql security definer as $$
declare
  v_course_id uuid; v_total_lessons integer; v_completed_lessons integer; v_progress_percentage integer;
begin
  select m.course_id into v_course_id
  from public.lessons l join public.modules m on m.id = l.module_id where l.id = new.lesson_id;
  select count(l.id) into v_total_lessons
  from public.lessons l join public.modules m on m.id = l.module_id where m.course_id = v_course_id;
  if v_total_lessons = 0 then return new; end if;
  select count(ulp.id) into v_completed_lessons
  from public.user_lesson_progress ulp
  join public.lessons l on l.id = ulp.lesson_id
  join public.modules m on m.id = l.module_id
  where m.course_id = v_course_id and ulp.user_id = new.user_id and ulp.completed = true;
  v_progress_percentage := (v_completed_lessons * 100) / v_total_lessons;
  insert into public.user_course_progress (user_id, course_id, progress_percentage, completed, completed_at)
  values (new.user_id, v_course_id, v_progress_percentage, v_progress_percentage = 100,
    case when v_progress_percentage = 100 then now() else null end)
  on conflict (user_id, course_id) do update set
    progress_percentage = excluded.progress_percentage,
    completed = excluded.completed,
    completed_at = case
      when excluded.completed and public.user_course_progress.completed_at is null then now()
      when not excluded.completed then null
      else public.user_course_progress.completed_at end,
    updated_at = now();
  return new;
end;
$$;
create trigger trigger_update_course_progress
  after insert or update of completed on public.user_lesson_progress
  for each row execute function public.update_course_progress();

create or replace function public.issue_course_certificate()
returns trigger language plpgsql security definer as $$
declare v_cert_exists boolean; v_code text;
begin
  if new.completed = true and (old is null or old.completed = false) then
    select exists (select 1 from public.certificates
      where user_id = new.user_id and course_id = new.course_id) into v_cert_exists;
    if not v_cert_exists then
      v_code := 'BEVSKILLS-' || to_char(now(), 'YYYY') || '-' || upper(substring(md5(random()::text) from 1 for 8));
      insert into public.certificates (user_id, course_id, certificate_code, issued_at)
      values (new.user_id, new.course_id, v_code, now());
    end if;
  end if;
  return new;
end;
$$;
create trigger trigger_issue_course_certificate
  after insert or update of completed on public.user_course_progress
  for each row execute function public.issue_course_certificate();

-- ---------- 6. Seeds ----------
do $$
declare
  v_path_onboarding uuid; v_path_portfolio uuid; v_cat_institucional uuid; v_cat_tecnico uuid;
  v_course_id uuid; v_module_id uuid;
begin
  insert into public.course_categories (name, slug) values ('Institucional', 'institucional') returning id into v_cat_institucional;
  insert into public.course_categories (name, slug) values ('Técnico', 'tecnico') returning id into v_cat_tecnico;

  insert into public.learning_paths (title, slug, description, is_required, estimated_hours, order_index)
    values ('Onboarding BEV', 'onboarding-bev', 'Trilha obrigatória para novos membros.', true, 20, 1) returning id into v_path_onboarding;
  insert into public.learning_paths (title, slug, description, is_required, estimated_hours, order_index)
    values ('Portfólio de Serviços', 'portfolio-servicos', 'Trilha de capacitação nos serviços da empresa.', false, 40, 2) returning id into v_path_portfolio;

  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
    values (v_path_onboarding, 'Bem-vindo ao BEV', 'bem-vindo-ao-bev', 'Introdução à nossa cultura e história.', 'Iniciante', 60, true, 1) returning id into v_course_id;
  insert into public.course_category_relations (course_id, category_id) values (v_course_id, v_cat_institucional);
  insert into public.modules (course_id, title, description, order_index)
    values (v_course_id, 'Módulo 1: Introdução', 'Os primeiros passos.', 1) returning id into v_module_id;
  insert into public.lessons (module_id, title, description, lesson_type, video_url, duration_minutes, order_index)
    values (v_module_id, 'Nossa História', 'Como tudo começou.', 'video', 'https://example.com/video1', 15, 1);

  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
    values (v_path_onboarding, 'Nossa Identidade', 'nossa-identidade', 'Missão, Visão e Valores.', 'Iniciante', 45, true, 2);
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
    values (v_path_onboarding, 'Movimento Empresa Júnior', 'movimento-empresa-junior', 'Entendendo o MEJ.', 'Iniciante', 60, true, 3);
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
    values (v_path_onboarding, 'Como o BEV funciona', 'como-o-bev-funciona', 'Nossos processos e rituais.', 'Iniciante', 90, true, 4);
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
    values (v_path_onboarding, 'Conheça as Diretorias', 'conheca-as-diretorias', 'Apresentação das áreas.', 'Iniciante', 60, true, 5);
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
    values (v_path_onboarding, 'Plano de Carreira', 'plano-de-carreira', 'Como crescer aqui dentro.', 'Iniciante', 45, true, 6);
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
    values (v_path_onboarding, 'Ferramentas', 'ferramentas', 'Softwares e sistemas que utilizamos.', 'Iniciante', 120, true, 7);
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
    values (v_path_onboarding, 'Código de Ética', 'codigo-de-etica', 'Nossas regras e condutas.', 'Iniciante', 30, true, 8);

  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
    values (v_path_portfolio, 'Registro de Marca', 'registro-de-marca', 'Como funciona o serviço no INPI.', 'Intermediário', 180, true, 1) returning id into v_course_id;
  insert into public.course_category_relations (course_id, category_id) values (v_course_id, v_cat_tecnico);
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
    values (v_path_portfolio, 'Adequação à LGPD', 'adequacao-a-lgpd', 'Processo de adequação de empresas.', 'Intermediário', 240, true, 2) returning id into v_course_id;
  insert into public.course_category_relations (course_id, category_id) values (v_course_id, v_cat_tecnico);
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
    values (v_path_portfolio, 'Selo EJ', 'selo-ej', 'Auditoria e validação.', 'Intermediário', 120, true, 3);
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
    values (v_path_portfolio, 'Noções Básicas de Contratos', 'nocoes-basicas-de-contratos', 'Teoria geral dos contratos.', 'Iniciante', 180, true, 4);
end $$;

-- ---------- 7. Verificação ----------
select
  (select count(*) from public.learning_paths)    as trilhas,     -- 2
  (select count(*) from public.courses)           as cursos,      -- 12
  (select count(*) from public.modules)           as modulos,     -- 2
  (select count(*) from public.lessons)           as aulas,       -- 1
  (select count(*) from public.course_categories) as categorias;  -- 2
