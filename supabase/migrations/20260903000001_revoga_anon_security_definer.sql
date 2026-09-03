-- ============================================================
-- BEV OS · 03/09/2026 — Auditoria de segurança.
--
-- ATENÇÃO: esta migration foi APLICADA e NÃO resolveu. `anon` nunca teve
-- grant próprio nestas funções — ele herda de PUBLIC, então revogar dele
-- é no-op. A correção que de fato fecha está em
-- 20260903000005_revoga_public_security_definer.sql. Este arquivo fica
-- porque está no histórico do banco.
--
-- 30 funções SECURITY DEFINER estavam com EXECUTE para `anon`.
-- SECURITY DEFINER ignora RLS por construção, e o PostgREST publica
-- toda função do schema `public` em /rest/v1/rpc/<nome>. Com a anon
-- key — que é pública, vai no bundle do front — dava para chamar sem
-- login e receber dado real. Verificado no banco:
--
--   get_total_earned_bevcoins(<uuid>, <ciclo>) -> 418.13
--   perfil_bandeira(<uuid>, <ciclo>)           -> {"cor","advertencias","agravos"}
--   talento_elegibilidade(<uuid>, <ciclo>)     -> critérios de promoção
--
-- Bandeira disciplinar e saldo de BevCoins de qualquer pessoa, para
-- quem tivesse o uuid dela.
--
-- Nenhuma destas é chamada antes do login: as telas que rodam sem
-- sessão são /cadastro e /recuperar-senha, e ambas usam apenas
-- check_roster_email — que por isso continua com EXECUTE para anon
-- (ver AUDITORIA-SEGURANCA.md §2.3 para o que ela ainda expõe).
--
-- `authenticated` não é tocado: o app depende dessas funções logado.
-- ============================================================

revoke execute on function public.bev_curso_visivel(uid uuid, c_id uuid) from anon;
revoke execute on function public.bev_pode_gerir_curso(uid uuid, c_id uuid) from anon;
revoke execute on function public.can_launch_bevcoins(uid uuid) from anon;
revoke execute on function public.create_project_from_lead() from anon;
revoke execute on function public.enforce_demand_rules() from anon;
revoke execute on function public.enforce_farol_autoria() from anon;
revoke execute on function public.enforce_lead_rules() from anon;
revoke execute on function public.enforce_parecer_travado() from anon;
revoke execute on function public.enforce_warning_chain() from anon;
revoke execute on function public.epeas_pode_editar(p_contrato uuid) from anon;
revoke execute on function public.epeas_pode_ver(p_contrato uuid) from anon;
revoke execute on function public.epeas_registra_historico() from anon;
revoke execute on function public.get_available_bevcoins(p_person_id uuid, p_cycle_id uuid) from anon;
revoke execute on function public.get_total_earned_bevcoins(p_person_id uuid, p_cycle_id uuid) from anon;
revoke execute on function public.handle_deleted_user() from anon;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.is_diretor_gestao(uid uuid) from anon;
revoke execute on function public.is_diretora_negocios(uid uuid) from anon;
revoke execute on function public.is_eligible_for_bevcoins(uid uuid) from anon;
revoke execute on function public.is_gestao(uid uuid) from anon;
revoke execute on function public.is_gestao_lideranca(uid uuid) from anon;
revoke execute on function public.is_lideranca_projetos(uid uuid) from anon;
revoke execute on function public.is_pc_lideranca(uid uuid) from anon;
revoke execute on function public.lidera_pessoa(uid uuid, pid uuid) from anon;
revoke execute on function public.perfil_bandeira(p_person uuid, p_cycle uuid) from anon;
revoke execute on function public.perfil_demandas(p_person uuid, p_cycle uuid) from anon;
revoke execute on function public.pode_gerir_bevskills(uid uuid, dir_id uuid) from anon;
revoke execute on function public.record_lead_stage() from anon;
revoke execute on function public.talento_elegibilidade(p_person uuid, p_cycle uuid) from anon;
revoke execute on function public.ve_perfil(uid uuid, pid uuid) from anon;

-- `handle_new_user` e os `enforce_*` são funções de trigger: rodam no
-- contexto do trigger, não pelo RPC. O revoke aqui é higiene de
-- superfície, não muda comportamento.
