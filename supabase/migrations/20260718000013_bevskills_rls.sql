-- ============================================================
-- BEV OS — BevSkills — Migration 2: Segurança e RLS
-- ============================================================

-- ---------- Helper de Admin do BevSkills ----------
-- Usaremos Pessoas e Cultura (ou Direx) como admins
create or replace function public.is_bevskills_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_direx(uid) or public.is_leader_of(uid, (select id from public.subareas where slug = 'pessoas_cultura'));
$$;

grant execute on function public.is_bevskills_admin(uuid) to authenticated, service_role;

-- Habilitar RLS em todas as tabelas
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

-- ---------- Políticas Públicas para Autenticados (Membros) ----------

-- learning_paths: Todos veem
create policy learning_paths_select on public.learning_paths
  for select to authenticated using (true);

-- courses: Membros veem apenas cursos publicados, admins veem todos
create policy courses_select on public.courses
  for select to authenticated
  using (is_published = true or public.is_bevskills_admin((select auth.uid())));

-- modules: Membros veem apenas se o curso estiver publicado
create policy modules_select on public.modules
  for select to authenticated
  using (
    exists (select 1 from public.courses c where c.id = course_id and c.is_published = true)
    or public.is_bevskills_admin((select auth.uid()))
  );

-- lessons: Idem (através do módulo -> curso)
create policy lessons_select on public.lessons
  for select to authenticated
  using (
    exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = module_id and c.is_published = true
    )
    or public.is_bevskills_admin((select auth.uid()))
  );

-- lesson_attachments: Idem
create policy lesson_attachments_select on public.lesson_attachments
  for select to authenticated
  using (
    exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = lesson_id and c.is_published = true
    )
    or public.is_bevskills_admin((select auth.uid()))
  );

-- categorias: Todos veem
create policy course_categories_select on public.course_categories
  for select to authenticated using (true);

create policy course_category_relations_select on public.course_category_relations
  for select to authenticated using (true);

-- ---------- Políticas de Progresso do Usuário ----------
-- user_lesson_progress: Usuário só lê, insere e atualiza o seu
create policy user_lesson_prog_select on public.user_lesson_progress
  for select to authenticated using (user_id = (select auth.uid()) or public.is_bevskills_admin((select auth.uid())));

create policy user_lesson_prog_insert on public.user_lesson_progress
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy user_lesson_prog_update on public.user_lesson_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- user_course_progress: Usuário só lê, as regras de update serão via trigger
create policy user_course_prog_select on public.user_course_progress
  for select to authenticated using (user_id = (select auth.uid()) or public.is_bevskills_admin((select auth.uid())));

-- certificates: Usuário só lê os seus certificados
create policy certificates_select on public.certificates
  for select to authenticated using (user_id = (select auth.uid()) or public.is_bevskills_admin((select auth.uid())));


-- ---------- Políticas para Admins ----------
-- learning_paths
create policy learning_paths_all on public.learning_paths
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));

-- courses
create policy courses_all on public.courses
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));

-- modules
create policy modules_all on public.modules
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));

-- lessons
create policy lessons_all on public.lessons
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));

-- lesson_attachments
create policy lesson_attachments_all on public.lesson_attachments
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));

-- categorias
create policy course_categories_all on public.course_categories
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));

create policy course_category_relations_all on public.course_category_relations
  for all to authenticated using (public.is_bevskills_admin((select auth.uid())));
