/**
 * Peças compartilhadas do EPEAS — usadas pelas quatro visões por papel
 * e pela página do contrato, para que todas falem a mesma língua visual.
 */
import { Link } from '@tanstack/react-router'
import { AlertTriangle, AtSign, ExternalLink, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import * as E from '@/lib/epeas'
import * as P from '@/lib/epeas-prazos'
import * as F from '@/lib/epeas-fila'
import { SITUACAO_LABELS, type ResultadoPrazo } from '@/lib/prazos'

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
      <div className="bg-muted h-1 w-20 overflow-hidden rounded-full">
        <div className="bg-primary/70 h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">
        {i + 1}/{E.ETAPAS_MACRO.length}
      </span>
    </div>
  )
}

/**
 * As duas camadas de prazo, lado a lado.
 *
 * Elas respondem perguntas diferentes e podem discordar: um contrato pode
 * estar dentro do prazo da cláusula e acima da nossa estimativa interna. Por
 * isso aparecem separadas, e só a de cima usa a palavra "atrasado".
 */
export function PrazoResumo({
  contratual,
  sla,
  alinhar = 'end',
}: {
  contratual: ResultadoPrazo
  sla: ResultadoPrazo
  alinhar?: 'start' | 'end'
}) {
  const tomContratual =
    contratual.situacao === 'estourado'
      ? 'text-status-danger font-medium'
      : contratual.situacao === 'perto'
        ? 'text-status-warning'
        : 'text-muted-foreground'
  const tomSla =
    sla.situacao === 'estourado' || sla.situacao === 'perto'
      ? 'text-status-warning'
      : 'text-muted-foreground'

  return (
    <div
      className={`flex flex-col gap-0.5 text-xs ${alinhar === 'end' ? 'items-end' : 'items-start'}`}
    >
      {contratual.situacao !== 'sem_prazo' && (
        <span className={tomContratual}>
          Cliente · {SITUACAO_LABELS[contratual.situacao]}
          {contratual.restantes !== null &&
            contratual.situacao !== 'sem_baseline' &&
            ` (${contratual.restantes < 0 ? `${Math.abs(contratual.restantes)}d além` : `${contratual.restantes}d`})`}
        </span>
      )}
      {sla.situacao !== 'sem_prazo' && (
        <span className={tomSla}>
          Interno · {P.SLA_LABELS[sla.situacao]}
          {sla.decorridos !== null && ` (${sla.decorridos}d úteis nesta etapa)`}
        </span>
      )}
    </div>
  )
}

/** Card de contrato usado em todas as filas. */
export function ContratoCard({
  c,
  ctx,
  acao,
  naoLidos = 0,
  mencionado = false,
}: {
  c: E.EpeasContrato
  ctx: P.ContextoPrazos
  acao?: React.ReactNode
  naoLidos?: number
  mencionado?: boolean
}) {
  const fase = E.faseDaEtapa(c.etapa_macro)
  const contratual = P.prazoContratual(c, ctx)
  const sla = P.slaDaEtapa(c, ctx)

  return (
    <Card
      className={
        c.excecoes_abertas > 0 || contratual.atrasado
          ? 'border-status-danger/40 bg-status-danger-bg/30'
          : sla.atrasado
            ? 'border-status-warning/40'
            : undefined
      }
    >
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
            {c.etapa_servico && (
              <Badge variant={P.SLA_TOM[sla.situacao]} className="w-fit">
                {c.etapa_servico.ordem}. {c.etapa_servico.nome}
              </Badge>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <ProgressoEtapa etapa={c.etapa_macro} />
            <PrazoResumo contratual={contratual} sla={sla} />
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

/**
 * Quem responde pela etapa atual — ou o erro de não haver ninguém.
 *
 * Etapa sem responsável resolvido não pode ser silêncio: é o estado em que
 * o contrato para sem que ninguém saiba que parou. Aqui ele aparece em
 * vermelho, dizendo qual papel falta preencher.
 */
export function ResponsavelDaEtapa({
  c,
  pessoas,
}: {
  c: E.EpeasContrato
  pessoas: { id: string; nome: string }[]
}) {
  const papel = E.papelDaEtapaAtual(c)
  const ids = F.resolverPapel(E.alocacaoDe(c), papel)
  const nomes = ids
    .map((id) => pessoas.find((p) => p.id === id)?.nome)
    .filter((n): n is string => Boolean(n))
  const etapa = c.etapa_servico?.nome ?? E.ETAPA_MACRO_LABELS[c.etapa_macro]

  if (ids.length === 0) {
    return (
      <Card className="border-status-danger/40 bg-status-danger-bg/40">
        <CardContent className="flex items-start gap-2 p-4 text-sm">
          <AlertTriangle className="text-status-danger mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-status-danger font-semibold">Etapa sem responsável</p>
            <p className="text-muted-foreground text-xs">
              "{etapa}" espera {F.PAPEL_LABELS[papel]}, e não há ninguém nesse papel neste
              contrato. Enquanto não houver, a cobrança cai na Diretoria de Negócios.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <p className="text-muted-foreground text-xs">
      Responde por "{etapa}": <span className="text-foreground font-medium">{nomes.join(', ')}</span>{' '}
      ({F.PAPEL_LABELS[papel]})
    </p>
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
