-- ============================================================
-- BevSkills — plataforma de aprendizagem (PRD §6) — 1/3
-- As "categorias" do PRD são as diretorias que já existem em
-- public.directorates; nada é duplicado.
-- Vídeo nunca é hospedado aqui (RF-08): só a URL da fonte.
-- ============================================================

-- Quem administra o catálogo de uma diretoria: a liderança dela
-- (diretor/gerente/coordenador). P&C é admin geral (RF-05).
create or replace function public.pode_gerir_bevskills(uid uuid, dir_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_pc(uid)
    or exists (
      select 1 from public.occupations o
      where o.person_id = uid
        and o.cycle_id = public.current_cycle_id()
        and o.directorate_id = dir_id
        and o.role in ('diretor', 'gerente', 'coordenador')
    );
$$;

create table if not exists public.bev_courses (
  id             uuid primary key default gen_random_uuid(),
  directorate_id uuid not null references public.directorates (id) on delete cascade,
  titulo         text not null,
  descricao      text,
  instrutor      text,
  status         text not null default 'rascunho'
                 check (status in ('rascunho', 'publicado', 'em_breve')),
  capa_url       text,
  ordem          int not null default 0,
  criado_por     uuid references public.people (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists bev_courses_dir_idx on public.bev_courses (directorate_id, ordem);

create table if not exists public.bev_modules (
  id        uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.bev_courses (id) on delete cascade,
  titulo    text not null,
  ordem     int not null default 0,
  bloqueado boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists bev_modules_course_idx on public.bev_modules (course_id, ordem);

create table if not exists public.bev_lessons (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.bev_modules (id) on delete cascade,
  titulo      text not null,
  descricao   text,
  video_url   text,
  video_fonte text check (video_fonte in ('youtube', 'drive', 'vimeo', 'loom')),
  duracao_min int,
  ordem       int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists bev_lessons_module_idx on public.bev_lessons (module_id, ordem);

create table if not exists public.bev_resources (
  id        uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.bev_lessons (id) on delete cascade,
  titulo    text not null,
  tipo      text not null default 'link'
            check (tipo in ('arquivo', 'canva', 'miro', 'notion', 'drive', 'link')),
  url       text not null,
  ordem     int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bev_resources_lesson_idx on public.bev_resources (lesson_id, ordem);

create table if not exists public.bev_progress (
  person_id    uuid not null references public.people (id) on delete cascade,
  lesson_id    uuid not null references public.bev_lessons (id) on delete cascade,
  concluida_em timestamptz,
  visto_em     timestamptz not null default now(),
  primary key (person_id, lesson_id)
);
create index if not exists bev_progress_person_idx on public.bev_progress (person_id, visto_em desc);

drop trigger if exists bev_courses_updated_at on public.bev_courses;
create trigger bev_courses_updated_at before update on public.bev_courses
  for each row execute function public.set_updated_at();

-- Um curso é visível se estiver publicado / em breve, ou se quem olha
-- administra aquela diretoria (aí enxerga os rascunhos também).
create or replace function public.bev_curso_visivel(uid uuid, c_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bev_courses c
    where c.id = c_id
      and (c.status <> 'rascunho' or public.pode_gerir_bevskills(uid, c.directorate_id))
  );
$$;

create or replace function public.bev_pode_gerir_curso(uid uuid, c_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bev_courses c
    where c.id = c_id and public.pode_gerir_bevskills(uid, c.directorate_id)
  );
$$;

alter table public.bev_courses   enable row level security;
alter table public.bev_modules   enable row level security;
alter table public.bev_lessons   enable row level security;
alter table public.bev_resources enable row level security;
alter table public.bev_progress  enable row level security;

revoke all on public.bev_courses, public.bev_modules, public.bev_lessons,
              public.bev_resources, public.bev_progress from anon;
grant select, insert, update, delete on public.bev_courses, public.bev_modules,
  public.bev_lessons, public.bev_resources, public.bev_progress to authenticated;
grant all on public.bev_courses, public.bev_modules, public.bev_lessons,
  public.bev_resources, public.bev_progress to service_role;

-- ---------- Cursos ----------
drop policy if exists bev_courses_select on public.bev_courses;
create policy bev_courses_select on public.bev_courses
  for select to authenticated
  using (status <> 'rascunho' or public.pode_gerir_bevskills((select auth.uid()), directorate_id));

drop policy if exists bev_courses_insert on public.bev_courses;
create policy bev_courses_insert on public.bev_courses
  for insert to authenticated
  with check (public.pode_gerir_bevskills((select auth.uid()), directorate_id));

drop policy if exists bev_courses_update on public.bev_courses;
create policy bev_courses_update on public.bev_courses
  for update to authenticated
  using (public.pode_gerir_bevskills((select auth.uid()), directorate_id))
  with check (public.pode_gerir_bevskills((select auth.uid()), directorate_id));

drop policy if exists bev_courses_delete on public.bev_courses;
create policy bev_courses_delete on public.bev_courses
  for delete to authenticated
  using (public.pode_gerir_bevskills((select auth.uid()), directorate_id));

-- ---------- Módulos ----------
drop policy if exists bev_modules_select on public.bev_modules;
create policy bev_modules_select on public.bev_modules
  for select to authenticated using (public.bev_curso_visivel((select auth.uid()), course_id));

drop policy if exists bev_modules_write on public.bev_modules;
create policy bev_modules_write on public.bev_modules
  for all to authenticated
  using (public.bev_pode_gerir_curso((select auth.uid()), course_id))
  with check (public.bev_pode_gerir_curso((select auth.uid()), course_id));

-- ---------- Aulas ----------
drop policy if exists bev_lessons_select on public.bev_lessons;
create policy bev_lessons_select on public.bev_lessons
  for select to authenticated
  using (exists (
    select 1 from public.bev_modules m
    where m.id = module_id and public.bev_curso_visivel((select auth.uid()), m.course_id)
  ));

drop policy if exists bev_lessons_write on public.bev_lessons;
create policy bev_lessons_write on public.bev_lessons
  for all to authenticated
  using (exists (
    select 1 from public.bev_modules m
    where m.id = module_id and public.bev_pode_gerir_curso((select auth.uid()), m.course_id)
  ))
  with check (exists (
    select 1 from public.bev_modules m
    where m.id = module_id and public.bev_pode_gerir_curso((select auth.uid()), m.course_id)
  ));

-- ---------- Recursos ----------
drop policy if exists bev_resources_select on public.bev_resources;
create policy bev_resources_select on public.bev_resources
  for select to authenticated
  using (exists (
    select 1 from public.bev_lessons l
    join public.bev_modules m on m.id = l.module_id
    where l.id = lesson_id and public.bev_curso_visivel((select auth.uid()), m.course_id)
  ));

drop policy if exists bev_resources_write on public.bev_resources;
create policy bev_resources_write on public.bev_resources
  for all to authenticated
  using (exists (
    select 1 from public.bev_lessons l
    join public.bev_modules m on m.id = l.module_id
    where l.id = lesson_id and public.bev_pode_gerir_curso((select auth.uid()), m.course_id)
  ))
  with check (exists (
    select 1 from public.bev_lessons l
    join public.bev_modules m on m.id = l.module_id
    where l.id = lesson_id and public.bev_pode_gerir_curso((select auth.uid()), m.course_id)
  ));

-- ---------- Progresso (só o próprio) ----------
drop policy if exists bev_progress_own on public.bev_progress;
create policy bev_progress_own on public.bev_progress
  for all to authenticated
  using (person_id = (select auth.uid()))
  with check (person_id = (select auth.uid()));

-- ---------- Storage: capas e materiais ----------
insert into storage.buckets (id, name, public)
values ('bevskills', 'bevskills', true)
on conflict (id) do update set public = true;

drop policy if exists bevskills_public_read on storage.objects;
drop policy if exists bevskills_write_lideranca on storage.objects;
drop policy if exists bevskills_update_lideranca on storage.objects;
drop policy if exists bevskills_delete_lideranca on storage.objects;

create policy bevskills_public_read on storage.objects for select
  using (bucket_id = 'bevskills');
create policy bevskills_write_lideranca on storage.objects for insert to authenticated
  with check (bucket_id = 'bevskills'
    and (public.is_lideranca((select auth.uid())) or public.is_pc((select auth.uid()))));
create policy bevskills_update_lideranca on storage.objects for update to authenticated
  using (bucket_id = 'bevskills'
    and (public.is_lideranca((select auth.uid())) or public.is_pc((select auth.uid()))));
create policy bevskills_delete_lideranca on storage.objects for delete to authenticated
  using (bucket_id = 'bevskills'
    and (public.is_lideranca((select auth.uid())) or public.is_pc((select auth.uid()))));

grant execute on function public.pode_gerir_bevskills(uuid, uuid) to authenticated, service_role;
grant execute on function public.bev_curso_visivel(uuid, uuid) to authenticated, service_role;
grant execute on function public.bev_pode_gerir_curso(uuid, uuid) to authenticated, service_role;
