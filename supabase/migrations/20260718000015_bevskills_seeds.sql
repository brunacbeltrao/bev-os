-- ============================================================
-- BEV OS — BevSkills — Migration 4: Seeds Iniciais
-- ============================================================

-- A inserção de dados usará gen_random_uuid() no ID, e usaremos
-- CTEs (Common Table Expressions) ou DO blocks para referenciar os IDs gerados.

do $$
declare
  v_path_onboarding uuid;
  v_path_portfolio uuid;
  v_cat_institucional uuid;
  v_cat_tecnico uuid;
  v_course_id uuid;
  v_module_id uuid;
begin

  -- ---------- Categorias ----------
  insert into public.course_categories (name, slug) values ('Institucional', 'institucional') returning id into v_cat_institucional;
  insert into public.course_categories (name, slug) values ('Técnico', 'tecnico') returning id into v_cat_tecnico;

  -- ---------- Trilhas ----------
  insert into public.learning_paths (title, slug, description, is_required, estimated_hours, order_index)
  values ('Onboarding BEV', 'onboarding-bev', 'Trilha obrigatória para novos membros.', true, 20, 1)
  returning id into v_path_onboarding;

  insert into public.learning_paths (title, slug, description, is_required, estimated_hours, order_index)
  values ('Portfólio de Serviços', 'portfolio-servicos', 'Trilha de capacitação nos serviços da empresa.', false, 40, 2)
  returning id into v_path_portfolio;

  -- ---------- Cursos: Onboarding BEV ----------
  
  -- Curso 1: Bem-vindo ao BEV
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
  values (v_path_onboarding, 'Bem-vindo ao BEV', 'bem-vindo-ao-bev', 'Introdução à nossa cultura e história.', 'Iniciante', 60, true, 1)
  returning id into v_course_id;
  
  insert into public.course_category_relations (course_id, category_id) values (v_course_id, v_cat_institucional);
  
  insert into public.modules (course_id, title, description, order_index)
  values (v_course_id, 'Módulo 1: Introdução', 'Os primeiros passos.', 1)
  returning id into v_module_id;

  insert into public.lessons (module_id, title, description, lesson_type, video_url, duration_minutes, order_index)
  values (v_module_id, 'Nossa História', 'Como tudo começou.', 'video', 'https://example.com/video1', 15, 1);

  -- Curso 2: Nossa Identidade
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
  values (v_path_onboarding, 'Nossa Identidade', 'nossa-identidade', 'Missão, Visão e Valores.', 'Iniciante', 45, true, 2);

  -- Curso 3: Movimento Empresa Júnior
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
  values (v_path_onboarding, 'Movimento Empresa Júnior', 'movimento-empresa-junior', 'Entendendo o MEJ.', 'Iniciante', 60, true, 3);

  -- Curso 4: Como o BEV funciona
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
  values (v_path_onboarding, 'Como o BEV funciona', 'como-o-bev-funciona', 'Nossos processos e rituais.', 'Iniciante', 90, true, 4);

  -- Curso 5: Conheça as Diretorias
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
  values (v_path_onboarding, 'Conheça as Diretorias', 'conheca-as-diretorias', 'Apresentação das áreas.', 'Iniciante', 60, true, 5);

  -- Curso 6: Plano de Carreira
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
  values (v_path_onboarding, 'Plano de Carreira', 'plano-de-carreira', 'Como crescer aqui dentro.', 'Iniciante', 45, true, 6);

  -- Curso 7: Ferramentas
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
  values (v_path_onboarding, 'Ferramentas', 'ferramentas', 'Softwares e sistemas que utilizamos.', 'Iniciante', 120, true, 7);

  -- Curso 8: Código de Ética
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
  values (v_path_onboarding, 'Código de Ética', 'codigo-de-etica', 'Nossas regras e condutas.', 'Iniciante', 30, true, 8);


  -- ---------- Cursos: Portfólio de Serviços ----------

  -- Registro de Marca
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
  values (v_path_portfolio, 'Registro de Marca', 'registro-de-marca', 'Como funciona o serviço no INPI.', 'Intermediário', 180, true, 1)
  returning id into v_course_id;
  
  insert into public.course_category_relations (course_id, category_id) values (v_course_id, v_cat_tecnico);
  
  -- Adequação à LGPD
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
  values (v_path_portfolio, 'Adequação à LGPD', 'adequacao-a-lgpd', 'Processo de adequação de empresas.', 'Intermediário', 240, true, 2)
  returning id into v_course_id;
  
  insert into public.course_category_relations (course_id, category_id) values (v_course_id, v_cat_tecnico);

  -- Selo EJ
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
  values (v_path_portfolio, 'Selo EJ', 'selo-ej', 'Auditoria e validação.', 'Intermediário', 120, true, 3);

  -- Noções Básicas de Contratos
  insert into public.courses (learning_path_id, title, slug, description, level, estimated_minutes, is_published, order_index)
  values (v_path_portfolio, 'Noções Básicas de Contratos', 'nocoes-basicas-de-contratos', 'Teoria geral dos contratos.', 'Iniciante', 180, true, 4);

end $$;
