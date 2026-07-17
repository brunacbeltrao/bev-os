/** Planejamento Estratégico (Onda 4.1) — foco/propósito do ciclo e os
 *  Objetivos Estratégicos (OKRs, KPIs, diretorias responsáveis).
 *  Todos leem; só a Direx edita. */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Compass, Plus, Target, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-context'
import {
  addKpi,
  addOkr,
  createObjective,
  deleteKpi,
  deleteObjective,
  deleteOkr,
  getDirectorates,
  getObjectives,
  getPlan,
  setObjectiveDirectorate,
  updateObjective,
  upsertPlan,
  type Directorate,
  type Objective,
} from '@/lib/planejamento'

export const Route = createFileRoute('/_app/direx/planejamento')({ component: PlanejamentoPage })

function PlanejamentoPage() {
  const { cycle, isDirex } = useApp()
  const queryClient = useQueryClient()
  const planQ = useQuery({ queryKey: ['strategic-plan', cycle.id], queryFn: () => getPlan(cycle.id) })
  const objQ = useQuery({ queryKey: ['objectives', cycle.id], queryFn: () => getObjectives(cycle.id) })
  const dirsQ = useQuery({ queryKey: ['directorates'], queryFn: getDirectorates, staleTime: Infinity })
  const objetivos = objQ.data ?? []

  const novoMut = useMutation({
    mutationFn: () => createObjective(cycle.id, 'Novo objetivo estratégico', objetivos.length),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['objectives'] }),
  })

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Compass className="size-6" />
            Planejamento Estratégico
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Foco, propósito e objetivos estratégicos · Ciclo {cycle.nome}
          </p>
        </div>
        {isDirex && (
          <Button onClick={() => novoMut.mutate()} disabled={novoMut.isPending}>
            <Plus className="size-4" /> Novo objetivo
          </Button>
        )}
      </header>

      {/* Foco / Propósito */}
      {planQ.isPending ? (
        <Skeleton className="mb-5 h-32 w-full" />
      ) : (
        <FocoBox cycleId={cycle.id} foco={planQ.data?.foco ?? ''} proposito={planQ.data?.proposito ?? ''} editavel={isDirex} />
      )}

      {/* Objetivos */}
      <h2 className="mb-3 mt-6 text-sm font-semibold">Objetivos estratégicos do ciclo</h2>
      {objQ.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : objetivos.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">
            Nenhum objetivo estratégico definido ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {objetivos.map((o, i) => (
            <ObjectiveCard key={o.id} obj={o} indice={i + 1} dirs={dirsQ.data ?? []} editavel={isDirex} />
          ))}
        </div>
      )}
    </div>
  )
}

function FocoBox({
  cycleId,
  foco,
  proposito,
  editavel,
}: {
  cycleId: string
  foco: string
  proposito: string
  editavel: boolean
}) {
  const queryClient = useQueryClient()
  const [f, setF] = useState(foco)
  const [p, setP] = useState(proposito)
  const mut = useMutation({
    mutationFn: () => upsertPlan(cycleId, f, p),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['strategic-plan'] }),
  })
  if (!editavel) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div>
            <div className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">Nosso foco</div>
            <p className="whitespace-pre-wrap text-sm">{foco || '—'}</p>
          </div>
          <div>
            <div className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">Nosso propósito</div>
            <p className="whitespace-pre-wrap text-sm">{proposito || '—'}</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-col gap-1.5">
          <Label>Nosso foco</Label>
          <Textarea value={f} onChange={(e) => setF(e.target.value)} placeholder="Qual o foco do BEV neste ciclo…" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Nosso propósito</Label>
          <Textarea value={p} onChange={(e) => setP(e.target.value)} placeholder="Nosso propósito…" />
        </div>
        <Button className="self-start" disabled={mut.isPending} onClick={() => mut.mutate()}>
          Salvar
        </Button>
      </CardContent>
    </Card>
  )
}

function ObjectiveCard({
  obj,
  indice,
  dirs,
  editavel,
}: {
  obj: Objective
  indice: number
  dirs: Directorate[]
  editavel: boolean
}) {
  const queryClient = useQueryClient()
  const inv = () => queryClient.invalidateQueries({ queryKey: ['objectives'] })
  const [novoOkr, setNovoOkr] = useState('')
  const [kpi, setKpi] = useState({ nome: '', atual: '', meta: '' })

  const updMut = useMutation({ mutationFn: (patch: any) => updateObjective(obj.id, patch), onSuccess: inv })
  const delMut = useMutation({ mutationFn: () => deleteObjective(obj.id), onSuccess: inv })
  const okrAddMut = useMutation({
    mutationFn: () => addOkr(obj.id, novoOkr, obj.okrs.length),
    onSuccess: () => {
      setNovoOkr('')
      inv()
    },
  })
  const okrDelMut = useMutation({ mutationFn: (id: string) => deleteOkr(id), onSuccess: inv })
  const kpiAddMut = useMutation({
    mutationFn: () => addKpi(obj.id, kpi.nome, kpi.meta, kpi.atual, obj.kpis.length),
    onSuccess: () => {
      setKpi({ nome: '', atual: '', meta: '' })
      inv()
    },
  })
  const kpiDelMut = useMutation({ mutationFn: (id: string) => deleteKpi(id), onSuccess: inv })
  const dirMut = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => setObjectiveDirectorate(obj.id, id, on),
    onSuccess: inv,
  })

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        {/* Título + descrição */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="text-primary mb-1 text-xs font-semibold uppercase tracking-wide">
              OE {indice}
            </div>
            {editavel ? (
              <input
                defaultValue={obj.titulo}
                onBlur={(e) => e.target.value !== obj.titulo && updMut.mutate({ titulo: e.target.value })}
                className="w-full border-none bg-transparent text-lg font-semibold outline-none focus:bg-accent/40 rounded px-1"
              />
            ) : (
              <h3 className="text-lg font-semibold">{obj.titulo}</h3>
            )}
          </div>
          {editavel && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600"
              onClick={() => confirm('Excluir este objetivo?') && delMut.mutate()}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
        {editavel ? (
          <Textarea
            defaultValue={obj.descricao ?? ''}
            placeholder="Descrição do objetivo…"
            onBlur={(e) =>
              e.target.value !== (obj.descricao ?? '') && updMut.mutate({ descricao: e.target.value })
            }
          />
        ) : (
          obj.descricao && <p className="text-muted-foreground text-sm">{obj.descricao}</p>
        )}

        {/* Diretorias responsáveis */}
        <div>
          <div className="text-muted-foreground mb-1.5 text-xs font-semibold uppercase tracking-wide">
            Diretorias responsáveis
          </div>
          <div className="flex flex-wrap gap-1.5">
            {dirs.map((d) => {
              const on = obj.directorate_ids.includes(d.id)
              if (!editavel) {
                return on ? (
                  <Badge key={d.id} variant="info">
                    {d.nome}
                  </Badge>
                ) : null
              }
              return (
                <button
                  key={d.id}
                  onClick={() => dirMut.mutate({ id: d.id, on: !on })}
                  className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'bg-neutral-900 text-neutral-0 border-neutral-900' : 'bg-card text-muted-foreground'}`}
                >
                  {d.nome}
                </button>
              )
            })}
            {!editavel && obj.directorate_ids.length === 0 && (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </div>
        </div>

        {/* OKRs */}
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <Target className="size-4" /> OKRs
          </div>
          <div className="flex flex-col gap-1.5">
            {obj.okrs.map((o) => (
              <div key={o.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <span className="flex-1">{o.texto}</span>
                {editavel && (
                  <button onClick={() => okrDelMut.mutate(o.id)} className="text-muted-foreground">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            {obj.okrs.length === 0 && !editavel && (
              <p className="text-muted-foreground text-xs">Nenhum OKR.</p>
            )}
            {editavel && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (novoOkr.trim()) okrAddMut.mutate()
                }}
              >
                <Input value={novoOkr} onChange={(e) => setNovoOkr(e.target.value)} placeholder="Novo OKR / resultado-chave…" />
                <Button type="submit" size="sm" variant="secondary" disabled={okrAddMut.isPending}>
                  <Plus className="size-4" />
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div>
          <div className="mb-1.5 text-sm font-medium">KPIs</div>
          <div className="flex flex-col gap-1.5">
            {obj.kpis.map((k) => (
              <div key={k.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <span className="flex-1 font-medium">{k.nome}</span>
                <span className="text-muted-foreground text-xs">
                  {k.atual || '—'}
                  {k.meta ? ` / meta ${k.meta}` : ''}
                </span>
                {editavel && (
                  <button onClick={() => kpiDelMut.mutate(k.id)} className="text-muted-foreground">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            {obj.kpis.length === 0 && !editavel && (
              <p className="text-muted-foreground text-xs">Nenhum KPI.</p>
            )}
            {editavel && (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (kpi.nome.trim()) kpiAddMut.mutate()
                }}
              >
                <Input
                  value={kpi.nome}
                  onChange={(e) => setKpi({ ...kpi, nome: e.target.value })}
                  placeholder="Indicador (nome)"
                  className="flex-1"
                />
                <Input
                  value={kpi.atual}
                  onChange={(e) => setKpi({ ...kpi, atual: e.target.value })}
                  placeholder="Atual"
                  className="w-24"
                />
                <Input
                  value={kpi.meta}
                  onChange={(e) => setKpi({ ...kpi, meta: e.target.value })}
                  placeholder="Meta"
                  className="w-24"
                />
                <Button type="submit" size="sm" variant="secondary" disabled={kpiAddMut.isPending}>
                  <Plus className="size-4" />
                </Button>
              </form>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
