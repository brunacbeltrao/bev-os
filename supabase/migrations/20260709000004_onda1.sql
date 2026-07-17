-- ============================================================
-- BEV OS — Onda 1: Demandas, Agenda/Reuniões, Comunicados,
-- Bev News e Direx (ADD §3.1–3.4, §6 item 2)
-- ============================================================

-- ---------- Enums ----------
create type public.demand_status as enum ('a_fazer', 'em_andamento', 'em_revisao', 'concluido');
create type public.news_tipo as enum ('premiacao', 'vivencia', 'aniversario', 'outro');

-- ============================================================
-- Helpers adicionais (mesmo padrão SECURITY DEFINER do núcleo)
-- ============================================================

-- Liderança em qualquer occupation ativa (Diretor/Gerente/Coordenador)
create or replace function public.is_lideranca(uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.occupations o
    where o.person_id = uid
      and o.role in ('diretor', 'gerente', 'coordenador')
      and o.cycle_id = public.current_cycle_id()
  );
$$;

-- ============================================================
-- 3.1 Demandas
-- ============================================================
create table public.demands (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  tipo text,
  subarea_id uuid not null references public.subareas (id),
  status public.demand_status not null default 'a_fazer',
  prazo date,
  entregavel_url text,
  criado_por uuid not null references public.people (id),
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger demands_updated_at before update on public.demands
  for each row execute function public.set_updated_at();
create index demands_subarea_status_idx on public.demands (subarea_id, status);
create index demands_cycle_idx on public.demands (cycle_id);

create table public.demand_assignees (
  demand_id uuid not null references public.demands (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (demand_id, person_id)
);
create index demand_assignees_person_idx on public.demand_assignees (person_id);

create table public.demand_comments (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.demands (id) on delete cascade,
  autor_id uuid not null references public.people (id),
  texto text not null,
  created_at timestamptz not null default now()
);
create index demand_comments_demand_idx on public.demand_comments (demand_id);

-- Helpers de demanda
create or replace function public.can_see_demand(uid uuid, d_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.demands d
    where d.id = d_id
      and (public.belongs_to_subarea(uid, d.subarea_id) or public.is_direx(uid))
  );
$$;

create or replace function public.is_demand_assignee(uid uuid, d_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.demand_assignees a
    where a.demand_id = d_id and a.person_id = uid
  );
$$;

-- ADD §4: liderança da subárea da demanda
create or replace function public.can_manage_demand(uid uuid, d_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_leader_of(uid, (select d.subarea_id from public.demands d where d.id = d_id));
$$;

-- Regras de negócio via trigger (ADD §3.1 — não só na UI):
-- em_revisao exige entregavel_url; concluido só pela liderança da subárea.
create or replace function public.enforce_demand_rules()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'em_revisao'
     and (new.entregavel_url is null or length(trim(new.entregavel_url)) = 0) then
    raise exception 'BEV_OS_DEMANDA_SEM_ENTREGAVEL: para enviar à revisão é obrigatório anexar o link do entregável.';
  end if;
  if new.status = 'concluido'
     and (tg_op = 'INSERT' or old.status is distinct from 'concluido') then
    if not public.is_leader_of(auth.uid(), new.subarea_id) then
      raise exception 'BEV_OS_DEMANDA_CONCLUIR_LIDERANCA: apenas a liderança da área pode concluir uma demanda.';
    end if;
  end if;
  return new;
end;
$$;
create trigger demands_enforce_rules before insert or update on public.demands
  for each row execute function public.enforce_demand_rules();

-- ============================================================
-- 3.2 Agenda / Reuniões
-- ============================================================
create table public.meeting_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, -- rg | rd | rl | ra
  nome text not null
);

-- Seed fixo, não editável pela aplicação
insert into public.meeting_types (slug, nome) values
  ('rg', 'Reunião Geral'),
  ('rd', 'Reunião de Diretoria'),
  ('rl', 'Reunião de Lideranças'),
  ('ra', 'Reunião de Área');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  meeting_type_id uuid not null references public.meeting_types (id),
  subarea_id uuid references public.subareas (id), -- null para RG/RD/RL
  data timestamptz not null,
  pauta text,
  criado_por uuid not null references public.people (id),
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create index events_data_idx on public.events (data);
create index events_cycle_idx on public.events (cycle_id);

-- Consistência tipo × subárea: RA exige subárea; RG/RD/RL exigem null
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
create trigger events_enforce_subarea before insert or update on public.events
  for each row execute function public.enforce_event_subarea();

create table public.event_participants (
  event_id uuid not null references public.events (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, person_id)
);

create table public.meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  conteudo text not null default '', -- markdown
  criado_por uuid not null references public.people (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger meeting_minutes_updated_at before update on public.meeting_minutes
  for each row execute function public.set_updated_at();

create table public.minute_decisions (
  id uuid primary key default gen_random_uuid(),
  minute_id uuid not null references public.meeting_minutes (id) on delete cascade,
  descricao text not null,
  demand_id uuid references public.demands (id) on delete set null, -- decisão pode gerar demanda
  created_at timestamptz not null default now()
);
create index minute_decisions_minute_idx on public.minute_decisions (minute_id);

-- Helpers de evento: composição/quórum resolvidos lendo occupations
-- (RG = todos; RD = diretores; RL = lideranças; RA = todos da subárea)
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
      )
  );
$$;

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
      )
  );
$$;

-- ============================================================
-- 3.3 Comunicados
-- ============================================================
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  texto text not null,
  autor_id uuid not null references public.people (id), -- deve ser gerente+
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger announcements_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();
create index announcements_created_idx on public.announcements (created_at desc);

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, person_id)
);

-- ============================================================
-- 3.3b Bev News
-- ============================================================
create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.people (id),
  tipo public.news_tipo not null default 'outro',
  texto text not null,
  imagem_url text,
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger news_posts_updated_at before update on public.news_posts
  for each row execute function public.set_updated_at();
create index news_posts_created_idx on public.news_posts (created_at desc);

create table public.news_reactions (
  news_post_id uuid not null references public.news_posts (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  tipo text not null default 'curtida',
  created_at timestamptz not null default now(),
  primary key (news_post_id, person_id)
);

-- ============================================================
-- 3.4 Direx
-- ============================================================
create table public.direx_minutes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  data date not null default current_date,
  conteudo text not null default '', -- markdown
  criado_por uuid not null references public.people (id),
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger direx_minutes_updated_at before update on public.direx_minutes
  for each row execute function public.set_updated_at();

create table public.direx_decisions (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  decidido_em date not null default current_date,
  criado_por uuid not null references public.people (id),
  cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger direx_decisions_updated_at before update on public.direx_decisions
  for each row execute function public.set_updated_at();

-- VIEW derivada, sem dados sensíveis de atas — é o que o Gerente enxerga.
-- Gate embutido no WHERE: só diretor/gerente do ciclo vigente recebem linhas.
create view public.direx_summary_view as
select
  c.id as cycle_id,
  c.nome as cycle_nome,
  (select count(*) from public.direx_minutes m where m.cycle_id = c.id) as total_atas,
  (select max(m.data) from public.direx_minutes m where m.cycle_id = c.id) as ultima_rd,
  (select count(*) from public.direx_decisions d where d.cycle_id = c.id) as total_decisoes,
  (select max(d.decidido_em) from public.direx_decisions d where d.cycle_id = c.id) as ultima_decisao
from public.cycles c
where exists (
  select 1 from public.occupations o
  where o.person_id = auth.uid()
    and o.cycle_id = public.current_cycle_id()
    and o.role in ('diretor', 'gerente')
);

-- ============================================================
-- GRANTs de funções (EXECUTE revogado de PUBLIC/anon)
-- ============================================================
revoke execute on function public.is_lideranca(uuid) from public, anon;
revoke execute on function public.can_see_demand(uuid, uuid) from public, anon;
revoke execute on function public.is_demand_assignee(uuid, uuid) from public, anon;
revoke execute on function public.can_manage_demand(uuid, uuid) from public, anon;
revoke execute on function public.can_see_event(uuid, uuid) from public, anon;
revoke execute on function public.can_manage_event(uuid, uuid) from public, anon;

grant execute on function public.is_lideranca(uuid) to authenticated, service_role;
grant execute on function public.can_see_demand(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_demand_assignee(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_manage_demand(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_see_event(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_manage_event(uuid, uuid) to authenticated, service_role;

-- ============================================================
-- RLS + GRANTs por tabela
-- ============================================================

-- ---------- demands ----------
alter table public.demands enable row level security;
revoke all on public.demands from anon;
grant select, insert, update, delete on public.demands to authenticated;
grant all on public.demands to service_role;

create policy demands_select on public.demands
  for select to authenticated
  using (public.can_see_demand((select auth.uid()), id));

create policy demands_insert on public.demands
  for insert to authenticated
  with check (
    criado_por = (select auth.uid())
    and cycle_id = public.current_cycle_id()
    and (
      public.belongs_to_subarea((select auth.uid()), subarea_id)
      or public.is_leader_of((select auth.uid()), subarea_id)
    )
  );

-- Escrita bloqueada em ciclos anteriores (cycle_id = ciclo vigente)
create policy demands_update on public.demands
  for update to authenticated
  using (
    cycle_id = public.current_cycle_id()
    and (
      criado_por = (select auth.uid())
      or public.is_demand_assignee((select auth.uid()), id)
      or public.can_manage_demand((select auth.uid()), id)
    )
  )
  with check (cycle_id = public.current_cycle_id());

create policy demands_delete on public.demands
  for delete to authenticated
  using (
    cycle_id = public.current_cycle_id()
    and public.can_manage_demand((select auth.uid()), id)
  );

-- ---------- demand_assignees ----------
alter table public.demand_assignees enable row level security;
revoke all on public.demand_assignees from anon;
grant select, insert, delete on public.demand_assignees to authenticated;
grant all on public.demand_assignees to service_role;

create policy demand_assignees_select on public.demand_assignees
  for select to authenticated
  using (public.can_see_demand((select auth.uid()), demand_id));

create policy demand_assignees_insert on public.demand_assignees
  for insert to authenticated
  with check (
    exists (
      select 1 from public.demands d
      where d.id = demand_id
        and d.cycle_id = public.current_cycle_id()
        and (d.criado_por = (select auth.uid()) or public.can_manage_demand((select auth.uid()), d.id))
    )
  );

create policy demand_assignees_delete on public.demand_assignees
  for delete to authenticated
  using (
    exists (
      select 1 from public.demands d
      where d.id = demand_id
        and d.cycle_id = public.current_cycle_id()
        and (d.criado_por = (select auth.uid()) or public.can_manage_demand((select auth.uid()), d.id))
    )
  );

-- ---------- demand_comments ----------
alter table public.demand_comments enable row level security;
revoke all on public.demand_comments from anon;
grant select, insert on public.demand_comments to authenticated;
grant all on public.demand_comments to service_role;

create policy demand_comments_select on public.demand_comments
  for select to authenticated
  using (public.can_see_demand((select auth.uid()), demand_id));

create policy demand_comments_insert on public.demand_comments
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and public.can_see_demand((select auth.uid()), demand_id)
  );

-- ---------- meeting_types ----------
alter table public.meeting_types enable row level security;
revoke all on public.meeting_types from anon;
grant select on public.meeting_types to authenticated;
grant all on public.meeting_types to service_role;

create policy meeting_types_select on public.meeting_types
  for select to authenticated using (true);

-- ---------- events ----------
alter table public.events enable row level security;
revoke all on public.events from anon;
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;

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
        )
    )
  );

-- RA criada pela liderança da subárea; RG/RD/RL pela Direx
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
        )
    )
  );

create policy events_update on public.events
  for update to authenticated
  using (
    cycle_id = public.current_cycle_id()
    and public.can_manage_event((select auth.uid()), id)
  )
  with check (cycle_id = public.current_cycle_id());

create policy events_delete on public.events
  for delete to authenticated
  using (
    cycle_id = public.current_cycle_id()
    and public.can_manage_event((select auth.uid()), id)
  );

-- ---------- event_participants ----------
alter table public.event_participants enable row level security;
revoke all on public.event_participants from anon;
grant select, insert, delete on public.event_participants to authenticated;
grant all on public.event_participants to service_role;

create policy event_participants_select on public.event_participants
  for select to authenticated
  using (public.can_see_event((select auth.uid()), event_id));

create policy event_participants_insert on public.event_participants
  for insert to authenticated
  with check (public.can_manage_event((select auth.uid()), event_id));

create policy event_participants_delete on public.event_participants
  for delete to authenticated
  using (public.can_manage_event((select auth.uid()), event_id));

-- ---------- meeting_minutes ----------
alter table public.meeting_minutes enable row level security;
revoke all on public.meeting_minutes from anon;
grant select, insert, update on public.meeting_minutes to authenticated;
grant all on public.meeting_minutes to service_role;

create policy meeting_minutes_select on public.meeting_minutes
  for select to authenticated
  using (public.can_see_event((select auth.uid()), event_id));

create policy meeting_minutes_insert on public.meeting_minutes
  for insert to authenticated
  with check (
    criado_por = (select auth.uid())
    and public.can_manage_event((select auth.uid()), event_id)
  );

create policy meeting_minutes_update on public.meeting_minutes
  for update to authenticated
  using (public.can_manage_event((select auth.uid()), event_id))
  with check (public.can_manage_event((select auth.uid()), event_id));

-- ---------- minute_decisions ----------
alter table public.minute_decisions enable row level security;
revoke all on public.minute_decisions from anon;
grant select, insert, update, delete on public.minute_decisions to authenticated;
grant all on public.minute_decisions to service_role;

create policy minute_decisions_select on public.minute_decisions
  for select to authenticated
  using (
    public.can_see_event(
      (select auth.uid()),
      (select mm.event_id from public.meeting_minutes mm where mm.id = minute_id)
    )
  );

create policy minute_decisions_insert on public.minute_decisions
  for insert to authenticated
  with check (
    public.can_manage_event(
      (select auth.uid()),
      (select mm.event_id from public.meeting_minutes mm where mm.id = minute_id)
    )
  );

create policy minute_decisions_update on public.minute_decisions
  for update to authenticated
  using (
    public.can_manage_event(
      (select auth.uid()),
      (select mm.event_id from public.meeting_minutes mm where mm.id = minute_id)
    )
  );

create policy minute_decisions_delete on public.minute_decisions
  for delete to authenticated
  using (
    public.can_manage_event(
      (select auth.uid()),
      (select mm.event_id from public.meeting_minutes mm where mm.id = minute_id)
    )
  );

-- ---------- announcements ----------
alter table public.announcements enable row level security;
revoke all on public.announcements from anon;
grant select, insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;

create policy announcements_select on public.announcements
  for select to authenticated using (true);

-- RLS de INSERT: autor precisa ser liderança (gerente/coordenador/diretor)
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and cycle_id = public.current_cycle_id()
    and public.is_lideranca((select auth.uid()))
  );

create policy announcements_update on public.announcements
  for update to authenticated
  using (
    cycle_id = public.current_cycle_id()
    and (autor_id = (select auth.uid()) or public.is_direx((select auth.uid())))
  )
  with check (cycle_id = public.current_cycle_id());

create policy announcements_delete on public.announcements
  for delete to authenticated
  using (
    cycle_id = public.current_cycle_id()
    and (autor_id = (select auth.uid()) or public.is_direx((select auth.uid())))
  );

-- ---------- announcement_reads ----------
alter table public.announcement_reads enable row level security;
revoke all on public.announcement_reads from anon;
grant select, insert on public.announcement_reads to authenticated;
grant all on public.announcement_reads to service_role;

create policy announcement_reads_select on public.announcement_reads
  for select to authenticated using (true);

create policy announcement_reads_insert on public.announcement_reads
  for insert to authenticated
  with check (person_id = (select auth.uid()));

-- ---------- news_posts (qualquer membro publica — sem hierarquia) ----------
alter table public.news_posts enable row level security;
revoke all on public.news_posts from anon;
grant select, insert, update, delete on public.news_posts to authenticated;
grant all on public.news_posts to service_role;

create policy news_posts_select on public.news_posts
  for select to authenticated using (true);

create policy news_posts_insert on public.news_posts
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and cycle_id = public.current_cycle_id()
  );

create policy news_posts_update on public.news_posts
  for update to authenticated
  using (autor_id = (select auth.uid()) and cycle_id = public.current_cycle_id())
  with check (autor_id = (select auth.uid()) and cycle_id = public.current_cycle_id());

create policy news_posts_delete on public.news_posts
  for delete to authenticated
  using (autor_id = (select auth.uid()) and cycle_id = public.current_cycle_id());

-- ---------- news_reactions ----------
alter table public.news_reactions enable row level security;
revoke all on public.news_reactions from anon;
grant select, insert, delete on public.news_reactions to authenticated;
grant all on public.news_reactions to service_role;

create policy news_reactions_select on public.news_reactions
  for select to authenticated using (true);

create policy news_reactions_insert on public.news_reactions
  for insert to authenticated
  with check (person_id = (select auth.uid()));

create policy news_reactions_delete on public.news_reactions
  for delete to authenticated
  using (person_id = (select auth.uid()));

-- ---------- direx_minutes (acesso total restrito a role=diretor) ----------
alter table public.direx_minutes enable row level security;
revoke all on public.direx_minutes from anon;
grant select, insert, update, delete on public.direx_minutes to authenticated;
grant all on public.direx_minutes to service_role;

create policy direx_minutes_select on public.direx_minutes
  for select to authenticated
  using (public.is_direx((select auth.uid())));

create policy direx_minutes_insert on public.direx_minutes
  for insert to authenticated
  with check (
    criado_por = (select auth.uid())
    and cycle_id = public.current_cycle_id()
    and public.is_direx((select auth.uid()))
  );

create policy direx_minutes_update on public.direx_minutes
  for update to authenticated
  using (public.is_direx((select auth.uid())) and cycle_id = public.current_cycle_id())
  with check (cycle_id = public.current_cycle_id());

create policy direx_minutes_delete on public.direx_minutes
  for delete to authenticated
  using (public.is_direx((select auth.uid())) and cycle_id = public.current_cycle_id());

-- ---------- direx_decisions ----------
alter table public.direx_decisions enable row level security;
revoke all on public.direx_decisions from anon;
grant select, insert, update, delete on public.direx_decisions to authenticated;
grant all on public.direx_decisions to service_role;

create policy direx_decisions_select on public.direx_decisions
  for select to authenticated
  using (public.is_direx((select auth.uid())));

create policy direx_decisions_insert on public.direx_decisions
  for insert to authenticated
  with check (
    criado_por = (select auth.uid())
    and cycle_id = public.current_cycle_id()
    and public.is_direx((select auth.uid()))
  );

create policy direx_decisions_update on public.direx_decisions
  for update to authenticated
  using (public.is_direx((select auth.uid())) and cycle_id = public.current_cycle_id())
  with check (cycle_id = public.current_cycle_id());

create policy direx_decisions_delete on public.direx_decisions
  for delete to authenticated
  using (public.is_direx((select auth.uid())) and cycle_id = public.current_cycle_id());

-- ---------- direx_summary_view ----------
revoke all on public.direx_summary_view from anon, public;
grant select on public.direx_summary_view to authenticated, service_role;
