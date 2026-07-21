-- ============================================================
-- BEV OS — Perfil do Assessor — parte 5/5
-- warnings/agravos e demands têm RLS restrita a outros escopos; aqui
-- a liderança direta recebe apenas o RESUMO necessário ao Perfil.
-- ============================================================

-- Bandeira e contagens para o banner da Aba 2 (sem a justificativa).
create or replace function public.perfil_bandeira(p_person uuid, p_cycle uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_cor text; v_adv int; v_agr int;
begin
  if not public.ve_perfil(auth.uid(), p_person) then
    raise exception 'BEV_OS_SEM_ACESSO';
  end if;
  select coalesce(
    (select f.cor::text from public.warnings w
       join public.warning_flags f on f.id = w.flag_id
      where w.person_id = p_person and w.cycle_id = p_cycle
      order by f.pontos desc limit 1), 'branca') into v_cor;
  select count(*) into v_adv from public.warnings w
   where w.person_id = p_person and w.cycle_id = p_cycle;
  select count(*) into v_agr from public.agravos a
   where a.person_id = p_person and a.cycle_id = p_cycle;
  return jsonb_build_object('cor', v_cor, 'advertencias', v_adv, 'agravos', v_agr);
end;
$$;

-- Demandas do assessor no ciclo, já classificadas para o card da Aba 1.
create or replace function public.perfil_demandas(p_person uuid, p_cycle uuid)
returns table (
  id uuid, titulo text, status text, prazo date,
  atualizada_em timestamptz, classe text
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ve_perfil(auth.uid(), p_person) then
    raise exception 'BEV_OS_SEM_ACESSO';
  end if;
  return query
  select d.id, d.titulo, d.status::text, d.prazo, d.updated_at,
    case
      when d.status = 'concluido'
        and (d.prazo is null or d.updated_at::date <= d.prazo) then 'no_prazo'
      when d.status = 'concluido' then 'com_atraso'
      else 'em_aberto'
    end as classe
  from public.demands d
  join public.demand_assignees da on da.demand_id = d.id
  where da.person_id = p_person and d.cycle_id = p_cycle
  order by d.prazo desc nulls last;
end;
$$;

grant execute on function public.perfil_bandeira(uuid, uuid) to authenticated, service_role;
grant execute on function public.perfil_demandas(uuid, uuid) to authenticated, service_role;
