-- ============================================================
-- BEV OS — Perfil do Assessor — parte 4/5
-- Aba 3: Parecer Final + Banco de Talentos.
-- A elegibilidade é CALCULADA, nunca digitada (PRD §4.2).
-- ============================================================

create table if not exists public.cycle_endorsements (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.people (id) on delete cascade,
  cycle_id   uuid not null references public.cycles (id) default public.current_cycle_id(),
  sintese      text,
  destaques    text,
  desenvolver  text,
  parecer_diretor text,
  status     text not null default 'rascunho'
             check (status in ('rascunho', 'aguardando_pc', 'assinado')),
  assinado_em timestamptz,
  assinado_por uuid references public.people (id),
  talento_elegivel        boolean,
  talento_override        boolean not null default false,
  talento_override_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, cycle_id)
);

drop trigger if exists cycle_endorsements_updated_at on public.cycle_endorsements;
create trigger cycle_endorsements_updated_at before update on public.cycle_endorsements
  for each row execute function public.set_updated_at();

alter table public.cycle_endorsements enable row level security;
revoke all on public.cycle_endorsements from anon;
grant select, insert, update, delete on public.cycle_endorsements to authenticated;
grant all on public.cycle_endorsements to service_role;

-- O assessor só lê o parecer depois de assinado (PRD §8).
drop policy if exists cycle_endorsements_select on public.cycle_endorsements;
create policy cycle_endorsements_select on public.cycle_endorsements
  for select to authenticated
  using (
    public.lidera_pessoa((select auth.uid()), person_id)
    or (person_id = (select auth.uid()) and status = 'assinado')
  );

drop policy if exists cycle_endorsements_write on public.cycle_endorsements;
create policy cycle_endorsements_write on public.cycle_endorsements
  for all to authenticated
  using (public.lidera_pessoa((select auth.uid()), person_id))
  with check (public.lidera_pessoa((select auth.uid()), person_id));

-- Depois de assinado o parecer trava: só a P&C reabre.
create or replace function public.enforce_parecer_travado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'assinado' and not public.is_pc(auth.uid()) then
    raise exception 'BEV_OS_PARECER_ASSINADO';
  end if;
  if new.status = 'assinado' and old.status <> 'assinado' then
    new.assinado_em := now();
    new.assinado_por := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists cycle_endorsements_travado on public.cycle_endorsements;
create trigger cycle_endorsements_travado before update on public.cycle_endorsements
  for each row execute function public.enforce_parecer_travado();

-- Elegibilidade ao Banco de Talentos: devolve o veredito e o porquê
-- de cada critério, para alimentar o tooltip do badge no Header.
create or replace function public.talento_elegibilidade(p_person uuid, p_cycle uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_ciclos    int;
  v_bandeira  text;
  v_agravos   int;
  v_pareceres int;
  v_total     int;
  v_ok        int;
  v_taxa      numeric;
  v_ovr       boolean;
  v_ovr_val   boolean;
  v_ovr_motivo text;
  criterios   jsonb;
begin
  select count(distinct o.cycle_id) into v_ciclos
    from public.occupations o where o.person_id = p_person;

  select coalesce(
           (select f.cor::text
              from public.warnings w
              join public.warning_flags f on f.id = w.flag_id
             where w.person_id = p_person and w.cycle_id = p_cycle
             order by f.pontos desc limit 1),
           'branca')
    into v_bandeira;

  select count(*) into v_agravos
    from public.agravos a where a.person_id = p_person and a.cycle_id = p_cycle;

  select count(*) into v_pareceres
    from public.cycle_endorsements e
   where e.person_id = p_person and e.status = 'assinado';

  select count(*) filter (where d.status = 'concluido'), count(*)
    into v_ok, v_total
    from public.demands d
    join public.demand_assignees da on da.demand_id = d.id
   where da.person_id = p_person and d.cycle_id = p_cycle;

  v_taxa := case when v_total = 0 then 1 else v_ok::numeric / v_total end;

  criterios := jsonb_build_array(
    jsonb_build_object('chave', 'ciclos', 'ok', v_ciclos >= 2,
      'label', 'Está no 2º ciclo ou mais',
      'detalhe', v_ciclos || (case when v_ciclos = 1 then ' ciclo' else ' ciclos' end) || ' no BEV'),
    jsonb_build_object('chave', 'bandeira', 'ok', v_bandeira not in ('vermelha', 'preta'),
      'label', 'Bandeira branca ou amarela',
      'detalhe', 'Bandeira ' || v_bandeira),
    jsonb_build_object('chave', 'agravos', 'ok', v_agravos = 0,
      'label', 'Sem agravos em aberto no ciclo',
      'detalhe', v_agravos || (case when v_agravos = 1 then ' agravo' else ' agravos' end) || ' no ciclo'),
    jsonb_build_object('chave', 'parecer', 'ok', v_pareceres >= 1,
      'label', 'Ao menos 1 Parecer Final assinado',
      'detalhe', v_pareceres || ' assinado(s)'),
    jsonb_build_object('chave', 'entregas', 'ok', v_taxa >= 0.7,
      'label', 'Taxa de entrega maior ou igual a 70%',
      'detalhe', case when v_total = 0 then 'Sem demandas atribuídas no ciclo'
                      else round(v_taxa * 100) || '% (' || v_ok || '/' || v_total || ')' end)
  );

  select e.talento_override, e.talento_elegivel, e.talento_override_motivo
    into v_ovr, v_ovr_val, v_ovr_motivo
    from public.cycle_endorsements e
   where e.person_id = p_person and e.cycle_id = p_cycle;

  return jsonb_build_object(
    'elegivel', coalesce(
      case when coalesce(v_ovr, false) then v_ovr_val else null end,
      not exists (select 1 from jsonb_array_elements(criterios) c where (c->>'ok')::boolean = false)
    ),
    'override', coalesce(v_ovr, false),
    'override_motivo', v_ovr_motivo,
    'criterios', criterios
  );
end;
$$;

grant execute on function public.talento_elegibilidade(uuid, uuid) to authenticated, service_role;
