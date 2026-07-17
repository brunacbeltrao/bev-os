-- Migração 20260718000003_direx_ajustes.sql

-- 1. Corrigir FK de direx_decisions para referenciar direx_minutes corretamente, e não meeting_minutes.
ALTER TABLE public.direx_decisions DROP CONSTRAINT IF EXISTS direx_decisions_reuniao_id_fkey;
ALTER TABLE public.direx_decisions 
ADD CONSTRAINT direx_decisions_reuniao_id_fkey 
FOREIGN KEY (reuniao_id) REFERENCES public.direx_minutes (id) ON DELETE SET NULL;

-- 2. Expandir a tabela direx_minutes para contemplar Pautas e Relatórios e status de Reunião
ALTER TABLE public.direx_minutes
ADD COLUMN IF NOT EXISTS pautas text,
ADD COLUMN IF NOT EXISTS relatorio text,
ADD COLUMN IF NOT EXISTS status text not null default 'agendada'; -- agendada / realizada / cancelada

-- Se o conteudo antigo existir, a gente pode migrar para relatorio
UPDATE public.direx_minutes SET relatorio = conteudo WHERE conteudo IS NOT NULL AND relatorio IS NULL;

-- 3. Atualizar as prioridades e status de direx_tarefas para combinar com a interface
ALTER TABLE public.direx_tarefas 
ALTER COLUMN prioridade SET DEFAULT 'normal';

-- Mapear os valores antigos para os novos se já houver (verde -> normal, amarelo -> média, vermelho -> alta)
UPDATE public.direx_tarefas SET prioridade = 'normal' WHERE prioridade = 'verde';
UPDATE public.direx_tarefas SET prioridade = 'média' WHERE prioridade = 'amarelo';
UPDATE public.direx_tarefas SET prioridade = 'alta' WHERE prioridade = 'vermelho';

-- 4. Atualizar as cores da view_inbox para refletir o novo mapeamento de prioridade
DROP VIEW IF EXISTS public.view_inbox;
CREATE VIEW public.view_inbox AS
SELECT 
    'tarefa' as tipo,
    id,
    titulo,
    responsavel_id,
    prazo,
    CASE 
        WHEN prioridade = 'alta' THEN 'vermelho'
        WHEN prioridade = 'média' THEN 'amarelo'
        ELSE 'verde'
    END as cor,
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
