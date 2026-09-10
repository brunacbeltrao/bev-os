/**
 * Painel de prazo do contrato: situação, eventos e suspensão.
 *
 * A situação vem do motor (lib/prazos.ts) e nunca é "atrasado" sem
 * baseline — a tela mostra o que falta registrar em vez de acusar atraso
 * que ninguém podia evitar.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/lib/app-context'
import * as E from '@/lib/epeas'
import type { EpeasContrato } from '@/lib/epeas'
import * as P from '@/lib/epeas-prazos'
import {
  EVENTO_LABELS,
  SITUACAO_LABELS,
  SUSPENSAO_LABELS,
  type EventoTipo,
  type PrazoSituacao,
  type SuspensaoMotivo,
} from '@/lib/prazos'
import { Vazio } from '@/components/features/epeas/epeas-shared'
import { ClausulaPrazo } from '@/components/features/epeas/clausula-prazo'

const TOM: Record<PrazoSituacao, 'danger' | 'warning' | 'success' | 'info' | 'neutral'> = {
  estourado: 'danger',
  perto: 'warning',
  no_prazo: 'success',
  suspenso: 'info',
  aguardando_gatilho: 'info',
  sem_baseline: 'neutral',
  sem_prazo: 'neutral',
}

const TIPOS_EVENTO = Object.keys(EVENTO_LABELS) as EventoTipo[]

export function PainelPrazo({
  contrato,
  ctx,
}: {
  contrato: EpeasContrato
  ctx: P.ContextoPrazos
}) {
  const { person } = useApp()
  const qc = useQueryClient()
  const contratoId = contrato.contrato_id

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['epeas-eventos', contratoId] })
    qc.invalidateQueries({ queryKey: ['epeas-suspensoes', contratoId] })
    qc.invalidateQueries({ queryKey: ['epeas-contrato', contratoId] })
    qc.invalidateQueries({ queryKey: ['epeas'] })
  }

  const [tipo, setTipo] = useState<EventoTipo>('assinatura')
  const [quando, setQuando] = useState('')
  const [motivo, setMotivo] = useState<SuspensaoMotivo>('aguardando_cliente')
  const [justificativa, setJustificativa] = useState('')

  const mutEvento = useMutation({
    mutationFn: () => P.registrarEvento(contratoId, tipo, quando, person.id),
    onSuccess: () => {
      toast.success('Evento registrado. O prazo passa a contar dele.')
      setQuando('')
      invalidar()
    },
    onError: () => toast.error('Não foi possível registrar o evento.'),
  })
  const mutRemover = useMutation({
    mutationFn: (id: string) => P.removerEvento(id),
    onSuccess: () => { toast.success('Evento removido.'); invalidar() },
  })
  const mutSuspender = useMutation({
    mutationFn: () => P.suspenderPrazo(contratoId, motivo, justificativa, person.id),
    onSuccess: () => {
      toast.success('Prazo suspenso — o contador está congelado.')
      setJustificativa('')
      invalidar()
    },
    onError: () => toast.error('Não foi possível suspender. Já existe uma pausa aberta?'),
  })
  const mutRetomar = useMutation({
    mutationFn: (id: string) => P.retomarPrazo(id, person.id),
    onSuccess: () => { toast.success('Prazo retomado de onde parou.'); invalidar() },
  })

  const prazo = P.prazoContratual(contrato, ctx)
  const sla = P.slaDaEtapa(contrato, ctx)
  const suspensoes = ctx.suspensoes.get(contratoId) ?? []
  const pausaAberta = suspensoes.find((s) => s.retomada_em === null) ?? null
  const eventos = ctx.eventos.get(contratoId) ?? []

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" aria-hidden="true" /> Prazo contratual
            </CardTitle>
            <CardDescription>{prazo.explicacao}</CardDescription>
          </div>
          <Badge variant={TOM[prazo.situacao]}>{SITUACAO_LABELS[prazo.situacao]}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {prazo.dataPrevista && (
          <p className="text-muted-foreground text-xs">
            Data-limite: <span className="font-medium">{prazo.dataPrevista}</span>
            {prazo.diasSuspensos > 0 &&
              ` · já empurrada por ${prazo.diasSuspensos} dia(s) de suspensão`}
          </p>
        )}

        <ClausulaPrazo contrato={contrato} />
        {/* O SLA interno aparece aqui embaixo, e nomeado, para que ninguém
            confunda a estimativa da equipe com a promessa ao cliente. */}
        {sla.situacao !== 'sem_prazo' && (
          <p className="text-muted-foreground border-t pt-3 text-xs">
            <span className="font-medium">
              SLA interno · {P.SLA_LABELS[sla.situacao]}
            </span>{' '}
            — {contrato.etapa_servico?.nome ?? E.ETAPA_MACRO_LABELS[contrato.etapa_macro]}:{' '}
            {sla.explicacao}
          </p>
        )}

        {/* -------- suspensão -------- */}
        <div className="border-t pt-3">
          {pausaAberta ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <p className="font-medium">{SUSPENSAO_LABELS[pausaAberta.motivo]}</p>
                <p className="text-muted-foreground text-xs">
                  {pausaAberta.justificativa} · desde{' '}
                  {new Date(pausaAberta.iniciada_em).toLocaleDateString('pt-BR')}
                  {pausaAberta.iniciada_por && ` · ${pausaAberta.iniciada_por.nome}`}
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={mutRetomar.isPending}
                onClick={() => mutRetomar.mutate(pausaAberta.id)}
              >
                <Play className="size-3.5" /> Retomar
              </Button>
            </div>
          ) : (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (justificativa.trim()) mutSuspender.mutate()
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="motivo-pausa">Suspender porque</Label>
                <select
                  id="motivo-pausa"
                  className="border-input bg-card h-9 rounded-md border px-3 text-sm shadow-xs"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value as SuspensaoMotivo)}
                >
                  {(Object.keys(SUSPENSAO_LABELS) as SuspensaoMotivo[]).map((m) => (
                    <option key={m} value={m}>{SUSPENSAO_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-48 flex-1">
                <Label htmlFor="just-pausa">Justificativa</Label>
                <Input
                  id="just-pausa"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Ex.: aguardando procuração assinada"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={mutSuspender.isPending || !justificativa.trim()}
              >
                <Pause className="size-3.5" /> Suspender
              </Button>
            </form>
          )}
        </div>

        {/* -------- eventos -------- */}
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-sm font-medium">Eventos que dão início a prazos</p>
          {eventos.length === 0 ? (
            <Vazio>
              Nenhum evento registrado — por isso este contrato não conta como atrasado.
            </Vazio>
          ) : (
            <ul className="flex flex-col divide-y">
              {eventos.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="flex-1">
                    {EVENTO_LABELS[e.tipo]}
                    <span className="text-muted-foreground block text-xs">
                      {e.ocorrido_em}
                      {e.registrado_por && ` · registrado por ${e.registrado_por.nome}`}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remover ${EVENTO_LABELS[e.tipo]}`}
                    onClick={() => mutRemover.mutate(e.id)}
                  >
                    <Trash2 className="text-muted-foreground size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (quando) mutEvento.mutate()
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tipo-evento">Evento</Label>
              <select
                id="tipo-evento"
                className="border-input bg-card h-9 rounded-md border px-3 text-sm shadow-xs"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as EventoTipo)}
              >
                {TIPOS_EVENTO.map((t) => (
                  <option key={t} value={t}>{EVENTO_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data-evento">Ocorreu em</Label>
              <input
                id="data-evento"
                type="date"
                className="border-input bg-card h-9 rounded-md border px-3 text-sm shadow-xs"
                value={quando}
                onChange={(e) => setQuando(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" className="gap-1.5" disabled={!quando || mutEvento.isPending}>
              <Plus className="size-3.5" /> Registrar
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
