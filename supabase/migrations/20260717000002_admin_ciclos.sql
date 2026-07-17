-- ============================================================
-- BEV OS — Módulo de Administração de P&C (Transição de Ciclos)
-- Cria RPC para virar o semestre e ajusta RLS de cycles e approved_roster
-- ============================================================

begin;

-- ============================================================
-- Helper para verificar se usuário é P&C ou Direx (usado nas policies)
-- ============================================================
create or replace function public.can_manage_roster_and_cycles(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_direx(uid) or public.is_leader_of(uid, (select id from public.subareas where slug = 'pessoas_cultura'));
$$;

revoke execute on function public.can_manage_roster_and_cycles(uuid) from public, anon;
grant execute on function public.can_manage_roster_and_cycles(uuid) to authenticated, service_role;

-- ============================================================
-- RPC: close_and_open_cycle
-- Função atômica que encerra o ciclo atual e inicia um novo
-- ============================================================
create or replace function public.close_and_open_cycle(novo_nome text, d_inicio date, d_fim date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  novo_id uuid;
  v_uid uuid := auth.uid();
begin
  -- Checar permissão
  if not public.can_manage_roster_and_cycles(v_uid) then
    raise exception 'BEV_OS_UNAUTHORIZED: Acesso negado. Apenas Direx ou liderança de Pessoas e Cultura podem gerenciar ciclos.';
  end if;

  -- Remove is_current do ciclo antigo (se houver)
  update public.cycles set is_current = false where is_current = true;

  -- Cria o novo ciclo
  insert into public.cycles (nome, data_inicio, data_fim, is_current)
  values (novo_nome, d_inicio, d_fim, true)
  returning id into novo_id;

  return novo_id;
end;
$$;

revoke execute on function public.close_and_open_cycle(text, date, date) from public, anon;
grant execute on function public.close_and_open_cycle(text, date, date) to authenticated, service_role;

-- ============================================================
-- Políticas (RLS) para tabela cycles
-- ============================================================
grant insert, update on public.cycles to authenticated;

drop policy if exists cycles_insert on public.cycles;
create policy cycles_insert on public.cycles
  for insert to authenticated
  with check (public.can_manage_roster_and_cycles((select auth.uid())));

drop policy if exists cycles_update on public.cycles;
create policy cycles_update on public.cycles
  for update to authenticated
  using (public.can_manage_roster_and_cycles((select auth.uid())))
  with check (public.can_manage_roster_and_cycles((select auth.uid())));

-- ============================================================
-- Políticas (RLS) para tabela approved_roster
-- ============================================================
grant insert, update, delete on public.approved_roster to authenticated;

drop policy if exists approved_roster_insert on public.approved_roster;
create policy approved_roster_insert on public.approved_roster
  for insert to authenticated
  with check (public.can_manage_roster_and_cycles((select auth.uid())));

drop policy if exists approved_roster_update on public.approved_roster;
create policy approved_roster_update on public.approved_roster
  for update to authenticated
  using (public.can_manage_roster_and_cycles((select auth.uid())))
  with check (public.can_manage_roster_and_cycles((select auth.uid())));

drop policy if exists approved_roster_delete on public.approved_roster;
create policy approved_roster_delete on public.approved_roster
  for delete to authenticated
  using (public.can_manage_roster_and_cycles((select auth.uid())));

commit;
