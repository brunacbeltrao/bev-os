import { z } from 'zod'

export const demandaFormSchema = z.object({
  titulo: z.string().min(3, { message: 'O título deve ter no mínimo 3 caracteres.' }),
  descricao: z.string().optional(),
  tipo: z.string().optional(),
  prazo: z.string().optional(), // Date string as ISO
  subarea_id: z.string().uuid({ message: 'Selecione uma subárea.' }),
  assignees: z.array(z.string().uuid()),
})

export type DemandaFormValues = z.infer<typeof demandaFormSchema>
