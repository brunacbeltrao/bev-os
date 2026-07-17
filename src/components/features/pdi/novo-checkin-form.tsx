import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { checkinFormSchema, type CheckinFormValues } from '@/lib/validations/pdi'
import { addCheckin, type Quadrante } from '@/lib/pdi'

interface NovoCheckinFormProps {
  planId: string
  liderId: string
}

export function NovoCheckinForm({ planId, liderId }: NovoCheckinFormProps) {
  const queryClient = useQueryClient()
  
  const form = useForm<CheckinFormValues>({
    resolver: zodResolver(checkinFormSchema),
    defaultValues: {
      data: new Date().toISOString().slice(0, 10),
      tipo: 'pc_bimestral',
      notas: '',
      encaminhamentos: '',
      quadrante: null,
    },
  })

  const addMut = useMutation({
    mutationFn: (values: CheckinFormValues) =>
      addCheckin(planId, liderId, {
        data: values.data,
        notas: values.notas,
        tipo: values.tipo,
        encaminhamentos: values.encaminhamentos,
        quadrante: values.quadrante || undefined,
      }),
    onSuccess: () => {
      form.reset()
      queryClient.invalidateQueries({ queryKey: ['pdi-checkins', planId] })
    },
  })

  const QUADRANTES: Quadrante[] = ['D1', 'D2', 'D3', 'D4']

  return (
    <form
      onSubmit={form.handleSubmit((v) => addMut.mutate(v))}
      className="flex flex-col gap-2 rounded-lg border p-3"
    >
      <div className="flex flex-wrap gap-2">
        <Input
          type="date"
          className="w-40"
          {...form.register('data')}
        />
        <select
          className="border-input bg-card h-9 rounded-md border px-2 text-sm"
          {...form.register('tipo')}
        >
          <option value="pc_bimestral">1:1 P&C</option>
          <option value="area_bimestral">1:1 da área</option>
          <option value="extra">Extra</option>
        </select>
        <select
          className="border-input bg-card h-9 rounded-md border px-2 text-sm"
          {...form.register('quadrante')}
        >
          <option value="">Quadrante…</option>
          {QUADRANTES.map((qd) => (
            <option key={qd} value={qd}>
              {qd}
            </option>
          ))}
        </select>
      </div>
      <Textarea
        placeholder="Resumo da conversa…"
        {...form.register('notas')}
      />
      <Textarea
        placeholder="Encaminhamentos e responsáveis…"
        {...form.register('encaminhamentos')}
      />
      
      {/* Exibir erros caso houver */}
      {form.formState.errors.notas && (
        <span className="text-destructive text-xs">{form.formState.errors.notas.message}</span>
      )}
      
      <Button
        type="submit"
        size="sm"
        className="self-start"
        disabled={!form.formState.isValid || addMut.isPending}
      >
        Registrar 1:1
      </Button>
    </form>
  )
}
