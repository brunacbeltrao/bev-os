-- ============================================================
-- BEV OS — BevSkills — Migration 1: Tabelas e Schema Core
-- ============================================================

-- ---------- Enum de tipo de aula ----------
create type public.lesson_type as enum (
  'video',
  'text',
  'pdf',
  'attachment'
);

-- ---------- learning_paths: Trilhas de aprendizagem ----------
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

create trigger learning_paths_updated_at
  before update on public.learning_paths
  for each row execute function public.set_updated_at();

-- ---------- courses: Cursos dentro ou fora de trilhas ----------
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

create trigger courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- ---------- modules: Módulos de um curso ----------
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger modules_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();

-- ---------- lessons: Aulas de um módulo ----------
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

create trigger lessons_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

-- ---------- lesson_attachments: Arquivos de uma aula ----------
create table public.lesson_attachments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text,
  created_at timestamptz not null default now()
);

-- ---------- user_lesson_progress: Progresso por aula ----------
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

create trigger user_lesson_progress_updated_at
  before update on public.user_lesson_progress
  for each row execute function public.set_updated_at();

-- ---------- user_course_progress: Progresso consolidado do curso ----------
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

create trigger user_course_progress_updated_at
  before update on public.user_course_progress
  for each row execute function public.set_updated_at();

-- ---------- certificates: Certificados emitidos ----------
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  certificate_code text not null unique,
  issued_at timestamptz not null default now(),
  file_url text,
  unique(user_id, course_id)
);

-- ---------- course_categories e relations: Tags/Categorias ----------
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

-- ---------- Índices para otimização ----------
create index idx_courses_published on public.courses(is_published);
create index idx_courses_learning_path on public.courses(learning_path_id);
create index idx_modules_course on public.modules(course_id);
create index idx_lessons_module on public.lessons(module_id);
create index idx_user_lesson_prog_user on public.user_lesson_progress(user_id);
create index idx_user_course_prog_user on public.user_course_progress(user_id);
create index idx_certificates_user on public.certificates(user_id);
