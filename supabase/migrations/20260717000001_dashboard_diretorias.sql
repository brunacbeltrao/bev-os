-- ============================================================
-- BEV OS — Dashboard por diretoria (2026-07-17)
--
-- Reformula a aba Dashboards em um painel consolidado por diretoria,
-- visível a todos os membros. Cada diretoria edita a própria seção.
--
-- Este migration cria:
--  · helper can_edit_dir_metrics(uid, dir_slug)
--  · núcleo Nabuco (Capiba/Suassuna já existem)
--  · catálogo project_services (14) + projects.servico_id
--  · série mensal do Brasil Júnior (faturamento_mensal) + seed 2026
--  · tabelas de KPI editáveis por diretoria (por ciclo)
--  · funções agregadas security definer para leitura do painel
-- ============================================================

begin;

-- ---------- Helper: quem pode editar as métricas de uma diretoria ----------
create or replace function public.can_edit_dir_metrics(uid uuid, dir_slug text)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_direx(uid) or exists (
    select 1
    from public.occupations o
    join public.directorates d on d.id = o.directorate_id
    where o.person_id = uid
      and o.cycle_id = public.current_cycle_id()
      and o.role in ('diretor','gerente','coordenador')
      and d.slug = dir_slug
  );
$$;
revoke execute on function public.can_edit_dir_metrics(uuid, text) from public, anon;
grant execute on function public.can_edit_dir_metrics(uuid, text) to authenticated, service_role;

-- ---------- Núcleo Nabuco ----------
insert into public.project_nucleos (directorate_id, slug, nome)
select d.id, 'nabuco', 'Nabuco' from public.directorates d where d.slug = 'projetos'
on conflict (slug) do nothing;

-- ---------- Catálogo de serviços de Projetos ----------
create table if not exists public.project_services (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,
  ordem int not null default 0
);
alter table public.project_services enable row level security;
revoke all on public.project_services from anon;
grant select on public.project_services to authenticated;
grant all on public.project_services to service_role;
drop policy if exists project_services_select on public.project_services;
create policy project_services_select on public.project_services for select to authenticated using (true);

insert into public.project_services (slug, nome, ordem) values
  ('abertura_cnpj','Abertura de CNPJ',1),
  ('contratos','Revisão e Elaboração de Contratos',2),
  ('registro_marca','Registro de Marca',3),
  ('lgpd','Adequação à LGPD',4),
  ('consultoria_juridica','Consultoria Jurídica',5),
  ('parecer','Parecer Jurídico',6),
  ('regimento','Elaboração de Regimento Interno',7),
  ('estatuto','Revisão e Elaboração do Estatuto Social',8),
  ('atas','Revisão e Elaboração de Atas',9),
  ('mou','MoU',10),
  ('nda','NDA',11),
  ('termos','Elaboração de Termos',12),
  ('termos_uso_priv','Termos de Uso e Política de Privacidade',13),
  ('assessoria_juridica','Assessoria Jurídica',14)
on conflict (slug) do nothing;

-- ---------- Campo serviço no projeto ----------
alter table public.projects add column if not exists servico_id uuid references public.project_services(id);

-- ---------- Série mensal Brasil Júnior (por ano-calendário) ----------
create table if not exists public.faturamento_mensal (
  id uuid primary key default gen_random_uuid(),
  ano int not null,
  mes int not null check (mes between 1 and 12),
  meta numeric(14,2) not null,
  realizado numeric(14,2),
  updated_at timestamptz not null default now(),
  unique (ano, mes)
);
alter table public.faturamento_mensal enable row level security;
revoke all on public.faturamento_mensal from anon;
grant select on public.faturamento_mensal to authenticated;
grant all on public.faturamento_mensal to service_role;
drop policy if exists fatmensal_select on public.faturamento_mensal;
drop policy if exists fatmensal_insert on public.faturamento_mensal;
drop policy if exists fatmensal_update on public.faturamento_mensal;
create policy fatmensal_select on public.faturamento_mensal for select to authenticated using (true);
create policy fatmensal_insert on public.faturamento_mensal for insert to authenticated
  with check (public.can_edit_dir_metrics((select auth.uid()), 'negocios'));
create policy fatmensal_update on public.faturamento_mensal for update to authenticated
  using (public.can_edit_dir_metrics((select auth.uid()), 'negocios'))
  with check (public.can_edit_dir_metrics((select auth.uid()), 'negocios'));

insert into public.faturamento_mensal (ano, mes, meta, realizado) values
  (2026,1,7003.04,7400),
  (2026,2,14006.08,11500),
  (2026,3,21009.13,12750),
  (2026,4,28012.17,15130),
  (2026,5,35015.21,28749),
  (2026,6,42018.25,28749),
  (2026,7,49021.29,28749),
  (2026,8,56024.33,33288.67),
  (2026,9,63027.37,null),
  (2026,10,70030.42,null),
  (2026,11,77033.46,null),
  (2026,12,84036.50,null)
on conflict (ano,mes) do nothing;

-- ============================================================
-- Tabelas de KPI editáveis por diretoria (uma linha por ciclo)
-- Padrão de RLS: SELECT liberado a todos; INSERT/UPDATE por diretoria.
-- ============================================================

-- Negócios: metas de ticket e conversão
create table if not exists public.negocios_indicadores (
  cycle_id uuid primary key references public.cycles(id) default public.current_cycle_id(),
  ticket_medio_meta numeric(14,2) not null default 2800,
  conversao_meta numeric(5,4) not null default 0.40,
  updated_at timestamptz not null default now()
);
alter table public.negocios_indicadores enable row level security;
revoke all on public.negocios_indicadores from anon;
grant select on public.negocios_indicadores to authenticated;
grant all on public.negocios_indicadores to service_role;
drop policy if exists negind_select on public.negocios_indicadores;
drop policy if exists negind_insert on public.negocios_indicadores;
drop policy if exists negind_update on public.negocios_indicadores;
create policy negind_select on public.negocios_indicadores for select to authenticated using (true);
create policy negind_insert on public.negocios_indicadores for insert to authenticated
  with check (public.can_edit_dir_metrics((select auth.uid()), 'negocios'));
create policy negind_update on public.negocios_indicadores for update to authenticated
  using (public.can_edit_dir_metrics((select auth.uid()), 'negocios'))
  with check (public.can_edit_dir_metrics((select auth.uid()), 'negocios'));

-- Gestão: reserva/meta de caixa
create table if not exists public.financeiro_meta (
  cycle_id uuid primary key references public.cycles(id) default public.current_cycle_id(),
  reserva_minima numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.financeiro_meta enable row level security;
revoke all on public.financeiro_meta from anon;
grant select on public.financeiro_meta to authenticated;
grant all on public.financeiro_meta to service_role;
drop policy if exists finmeta_select on public.financeiro_meta;
drop policy if exists finmeta_insert on public.financeiro_meta;
drop policy if exists finmeta_update on public.financeiro_meta;
create policy finmeta_select on public.financeiro_meta for select to authenticated using (true);
create policy finmeta_insert on public.financeiro_meta for insert to authenticated
  with check (public.can_edit_dir_metrics((select auth.uid()), 'gestao'));
create policy finmeta_update on public.financeiro_meta for update to authenticated
  using (public.can_edit_dir_metrics((select auth.uid()), 'gestao'))
  with check (public.can_edit_dir_metrics((select auth.uid()), 'gestao'));

-- P&C: eNPS / clima
create table if not exists public.pc_indicadores (
  cycle_id uuid primary key references public.cycles(id) default public.current_cycle_id(),
  enps numeric(6,2),
  updated_at timestamptz not null default now()
);
alter table public.pc_indicadores enable row level security;
revoke all on public.pc_indicadores from anon;
grant select on public.pc_indicadores to authenticated;
grant all on public.pc_indicadores to service_role;
drop policy if exists pcind_select on public.pc_indicadores;
drop policy if exists pcind_insert on public.pc_indicadores;
drop policy if exists pcind_update on public.pc_indicadores;
create policy pcind_select on public.pc_indicadores for select to authenticated using (true);
create policy pcind_insert on public.pc_indicadores for insert to authenticated
  with check (public.can_edit_dir_metrics((select auth.uid()), 'pessoas_cultura'));
create policy pcind_update on public.pc_indicadores for update to authenticated
  using (public.can_edit_dir_metrics((select auth.uid()), 'pessoas_cultura'))
  with check (public.can_edit_dir_metrics((select auth.uid()), 'pessoas_cultura'));

-- Institucional: colaborativo + engajamento MEJ
create table if not exists public.institucional_indicadores (
  cycle_id uuid primary key references public.cycles(id) default public.current_cycle_id(),
  colab_realizado numeric(14,2) not null default 0,
  colab_meta numeric(14,2) not null default 21475.95,
  colab_ej int not null default 0,
  colab_ej_meta int not null default 1,
  colab_agentes int not null default 0,
  colab_agentes_meta int not null default 2,
  superavit numeric(14,2) not null default -18199.96,
  engajamento_mej numeric(5,2),
  updated_at timestamptz not null default now()
);
alter table public.institucional_indicadores enable row level security;
revoke all on public.institucional_indicadores from anon;
grant select on public.institucional_indicadores to authenticated;
grant all on public.institucional_indicadores to service_role;
drop policy if exists instind_select on public.institucional_indicadores;
drop policy if exists instind_insert on public.institucional_indicadores;
drop policy if exists instind_update on public.institucional_indicadores;
create policy instind_select on public.institucional_indicadores for select to authenticated using (true);
create policy instind_insert on public.institucional_indicadores for insert to authenticated
  with check (public.can_edit_dir_metrics((select auth.uid()), 'institucional'));
create policy instind_update on public.institucional_indicadores for update to authenticated
  using (public.can_edit_dir_metrics((select auth.uid()), 'institucional'))
  with check (public.can_edit_dir_metrics((select auth.uid()), 'institucional'));

-- Geral BEV (Portal BJ): CSAT + projeto de impacto — só Direx edita
create table if not exists public.bev_indicadores (
  cycle_id uuid primary key references public.cycles(id) default public.current_cycle_id(),
  csat numeric(6,2),
  projeto_impacto text,
  updated_at timestamptz not null default now()
);
alter table public.bev_indicadores enable row level security;
revoke all on public.bev_indicadores from anon;
grant select on public.bev_indicadores to authenticated;
grant all on public.bev_indicadores to service_role;
drop policy if exists bevind_select on public.bev_indicadores;
drop policy if exists bevind_insert on public.bev_indicadores;
drop policy if exists bevind_update on public.bev_indicadores;
create policy bevind_select on public.bev_indicadores for select to authenticated using (true);
create policy bevind_insert on public.bev_indicadores for insert to authenticated
  with check (public.is_direx((select auth.uid())));
create policy bevind_update on public.bev_indicadores for update to authenticated
  using (public.is_direx((select auth.uid())))
  with check (public.is_direx((select auth.uid())));

-- ============================================================
-- Funções agregadas (security definer) — leitura do painel.
-- Retornam apenas números agregados; liberadas a todos os membros.
-- ============================================================

-- Financeiro do ciclo atual
create or replace function public.dashboard_financeiro()
returns table(saldo numeric, entradas numeric, saidas numeric)
language sql security definer set search_path = public stable as $$
  select
    coalesce(sum(case when tipo='entrada' then valor else -valor end),0),
    coalesce(sum(case when tipo='entrada' then valor else 0 end),0),
    coalesce(sum(case when tipo='saida' then valor else 0 end),0)
  from public.finance_entries
  where cycle_id = public.current_cycle_id();
$$;

-- Negócios: ticket médio + conversão do ciclo atual
create or replace function public.dashboard_negocios()
returns table(ticket_medio numeric, conversao numeric, fechados int, total int)
language sql security definer set search_path = public stable as $$
  select
    coalesce(avg(valor_fechado) filter (where etapa_atual='fechado'),0),
    case when count(*)=0 then 0
         else count(*) filter (where etapa_atual='fechado')::numeric / count(*) end,
    count(*) filter (where etapa_atual='fechado')::int,
    count(*)::int
  from public.leads
  where cycle_id = public.current_cycle_id();
$$;

-- PDI do ciclo atual
create or replace function public.dashboard_pdi()
returns table(abertos int, concluidos int, em_risco int)
language sql security definer set search_path = public stable as $$
  select
    (select count(*)::int from public.pdi_plans
       where cycle_id = public.current_cycle_id()),
    (select count(*)::int from public.pdi_plans
       where cycle_id = public.current_cycle_id() and lider_submetido),
    (select count(*)::int
       from public.approved_roster r
       join public.people p on lower(p.email) = r.email
       left join public.pdi_plans pl on pl.person_id = p.id and pl.cycle_id = r.cycle_id
       where r.cycle_id = public.current_cycle_id()
         and (
           pl.id is null
           or pl.updated_at < now() - interval '30 days'
           or exists (
             select 1 from public.agravos a
             where a.person_id = p.id and a.created_at > now() - interval '60 days'
           )
         ));
$$;

-- Projetos em andamento por serviço (ciclo atual)
create or replace function public.dashboard_projetos_servico()
returns table(servico_id uuid, nome text, total int)
language sql security definer set search_path = public stable as $$
  select s.id, s.nome, count(pr.id)::int
  from public.project_services s
  left join public.projects pr
    on pr.servico_id = s.id
   and pr.status = 'em_andamento'
   and pr.cycle_id = public.current_cycle_id()
  group by s.id, s.nome, s.ordem
  order by s.ordem;
$$;

-- Projetos em andamento por núcleo (ciclo atual)
create or replace function public.dashboard_projetos_nucleo()
returns table(nucleo_id uuid, nome text, total int)
language sql security definer set search_path = public stable as $$
  select n.id, n.nome, count(pr.id)::int
  from public.project_nucleos n
  left join public.projects pr
    on pr.nucleo_id = n.id
   and pr.status = 'em_andamento'
   and pr.cycle_id = public.current_cycle_id()
  group by n.id, n.nome
  order by n.nome;
$$;

-- Resumo de projetos (total em andamento e sem classificação)
create or replace function public.dashboard_projetos_resumo()
returns table(total int, sem_servico int, sem_nucleo int)
language sql security definer set search_path = public stable as $$
  select
    count(*)::int,
    count(*) filter (where servico_id is null)::int,
    count(*) filter (where nucleo_id is null)::int
  from public.projects
  where status = 'em_andamento' and cycle_id = public.current_cycle_id();
$$;

revoke execute on function public.dashboard_financeiro() from public, anon;
revoke execute on function public.dashboard_negocios() from public, anon;
revoke execute on function public.dashboard_pdi() from public, anon;
revoke execute on function public.dashboard_projetos_servico() from public, anon;
revoke execute on function public.dashboard_projetos_nucleo() from public, anon;
revoke execute on function public.dashboard_projetos_resumo() from public, anon;
grant execute on function public.dashboard_financeiro() to authenticated, service_role;
grant execute on function public.dashboard_negocios() to authenticated, service_role;
grant execute on function public.dashboard_pdi() to authenticated, service_role;
grant execute on function public.dashboard_projetos_servico() to authenticated, service_role;
grant execute on function public.dashboard_projetos_nucleo() to authenticated, service_role;
grant execute on function public.dashboard_projetos_resumo() to authenticated, service_role;

commit;
