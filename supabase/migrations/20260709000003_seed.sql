-- ============================================================
-- BEV OS — Onda 0 — Migration 3: Seed
-- Estrutura organizacional (PRD §2) + ciclo vigente + roster
-- ============================================================

-- ---------- As 5 diretorias executivas horizontais ----------
insert into public.directorates (slug, nome) values
  ('negocios', 'Negócios'),
  ('projetos', 'Projetos'),
  ('gestao', 'Gestão'),
  ('pessoas_cultura', 'Pessoas e Cultura'),
  ('institucional', 'Institucional');

-- ---------- Subáreas: só Negócios tem 2 ----------
insert into public.subareas (directorate_id, slug, nome) values
  ((select id from public.directorates where slug = 'negocios'), 'comercial', 'Comercial'),
  ((select id from public.directorates where slug = 'negocios'), 'marketing', 'Marketing'),
  ((select id from public.directorates where slug = 'projetos'), 'projetos', 'Projetos'),
  ((select id from public.directorates where slug = 'gestao'), 'gestao', 'Gestão'),
  ((select id from public.directorates where slug = 'pessoas_cultura'), 'pessoas_cultura', 'Pessoas e Cultura'),
  ((select id from public.directorates where slug = 'institucional'), 'institucional', 'Institucional');

-- ---------- Núcleos fixos de execução de Projetos ----------
insert into public.project_nucleos (directorate_id, slug, nome) values
  ((select id from public.directorates where slug = 'projetos'), 'capiba', 'Capiba'),
  ((select id from public.directorates where slug = 'projetos'), 'suassuna', 'Suassuna');

-- ---------- Ciclo vigente ----------
insert into public.cycles (nome, data_inicio, data_fim, is_current) values
  ('2026.2', '2026-07-01', '2026-12-31', true);

-- ============================================================
-- ROSTER DE EXEMPLO — SUBSTITUIR PELA LISTA REAL DA P&C
-- A linha da Bruna usa o e-mail real para permitir o primeiro
-- teste de cadastro. As demais são placeholders (@exemplo.com)
-- para testar cada papel — remova antes de abrir o cadastro.
-- ============================================================
insert into public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id) values
  (
    'brunacbeltrao@gmail.com', 'Bruna Beltrão', 'diretor',
    (select id from public.directorates where slug = 'pessoas_cultura'),
    (select id from public.subareas where slug = 'pessoas_cultura'),
    (select id from public.cycles where is_current = true)
  ),
  (
    'gerente.comercial@exemplo.com', 'Gerente Comercial (exemplo)', 'gerente',
    (select id from public.directorates where slug = 'negocios'),
    (select id from public.subareas where slug = 'comercial'),
    (select id from public.cycles where is_current = true)
  ),
  (
    'coordenador.marketing@exemplo.com', 'Coordenador Marketing (exemplo)', 'coordenador',
    (select id from public.directorates where slug = 'negocios'),
    (select id from public.subareas where slug = 'marketing'),
    (select id from public.cycles where is_current = true)
  ),
  (
    'analista.gestao@exemplo.com', 'Analista Gestão (exemplo)', 'analista',
    (select id from public.directorates where slug = 'gestao'),
    (select id from public.subareas where slug = 'gestao'),
    (select id from public.cycles where is_current = true)
  ),
  (
    'assessor.projetos@exemplo.com', 'Assessor Projetos (exemplo)', 'assessor',
    (select id from public.directorates where slug = 'projetos'),
    (select id from public.subareas where slug = 'projetos'),
    (select id from public.cycles where is_current = true)
  );
