-- ============================================================
-- BEV OS — Backend Refactor
-- Migration: system_settings e Desengessamento
-- Cria a tabela de configurações dinâmicas e remove restrições
-- hardcoded (engessadas) do banco de dados, delegando para API.
-- ============================================================

-- 1. Criação da tabela de configurações
create table if not exists public.system_settings (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  value jsonb not null,
  description text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.system_settings enable row level security;

-- Apenas membros ativos podem ler as configurações
create policy "Qualquer pessoa logada e ativa pode ler configurações"
  on public.system_settings for select
  using (
    exists (
      select 1 from public.occupations o
      join public.cycles c on o.cycle_id = c.id
      where o.person_id = auth.uid() and c.is_current = true
    )
  );

-- Apenas Diretores (e idealmente P&C no futuro) podem alterar configurações
create policy "Apenas Diretores podem editar configurações"
  on public.system_settings for all
  using (
    exists (
      select 1 from public.occupations o
      join public.cycles c on o.cycle_id = c.id
      where o.person_id = auth.uid() and c.is_current = true and o.role = 'diretor'
    )
  );

-- Seed de configurações padrão (que antes eram hardcoded)
insert into public.system_settings (key, value, description) values
  ('allow_hybrid_managers', 'false', 'Se ativo, gerentes e diretores podem ter vínculo híbrido (secundário).'),
  ('require_subarea_for_ra', 'true', 'Se ativo, Reuniões de Área (RA) exigem vínculo com uma subárea.'),
  ('only_leaders_can_complete_demands', 'true', 'Se ativo, apenas a liderança da área responsável pode concluir demandas do projeto.');


-- 2. Desengessamento: Remoção de Constraints rígidas da tabela Occupations
-- Removemos a regra rígida de banco de dados que impedia gerentes de serem híbridos
alter table public.occupations drop constraint if exists occupations_check;

-- Em versões mais robustas, o nome exato da constraint gerada pelo postgres pode variar
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.occupations'::regclass 
    AND pg_get_constraintdef(oid) ILIKE '%is_hibrido%'
  LOOP
    EXECUTE 'ALTER TABLE public.occupations DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;


-- 3. Desengessamento: Remoção ou substituição de Triggers de negócio (Eventos)
-- O trigger events_enforce_subarea bloqueava RA sem subárea e RG com subárea.
drop trigger if exists events_enforce_subarea on public.events;
drop function if exists public.check_event_subarea();

-- 4. Desengessamento: Remoção de Triggers de negócio (Demandas)
-- O trigger demands_enforce_rules verificava quem podia concluir demandas via SQL.
drop trigger if exists demands_enforce_rules on public.demands;
drop function if exists public.check_demand_rules();

-- (A lógica dessas funções agora será feita via Server Functions no TanStack Start, 
--  respeitando as configurações da system_settings).
