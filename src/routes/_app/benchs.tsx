/**
 * Benchs (Onda 3) — Lista + Detalhe: benchmarks com outras EJs.
 * Registro do agendamento e documentação de insights obrigatória
 * após a execução (PRD §5).
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useApp } from '@/lib/app-context'
import { createBench, getBenchs, setBenchInsights, type Bench } from '@/lib/benchs'
import { fmtDate, useContextScope } from '@/lib/use-context-scope'

export const Route = createFileRoute('/_app/benchs')({ component: BenchsPage })

function BenchDetail({ bench }: { bench: Bench }) {
  const queryClient = useQueryClient()
  const [insights, setInsights] = useState(bench.insights ?? '')
  const [url, setUrl] = useState(bench.meet_url ?? '')
  const saveMut = useMutation({
    mutationFn: () => setBenchInsights(bench.id, insights, url),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['benchs'] }),
  })
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{bench.membro_nome} ({bench.organizacao_parceira})</h2>
        <p className="text-muted-foreground text-sm">{bench.tema} · {fmtDate(bench.data)}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Insights (obrigatório após a execução)</Label>
        <Textarea
          className="min-h-[120px]"
          value={insights}
          onChange={(e) => setInsights(e.target.value)}
          placeholder="O que aprendemos com esse bench…"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Link do Meet / Gravação</Label>
        <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meet.google.com/..." />
      </div>
      <Button size="sm" className="self-start" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
        Salvar documentação
      </Button>
    </div>
  )
}

function BenchsPage() {
  const { person, cycle } = useApp()
  const { subareaIds, scopeSubareas } = useContextScope()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [org, setOrg] = useState('')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [tema, setTema] = useState('')
  const [dataBench, setDataBench] = useState('')
  const [meetUrl, setMeetUrl] = useState('')
  const [subareaId, setSubareaId] = useState('')

  const benchsQ = useQuery({
    queryKey: ['benchs', cycle.id, subareaIds?.join(',') ?? 'all'],
    queryFn: () => getBenchs(cycle.id, subareaIds),
  })
  const createMut = useMutation({
    mutationFn: () =>
      createBench({
        subarea_id: subareaId || scopeSubareas[0]?.id,
        organizacao_parceira: org,
        membro_nome: nome,
        membro_email: email,
        tema: tema,
        data: dataBench,
        meet_url: meetUrl,
        criado_por: person.id,
      }),
    onSuccess: () => {
      setOpen(false)
      setOrg('')
      setNome('')
      setEmail('')
      setTema('')
      setMeetUrl('')
      setDataBench('')
      queryClient.invalidateQueries({ queryKey: ['benchs'] })
    },
  })

  const selected = (benchsQ.data ?? []).find((b) => b.id === selectedId) ?? null

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Sparkles className="size-4.5" />
          </span>
            Benchs
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Benchmarks com outras EJs e profissionais
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Novo bench
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar bench</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (org.trim() && nome.trim() && dataBench) createMut.mutate()
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Nome do Membro</Label>
                  <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>EJ / Empresa</Label>
                  <Input required value={org} onChange={(e) => setOrg(e.target.value)} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Tema</Label>
                  <Input required value={tema} onChange={(e) => setTema(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Data e Hora</Label>
                  <Input
                    type="datetime-local"
                    required
                    value={dataBench}
                    onChange={(e) => setDataBench(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Link do Meet</Label>
                  <Input type="url" placeholder="https://..." value={meetUrl} onChange={(e) => setMeetUrl(e.target.value)} />
                </div>
              </div>
                {scopeSubareas.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <Label>Área</Label>
                    <select
                      className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-9 rounded-md border px-3 text-sm shadow-xs transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2"
                      value={subareaId || scopeSubareas[0]?.id}
                      onChange={(e) => setSubareaId(e.target.value)}
                    >
                      {scopeSubareas.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              <Button type="submit" disabled={createMut.isPending}>
                Agendar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-2 lg:col-span-2">
          {benchsQ.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (benchsQ.data ?? []).length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-center text-sm">
                Nenhum bench registrado neste contexto.
              </CardContent>
            </Card>
          ) : (
            benchsQ.data!.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  selectedId === b.id ? 'bg-accent border-ring' : 'bg-card hover:bg-accent/50'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">{fmtDate(b.data)}</span>
                  {b.insights ? (
                    <Badge variant="success" className="ml-auto">Documentado</Badge>
                  ) : (
                    <Badge variant="warning" className="ml-auto">Insights pendentes</Badge>
                  )}
                </div>
                <p className="text-sm font-medium">{b.tema}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{b.membro_nome} ({b.organizacao_parceira})</p>
              </button>
            ))
          )}
        </div>
        <div className="lg:col-span-3">
          {selected ? (
            <Card>
              <CardHeader className="sr-only">
                <CardTitle>Detalhe</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <BenchDetail key={selected.id} bench={selected} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-muted-foreground p-10 text-center text-sm">
                Selecione um bench para documentar os insights.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
