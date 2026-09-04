-- ============================================================
-- BEV OS · 04/09/2026 — fecha função nova que nasceu aberta. APLICADA.
--
-- `pertence_diretoria` é SECURITY DEFINER e apareceu executável por anon
-- mesmo depois do `revoke ... from public` da migration que a criou
-- (20260904000001).
--
-- O motivo: o Supabase mantém ALTER DEFAULT PRIVILEGES concedendo EXECUTE
-- a anon/authenticated/service_role em toda função nova do schema public.
-- O grant do anon é EXPLÍCITO (`anon=X` no ACL), não herdado de PUBLIC —
-- então revogar de PUBLIC não o alcança. É o espelho do erro da
-- 20260903000001, que revogou de anon quando o grant vinha de PUBLIC.
--
-- Regra daqui para frente: toda função nova em `public` precisa de
--   revoke execute on function ... from anon, public;
-- Os dois. Fechar só um deixa a porta aberta, e ambos falham em silêncio.
--
-- Checagem que pega isto (deve devolver só check_roster_email):
--   select p.proname from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname='public' and p.prosecdef
--      and has_function_privilege('anon', p.oid, 'EXECUTE');
-- ============================================================

revoke execute on function public.pertence_diretoria(uuid, text) from anon, public;
revoke execute on function public.epeas_diretoria_da_etapa(public.epeas_etapa_macro) from anon, public;
revoke execute on function public.storage_pasta_uuid(text) from anon, public;
revoke execute on function public.epeas_excecao_trava_autoria() from anon, public;

grant execute on function public.pertence_diretoria(uuid, text) to authenticated, service_role;
grant execute on function public.epeas_diretoria_da_etapa(public.epeas_etapa_macro) to authenticated, service_role;
grant execute on function public.storage_pasta_uuid(text) to authenticated, service_role;
