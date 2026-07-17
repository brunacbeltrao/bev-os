/**
 * Warnings (Onda 3) — Formulário + Histórico. Pontos e bandeiras:
 * titular vê a própria pontuação; a equipe de P&C aplica bandeiras
 * e acompanha totais. 10 pontos = 1 agravo; 3 agravos = probatório
 * (cadeia automática no banco).
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Flag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-context'
import { getDirectory } from '@/lib/org'
import {
  applyWarning,
  getFlags,
  getMyProbation,
  getTotals,
  getWarnings,
  FLAG_BADGE,
  FLAG_LABELS,
} from '@/lib/warnings'
import { fmtDate, useContextScope } from '@/lib/use-context-scope'

export const Route = createFileRoute('/_app/warnings')({ component: WarningsPage })

function WarningsPage() {
  const { person, cycle, occupations } = useApp()
  const { allSubareas } = useContextScope()
  const queryClient = useQueryClient()

  const pc = allSubareas.find((s) => s.slug === 'pessoas_cultura')
  const souPC = occupations.some((o) => o.subarea.slug === 'pessoas_cultura')

  const [alvo, setAlvo] = useState('')
  const [flagId, setFlagId] = useState('')
  const [justificativa, setJustificativa] = useState('')

  const flagsQ = useQuery({ queryKey: ['flags'], queryFn: getFlags, staleTime: Infinity })
  const warningsQ = useQuery({ queryKey: ['warnings', cycle.id], queryFn: () => getWarnings(cycle.id) })
  const totalsQ = useQuery({ queryKey: ['warning-totals', cycle.id], queryFn: () => getTotals(cycle.id) })
  const probationQ = useQuery({
    queryKey: ['my-probation', person.id, cycle.id],
    queryFn: () => getMyProbation(person.id, cycle.id),
  })
  const membrosQ = useQuery({
    queryKey: ['directory', cycle.id, null],
    queryFn: () => getDirectory(cycle.id, null),
    enabled: souPC,
  })

  const applyMut = useMutation({
    mutationFn: () => applyWarning(alvo, flagId, justificativa, person.id),
    onSuccess: () => {
      setJustificativa('')
      queryClient.invalidateQueries({ queryKey: ['warnings'] })
      queryClient.invalidateQueries({ queryKey: ['warning-totals'] })
    },
  })

  const meuTotal = (totalsQ.data ?? []).find((t) => t.person_id === person.id)

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Flag className="size-6" />
          Warnings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Sistema de pontos e bandeiras do Regimento · 10 pontos = 1 agravo · 3 agravos = probatório
          · visível só a você e à P&C
        </p>
      </header>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="text-base">Minha situação</CardTitle>
          <CardDescription>Ciclo {cycle.nome}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div>
            <span className="text-3xl font-semibold">{meuTotal?.pontos ?? 0}</span>
            <span className="text-muted-foreground ml-1.5 text-sm">pontos</span>
          </div>
          <div>
            <span className="text-3xl font-semibold">{meuTotal?.agravos ?? 0}</span>
            <span className="text-muted-foreground ml-1.5 text-sm">agravo(s)</span>
          </div>
          {probationQ.data && (
            <Badge variant={probationQ.data.status === 'em_andamento' ? 'danger' : 'neutral'}>
              Probatório: {probationQ.data.status.replace('_', ' ')}
            </Badge>
          )}
        </CardContent>
      </Card>

      {souPC && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="text-base">Aplicar bandeira (P&C)</CardTitle>
            <CardDescription>
              A liderança solicita; a P&C aplica com justificativa formal (PRD §5).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (alvo && flagId && justificativa.trim()) applyMut.mutate()
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Membro</Label>
                  <select
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    value={alvo}
                    onChange={(e) => setAlvo(e.target.value)}
                    required
                  >
                    <option value="">Selecionar…</option>
                    {(membrosQ.data ?? [])
                      .filter((m) => !m.occupation.is_hibrido)
                      .map((m) => (
                        <option key={m.person.id} value={m.person.id}>
                          {m.person.nome}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Bandeira</Label>
                  <select
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    value={flagId}
                    onChange={(e) => setFlagId(e.target.value)}
                    required
                  >
                    <option value="">Selecionar…</option>
                    {(flagsQ.data ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {FLAG_LABELS[f.cor]} ({f.pontos} pts)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Justificativa formal</Label>
                <Textarea
                  required
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                />
              </div>
              <Button type="submit" className="self-start" disabled={applyMut.isPending}>
                Aplicar bandeira
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <h2 className="mb-2 text-sm font-medium">Histórico {souPC ? '(área de P&C vê tudo)' : ''}</h2>
      <div className="flex flex-col gap-2">
        {warningsQ.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : (warningsQ.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-center text-sm">
              Nenhuma advertência registrada. Que continue assim!
            </CardContent>
          </Card>
        ) : (
          warningsQ.data!.map((w) => (
            <Card key={w.id}>
              <CardContent className="flex flex-col gap-1 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant={FLAG_BADGE[w.flag.cor]}>
                    {FLAG_LABELS[w.flag.cor]} · {w.flag.pontos} pts
                  </Badge>
                  {souPC && w.pessoa && <span className="text-sm font-medium">{w.pessoa.nome}</span>}
                  <span className="text-muted-foreground ml-auto text-xs">{fmtDate(w.created_at)}</span>
                </div>
                <p className="text-sm">{w.justificativa}</p>
                {w.aplicador && (
                  <p className="text-muted-foreground text-xs">Aplicada por {w.aplicador.nome}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
      {!pc && null}
    </div>
  )
}
