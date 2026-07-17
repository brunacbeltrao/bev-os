-- ============================================================
-- BEV OS — Correções pós-validação da Bruna (10/07/2026):
-- 1) Calendário: novas categorias de evento (Capacitação, Evento
--    MEJ, Coworking, Outro) com título livre e escopo área/BEV.
-- 2) Avisos (ex-Comunicados): só a DIRETORIA publica; suporte a
--    link, imagens e arquivos (bucket de storage "avisos").
-- ============================================================

-- ---------- 1) Calendário ----------
insert into public.meeting_types (slug, nome) values
  ('capacitacao', 'Capacitação'),
  ('evento_mej', 'Evento MEJ'),
  ('coworking', 'Coworking'),
  ('outro', 'Outro');

alter table public.events add column titulo text;

-- RG/RD/RL: institucionais (sem subárea). RA: exige subárea.
-- Novas categorias: subárea define o escopo (null = BEV todo).
create or replace function public.enforce_event_subarea()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  mt_slug text;
begin
  select slug into mt_slug from public.meeting_types where id = new.meeting_type_id;
  if mt_slug = 'ra' and new.subarea_id is null then
    raise exception 'BEV_OS_EVENTO_RA_SEM_SUBAREA: Reunião de Área exige uma subárea.';
  end if;
  if mt_slug in ('rg', 'rd', 'rl') and new.subarea_id is not null then
    raise exception 'BEV_OS_EVENTO_SUBAREA_INDEVIDA: RG/RD/RL são institucionais, sem subárea.';
  end if;
  return new;
end;
$$;

-- Visibilidade: novas categorias sem subárea = BEV todo; com
-- subárea = membros da área (como RA).
create or replace function public.can_see_event(uid uuid, ev_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.events e
    join public.meeting_types mt on mt.id = e.meeting_type_id
    where e.id = ev_id
      and (
        mt.slug = 'rg'
        or (mt.slug = 'rd' and public.is_direx(uid))
        or (mt.slug = 'rl' and public.is_lideranca(uid))
        or (mt.slug = 'ra' and public.belongs_to_subarea(uid, e.subarea_id))
        or (
          mt.slug in ('capacitacao', 'evento_mej', 'coworking', 'outro')
          and (e.subarea_id is null or public.belongs_to_subarea(uid, e.subarea_id) or public.is_direx(uid))
        )
      )
  );
$$;

-- Gestão: eventos de área pela liderança da área; eventos BEV
-- todo (e RG/RD/RL) pela Direx.
create or replace function public.can_manage_event(uid uuid, ev_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.events e
    join public.meeting_types mt on mt.id = e.meeting_type_id
    where e.id = ev_id
      and (
        (mt.slug = 'ra' and public.is_leader_of(uid, e.subarea_id))
        or (mt.slug in ('rg', 'rd', 'rl') and public.is_direx(uid))
        or (
          mt.slug in ('capacitacao', 'evento_mej', 'coworking', 'outro')
          and (
            (e.subarea_id is not null and public.is_leader_of(uid, e.subarea_id))
            or public.is_direx(uid)
          )
        )
      )
  );
$$;

drop policy events_select on public.events;
create policy events_select on public.events
  for select to authenticated
  using (
    exists (
      select 1 from public.meeting_types mt
      where mt.id = meeting_type_id
        and (
          mt.slug = 'rg'
          or (mt.slug = 'rd' and public.is_direx((select auth.uid())))
          or (mt.slug = 'rl' and public.is_lideranca((select auth.uid())))
          or (mt.slug = 'ra' and public.belongs_to_subarea((select auth.uid()), subarea_id))
          or (
            mt.slug in ('capacitacao', 'evento_mej', 'coworking', 'outro')
            and (
              subarea_id is null
              or public.belongs_to_subarea((select auth.uid()), subarea_id)
              or public.is_direx((select auth.uid()))
            )
          )
        )
    )
  );

drop policy events_insert on public.events;
create policy events_insert on public.events
  for insert to authenticated
  with check (
    criado_por = (select auth.uid())
    and cycle_id = public.current_cycle_id()
    and exists (
      select 1 from public.meeting_types mt
      where mt.id = meeting_type_id
        and (
          (mt.slug = 'ra' and public.is_leader_of((select auth.uid()), subarea_id))
          or (mt.slug in ('rg', 'rd', 'rl') and public.is_direx((select auth.uid())))
          or (
            mt.slug in ('capacitacao', 'evento_mej', 'coworking', 'outro')
            and (
              (subarea_id is not null and public.is_leader_of((select auth.uid()), subarea_id))
              or public.is_direx((select auth.uid()))
            )
          )
        )
    )
  );

-- ---------- 2) Avisos ----------
-- Apenas a Diretoria Executiva publica (antes: gerente+).
drop policy announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and cycle_id = public.current_cycle_id()
    and public.is_direx((select auth.uid()))
  );

alter table public.announcements add column link_url text;

create table public.announcement_attachments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  nome text not null,
  url text not null,
  tipo text not null default 'arquivo', -- imagem | arquivo
  created_at timestamptz not null default now()
);
create index announcement_attachments_announcement_idx
  on public.announcement_attachments (announcement_id);

alter table public.announcement_attachments enable row level security;
revoke all on public.announcement_attachments from anon;
grant select, insert, delete on public.announcement_attachments to authenticated;
grant all on public.announcement_attachments to service_role;

create policy announcement_attachments_select on public.announcement_attachments
  for select to authenticated using (true);

create policy announcement_attachments_insert on public.announcement_attachments
  for insert to authenticated
  with check (public.is_direx((select auth.uid())));

create policy announcement_attachments_delete on public.announcement_attachments
  for delete to authenticated
  using (public.is_direx((select auth.uid())));

-- Bucket público para anexos dos Avisos (upload restrito à Direx)
insert into storage.buckets (id, name, public)
values ('avisos', 'avisos', true)
on conflict (id) do nothing;

create policy avisos_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avisos' and public.is_direx((select auth.uid())));

create policy avisos_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'avisos');

create policy avisos_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avisos' and public.is_direx((select auth.uid())));
