-- ============================================================
-- BEV OS · 01/09/2026 — JÁ APLICADO no Supabase.
-- Enxugamento: Benchs, Meus Liderados, Painel do Gerente e da Diretoria.
--
-- Todas as tabelas envolvidas estavam com ZERO registros.
--
-- liderados_view foi PRESERVADA: além da aba removida, ela alimenta a
-- aba de acompanhamento de assessores dentro do PDI.
-- ============================================================
drop table if exists public.bench_participantes cascade;
drop table if exists public.benchs              cascade;
drop table if exists public.minute_decisions    cascade;
drop table if exists public.direx_decisions     cascade;
drop table if exists public.direx_minutes       cascade;
drop view  if exists public.direx_summary_view  cascade;
drop table if exists public.one_on_ones         cascade;
drop table if exists public.otos                cascade;
