import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addGoalFormSchema, type AddGoalFormValues } from '@/lib/validations/pdi'
import { addGoal } from '@/lib/pdi'

interface NovaMetaFormProps {
  planId: string
}

export function NovaMetaForm({ planId }: NovaMetaFormProps) {
  const queryClient = useQueryClient()

  const form = useForm<AddGoalFormValues>({
    resolver: zodResolver(addGoalFormSchema),
    defaultValues: {
      meta: '',
    },
  })

  const addMut = useMutation({
    mutationFn: (values: AddGoalFormValues) =>
      addGoal(planId, { meta: values.meta, fonte: 'pdi' }),
    onSuccess: () => {
      form.reset()
      queryClient.invalidateQueries({ queryKey: ['pdi-goals', planId] })
    },
  })

  return (
    <form
      className="flex gap-2"
      onSubmit={form.handleSubmit((v) => addMut.mutate(v))}
    >
      <Input
        placeholder="Nova meta (construída junto)…"
        {...form.register('meta')}
      />
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        disabled={!form.formState.isValid || addMut.isPending}
      >
        Adicionar
      </Button>
    </form>
  )
}
