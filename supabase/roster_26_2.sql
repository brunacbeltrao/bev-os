-- ============================================================
-- Carga do roster real 26.2 — APLICADO em produção em 09/07/2026
-- Fonte: "E-MAILS 26.2.md" (Bruna). 38 membros.
-- Decisões registradas:
--  · Gerente de Institucional = guilhermebarros@ (pessoa distinta
--    do Diretor de Gestão guilherme@) — confirmado pela Bruna.
--  · Diretora de Negócios (Bruna) vinculada nominalmente à
--    subárea Comercial; o contexto "Minha Diretoria" cobre
--    Comercial + Marketing.
--  · Marketing sem gerente eleito (entra depois via novo INSERT).
--  · Nomes de diretores/gerentes derivados dos e-mails quando a
--    lista não trazia nome completo — corrigir se necessário.
-- ============================================================
begin;

delete from public.approved_roster where claimed = false;

with c as (select id from public.cycles where is_current = true)
insert into public.approved_roster (email, nome, role, directorate_id, subarea_id, cycle_id)
select x.email, x.nome, x.role::public.role_type, s.directorate_id, s.id, (select id from c)
from (values
  -- DIRETORES
  ('brunabeltrao@bevilaqua.org.br',       'Bruna Beltrão',                            'diretor',  'comercial'),
  ('eduardaferraz@bevilaqua.org.br',      'Eduarda Ferraz',                           'diretor',  'pessoas_cultura'),
  ('rayssabarbara@bevilaqua.org.br',      'Rayssa Bárbara',                           'diretor',  'projetos'),
  ('guilherme@bevilaqua.org.br',          'Guilherme',                                'diretor',  'gestao'),
  ('teodoro@bevilaqua.org.br',            'Teodoro',                                  'diretor',  'institucional'),
  -- GERENTES
  ('camilamoraes@bevilaqua.org.br',       'Camila Moraes',                            'gerente',  'pessoas_cultura'),
  ('lorena@bevilaqua.org.br',             'Lorena',                                   'gerente',  'projetos'),
  ('mariaemilia@bevilaqua.org.br',        'Maria Emília',                             'gerente',  'projetos'),
  ('mariatereza@bevilaqua.org.br',        'Maria Tereza',                             'gerente',  'comercial'),
  ('lucasalmeida@bevilaqua.org.br',       'Lucas Almeida',                            'gerente',  'comercial'),
  ('guilhermebarros@bevilaqua.org.br',    'Guilherme Barros',                         'gerente',  'institucional'),
  -- ASSESSORES — INSTITUCIONAL
  ('antoniocorreia@bevilaqua.org.br',     'Antônio de Souza Leão Correia',            'assessor', 'institucional'),
  ('miguel@bevilaqua.org.br',             'Miguel Robalinho Campelo',                 'assessor', 'institucional'),
  -- ASSESSORES — GESTÃO
  ('barbara@bevilaqua.org.br',            'Bárbara Morato Dubeux',                    'assessor', 'gestao'),
  ('leticiaalmeida@bevilaqua.org.br',     'Leticia Rocha Valença de Almeida',         'assessor', 'gestao'),
  ('cesar@bevilaqua.org.br',              'César Lins Pereira Affonso de Amorim',     'assessor', 'gestao'),
  -- ASSESSORES — PESSOAS & CULTURA
  ('gloria@bevilaqua.org.br',             'Glória Esteffeny da Silva Martins',        'assessor', 'pessoas_cultura'),
  ('leticiafriedheim@bevilaqua.org.br',   'Leticia Friedheim',                        'assessor', 'pessoas_cultura'),
  ('fernandafalcao@bevilaqua.org.br',     'Maria Fernanda Moura Falcão',              'assessor', 'pessoas_cultura'),
  -- ASSESSORES — PROJETOS
  ('anacaetano@bevilaqua.org.br',         'Ana Vitória Caetano Lopes',                'assessor', 'projetos'),
  ('beatrizleite@bevilaqua.org.br',       'Beatriz Alves de Lima Leite',              'assessor', 'projetos'),
  ('isadora@bevilaqua.org.br',            'Isa Dora Duarte Araújo Cardoso',           'assessor', 'projetos'),
  ('luanaramos@bevilaqua.org.br',         'Luana Dymunique Oliveira Ramos',           'assessor', 'projetos'),
  ('guilhermedias@bevilaqua.org.br',      'José Guilherme Fragoso Dias Fernandes',    'assessor', 'projetos'),
  ('raquel@bevilaqua.org.br',             'Raquel de Souza Santos',                   'assessor', 'projetos'),
  ('eduardaferro@bevilaqua.org.br',       'Maria Eduarda Ferro Barros de Almeida',    'assessor', 'projetos'),
  ('julialima@bevilaqua.org.br',          'Maria Júlia de Lima e Silva',              'assessor', 'projetos'),
  ('fernanda@bevilaqua.org.br',           'Maria Fernanda Brasileiro Cordeiro',       'assessor', 'projetos'),
  -- ASSESSORES — NEGÓCIOS (COMERCIAL)
  ('juliabarretto@bevilaqua.org.br',      'Júlia Matoso Maciel Barretto',             'assessor', 'comercial'),
  ('lucca@bevilaqua.org.br',              'Lucca Gabriel Barros Meireles',            'assessor', 'comercial'),
  ('manuela@bevilaqua.org.br',            'Manuela Vasconcelos Franco Rafael Nogueira','assessor', 'comercial'),
  ('fernandacarvalheira@bevilaqua.org.br','Maria Fernanda Dantas Carvalheira',        'assessor', 'comercial'),
  ('nicolasgattas@bevilaqua.org.br',      'Nicolas Moraes Barros Gattás',             'assessor', 'comercial'),
  ('sofiahora@bevilaqua.org.br',          'Sofia Hora de Albuquerque Maranhão',       'assessor', 'comercial'),
  -- ASSESSORES — NEGÓCIOS (MARKETING)
  ('paulohenrique@bevilaqua.org.br',      'Paulo Henrique Andrade da Silva',          'assessor', 'marketing'),
  ('arthursoares@bevilaqua.org.br',       'Arthur Soares Portela',                    'assessor', 'marketing'),
  ('gabrielamelo@bevilaqua.org.br',       'Gabriela de Oliveira Melo',                'assessor', 'marketing'),
  ('taina@bevilaqua.org.br',              'Tainá Soares Feliciano Martins',           'assessor', 'marketing')
) as x(email, nome, role, subarea)
join public.subareas s on s.slug = x.subarea;

commit;
