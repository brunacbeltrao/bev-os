import { z } from 'zod'

const uuidSchema = z.string().uuid('ID inválido')

export const problemaSchema = z.object({
  id: uuidSchema.optional(),
  descricao: z.string().min(3, 'A descrição deve ter no mínimo 3 caracteres'),
  diretoria_id: uuidSchema.nullable().optional(),
  responsavel_id: uuidSchema.nullable().optional(),
  impacto: z.string().optional().nullable(),
  urgencia: z.enum(['baixa', 'média', 'alta']),
  coluna_kanban: z.enum(['novo', 'em análise', 'em andamento', 'resolvido']).default('novo'),
  solucao_aplicada: z.string().optional().nullable(),
  aprendizados: z.string().optional().nullable(),
  decisao_id: uuidSchema.nullable().optional(),
})

export type ProblemaFormValues = z.infer<typeof problemaSchema>

export const tarefaSchema = z.object({
  id: uuidSchema.optional(),
  titulo: z.string().min(3, 'O título da tarefa deve ter no mínimo 3 caracteres'),
  responsavel_id: uuidSchema.nullable().optional(),
  prazo: z.string().optional().nullable(), // date string (YYYY-MM-DD)
  status: z.enum(['não iniciado', 'em andamento', 'concluído']).default('não iniciado'),
  prioridade: z.enum(['normal', 'média', 'alta']).default('normal'),
  origem_tipo: z.string().optional().nullable(),
  origem_id: uuidSchema.optional().nullable(),
})

export type TarefaFormValues = z.infer<typeof tarefaSchema>

export const decisaoDirexSchema = z.object({
  id: uuidSchema.optional(),
  titulo: z.string().min(3, 'Título obrigatório'),
  descricao: z.string().optional().nullable(),
  contexto: z.string().optional().nullable(),
  problema: z.string().optional().nullable(),
  alternativas: z.string().optional().nullable(),
  decisao_final: z.string().optional().nullable(),
  justificativa: z.string().optional().nullable(),
  tipo_resolucao: z.enum(['consenso', 'consenso parcial', 'pendente']).default('consenso'),
  impactos_esperados: z.string().optional().nullable(),
  revisao_prevista: z.string().optional().nullable(), // YYYY-MM-DD
  status: z.enum(['vigente', 'em revisão', 'revogada', 'pendente']).default('vigente'),
  reuniao_id: uuidSchema.nullable().optional(),
})

export type DecisaoDirexFormValues = z.infer<typeof decisaoDirexSchema>
