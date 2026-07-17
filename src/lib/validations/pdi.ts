import { z } from 'zod'

export const addGoalFormSchema = z.object({
  meta: z.string().min(3, { message: 'A meta deve ter pelo menos 3 caracteres.' }),
})
export type AddGoalFormValues = z.infer<typeof addGoalFormSchema>

export const updateGoalSchema = z.object({
  indicador: z.string().optional(),
  criterio_sucesso: z.string().optional(),
  prazo: z.string().optional(),
  competency_id: z.string().nullable().optional(),
  evidencia: z.string().nullable().optional(),
  comentario_lideranca: z.string().optional(),
  fonte: z.string().optional(),
})

export const checkinFormSchema = z.object({
  data: z.string().min(1, { message: 'Data é obrigatória.' }),
  tipo: z.string().min(1, { message: 'Tipo é obrigatório.' }),
  notas: z.string().min(1, { message: 'As notas são obrigatórias.' }),
  encaminhamentos: z.string().optional(),
  quadrante: z.enum(['D1', 'D2', 'D3', 'D4']).nullable().optional(),
})

export type CheckinFormValues = z.infer<typeof checkinFormSchema>
