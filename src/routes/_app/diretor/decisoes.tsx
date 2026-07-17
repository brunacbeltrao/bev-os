/**
 * Direx — Decisões Macro (Blueprint §5.1): restritas a Diretores.
 * Padrão Formulário + Histórico (Blueprint §6).
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gavel, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-context'
import { createDirexDecision, getDirexDecisions } from '@/lib/direx'
import { fmtDate } from '@/lib/use-context-scope'

export const Route = createFileRoute('/_app/diretor/decisoes')({ component: DirexDecisoesPage })

function DirexDecisoesPage() {
  const { isDirex, person, cycle } = useApp()
  const queryClient = useQueryClient()
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')

  const decisionsQ = useQuery({
    queryKey: ['direx-decisions', cycle.id],
    queryFn: () => getDirexDecisions(cycle.id),
    enabled: isDirex,
  })

  const createMut = useMutation({
    mutationFn: () => createDirexDecision(titulo, descricao, person.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direx-decisions'] })
      queryClient.invalidateQueries({ queryKey: ['direx-summary'] })
      setTitulo('')
      setDescricao('')
    },
  })

  if (!isDirex) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <Lock className="text-muted-foreground mx-auto mb-3 size-8" />
        <h1 className="text-lg font-semibold">Somente Diretores</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          As decisões macro completas são restritas à Diretoria Executiva.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Gavel className="size-4.5" />
          </span>
          Decisões Macro
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Ciclo {cycle.nome} · só Diretores</p>
      </header>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="text-base">Registrar decisão</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (titulo.trim()) createMut.mutate()
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dec-titulo">Título</Label>
              <Input id="dec-titulo" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dec-desc">Descrição / contexto</Label>
              <Textarea id="dec-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <Button type="submit" className="self-start" disabled={createMut.isPending}>
              {createMut.isPending ? 'Registrando…' : 'Registrar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <h2 className="mb-2 text-sm font-medium">Histórico</h2>
      <div className="flex flex-col gap-2">
        {decisionsQ.isPending ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : (decisionsQ.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-center text-sm">
              Nenhuma decisão registrada neste ciclo.
            </CardContent>
          </Card>
        ) : (
          decisionsQ.data!.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{d.titulo}</p>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {fmtDate(d.decidido_em)}
                  </span>
                </div>
                {d.descricao && (
                  <p className="text-muted-foreground mt-1 whitespace-pre-wrap text-sm">
                    {d.descricao}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
