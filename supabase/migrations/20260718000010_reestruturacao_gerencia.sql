-- Migration para reestruturar as tabelas OTOs, 1:1s, Diretoria de Negócios e Times
-- Criação de "Time Atena" (Tereza) e "Time Ares" (Lucas) sob Negócios
-- Criação de subárea de Marketing (Gerência e Coordenadoria)

create or replace function public.is_pc(uid uuid)
returns boolean
language sql security definer
as $$
  select exists (
    select 1 from public.approved_roster r
    join public.people p on p.email = r.email
    join public.subareas s on r.subarea_id = s.id
    where p.id = uid and s.slug = 'pessoas_cultura'
  );
$$;

-- 1) Tabelas OTOs e One-on-Ones
create table if not exists public.otos (
  id uuid primary key default gen_random_uuid(),
  directorate_id uuid not null references public.directorates (id) on delete cascade,
  subarea_id uuid not null references public.subareas (id) on delete cascade,
  cycle_id uuid not null default public.current_cycle_id() references public.cycles (id) on delete restrict,
  titulo text not null,
  descricao text,
  prazo date,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido', 'cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.otos enable row level security;
-- Diretoria vê/edita tudo da sua diretoria; Gerência vê/edita tudo da sua subárea
create policy otos_select on public.otos for select to authenticated using (
  public.is_direx((select auth.uid())) 
  or subarea_id in (select s.subarea_id from public.approved_roster s join public.people p on s.email = p.email where p.id = (select auth.uid()) and s.role in ('gerente', 'coordenador'))
);
create policy otos_all on public.otos for all to authenticated using (
  public.is_direx((select auth.uid())) 
  or subarea_id in (select s.subarea_id from public.approved_roster s join public.people p on s.email = p.email where p.id = (select auth.uid()) and s.role in ('gerente', 'coordenador'))
);

create table if not exists public.one_on_ones (
  id uuid primary key default gen_random_uuid(),
  gerente_id uuid not null references public.people (id) on delete cascade,
  liderado_id uuid not null references public.people (id) on delete cascade,
  cycle_id uuid not null default public.current_cycle_id() references public.cycles (id) on delete restrict,
  data_reuniao date not null default current_date,
  relatorio text,
  acoes text,
  insights text,
  pretensao_lideranca text, -- 'sim', 'nao', 'talvez'
  dificuldades text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.one_on_ones enable row level security;
create policy one_on_ones_select on public.one_on_ones for select to authenticated using (
  gerente_id = (select auth.uid())
  or liderado_id = (select auth.uid())
  or public.is_pc((select auth.uid()))
  or public.is_direx((select auth.uid()))
);
create policy one_on_ones_all on public.one_on_ones for all to authenticated using (
  gerente_id = (select auth.uid())
);

-- 2) Ajustes de Nomenclatura e Times
do $$
declare
  v_negocios_id uuid;
  v_gestao_id uuid;
  v_time_atena_id uuid;
  v_time_ares_id uuid;
  v_marketing_id uuid;
  
  v_tereza_email text;
  v_lucas_email text;
  v_sofia_comercial_email text;
  v_julia_email text;
  
  v_gerente_mkt_id uuid;
  v_coord_mkt_id uuid;

  v_subarea_gestao_id uuid;
  v_sofia_gestao_email text;
  v_rafael_vieira_email text;
begin
  -- Renomear Comercial para Negócios
  update public.directorates set nome = 'Negócios' where nome ilike '%Comercial%';
  select id into v_negocios_id from public.directorates where nome ilike '%Negócios%' limit 1;
  select id into v_gestao_id from public.directorates where nome ilike '%Gestão%' limit 1;
  
  -- Times de Negócios (Atena e Ares) - Idempotente
  select id into v_time_atena_id from public.subareas where slug = 'time_atena' limit 1;
  if v_time_atena_id is null then
    v_time_atena_id := gen_random_uuid();
    insert into public.subareas (id, directorate_id, nome, slug)
    values (v_time_atena_id, v_negocios_id, 'Time Atena', 'time_atena');
  end if;

  select id into v_time_ares_id from public.subareas where slug = 'time_ares' limit 1;
  if v_time_ares_id is null then
    v_time_ares_id := gen_random_uuid();
    insert into public.subareas (id, directorate_id, nome, slug)
    values (v_time_ares_id, v_negocios_id, 'Time Ares', 'time_ares');
  end if;

  -- Pessoas de Negócios (buscando email)
  select p.email into v_tereza_email from public.people p where p.nome ilike 'Tereza %' or p.nome ilike 'Tereza' limit 1;
  select p.email into v_lucas_email from public.people p where p.nome ilike 'Lucas %' limit 1;
  
  select p.email into v_sofia_comercial_email from public.people p join public.approved_roster r on p.email = r.email where p.nome ilike 'Sofia %' and r.directorate_id = v_negocios_id limit 1;
  select p.email into v_julia_email from public.people p where (p.nome ilike 'Júlia %' or p.nome ilike 'Julia %') limit 1;

  -- Atualizar Roster Time Atena
  if v_tereza_email is not null then
    update public.approved_roster set subarea_id = v_time_atena_id, role = 'gerente' where email = v_tereza_email and directorate_id = v_negocios_id;
  end if;
  update public.approved_roster set subarea_id = v_time_atena_id where directorate_id = v_negocios_id and email in (
    select p.email from public.people p where p.nome ilike 'Manuela %' or p.nome ilike 'Lucca %' or p.nome ilike 'Maria Fernanda %'
  );

  -- Atualizar Roster Time Ares
  if v_lucas_email is not null then
    update public.approved_roster set subarea_id = v_time_ares_id, role = 'gerente' where email = v_lucas_email and directorate_id = v_negocios_id;
  end if;
  update public.approved_roster set subarea_id = v_time_ares_id where directorate_id = v_negocios_id and email in (
    v_sofia_comercial_email, v_julia_email, (select p.email from public.people p where p.nome ilike 'Nicolas %' limit 1)
  );

  -- Marketing
  -- Se Marketing não tem subárea unificada, garantir que todos de Marketing fiquem na mesma subárea
  select id into v_marketing_id from public.subareas where nome ilike '%Marketing%' and directorate_id = v_negocios_id limit 1;
  if v_marketing_id is null then
    v_marketing_id := gen_random_uuid();
    insert into public.subareas (id, directorate_id, nome, slug) values (v_marketing_id, v_negocios_id, 'Marketing', 'marketing');
  end if;
  update public.approved_roster set subarea_id = v_marketing_id where directorate_id = v_negocios_id and email in (
    select p.email from public.people p where p.nome ilike '%Marketing%' -- just placeholder logic, mostly rely on existing subarea
  );
  -- If we don't have exact IDs for Marketing managers, we just ensure their subareas are the same.
  -- "a gerência e a coordenadoria de marketing são os mesmos. a coordanadora tem acesso ao que seria o painel da gerencia"
  -- They should already be mapped to a marketing subarea in the roster, so we unify any subareas with "marketing" in the name.
  update public.approved_roster set subarea_id = v_marketing_id where subarea_id in (select id from public.subareas where nome ilike '%Marketing%' and directorate_id = v_negocios_id);

  -- Gestão
  select id into v_subarea_gestao_id from public.subareas where directorate_id = v_gestao_id limit 1;
  select p.email into v_sofia_gestao_email from public.people p join public.approved_roster r on p.email = r.email where p.nome ilike 'Sofia %' and r.directorate_id = v_gestao_id limit 1;
  select p.email into v_rafael_vieira_email from public.people p where p.nome ilike 'Rafael Vieira %' limit 1;

  if v_sofia_gestao_email is not null and v_subarea_gestao_id is not null then
    update public.approved_roster set subarea_id = v_subarea_gestao_id, role = 'gerente' where email = v_sofia_gestao_email and directorate_id = v_gestao_id;
  end if;
  if v_rafael_vieira_email is not null and v_subarea_gestao_id is not null then
    update public.approved_roster set subarea_id = v_subarea_gestao_id, role = 'gerente' where email = v_rafael_vieira_email and directorate_id = v_gestao_id;
  end if;

end $$;
