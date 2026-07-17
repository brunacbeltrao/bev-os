-- ============================================================
-- PENDENTE: aplicar manualmente no SQL Editor do Supabase
-- (o filtro de segurança do agente bloqueou colar este SQL por
--  parecer transação financeira; BevCoins é moeda interna)
--
-- Contexto: o banco de produção NÃO tem a migration
-- 20260718000009_fid_bevcoins.sql — o módulo FID/BevCoins está
-- quebrado em produção hoje (tabela inexistente).
--
-- Passo 1: rodar o conteúdo de
--   supabase/migrations/20260718000009_fid_bevcoins.sql
--   (antes dele, rode: create extension if not exists moddatetime with schema extensions;)
--
-- Passo 2: rodar a seção 5 da migration de auditoria (abaixo),
--   que fixa o search_path dos helpers do FID.
-- ============================================================

alter function public.is_diretor_gestao(uuid) set search_path = public;
alter function public.is_diretora_negocios(uuid) set search_path = public;
alter function public.is_eligible_for_bevcoins(uuid) set search_path = public;
alter function public.get_available_bevcoins(uuid, uuid) set search_path = public;
alter function public.get_total_earned_bevcoins(uuid, uuid) set search_path = public;

revoke execute on function public.is_diretor_gestao(uuid) from public, anon;
revoke execute on function public.is_diretora_negocios(uuid) from public, anon;
revoke execute on function public.is_eligible_for_bevcoins(uuid) from public, anon;
revoke execute on function public.get_available_bevcoins(uuid, uuid) from public, anon;
revoke execute on function public.get_total_earned_bevcoins(uuid, uuid) from public, anon;

grant execute on function public.is_diretor_gestao(uuid) to authenticated, service_role;
grant execute on function public.is_diretora_negocios(uuid) to authenticated, service_role;
grant execute on function public.is_eligible_for_bevcoins(uuid) to authenticated, service_role;
grant execute on function public.get_available_bevcoins(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_total_earned_bevcoins(uuid, uuid) to authenticated, service_role;
