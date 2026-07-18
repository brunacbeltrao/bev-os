-- ============================================================
-- BEV OS — BevSkills — Migration 3: Funções e Triggers
-- ============================================================

-- ---------- 1. Função para atualizar progresso do curso ----------
create or replace function public.update_course_progress()
returns trigger
language plpgsql
security definer
as $$
declare
  v_course_id uuid;
  v_total_lessons integer;
  v_completed_lessons integer;
  v_progress_percentage integer;
begin
  -- Encontrar a qual curso essa aula pertence
  select m.course_id into v_course_id
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where l.id = new.lesson_id;

  -- Contar total de aulas do curso
  select count(l.id) into v_total_lessons
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where m.course_id = v_course_id;

  -- Se o curso não tem aulas (caso raro, mas possível), retorna
  if v_total_lessons = 0 then
    return new;
  end if;

  -- Contar aulas concluídas pelo usuário neste curso
  select count(ulp.id) into v_completed_lessons
  from public.user_lesson_progress ulp
  join public.lessons l on l.id = ulp.lesson_id
  join public.modules m on m.id = l.module_id
  where m.course_id = v_course_id
    and ulp.user_id = new.user_id
    and ulp.completed = true;

  -- Calcular porcentagem
  v_progress_percentage := (v_completed_lessons * 100) / v_total_lessons;

  -- Inserir ou atualizar na user_course_progress
  insert into public.user_course_progress (
    user_id, course_id, progress_percentage, completed, completed_at
  ) values (
    new.user_id,
    v_course_id,
    v_progress_percentage,
    v_progress_percentage = 100,
    case when v_progress_percentage = 100 then now() else null end
  )
  on conflict (user_id, course_id) do update set
    progress_percentage = excluded.progress_percentage,
    completed = excluded.completed,
    completed_at = case
      when excluded.completed and public.user_course_progress.completed_at is null then now()
      when not excluded.completed then null
      else public.user_course_progress.completed_at
    end,
    updated_at = now();

  return new;
end;
$$;

create trigger trigger_update_course_progress
  after insert or update of completed on public.user_lesson_progress
  for each row
  execute function public.update_course_progress();


-- ---------- 2. Função para emitir certificado ----------
-- Disparada quando o course_progress chega a 100%
create or replace function public.issue_course_certificate()
returns trigger
language plpgsql
security definer
as $$
declare
  v_cert_exists boolean;
  v_code text;
begin
  -- Só faz algo se o progresso acabou de mudar para completo
  if new.completed = true and (old is null or old.completed = false) then
    
    -- Verifica se já existe certificado para evitar duplicidade
    select exists (
      select 1 from public.certificates
      where user_id = new.user_id and course_id = new.course_id
    ) into v_cert_exists;

    if not v_cert_exists then
      -- Gera um código único: BEVSKILLS-[ano]-[hash curto]
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
  for each row
  execute function public.issue_course_certificate();
