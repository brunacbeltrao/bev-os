/**
 * Frequência (Onda 3) — Formulário + Histórico: justificativa de
 * ausência em evento específico (não é ponto diário). Liderança do
 * evento aprova/rejeita com a barra transversal.
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ApprovalBar } from '@/components/approval-bar'
import { useApp } from '@/lib/app-context'
import { eventDisplayName, getEvents } from '@/lib/agenda'
import {
  createJustification,
  getJustifications,
  setJustificationStatus,
  JUST_BADGE,
} from '@/lib/frequencia'
import { fmtDate } from '@/lib/use-context-scope'

export const Route = createFileRoute('/_app/frequencia')({ component: FrequenciaPage })

function FrequenciaPage() {
  const { person } = useApp()
  const queryClient = useQueryClient()
  const [eventId, setEventId] = useState('')
  const [motivo, setMotivo] = useState('')

  // Eventos dos últimos 60 dias e próximos 30 (para justificar)
  const from = new Date(Date.now() - 60 * 86400000).toISOString()
  const to = new Date(Date.now() + 30 * 86400000).toISOString()
  const eventsQ = useQuery({ queryKey: ['events-just'], queryFn: () => getEvents(from, to) })
  const justQ = useQuery({ queryKey: ['justifications'], queryFn: getJustifications })

  const inv = () => queryClient.invalidateQueries({ queryKey: ['justifications'] })
  const createMut = useMutation({
    mutationFn: () => createJustification(person.id, eventId, motivo),
    onSuccess: () => {
      setMotivo('')
      setEventId('')
      inv()
    },
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'aprovado' | 'rejeitado' }) =>
      setJustificationStatus(id, status),
    onSuccess: inv,
  })

  const minhas = (justQ.data ?? []).filter((j) => j.person_id === person.id)
  const paraAprovar = (justQ.data ?? []).filter(
    (j) => j.person_id !== person.id && j.status === 'pendente',
  )

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <ShieldCheck className="size-4.5" />
          </span>
          Frequência
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Justificativas de ausência em reuniões e eventos — não é controle de ponto.
        </p>
      </header>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="text-base">Justificar ausência</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (eventId && motivo.trim()) createMut.mutate()
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label>Evento</Label>
              <select
                className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-9 rounded-md border px-3 text-sm shadow-xs transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                required
              >
                <option value="">Selecionar…</option>
                {(eventsQ.data ?? []).map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {fmtDate(ev.data)} · {eventDisplayName(ev)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Motivo</Label>
              <Textarea required value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            <Button type="submit" className="self-start" disabled={createMut.isPending}>
              Enviar justificativa
            </Button>
          </form>
        </CardContent>
      </Card>

      {paraAprovar.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-medium">Aguardando sua aprovação</h2>
          <div className="mb-5 flex flex-col gap-2">
            {paraAprovar.map((j) => (
              <Card key={j.id}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <ApprovalBar
                    titulo={`${j.pessoa?.nome ?? 'Membro'} · ${eventDisplayName(j.event as never)} (${fmtDate(j.event.data)})`}
                    onAprovar={() => statusMut.mutate({ id: j.id, status: 'aprovado' })}
                    onReprovar={() => statusMut.mutate({ id: j.id, status: 'rejeitado' })}
                    disabled={statusMut.isPending}
                  />
                  <p className="text-sm">{j.motivo}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-2 text-sm font-medium">Minhas justificativas</h2>
      <div className="flex flex-col gap-2">
        {justQ.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : minhas.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-center text-sm">
              Nenhuma justificativa enviada.
            </CardContent>
          </Card>
        ) : (
          minhas.map((j) => (
            <Card key={j.id}>
              <CardContent className="flex items-center gap-2 p-4 text-sm">
                <Badge variant={JUST_BADGE[j.status]}>{j.status}</Badge>
                <span className="min-w-0 flex-1 truncate">
                  {eventDisplayName(j.event as never)} · {fmtDate(j.event.data)} — {j.motivo}
                </span>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
