-- ============================================================
-- BevSkills — 2/3: catálogo inicial mapeado no PRD §3.1.
-- Tudo entra como "em breve": a vitrine já nasce cheia, sem parecer
-- uma plataforma vazia no dia do lançamento.
-- ============================================================

insert into public.bev_courses (directorate_id, titulo, descricao, status, ordem)
select d.id, v.titulo, v.descricao, 'em_breve', v.ordem
from public.directorates d
join (values
  ('SPIN Selling', 'O método de perguntas que transforma conversa em diagnóstico e diagnóstico em proposta.', 1),
  ('CRM e Gestão de Funil', 'Como registrar, mover e não perder oportunidade nenhuma no meio do caminho.', 2),
  ('Customer Success', 'O que fazer depois do contrato assinado para o cliente voltar e indicar.', 3),
  ('Copywriting', 'Escrever para vender sem soar como anúncio: estrutura, gatilhos e revisão.', 4),
  ('Design e Criação no Canva', 'Do template ao material com cara de BEV: hierarquia, cor e consistência.', 5)
) as v(titulo, descricao, ordem) on true
where d.slug = 'negocios'
  and not exists (
    select 1 from public.bev_courses c
    where c.directorate_id = d.id and c.titulo = v.titulo
  );

insert into public.bev_courses (directorate_id, titulo, descricao, status, ordem)
select d.id,
  'Trilha do Conhecimento',
  'Os quatro serviços do portfólio do BEV, do zero ao entregável — a base técnica de quem assessora projeto.',
  'em_breve', 1
from public.directorates d
where d.slug = 'projetos'
  and not exists (
    select 1 from public.bev_courses c
    where c.directorate_id = d.id and c.titulo = 'Trilha do Conhecimento'
  );

insert into public.bev_modules (course_id, titulo, ordem, bloqueado)
select c.id, v.titulo, v.ordem, true
from public.bev_courses c
join public.directorates d on d.id = c.directorate_id and d.slug = 'projetos'
join (values
  ('Registro de Marca', 1),
  ('Adequação à LGPD', 2),
  ('Atas de Eleição e Posse — Selo EJ', 3),
  ('Noções Básicas de Contratos', 4)
) as v(titulo, ordem) on true
where c.titulo = 'Trilha do Conhecimento'
  and not exists (
    select 1 from public.bev_modules m where m.course_id = c.id and m.titulo = v.titulo
  );
