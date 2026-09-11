/**
 * Estado de ciclo de vida do contrato.
 *
 * Estado é outro eixo, perpendicular à etapa: um contrato PAUSADO continua
 * na etapa em que estava e volta dela quando retomar. Antes disto, contrato
 * parado ficava indistinguível de contrato andando devagar, e distratado
 * continuava na carteira ativa sendo cobrado por prazo que ninguém ia mais
 * cumprir.
 *
 * O motivo é de lista fechada porque "motivo" em texto livre não vira
 * relatório — vira trinta frases diferentes para a mesma coisa.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleDot } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useApp } from '@/lib/app-context'
import * as E from '@/lib/epeas'
import { ESTADO_LABELS, ESTADOS_ATIVOS, type Estado } from '@/lib/epeas-fila'
import { isDirexMember } from '@/lib/permissions'

const TOM: Record<Estado, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  em_execucao: 'success',
  pausado: 'warning',
  distratado: 'danger',
  cancelado: 'danger',
  concluido: 'info',
}

const ESTADOS: Estado[] = ['em_execucao', 'pausado', 'distratado', 'cancelado', 'concluido']

/** O que cada estado faz, dito antes de a pessoa confirmar. */
const CONSEQUENCIA: Record<Estado, string> = {
  em_execucao: 'Volta a contar prazo e a aparecer nas filas.',
  pausado: 'O relógio para. O contrato continua na carteira e na fila de quem responde por ele.',
  distratado: 'Sai da carteira ativa, para de cobrar prazo e sai do faturamento do ano.',
  cancelado: 'Sai da carteira ativa e do faturamento. Use quando o contrato não chegou a existir.',
  concluido: 'Encerra o contrato. Só com a etapa em "Entregue" e sem requisito pendente.',
}

export function EstadoContrato({
  contrato,
  pendencias,
}: {
  contrato: E.EpeasContrato
  pendencias: E.Pendencia[]
}) {
  const { occupations } = useApp()
  const qc = useQueryClient()
  const [alvo, setAlvo] = useState<Estado | null>(null)
  const [motivoId, setMotivoId] = useState('')
  const [observacao, setObservacao] = useState('')

  const motivosQ = useQuery({
    queryKey: ['epeas-estado-motivos'],
    queryFn: E.getEstadoMotivos,
    staleTime: 10 * 60_000,
  })

  // Tirar da carteira é decisão de quem responde por ela.
  const podeMudar =
    isDirexMember(occupations) ||
    occupations.some(
      (o) =>
        ['negocios', 'projetos'].includes(o.directorate.slug) &&
        ['diretor', 'gerente'].includes(o.role),
    )

  const mut = useMutation({
    mutationFn: () => E.mudarEstado(contrato.contrato_id, alvo!, motivoId || null, observacao),
    onSuccess: () => {
      toast.success(`Contrato agora está "${ESTADO_LABELS[alvo!]}".`)
      setAlvo(null)
      setMotivoId('')
      setObservacao('')
      qc.invalidateQueries({ queryKey: ['epeas-contrato', contrato.contrato_id] })
      qc.invalidateQueries({ queryKey: ['epeas-historico', contrato.contrato_id] })
      qc.invalidateQueries({ queryKey: ['epeas'] })
      qc.invalidateQueries({ queryKey: ['contratos'] })
    },
    onError: () => toast.error('Não foi possível mudar o estado.'),
  })

  const motivos = (motivosQ.data ?? []).filter((m) => m.estado === alvo)

  // "Concluído exige encerramento completo": a trava é aqui, e o motivo
  // aparece na tela em vez de o botão só não funcionar.
  const impedeConcluir =
    alvo === 'concluido'
      ? contrato.etapa_macro !== 'projetos_entregue'
        ? 'O contrato precisa estar na etapa "Entregue".'
        : pendencias.length > 0
          ? `Ainda faltam ${pendencias.length} requisito(s) da etapa.`
          : null
      : null

  const precisaMotivo = alvo !== null && alvo !== 'em_execucao'
  const podeConfirmar =
    alvo !== null && !impedeConcluir && (!precisaMotivo || motivoId !== '') && !mut.isPending

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDot className="size-4" aria-hidden="true" /> Estado do contrato
            </CardTitle>
            <CardDescription>
              {contrato.estado_motivo
                ? `${contrato.estado_motivo.label}${contrato.estado_observacao ? ` — ${contrato.estado_observacao}` : ''}`
                : CONSEQUENCIA[contrato.estado]}
            </CardDescription>
          </div>
          <Badge variant={TOM[contrato.estado]}>{ESTADO_LABELS[contrato.estado]}</Badge>
        </div>
      </CardHeader>

      {podeMudar && (
        <CardContent className="flex flex-wrap gap-2">
          {ESTADOS.filter((e) => e !== contrato.estado).map((e) => (
            <Button key={e} size="sm" variant="outline" onClick={() => setAlvo(e)}>
              {ESTADO_LABELS[e]}
            </Button>
          ))}
        </CardContent>
      )}

      {!podeMudar && !ESTADOS_ATIVOS.includes(contrato.estado) && (
        <CardContent>
          <p className="text-muted-foreground text-xs">
            Este contrato saiu da carteira ativa. Só a Diretoria pode reabri-lo.
          </p>
        </CardContent>
      )}

      <Dialog open={alvo !== null} onOpenChange={(o) => !o && setAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mudar para "{alvo ? ESTADO_LABELS[alvo] : ''}"</DialogTitle>
            <DialogDescription>{alvo ? CONSEQUENCIA[alvo] : ''}</DialogDescription>
          </DialogHeader>

          {impedeConcluir ? (
            <p className="text-status-warning text-sm">{impedeConcluir}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {precisaMotivo && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="motivo-estado">Motivo</Label>
                  <select
                    id="motivo-estado"
                    className="border-input bg-card h-9 rounded-md border px-3 text-sm shadow-xs"
                    value={motivoId}
                    onChange={(e) => setMotivoId(e.target.value)}
                  >
                    <option value="">Escolha um motivo…</option>
                    {motivos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="obs-estado">Observação (opcional)</Label>
                <Textarea
                  id="obs-estado"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="O que o motivo sozinho não conta."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAlvo(null)}>
              Cancelar
            </Button>
            <Button disabled={!podeConfirmar} onClick={() => mut.mutate()}>
              {mut.isPending ? 'Gravando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
