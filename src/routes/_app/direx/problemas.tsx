import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, ArrowLeft, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/lib/app-context'
import { getDirexProblemas, updateProblemaStatus, createDirexProblema } from '@/lib/direx'
import type { DirexProblema } from '@/lib/direx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useState } from 'react'

export const Route = createFileRoute('/_app/direx/problemas')({
  component: DirexProblemasPage,
})

const COLUNAS = ['novo', 'em análise', 'em andamento', 'resolvido']

function DirexProblemasPage() {
  const { isDirex, cycle, person } = useApp()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [urgencia, setUrgencia] = useState('média')

  const { data: problemas = [], isPending } = useQuery({
    queryKey: ['direx-problemas', cycle.id],
    queryFn: () => getDirexProblemas(cycle.id),
    enabled: isDirex,
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, novaColuna }: { id: string; novaColuna: string }) =>
      updateProblemaStatus(id, novaColuna),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direx-problemas'] })
      queryClient.invalidateQueries({ queryKey: ['direx-inbox'] })
    },
  })

  const createMut = useMutation({
    mutationFn: () => createDirexProblema(descricao, urgencia, null, person.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direx-problemas'] })
      queryClient.invalidateQueries({ queryKey: ['direx-inbox'] })
      setDialogOpen(false)
      setDescricao('')
      setUrgencia('média')
    },
  })

  if (!isDirex) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          A Gestão de Problemas é restrita à Diretoria Executiva.
        </p>
      </div>
    )
  }

  const grouped = COLUNAS.map((coluna) => ({
    titulo: coluna,
    items: problemas.filter((p) => p.coluna_kanban === coluna),
  }))

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <header className="mb-6 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <AlertTriangle className="size-4.5" />
          </span>
            Gestão de Problemas
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Acompanhamento estruturado de situações críticas e aprendizados da gestão.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Reportar Problema
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reportar Novo Problema</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4 mt-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (descricao.trim()) createMut.mutate()
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-desc">Problema / Situação (seja sucinto)</Label>
                <Input
                  id="p-desc"
                  required
                  placeholder="ex: Furo no fluxo de caixa no projeto X"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-urgencia">Urgência</Label>
                <select
                  id="p-urgencia"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={urgencia}
                  onChange={(e) => setUrgencia(e.target.value)}
                >
                  <option value="baixa">Baixa</option>
                  <option value="média">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <Button type="submit" disabled={createMut.isPending} className="mt-2">
                {createMut.isPending ? 'Salvando…' : 'Adicionar ao Kanban'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {isPending ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-80 shrink-0">
              <Skeleton className="h-[400px] w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
          {grouped.map((col, cIdx) => (
            <div key={col.titulo} className="flex w-80 shrink-0 flex-col rounded-xl bg-muted/40 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="font-semibold capitalize text-muted-foreground">{col.titulo}</h3>
                <Badge variant="secondary" className="text-xs">
                  {col.items.length}
                </Badge>
              </div>

              <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
                {col.items.length === 0 ? (
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground/50">
                    Nenhum item
                  </div>
                ) : (
                  col.items.map((p) => (
                    <ProblemaCard
                      key={p.id}
                      problema={p}
                      onMove={(dir) => {
                        const nova = COLUNAS[cIdx + dir]
                        if (nova) {
                          moveMutation.mutate({ id: p.id, novaColuna: nova })
                        }
                      }}
                      canMoveLeft={cIdx > 0}
                      canMoveRight={cIdx < COLUNAS.length - 1}
                      isMoving={moveMutation.isPending && moveMutation.variables?.id === p.id}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProblemaCard({
  problema,
  onMove,
  canMoveLeft,
  canMoveRight,
  isMoving,
}: {
  problema: DirexProblema
  onMove: (dir: number) => void
  canMoveLeft: boolean
  canMoveRight: boolean
  isMoving: boolean
}) {
  return (
    <Card className={`relative shadow-sm transition-opacity ${isMoving ? 'opacity-50' : ''}`}>
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <Badge
            variant="outline"
            className={`text-[10px] ${
              problema.urgencia === 'alta'
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-400'
                : problema.urgencia === 'média'
                  ? 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/30 dark:text-green-400'
            }`}
          >
            {problema.urgencia}
          </Badge>
        </div>
        <CardTitle className="mt-1.5 text-sm leading-snug">{problema.descricao}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
        {problema.impacto && <p className="mb-2 line-clamp-2">{problema.impacto}</p>}
        {/* Placeholder para Diretoria */}
        <div className="flex items-center gap-2 mt-2 text-[11px]">
          <div className="size-5 rounded bg-muted flex items-center justify-center text-[9px] font-bold">
            {problema.diretoria_id ? 'DR' : '—'}
          </div>
          <span>{problema.diretoria_id ? 'Diretoria Atribuída' : 'Sem Diretoria'}</span>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between p-2 bg-muted/20 border-t">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!canMoveLeft || isMoving}
          onClick={() => onMove(-1)}
        >
          <ArrowLeft className="size-3" />
        </Button>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {problema.decisao_id ? 'Possui Decisão' : 'Aberto'}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!canMoveRight || isMoving}
          onClick={() => onMove(1)}
        >
          <ArrowRight className="size-3" />
        </Button>
      </CardFooter>
    </Card>
  )
}
