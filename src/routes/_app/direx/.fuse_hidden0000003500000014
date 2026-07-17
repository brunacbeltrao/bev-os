/**
 * Direx — Reuniões de Diretoria (RD).
 * Padrão Lista + Detalhe, agora com gestão de pautas, relatórios, ações e decisões.
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Lock, Plus, Calendar, CheckSquare, Gavel } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useApp } from '@/lib/app-context'
import { createDirexMinute, getDirexMinutes, updateDirexMinute } from '@/lib/direx'
import { fmtDate } from '@/lib/use-context-scope'

export const Route = createFileRoute('/_app/direx/atas')({ component: DirexReunioesPage })

function DirexReunioesPage() {
  const { isDirex, person, cycle } = useApp()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [dataAta, setDataAta] = useState('')
  const [pautas, setPautas] = useState('')
  
  // States for editing
  const [edicaoField, setEdicaoField] = useState<'pautas' | 'relatorio' | null>(null)
  const [edicaoText, setEdicaoText] = useState('')

  const minutesQ = useQuery({
    queryKey: ['direx-minutes', cycle.id],
    queryFn: () => getDirexMinutes(cycle.id),
    enabled: isDirex,
  })

  const createMut = useMutation({
    mutationFn: () =>
      createDirexMinute(titulo, dataAta || new Date().toISOString().slice(0, 10), pautas, person.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direx-minutes'] })
      queryClient.invalidateQueries({ queryKey: ['direx-summary'] })
      setDialogOpen(false)
      setTitulo('')
      setDataAta('')
      setPautas('')
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => updateDirexMinute(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direx-minutes'] })
      setEdicaoField(null)
    },
  })

  if (!isDirex) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <Lock className="text-muted-foreground mx-auto mb-3 size-8" />
        <h1 className="text-lg font-semibold">Somente Diretores</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          A gestão de reuniões da Diretoria Executiva é restrita.
        </p>
      </div>
    )
  }

  const list = minutesQ.data ?? []
  const selected = list.find((m) => m.id === selectedId) ?? null

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Calendar className="size-6 text-indigo-500" />
            Reuniões de Diretoria
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Ciclo {cycle.nome} · Pautas, Relatórios, Decisões e Ações</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Agendar RD
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Reunião de Diretoria</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (titulo.trim()) createMut.mutate()
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="a-titulo">Título / Tema</Label>
                  <Input
                    id="a-titulo"
                    required
                    placeholder="ex: RD de Alinhamento Semanal"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="a-data">Data</Label>
                  <Input
                    id="a-data"
                    type="date"
                    value={dataAta}
                    onChange={(e) => setDataAta(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="a-pautas">Pautas Propostas (markdown)</Label>
                <Textarea
                  id="a-pautas"
                  className="min-h-[140px] font-mono text-xs"
                  placeholder="- Discussão sobre caixa&#10;- Feedback de clientes&#10;- Aprovação de contratações"
                  value={pautas}
                  onChange={(e) => setPautas(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? 'Salvando…' : 'Agendar RD'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="flex flex-col gap-2 lg:col-span-2">
          {minutesQ.isPending ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : list.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-center text-sm border-dashed">
                Nenhuma RD registrada neste ciclo.
              </CardContent>
            </Card>
          ) : (
            list.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setSelectedId(m.id)
                  setEdicaoField(null)
                }}
                className={`flex flex-col rounded-xl border p-3.5 text-left transition-colors ${
                  selectedId === m.id ? 'bg-accent border-ring' : 'bg-card hover:bg-accent/50'
                }`}
              >
                <div className="flex items-start justify-between w-full">
                   <p className="text-sm font-semibold truncate flex-1 pr-2">{m.titulo}</p>
                   <Badge variant="outline" className={`text-[10px] uppercase shrink-0 ${m.status === 'realizada' ? 'text-green-600 bg-green-50' : m.status === 'cancelada' ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50'}`}>
                     {m.status}
                   </Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{fmtDate(m.data)}</p>
              </button>
            ))
          )}
        </div>
        <div className="lg:col-span-3">
          {selected ? (
            <div className="flex flex-col gap-4">
              <Card>
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className="flex items-center justify-between border-b pb-4">
                    <div>
                      <h2 className="text-xl font-bold">{selected.titulo}</h2>
                      <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                        <Calendar className="size-4" /> {fmtDate(selected.data)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button size="sm" variant={selected.status === 'agendada' ? 'default' : 'outline'} onClick={() => updateMut.mutate({ id: selected.id, patch: { status: 'realizada' } })}>
                          Finalizar RD
                       </Button>
                    </div>
                  </div>

                  {/* Pautas Section */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-2">
                       <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">1. Pautas & Discussões</h3>
                       <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setEdicaoField('pautas'); setEdicaoText(selected.pautas || '') }}>Editar</Button>
                    </div>
                    
                    {edicaoField === 'pautas' ? (
                      <div className="flex flex-col gap-2">
                        <Textarea className="min-h-[150px] font-mono text-sm" value={edicaoText} onChange={(e) => setEdicaoText(e.target.value)} />
                        <div className="flex gap-2">
                           <Button size="sm" onClick={() => updateMut.mutate({ id: selected.id, patch: { pautas: edicaoText } })}>Salvar Pautas</Button>
                           <Button size="sm" variant="ghost" onClick={() => setEdicaoField(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/30 p-3 rounded-lg text-sm whitespace-pre-wrap min-h-20">
                         {selected.pautas || 'Nenhuma pauta cadastrada.'}
                      </div>
                    )}
                  </div>

                  {/* Relatório Section */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-2">
                       <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">2. Relatório / Notas Gerais</h3>
                       <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setEdicaoField('relatorio'); setEdicaoText(selected.relatorio || selected.conteudo || '') }}>Editar</Button>
                    </div>
                    
                    {edicaoField === 'relatorio' ? (
                      <div className="flex flex-col gap-2">
                        <Textarea className="min-h-[150px] font-mono text-sm" value={edicaoText} onChange={(e) => setEdicaoText(e.target.value)} />
                        <div className="flex gap-2">
                           <Button size="sm" onClick={() => updateMut.mutate({ id: selected.id, patch: { relatorio: edicaoText, conteudo: '' } })}>Salvar Relatório</Button>
                           <Button size="sm" variant="ghost" onClick={() => setEdicaoField(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/30 p-3 rounded-lg text-sm whitespace-pre-wrap min-h-20">
                         {selected.relatorio || selected.conteudo || 'Nenhum relatório preenchido.'}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Decisões e Ações Preview (V1.5 future integration) */}
              <div className="grid grid-cols-2 gap-4">
                 <Card className="bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                       <Gavel className="size-6 text-blue-500" />
                       <h4 className="font-semibold text-sm">Decisões Macro</h4>
                       <p className="text-xs text-muted-foreground">Vincule novas decisões a esta reunião na aba de Decisões.</p>
                    </CardContent>
                 </Card>
                 <Card className="bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                       <CheckSquare className="size-6 text-emerald-500" />
                       <h4 className="font-semibold text-sm">Plano de Ação</h4>
                       <p className="text-xs text-muted-foreground">Tarefas derivadas desta RD aparecerão no seu To do list.</p>
                    </CardContent>
                 </Card>
              </div>
            </div>
          ) : (
            <Card className="border-dashed h-full min-h-[400px] flex items-center justify-center">
              <CardContent className="text-muted-foreground text-center text-sm flex flex-col items-center gap-3">
                <FileText className="size-10 opacity-20" />
                Selecione uma RD para visualizar pautas e relatórios.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
