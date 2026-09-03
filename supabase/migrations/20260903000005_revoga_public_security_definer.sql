-- ============================================================
-- BEV OS · 03/09/2026 — Auditoria de segurança.
--
-- Corrige a 20260903000001, que mirou no alvo errado.
--
-- `revoke ... from anon` era inócuo: `anon` nunca teve grant próprio
-- nestas funções — ele herda de PUBLIC. No ACL, a entrada de grantee
-- vazio é o PUBLIC:
--
--   perfil_bandeira  {=X/postgres, postgres=X, authenticated=X, service_role=X}
--                     ^^ este
--   is_direx         {postgres=X, authenticated=X, service_role=X}
--                     (sem a entrada: por isso já estava fechada)
--
-- As funções que já estavam protegidas — is_direx, current_cycle_id,
-- excluir_cadastro, resumo_exclusao_cadastro — são exatamente as que
-- tiveram PUBLIC revogado quando foram criadas. As 30 daqui nunca
-- tiveram.
--
-- Revogar de PUBLIC é seguro: as 64 funções SECURITY DEFINER do schema
-- têm grant explícito para `authenticated`, conferido antes de aplicar.
-- Verificado depois: anon recebe insufficient_privilege nas 30, e um
-- usuário logado continua lendo BevCoins, bandeira, talento, EPEAS e as
-- tabelas sob RLS que dependem destas funções nas policies.
--
-- check_roster_email fica de fora de propósito: tem `anon=X` explícito e
-- é chamada por /cadastro e /recuperar-senha, que rodam sem sessão.
-- ============================================================

revoke execute on function public.bev_curso_visivel(uid uuid, c_id uuid) from public;
revoke execute on function public.bev_pode_gerir_curso(uid uuid, c_id uuid) from public;
revoke execute on function public.can_launch_bevcoins(uid uuid) from public;
revoke execute on function public.create_project_from_lead() from public;
revoke execute on function public.enforce_demand_rules() from public;
revoke execute on function public.enforce_farol_autoria() from public;
revoke execute on function public.enforce_lead_rules() from public;
revoke execute on function public.enforce_parecer_travado() from public;
revoke execute on function public.enforce_warning_chain() from public;
revoke execute on function public.epeas_pode_editar(p_contrato uuid) from public;
revoke execute on function public.epeas_pode_ver(p_contrato uuid) from public;
revoke execute on function public.epeas_registra_historico() from public;
revoke execute on function public.get_available_bevcoins(p_person_id uuid, p_cycle_id uuid) from public;
revoke execute on function public.get_total_earned_bevcoins(p_person_id uuid, p_cycle_id uuid) from public;
revoke execute on function public.handle_deleted_user() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.is_diretor_gestao(uid uuid) from public;
revoke execute on function public.is_diretora_negocios(uid uuid) from public;
revoke execute on function public.is_eligible_for_bevcoins(uid uuid) from public;
revoke execute on function public.is_gestao(uid uuid) from public;
revoke execute on function public.is_gestao_lideranca(uid uuid) from public;
revoke execute on function public.is_lideranca_projetos(uid uuid) from public;
revoke execute on function public.is_pc_lideranca(uid uuid) from public;
revoke execute on function public.lidera_pessoa(uid uuid, pid uuid) from public;
revoke execute on function public.perfil_bandeira(p_person uuid, p_cycle uuid) from public;
revoke execute on function public.perfil_demandas(p_person uuid, p_cycle uuid) from public;
revoke execute on function public.pode_gerir_bevskills(uid uuid, dir_id uuid) from public;
revoke execute on function public.record_lead_stage() from public;
revoke execute on function public.talento_elegibilidade(p_person uuid, p_cycle uuid) from public;
revoke execute on function public.ve_perfil(uid uuid, pid uuid) from public;
