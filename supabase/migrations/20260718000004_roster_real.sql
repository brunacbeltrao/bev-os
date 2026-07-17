-- ============================================================
-- Seed Migration: Roster 2026.2
-- ============================================================

-- Clean old placeholder roster data (keeps claimed if any)
DELETE FROM public.approved_roster WHERE claimed = false;


INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'guilherme@bevilaqua.org.br', 
  'Guilherme Galvão de Barros Lima', 
  'diretor',
  (SELECT id FROM public.directorates WHERE slug = 'gestao'),
  (SELECT id FROM public.subareas WHERE slug = 'gestao'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'teodoro@bevilaqua.org.br', 
  'Teodoro Pessoa de Luna Gonçalves Torres', 
  'diretor',
  (SELECT id FROM public.directorates WHERE slug = 'institucional'),
  (SELECT id FROM public.subareas WHERE slug = 'institucional'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'brunabeltrao@bevilaqua.org.br', 
  'Bruna Cristina Beltrão Girão de Menezes', 
  'diretor',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'comercial'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'eduardaferraz@bevilaqua.org.br', 
  'Maria Eduarda Ferraz Miranda Cordeiro', 
  'diretor',
  (SELECT id FROM public.directorates WHERE slug = 'pessoas_cultura'),
  (SELECT id FROM public.subareas WHERE slug = 'pessoas_cultura'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'rayssabarbara@bevilaqua.org.br', 
  'Rayssa Barbara Azevedo Melo', 
  'diretor',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'lucasalmeida@bevilaqua.org.br', 
  'Lucas Albuquerque de Almeida', 
  'gerente',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'comercial'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'mariatereza@bevilaqua.org.br', 
  'Maria Tereza de Souza Araújo', 
  'gerente',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'comercial'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'guilhermebarros@bevilaqua.org.br', 
  'Guilherme Barros Lins', 
  'gerente',
  (SELECT id FROM public.directorates WHERE slug = 'institucional'),
  (SELECT id FROM public.subareas WHERE slug = 'institucional'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'camilamoraes@bevilaqua.org.br', 
  'Camila Moraes Cardoso', 
  'gerente',
  (SELECT id FROM public.directorates WHERE slug = 'pessoas_cultura'),
  (SELECT id FROM public.subareas WHERE slug = 'pessoas_cultura'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'lorena@bevilaqua.org.br', 
  'Lorena Oliveira Cardozo De Lima', 
  'gerente',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'sofiaerdt@bevilaqua.org.br', 
  'Sofia Erdtmann Maia', 
  'gerente',
  (SELECT id FROM public.directorates WHERE slug = 'gestao'),
  (SELECT id FROM public.subareas WHERE slug = 'gestao'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'rafaelvieira@bevilaqua.org.br', 
  'Rafael Lima Vieira', 
  'gerente',
  (SELECT id FROM public.directorates WHERE slug = 'gestao'),
  (SELECT id FROM public.subareas WHERE slug = 'gestao'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'luizagold@bevilaqua.org.br', 
  'Maria Luiza Goldstein Barroso', 
  'gerente',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'marketing'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'mariaemilia@bevilaqua.org.br', 
  'Maria Emília de Oliveira Freitas', 
  'gerente',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'sophya@bevilaqua.org.br', 
  'Sophya Araújo', 
  'gerente',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'aline@bevilaqua.org.br', 
  'Aline de Carvalho Alves', 
  'coordenador',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'marketing'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'fagner@bevilaqua.org.br', 
  'Fagner Tavares Moreira de Athayde', 
  'analista',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'juliabarretto@bevilaqua.org.br', 
  'Júlia Matoso Maciel Barretto', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'comercial'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'lucca@bevilaqua.org.br', 
  'Lucca Gabriel Barros Meireles', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'comercial'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'manuela@bevilaqua.org.br', 
  'Manuela Vasconcelos Franco Rafael Nogueira', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'comercial'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'fernandacarvalheira@bevilaqua.org.br', 
  'Maria Fernanda Dantas Carvalheira', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'comercial'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'nicolasgattas@bevilaqua.org.br', 
  'Nicolas Moraes Barros Gattás', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'comercial'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'sofiahora@bevilaqua.org.br', 
  'Sofia Hora de Albuquerque Maranhão', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'comercial'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'barbara@bevilaqua.org.br', 
  'Bárbara Morato Dubeux', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'gestao'),
  (SELECT id FROM public.subareas WHERE slug = 'gestao'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'cesar@bevilaqua.org.br', 
  'César Lins Pereira Affonso de Amorim', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'gestao'),
  (SELECT id FROM public.subareas WHERE slug = 'gestao'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'leticiaalmeida@bevilaqua.org.br', 
  'Leticia Rocha Valença de Almeida', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'gestao'),
  (SELECT id FROM public.subareas WHERE slug = 'gestao'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'antoniocorreia@bevilaqua.org.br', 
  'Antônio de Souza Leão Correia', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'institucional'),
  (SELECT id FROM public.subareas WHERE slug = 'institucional'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'miguel@bevilaqua.org.br', 
  'Miguel Robalinho Campelo', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'institucional'),
  (SELECT id FROM public.subareas WHERE slug = 'institucional'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'arthursoares@bevilaqua.org.br', 
  'Arthur Soares Portela', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'marketing'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'gabrielamelo@bevilaqua.org.br', 
  'Gabriela de Oliveira Melo', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'marketing'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'paulohenrique@bevilaqua.org.br', 
  'Paulo Henrique Andrade da Silva', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'marketing'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'taina@bevilaqua.org.br', 
  'Tainá Soares Feliciano Martins', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'negocios'),
  (SELECT id FROM public.subareas WHERE slug = 'marketing'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'gloria@bevilaqua.org.br', 
  'Glória Esteffeny da Silva Martins', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'pessoas_cultura'),
  (SELECT id FROM public.subareas WHERE slug = 'pessoas_cultura'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'leticiafriedheim@bevilaqua.org.br', 
  'Leticia Friedheim', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'pessoas_cultura'),
  (SELECT id FROM public.subareas WHERE slug = 'pessoas_cultura'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'fernandafalcao@bevilaqua.org.br', 
  'Maria Fernanda Moura Falcão', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'pessoas_cultura'),
  (SELECT id FROM public.subareas WHERE slug = 'pessoas_cultura'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'anacaetano@bevilaqua.org.br', 
  'Ana Vitória Caetano Lopes', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'beatrizleite@bevilaqua.org.br', 
  'Beatriz Alves de Lima Leite', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'isadora@bevilaqua.org.br', 
  'Isa Dora Duarte Araújo Cardoso', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'guilhermedias@bevilaqua.org.br', 
  'José Guilherme Fragoso Dias Fernandes', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'luanaramos@bevilaqua.org.br', 
  'Luana Dymunique Oliveira Ramos', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'eduardaferro@bevilaqua.org.br', 
  'Maria Eduarda Ferro Barros de Almeida', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'fernanda@bevilaqua.org.br', 
  'Maria Fernanda Brasileiro Cordeiro', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'julialima@bevilaqua.org.br', 
  'Maria Júlia de Lima e Silva', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;

INSERT INTO public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
VALUES (
  'raquel@bevilaqua.org.br', 
  'Raquel de Souza Santos', 
  'assessor',
  (SELECT id FROM public.directorates WHERE slug = 'projetos'),
  (SELECT id FROM public.subareas WHERE slug = 'projetos'),
  (SELECT id FROM public.cycles WHERE is_current = true)
) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, subarea_id = EXCLUDED.subarea_id, directorate_id = EXCLUDED.directorate_id, nome = EXCLUDED.nome;
