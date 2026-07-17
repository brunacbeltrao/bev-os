-- ============================================================
-- BEV OS — Calendário 2.0: compromissos institucionais
--  · Público-alvo (audiência) separado da presença obrigatória
--  · Link da reunião + documentos
--  · RSVP por pessoa; "não poderei" alimenta a Frequência
-- Reaproveita events/meeting_types; visibilidade passa a ser por
-- AUDIÊNCIA (não mais pelo slug do tipo). Criação = qualquer liderança.
-- ============================================================

begin;

create type public.event_audience as enum ('bev', 'diretores', 'diretores_gerentes', 'areas');
create type public.rsvp_status as enum ('confirmado', 'recusado');

alter table public.events
  add column audiencia public.event_audience,
  add column link_reuniao text,
  add column obrig_diretores boolean not null default false,
  add column obrig_gerentes boolean not null default false,
  add column obrig_assessores boolean not null default false;

-- Áreas-alvo quando audiencia='areas' (por DIRETORIA; cobre multi-área)
create table public.event_target_directorates (
  event_id uuid not null references public.events (id) on delete cascade,
  directorate_id uuid not null references public.directorates (id) on delete cascade,
  primary key (event_id, directorate_id)
);
alter table public.event_target_directorates enable row level security;
revoke all on public.event_target_directorates from anon;
grant select, insert, delete on public.event_target_directorates to authenticated;
grant all on public.event_target_directorates to service_role;
create policy etd_select on public.event_target_directorates for select to authenticated using (true);
create policy etd_insert on public.event_target_directorates for insert to authenticated
  with check (public.can_manage_event((select auth.uid()), event_id));
create policy etd_delete on public.event_target_directorates for delete to authenticated
  using (public.can_manage_event((select auth.uid()), event_id));

-- Documentos do evento (slides/drive/material). A ata continua em meeting_minutes.
create table public.event_docs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  nome text not null,
  url text not null,
  created_at timestamptz not null default now()
);
alter table public.event_docs enable row level security;
revoke all on public.event_docs from anon;
grant select, insert, delete on public.event_docs to authenticated;
grant all on public.event_docs to service_role;
create policy edocs_select on public.event_docs for select to authenticated
  using (public.can_see_event((select auth.uid()), event_id));
create policy edocs_insert on public.event_docs for insert to authenticated
  with check (public.can_manage_event((select auth.uid()), event_id));
create policy edocs_delete on public.event_docs for delete to authenticated
  using (public.can_manage_event((select auth.uid()), event_id));

-- RSVP por pessoa
create table public.event_rsvp (
  event_id uuid not null references public.events (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  status public.rsvp_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, person_id)
);
create trigger event_rsvp_updated_at before update on public.event_rsvp
  for each row execute function public.set_updated_at();
alter table public.event_rsvp enable row level security;
revoke all on public.event_rsvp from anon;
grant select, insert, update, delete on public.event_rsvp to authenticated;
grant all on public.event_rsvp to service_role;
create policy rsvp_select on public.event_rsvp for select to authenticated
  using (public.can_see_event((select auth.uid()), event_id));
create policy rsvp_insert on public.event_rsvp for insert to authenticated
  with check (person_id = (select auth.uid()) and public.can_see_event((select auth.uid()), event_id));
create policy rsvp_update on public.event_rsvp for update to authenticated
  using (person_id = (select auth.uid())) with check (person_id = (select auth.uid()));
create policy rsvp_delete on public.event_rsvp for delete to authenticated
  using (person_id = (select auth.uid()));

-- ---------- Backfill de audiência dos eventos existentes ----------
update public.events e set audiencia = (case
    when mt.slug = 'rg' then 'bev'
    when mt.slug = 'rd' then 'diretores'
    when mt.slug = 'rl' then 'diretores_gerentes'
    else 'areas'
  end)::public.event_audience
from public.meeting_types mt
where mt.id = e.meeting_type_id and e.audiencia is null;

insert into public.event_target_directorates (event_id, directorate_id)
select e.id, s.directorate_id
from public.events e
join public.subareas s on s.id = e.subarea_id
where e.audiencia = 'areas' and e.subarea_id is not null
on conflict do nothing;

alter table public.events alter column audiencia set default 'bev';

-- ---------- Visibilidade por AUDIÊNCIA ----------
create or replace function public.can_see_event(uid uuid, ev_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.events e
    where e.id = ev_id
      and (
        e.criado_por = uid
        or e.audiencia = 'bev'
        or (e.audiencia = 'diretores' and public.is_direx(uid))
        or (e.audiencia = 'diretores_gerentes' and public.is_lideranca(uid))
        or (e.audiencia = 'areas' and (
              public.is_direx(uid)
              or exists (
                select 1 from public.event_target_directorates td
                join public.occupations o on o.directorate_id = td.directorate_id
                where td.event_id = e.id
                  and o.person_id = uid and o.cycle_id = public.current_cycle_id()
              )
        ))
      )
  );
$$;

-- ---------- Gestão: criador, diretor, ou liderança de área-alvo ----------
create or replace function public.can_manage_event(uid uuid, ev_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.events e
    where e.id = ev_id
      and (
        e.criado_por = uid
        or public.is_direx(uid)
        or exists (
          select 1 from public.event_target_directorates td
          join public.occupations o on o.directorate_id = td.directorate_id
          where td.event_id = e.id
            and o.person_id = uid and o.cycle_id = public.current_cycle_id()
            and o.role in ('diretor', 'gerente', 'coordenador')
        )
      )
  );
$$;

-- ---------- Políticas de events (visibilidade + criação por liderança) ----------
drop policy events_select on public.events;
create policy events_select on public.events
  for select to authenticated
  using (public.can_see_event((select auth.uid()), id));

drop policy events_insert on public.events;
create policy events_insert on public.events
  for insert to authenticated
  with check (
    criado_por = (select auth.uid())
    and cycle_id = public.current_cycle_id()
    and public.is_lideranca((select auth.uid()))
  );

commit;
