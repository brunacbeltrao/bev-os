-- Migração 20260718000002_direx.sql
-- Adicionando estrutura da Central da Direx (Inbox, Kanban, Decisões)

-- 1. Melhorar direx_decisions com os campos do ADD
ALTER TABLE public.direx_decisions 
ADD COLUMN IF NOT EXISTS contexto text,
ADD COLUMN IF NOT EXISTS problema text,
ADD COLUMN IF NOT EXISTS alternativas text,
ADD COLUMN IF NOT EXISTS decisao_final text,
ADD COLUMN IF NOT EXISTS justificativa text,
ADD COLUMN IF NOT EXISTS tipo_resolucao text default 'consenso',
ADD COLUMN IF NOT EXISTS impactos_esperados text,
ADD COLUMN IF NOT EXISTS revisao_prevista date,
ADD COLUMN IF NOT EXISTS status text not null default 'vigente',
ADD COLUMN IF NOT EXISTS reuniao_id uuid references public.meeting_minutes (id) on delete set null;

-- 2. Tabela de Problemas (Kanban)
CREATE TABLE IF NOT EXISTS public.direx_problemas (
    id uuid primary key default gen_random_uuid(),
    descricao text not null,
    diretoria_id uuid references public.directorates (id) on delete set null,
    responsavel_id uuid references public.people (id) on delete set null,
    impacto text,
    urgencia text not null default 'média', -- baixa / média / alta
    coluna_kanban text not null default 'novo', -- novo / em análise / em andamento / resolvido
    solucao_aplicada text,
    aprendizados text,
    decisao_id uuid references public.direx_decisions (id) on delete set null,
    cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
    criado_por uuid not null references public.people (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

CREATE TRIGGER direx_problemas_updated_at BEFORE UPDATE ON public.direx_problemas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Tabela de Tarefas
CREATE TABLE IF NOT EXISTS public.direx_tarefas (
    id uuid primary key default gen_random_uuid(),
    titulo text not null,
    responsavel_id uuid references public.people (id) on delete set null,
    prazo date,
    status text not null default 'não iniciado', -- não iniciado / em andamento / concluído
    prioridade text not null default 'verde', -- verde / amarelo / vermelho
    origem_tipo text, -- reuniao / decisao / oe / problema / avulsa
    origem_id uuid,
    cycle_id uuid not null references public.cycles (id) default public.current_cycle_id(),
    criado_por uuid not null references public.people (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

CREATE TRIGGER direx_tarefas_updated_at BEFORE UPDATE ON public.direx_tarefas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Criar View para a Inbox (Centro de Comando)
-- A View da Inbox une Tarefas, Decisões e Problemas
DROP VIEW IF EXISTS public.view_inbox;
CREATE VIEW public.view_inbox AS
SELECT 
    'tarefa' as tipo,
    id,
    titulo,
    responsavel_id,
    prazo,
    prioridade as cor,
    cycle_id
FROM public.direx_tarefas
WHERE status != 'concluído'

UNION ALL

SELECT
    'decisao' as tipo,
    id,
    titulo,
    criado_por as responsavel_id,
    revisao_prevista as prazo,
    CASE 
        WHEN revisao_prevista <= current_date THEN 'vermelho'
        WHEN revisao_prevista <= current_date + 3 THEN 'amarelo'
        ELSE 'verde'
    END as cor,
    cycle_id
FROM public.direx_decisions
WHERE status = 'pendente' OR (revisao_prevista is not null AND revisao_prevista <= current_date + 3)

UNION ALL

SELECT
    'problema' as tipo,
    id,
    descricao as titulo,
    responsavel_id,
    null::date as prazo,
    CASE 
        WHEN urgencia = 'alta' THEN 'vermelho'
        WHEN urgencia = 'média' THEN 'amarelo'
        ELSE 'verde'
    END as cor,
    cycle_id
FROM public.direx_problemas
WHERE coluna_kanban != 'resolvido';

-- Configurar RLS
ALTER TABLE public.direx_problemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direx_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total direx problemas" ON public.direx_problemas
FOR ALL USING (auth.uid() is not null);

CREATE POLICY "Acesso total direx tarefas" ON public.direx_tarefas
FOR ALL USING (auth.uid() is not null);
