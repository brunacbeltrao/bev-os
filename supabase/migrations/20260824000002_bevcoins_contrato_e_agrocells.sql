-- ============================================================
-- BEV OS · 24/08/2026 — JÁ APLICADO no Supabase.
-- ============================================================

-- Agrocells NÃO foi distratada: volta a contar no faturamento.
update public.contratos
set status = 'aprovado', distratado_em = null
where cliente ilike '%agrocells%';

-- Crédito de BevCoins passa a apontar para o contrato que o gerou.
-- Antes o nome era digitado à mão: nada garantia que o contrato
-- existisse, o valor podia divergir do real, e não havia como saber
-- se um contrato já tinha sido creditado.
alter table public.bevcoins_transactions
  add column if not exists contrato_id uuid references public.contratos(id) on delete set null;

create index if not exists bevcoins_transactions_contrato_idx
  on public.bevcoins_transactions(contrato_id);

comment on column public.bevcoins_transactions.contrato_id is
  'Contrato que originou o crédito. Null em débitos e nos créditos lançados antes deste vínculo existir.';
