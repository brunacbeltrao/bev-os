-- ============================================================
-- BEV OS — PDI Completo (compilado de P&C). 6 seções: perfil,
-- visão, competências + gráfico situacional, metas ricas, 1:1s,
-- avaliação final com revelação cega. + catálogo de competências,
-- scores, notas de liderança restritas, P&C responsável designado.
-- Segurança: campos ultrassensíveis (engajamento percebido,
-- potencial PDL) em pdi_leadership_notes (só liderança/P&C leem).
-- P&C passa a ver/gerenciar PDIs de toda a EJ (auditora/facilitadora).
-- ============================================================

-- status de meta mais rico (ADD VALUE não pode rodar dentro de transação)
alter type public.pdi_goal_status add value if not exists 'em_andamento';
alter type public.pdi_goal_status add value if not exists 'cancelada';

begin;

-- ---------- pdi_plans: novas colunas ----------
alter table public.pdi_plans
  add column if not exists situacao_estagio text,
  add column if not exists disponibilidade_horas int,
  add column if not exists aspiracao text,
  add column if not exists motivacao text,
  add column if not exists onde_chegar text,
  add column if not exists validacao_lideranca text,
  add column if not exists pc_responsavel_id uuid references public.people (id),
  add column if not exists pdia_link text,
  add column if not exists quadrante text,
  -- fechamento: autoavaliação (visível ao membro)
  add column if not exists auto_desenvolvi text,
  add column if not exists auto_nao_avancou text,
  add column if not exists auto_nota int,
  add column if not exists auto_justificativa text,
  add column if not exists auto_proximo text,
  add column if not exists auto_submetido boolean not null default false,
  -- fechamento: avaliação da liderança (revelada só após ambos submeterem)
  add column if not exists lider_avaliacao_geral text,
  add column if not exists lider_nota int,
  add column if not exists lider_recomendacoes text,
  add column if not exists lider_submetido boolean not null default false;

-- ---------- pdi_goals: metas ricas ----------
alter table public.pdi_goals
  add column if not exists criterio_sucesso text,
  add column if not exists indicador text,
  add column if not exists prazo date,
  add column if not exists competency_id uuid,
  add column if not exists comentario_lideranca text,
  add column if not exists fonte text; -- pdi | pdia | ambos

-- ---------- pdi_checkins: 1:1 estruturada ----------
alter table public.pdi_checkins
  add column if not exists tipo text,          -- pc_bimestral | area_bimestral | extra
  add column if not exists encaminhamentos text,
  add column if not exists quadrante text;      -- D1..D4 no momento

-- ---------- Catálogo de competências ----------
create table if not exists public.competencies (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null,           -- comportamental | lideranca | tecnica
  subarea_id uuid references public.subareas (id), -- só para técnicas
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.competencies enable row level security;
revoke all on public.competencies from anon;
grant select on public.competencies to authenticated;
grant all on public.competencies to service_role;
create policy competencies_select on public.competencies for select to authenticated using (true);

-- seed (idempotente)
do $$
begin
  if not exists (select 1 from public.competencies) then
    insert into public.competencies (nome, categoria, subarea_id, ordem)
    -- comportamentais (comuns)
    select * from (values
      ('Responsabilidade e entrega','comportamental',null::uuid,1),
      ('Comunicação ativa','comportamental',null,2),
      ('Sentimento de dono','comportamental',null,3),
      ('Coerência cultural','comportamental',null,4),
      ('Aprendizado contínuo','comportamental',null,5),
      ('Colaboração entre áreas','comportamental',null,6),
      ('Desenvolvimento de pessoas','lideranca',null,7),
      ('Tomada de decisão','lideranca',null,8),
      ('Visão estratégica','lideranca',null,9)
    ) as v(nome,categoria,subarea_id,ordem);

    -- técnicas por subárea
    insert into public.competencies (nome, categoria, subarea_id, ordem)
    select v.nome,'tecnica', s.id, v.ordem
    from (values
      ('Condução de 1:1','pessoas_cultura',1),
      ('Aplicação e análise de NPS','pessoas_cultura',2),
      ('Gestão do sistema de advertências','pessoas_cultura',3),
      ('Organização de eventos','pessoas_cultura',4),
      ('Comunicação interna','pessoas_cultura',5),
      ('Elaboração de contratos e pareceres','projetos',1),
      ('Gestão de prazos com cliente','projetos',2),
      ('Controle de qualidade técnica','projetos',3),
      ('Prospecção ativa','comercial',1),
      ('Diagnóstico com SPIN Selling','comercial',2),
      ('Gestão do CRM','comercial',3),
      ('Elaboração de proposta comercial','comercial',4),
      ('Gestão de calendário editorial','marketing',1),
      ('Produção de conteúdo jurídico','marketing',2),
      ('Análise de métricas de engajamento','marketing',3),
      ('Análise financeira','gestao',1),
      ('Controle de contratos','gestao',2),
      ('Gestão de documentação legal','gestao',3),
      ('Automação de relatórios','gestao',4),
      ('Prospecção de parcerias','institucional',1),
      ('Relacionamento com stakeholders do MEJ','institucional',2),
      ('Representação institucional','institucional',3)
    ) as v(nome,slug,ordem)
    join public.subareas s on s.slug = v.slug;
  end if;
end $$;

-- ---------- Scores de competência (histórico por 1:1) ----------
create table if not exists public.pdi_competency_scores (
  id uuid primary key default gen_random_uuid(),
  pdi_plan_id uuid not null references public.pdi_plans (id) on delete cascade,
  competency_id uuid not null references public.competencies (id),
  nota int not null check (nota between 1 and 4),
  avaliador_id uuid not null references public.people (id),
  data date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.pdi_competency_scores enable row level security;
revoke all on public.pdi_competency_scores from anon;
grant select, insert, update, delete on public.pdi_competency_scores to authenticated;
grant all on public.pdi_competency_scores to service_role;
create policy pcs_select on public.pdi_competency_scores for select to authenticated
  using (public.can_see_pdi((select auth.uid()), pdi_plan_id));
create policy pcs_insert on public.pdi_competency_scores for insert to authenticated
  with check (public.can_manage_pdi((select auth.uid()), pdi_plan_id));
create policy pcs_update on public.pdi_competency_scores for update to authenticated
  using (public.can_manage_pdi((select auth.uid()), pdi_plan_id));
create policy pcs_delete on public.pdi_competency_scores for delete to authenticated
  using (public.can_manage_pdi((select auth.uid()), pdi_plan_id));

-- ---------- Notas de liderança (restritas — o membro NÃO lê) ----------
create table if not exists public.pdi_leadership_notes (
  pdi_plan_id uuid primary key references public.pdi_plans (id) on delete cascade,
  engajamento int,            -- 1..5 percebido
  potencial_pdl text,         -- sim | a_desenvolver | nao
  updated_at timestamptz not null default now()
);
create trigger pdi_leadership_notes_updated_at before update on public.pdi_leadership_notes
  for each row execute function public.set_updated_at();
alter table public.pdi_leadership_notes enable row level security;
revoke all on public.pdi_leadership_notes from anon;
grant select, insert, update, delete on public.pdi_leadership_notes to authenticated;
grant all on public.pdi_leadership_notes to service_role;
-- can_manage_pdi NÃO inclui o próprio membro → ele não vê estas notas
create policy pln_select on public.pdi_leadership_notes for select to authenticated
  using (public.can_manage_pdi((select auth.uid()), pdi_plan_id));
create policy pln_write on public.pdi_leadership_notes for insert to authenticated
  with check (public.can_manage_pdi((select auth.uid()), pdi_plan_id));
create policy pln_update on public.pdi_leadership_notes for update to authenticated
  using (public.can_manage_pdi((select auth.uid()), pdi_plan_id));

-- ---------- P&C passa a ver/gerenciar PDIs de toda a EJ ----------
-- (auditora/facilitadora) + o P&C responsável designado por plano.
create or replace function public.can_see_pdi(uid uuid, plan_id uuid)
returns boolean language sql security definer set search_path = public stable as $fn$
  select exists (
    select 1 from public.pdi_plans pl
    where pl.id = plan_id
      and (
        pl.person_id = uid or pl.avaliador_id = uid or pl.pc_responsavel_id = uid
        or public.is_leader_of(uid, public.pc_subarea_id())
        or exists (
          select 1 from public.occupations o
          where o.person_id = pl.person_id
            and o.cycle_id = public.current_cycle_id()
            and public.is_leader_of(uid, o.subarea_id)
        )
      )
  );
$fn$;

create or replace function public.can_manage_pdi(uid uuid, plan_id uuid)
returns boolean language sql security definer set search_path = public stable as $fn$
  select exists (
    select 1 from public.pdi_plans pl
    where pl.id = plan_id
      and (
        pl.avaliador_id = uid or pl.pc_responsavel_id = uid
        or public.is_leader_of(uid, public.pc_subarea_id())
        or exists (
          select 1 from public.occupations o
          where o.person_id = pl.person_id
            and o.cycle_id = public.current_cycle_id()
            and public.is_leader_of(uid, o.subarea_id)
        )
      )
  );
$fn$;

-- ---------- Membro pode criar/editar o PRÓPRIO plano e metas ----------
-- (perfil, visão, autoavaliação, status/evidência) — a UI limita quais campos.
alter table public.pdi_plans alter column avaliador_id drop not null;

create policy pdi_plans_insert_self on public.pdi_plans
  for insert to authenticated
  with check (person_id = (select auth.uid()) and cycle_id = public.current_cycle_id());

create policy pdi_plans_update_self on public.pdi_plans
  for update to authenticated
  using (person_id = (select auth.uid()) and cycle_id = public.current_cycle_id())
  with check (person_id = (select auth.uid()) and cycle_id = public.current_cycle_id());

create policy pdi_goals_update_self on public.pdi_goals
  for update to authenticated
  using (
    exists (
      select 1 from public.pdi_plans pl
      where pl.id = pdi_plan_id and pl.person_id = (select auth.uid())
    )
  );

commit;
