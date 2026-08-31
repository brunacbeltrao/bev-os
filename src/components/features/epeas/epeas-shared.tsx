/**
 * Peças compartilhadas do EPEAS — usadas pelas quatro visões por papel
 * e pela página do contrato, para que todas falem a mesma língua visual.
 */
import { Link } from '@tanstack/react-router'
import { AlertTriangle, AtSign, ExternalLink, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import * as E from '@/lib/epeas'

export const fmtBRLCurto = (n: number) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export const fmtData = (iso: string | null) =>
  iso ? new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR') : '—'

const FASE_BADGE = {
  comercial: 'info',
  gestao: 'warning',
  projetos: 'success',
} as const

/** Barra de progresso do fluxo macro — 12 etapas. */
export function ProgressoEtapa({ etapa }: { etapa: E.EtapaMacro }) {
  const i = E.ETAPAS_MACRO.indexOf(etapa)
  const pct = Math.round(((i + 1) / E.ETAPAS_MACRO.length) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">
        {i + 1}/{E.ETAPAS_MACRO.length}
      </span>
    </div>
  )
}

/** Card de contrato usado em todas as filas. */
export function ContratoCard({
  c,
  acao,
  naoLidos = 0,
  mencionado = false,
}: {
  c: E.EpeasContrato
  acao?: React.ReactNode
  naoLidos?: number
  mencionado?: boolean
}) {
  const fase = E.faseDaEtapa(c.etapa_macro)
  const alerta = E.alertaPagamento(c)
  const status = E.statusEtapa(c)

  return (
    <Card className={c.excecoes_abertas > 0 ? 'border-destructive/50' : undefined}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/epeas/contrato/$contratoId"
              params={{ contratoId: c.contrato_id }}
              className="hover:text-primary font-semibold hover:underline"
            >
              {c.contrato.cliente}
            </Link>
            <p className="text-muted-foreground text-xs">
              {c.contrato.servico?.nome ?? 'Serviço não informado'} ·{' '}
              {fmtBRLCurto(Number(c.contrato.valor))} · fechado em {fmtData(c.contrato.data_fechamento)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {mencionado && (
              <Badge variant="info" className="gap-1">
                <AtSign className="size-3" aria-hidden="true" />
                citaram você
              </Badge>
            )}
            {naoLidos > 0 && (
              <Badge variant="neutral" className="gap-1">
                <MessageSquare className="size-3" aria-hidden="true" />
                {naoLidos}
              </Badge>
            )}
            <Badge variant={FASE_BADGE[fase]}>{E.FASE_LABELS[fase]}</Badge>
            {c.excecoes_abertas > 0 && (
              <Badge variant="danger" className="gap-1">
                <AlertTriangle className="size-3" aria-hidden="true" />
                {c.excecoes_abertas}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{E.ETAPA_MACRO_LABELS[c.etapa_macro]}</span>
            {c.etapa_execucao && (
              <Badge variant={E.ETAPA_EXECUCAO_BADGE[c.etapa_execucao]} className="w-fit">
                {E.ETAPA_EXECUCAO_LABELS[c.etapa_execucao]}
              </Badge>
            )}
            {alerta && (
              <span
                className={`text-xs font-medium ${alerta.nivel === 'critico' ? 'text-destructive' : 'text-amber-600'}`}
              >
                {alerta.nivel === 'critico' ? 'Pagamento crítico' : 'Pagamento pendente'} · há{' '}
                {alerta.dias} dias
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <ProgressoEtapa etapa={c.etapa_macro} />
            <span
              className={`text-xs ${
                status.saude === 'atrasado'
                  ? 'text-destructive font-medium'
                  : status.saude === 'atencao'
                    ? 'text-amber-600'
                    : 'text-muted-foreground'
              }`}
            >
              há {status.dias}d nesta etapa
              {status.saude === 'atrasado' && ` · prazo ${status.sla}d`}
            </span>
          </div>
        </div>

        {(c.nucleo || c.gestao_responsavel) && (
          <p className="text-muted-foreground text-xs">
            {c.gestao_responsavel && `Gestão: ${c.gestao_responsavel.nome}`}
            {c.gestao_responsavel && c.nucleo && ' · '}
            {c.nucleo && `Núcleo ${c.nucleo.nome}`}
            {c.gerente_nucleo && ` · Gerente ${c.gerente_nucleo.nome}`}
          </p>
        )}

        {acao && <div className="flex flex-wrap gap-2 border-t pt-3">{acao}</div>}
      </CardContent>
    </Card>
  )
}

export function LinkExterno({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  )
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
      {children}
    </div>
  )
}
