import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, ArrowRight, ArrowLeft, Clock, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/lib/app-context'
import { getDirexTarefas, updateTarefaStatus, createDirexTarefa } from '@/lib/direx'
import type { DirexTarefa } from '@/lib/direx'
import { fmtDate } from '@/lib/use-context-scope'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useState } from 'react'

export const Route = createFileRoute('/_app/direx/todo')({
  component: DirexTodoPage,
})

const COLUNAS = ['não iniciado', 'em andamento', 'concluído']

function DirexTodoPage() {
  const { isDirex, cycle, person } = useApp()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [prioridade, setPrioridade] = useState('normal')
  const [prazo, setPrazo] = useState('')

  const { data: tarefas = [], isPending } = useQuery({
    queryKey: ['direx-tarefas', cycle.id],
    queryFn: () => getDirexTarefas(cycle.id),
    enabled: isDirex,
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, novoStatus }: { id: string; novoStatus: string }) =>
      updateTarefaStatus(id, novoStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direx-tarefas'] })
      queryClient.invalidateQueries({ queryKey: ['direx-inbox'] })
    },
  })

  const createMut = useMutation({
    mutationFn: () => createDirexTarefa(titulo, prioridade, prazo || null, person.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direx-tarefas'] })
      queryClient.invalidateQueries({ queryKey: ['direx-inbox'] })
      setDialogOpen(false)
      setTitulo('')
      setPrioridade('normal')
      setPrazo('')
    },
  })

  if (!isDirex) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          A Gestão de Tarefas é restrita à Diretoria Executiva.
        </p>
      </div>
    )
  }

  const grouped = COLUNAS.map((coluna) => ({
    titulo: coluna,
    items: tarefas.filter((t) => t.status === coluna),
  }))

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <header className="mb-6 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <CheckSquare className="size-4.5" />
          </span>
            To do
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Acompanhamento das tarefas e planos de ação da Diretoria Executiva.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Nova Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Tarefa</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4 mt-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (titulo.trim()) createMut.mutate()
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="t-titulo">Título / Descrição</Label>
                <Input
                  id="t-titulo"
                  required
                  placeholder="ex: Avaliar fornecedores de TI"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-prio">Prioridade</Label>
                  <select
                    id="t-prio"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value)}
                  >
                    <option value="normal">Normal</option>
                    <option value="média">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-prazo">Prazo Estimado</Label>
                  <Input
                    id="t-prazo"
                    type="date"
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" disabled={createMut.isPending} className="mt-2">
                {createMut.isPending ? 'Salvando…' : 'Criar Tarefa'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {isPending ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3].map((i) => (
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
                  col.items.map((t) => (
                    <TarefaCard
                      key={t.id}
                      tarefa={t}
                      onMove={(dir) => {
                        const nova = COLUNAS[cIdx + dir]
                        if (nova) {
                          moveMutation.mutate({ id: t.id, novoStatus: nova })
                        }
                      }}
                      canMoveLeft={cIdx > 0}
                      canMoveRight={cIdx < COLUNAS.length - 1}
                      isMoving={moveMutation.isPending && moveMutation.variables?.id === t.id}
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

function TarefaCard({
  tarefa,
  onMove,
  canMoveLeft,
  canMoveRight,
  isMoving,
}: {
  tarefa: DirexTarefa
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
              tarefa.prioridade === 'alta'
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-400'
                : tarefa.prioridade === 'média'
                  ? 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/30 dark:text-green-400'
            }`}
          >
            {tarefa.prioridade}
          </Badge>
          {tarefa.prazo && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
              <Clock className="size-3" /> {fmtDate(tarefa.prazo)}
            </span>
          )}
        </div>
        <CardTitle className="mt-1.5 text-sm leading-snug">{tarefa.titulo}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 mt-2 text-[11px]">
           <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold">
             {tarefa.responsavel_id ? 'DI' : '—'}
           </div>
           <span>{tarefa.responsavel_id ? 'Responsável Atribuído' : 'Sem Responsável'}</span>
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
          {tarefa.origem_tipo ? `Origem: ${tarefa.origem_tipo}` : 'Ação Avulsa'}
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
