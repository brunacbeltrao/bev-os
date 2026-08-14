-- ============================================================
-- BEV OS · Auditoria 11/08/2026 — revisão das views
-- JÁ APLICADA no projeto Supabase qsldssvblnwcqdetylrl.
-- Salve em: supabase/migrations/
--
-- As 6 views sinalizadas pelo advisor do Supabase JÁ possuem
-- filtro de permissão explícito na cláusula WHERE. O alerta é
-- genérico (heurística), não um vazamento real.
--
-- Só uma pode virar security_invoker sem alterar comportamento:
-- person_warning_totals, cujo WHERE é idêntico à policy de RLS
-- das tabelas de base (warnings e agravos).
--
-- As outras 5 são agregadoras: precisam contar linhas que o
-- usuário não pode ler individualmente. Trocar para invoker faria
-- os números caírem silenciosamente para zero — pior que um erro,
-- porque o dashboard continuaria parecendo correto.
-- ============================================================

alter view public.person_warning_totals set (security_invoker = on);

comment on view public.person_warning_totals is
  'security_invoker=on. O WHERE replica a policy de RLS de warnings/agravos (titular ou P&C), portanto o RLS das tabelas de base é suficiente.';

comment on view public.dashboard_entrega is
  'SECURITY DEFINER intencional. Conta demandas de TODAS as subáreas para liderança/Direx; o RLS de demands limita a leitura à própria subárea, o que zeraria as contagens. Guarda de permissão no WHERE: is_lideranca() OR is_direx(). NÃO trocar para security_invoker.';

comment on view public.dashboard_warnings is
  'SECURITY DEFINER intencional. Agrega agravos e probatórios por diretoria; o RLS de agravos/probation_periods é titular-ou-P&C, o que zeraria os números para diretores fora da P&C. Guarda no WHERE: is_direx() OR is_leader_of(pc_subarea_id()). NÃO trocar para security_invoker.';

comment on view public.liderados_view is
  'SECURITY DEFINER intencional. O contador de agravos e o flag de risco dependem de ler agravos dos liderados, que o RLS restringe a titular-ou-P&C. Guarda no WHERE: is_leader_of(auth.uid(), subarea_id). NÃO trocar para security_invoker.';

comment on view public.direx_summary_view is
  'SECURITY DEFINER intencional. O WHERE libera diretor E gerente, mas o RLS de direx_minutes/direx_decisions é is_direx() — gerentes veriam zero. NÃO trocar para security_invoker.';

comment on view public.bevcoins_ranking is
  'SECURITY DEFINER intencional. Ranking público do ciclo: por definição mostra o total de terceiros. A agregação roda dentro de get_total_earned_bevcoins(). NÃO trocar para security_invoker.';
