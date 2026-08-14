-- ============================================================
-- BEV OS · Auditoria 11/08/2026
-- JÁ APLICADA no projeto Supabase qsldssvblnwcqdetylrl.
-- Este arquivo existe para manter o histórico de migrations
-- do repositório em sincronia com o banco.
-- Salve em: supabase/migrations/
-- ============================================================

-- 1) Limpeza do dado de teste (crédito de 625.000 BevCoins)
delete from public.bevcoins_transactions
where id = '20ca31fa-92f4-4699-be62-439150f9937e';

-- 2) Remoção completa da Reunião de Área (RA)
do $$
declare v_ra uuid;
begin
  select id into v_ra from public.meeting_types where slug = 'ra';
  if v_ra is null then return; end if;

  delete from public.ra_attendance            where event_id in (select id from public.events where meeting_type_id = v_ra);
  delete from public.ra_details               where event_id in (select id from public.events where meeting_type_id = v_ra);
  delete from public.event_rsvp               where event_id in (select id from public.events where meeting_type_id = v_ra);
  delete from public.absence_justifications   where event_id in (select id from public.events where meeting_type_id = v_ra);
  delete from public.event_participants       where event_id in (select id from public.events where meeting_type_id = v_ra);
  delete from public.event_target_directorates where event_id in (select id from public.events where meeting_type_id = v_ra);
  delete from public.event_docs               where event_id in (select id from public.events where meeting_type_id = v_ra);
  delete from public.meeting_minutes          where event_id in (select id from public.events where meeting_type_id = v_ra);
  delete from public.events where meeting_type_id = v_ra;
  delete from public.meeting_types where id = v_ra;
end $$;

drop table if exists public.ra_attendance cascade;
drop table if exists public.ra_details  cascade;
drop function if exists public.enforce_event_subarea() cascade;

-- 3) Correção de segurança: search_path fixo
alter function public.set_updated_at() set search_path to 'public';
