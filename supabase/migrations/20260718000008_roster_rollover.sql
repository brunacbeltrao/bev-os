-- ============================================================
-- BEV OS — Módulo de Administração de P&C (Rollover de Ciclos)
-- Atualiza a RPC close_and_open_cycle para suportar o 
-- import automático (rollover) de membros do ciclo anterior.
-- ============================================================

begin;

drop function if exists public.close_and_open_cycle(text, date, date);

-- ============================================================
-- RPC: close_and_open_cycle
-- Função atômica que encerra o ciclo atual, inicia um novo e
-- opcionalmente carrega o Roster do ciclo antigo (ativo).
-- ============================================================
create or replace function public.close_and_open_cycle(
  novo_nome text, 
  d_inicio date, 
  d_fim date,
  b_rollover_roster boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  novo_id uuid;
  antigo_id uuid;
  v_uid uuid := auth.uid();
begin
  -- Checar permissão
  if not public.can_manage_roster_and_cycles(v_uid) then
    raise exception 'BEV_OS_UNAUTHORIZED: Acesso negado. Apenas Direx ou liderança de Pessoas e Cultura podem gerenciar ciclos.';
  end if;

  -- Guarda o ID do ciclo antigo para possível rollover
  select id into antigo_id from public.cycles where is_current = true limit 1;

  -- Remove is_current do ciclo antigo (se houver)
  update public.cycles set is_current = false where is_current = true;

  -- Cria o novo ciclo
  insert into public.cycles (nome, data_inicio, data_fim, is_current)
  values (novo_nome, d_inicio, d_fim, true)
  returning id into novo_id;

  -- Rollover de Roster (Opcional)
  if b_rollover_roster and antigo_id is not null then
    -- Como a tabela approved_roster tem email como primary key, 
    -- não inserimos novas linhas, apenas migramos os registros do 
    -- ciclo antigo para o novo.
    update public.approved_roster 
    set cycle_id = novo_id
    where cycle_id = antigo_id;
    
    -- A tabela occupations guarda histórico. 
    -- Inserimos os novos vínculos para o novo ciclo.
    insert into public.occupations (
      person_id,
      cycle_id,
      directorate_id,
      subarea_id,
      role,
      is_hibrido
    )
    select
      o.person_id,
      novo_id,
      o.directorate_id,
      o.subarea_id,
      o.role,
      o.is_hibrido
    from public.occupations o
    where o.cycle_id = antigo_id;
    
  end if;

  return novo_id;
end;
$$;

revoke execute on function public.close_and_open_cycle(text, date, date, boolean) from public, anon;
grant execute on function public.close_and_open_cycle(text, date, date, boolean) to authenticated, service_role;

commit;
