/**
 * Checklist da etapa — transforma "avançar" numa decisão com critério.
 *
 * Antes o botão de avançar era só um botão: cada pessoa decidia sozinha
 * o que considerava pronto. Aqui o que falta fica explícito, e o avanço
 * só libera quando os itens obrigatórios estão marcados.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useApp } from '@/lib/app-context'
import * as E from '@/lib/epeas'
import * as P from '@/lib/epeas-prazos'

export function ChecklistEtapa({
  contrato,
  ctx,
  onAvancar,
  avancando,
}: {
  contrato: E.EpeasContrato
  ctx: P.ContextoPrazos
  onAvancar: () => void
  avancando: boolean
}) {
  const { person } = useApp()
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['epeas-checklist', contrato.contrato_id],
    queryFn: () => E.getChecklist(contrato.contrato_id),
  })
  const feitos = q.data ?? []
  const itens = E.CHECKLIST[contrato.etapa_macro] ?? []
  const marcados = new Set(
    feitos.filter((f) => f.etapa === contrato.etapa_macro).map((f) => f.item_key),
  )
  const pendentes = E.pendenciasDaEtapa(contrato.etapa_macro, feitos)

  const i = E.ETAPAS_MACRO.indexOf(contrato.etapa_macro)
  const proxima = E.ETAPAS_MACRO[i + 1]

  const mut = useMutation({
    mutationFn: ({ key, marcar }: { key: string; marcar: boolean }) =>
      marcar
        ? E.marcarItem(contrato.contrato_id, contrato.etapa_macro, key, person.id)
        : E.desmarcarItem(contrato.contrato_id, contrato.etapa_macro, key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['epeas-checklist', contrato.contrato_id] }),
    onError: () => toast.error('Não foi possível atualizar o item.'),
  })

  // SLA da etapa macro, não da trilha: este cartão é sobre a etapa do fluxo
  // em que o contrato está agora. Nunca diz "atrasado" — isso é do contratual.
  const sla = P.slaEtapaMacro(contrato, ctx)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{E.ETAPA_MACRO_LABELS[contrato.etapa_macro]}</CardTitle>
            <CardDescription>
              {E.FASE_LABELS[E.faseDaEtapa(contrato.etapa_macro)]}
              {sla.decorridos !== null &&
                ` · há ${sla.decorridos} ${sla.decorridos === 1 ? 'dia útil' : 'dias úteis'} nesta etapa`}
              {sla.diasSuspensos > 0 && ` · ${sla.diasSuspensos}d não contaram por suspensão`}
            </CardDescription>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              sla.situacao === 'estourado' || sla.situacao === 'perto'
                ? 'bg-status-warning-bg text-status-warning'
                : 'bg-accent text-accent-foreground'
            }`}
            title="SLA interno da etapa — estimativa nossa, não o prazo da cláusula"
          >
            SLA interno · {P.SLA_LABELS[sla.situacao]}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {itens.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sem itens obrigatórios nesta etapa.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {itens.map((item) => {
              const feito = marcados.has(item.key)
              const quem = feitos.find(
                (f) => f.etapa === contrato.etapa_macro && f.item_key === item.key,
              )
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    disabled={mut.isPending}
                    onClick={() => mut.mutate({ key: item.key, marcar: !feito })}
                    className="hover:bg-accent/50 flex w-full items-start gap-2.5 rounded-md p-2 text-left transition-colors"
                  >
                    <span
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                        feito ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                      }`}
                      aria-hidden="true"
                    >
                      {feito && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className={`text-sm ${feito ? 'text-muted-foreground line-through' : ''}`}>
                        {item.label}
                        {!item.obrigatorio && (
                          <span className="text-muted-foreground text-xs"> · opcional</span>
                        )}
                      </span>
                      {feito && quem?.feito_por && (
                        <span className="text-muted-foreground block text-xs">
                          {quem.feito_por.nome} · {new Date(quem.feito_em).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {proxima && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Próxima: </span>
              <span className="font-medium">{E.ETAPA_MACRO_LABELS[proxima]}</span>
              {pendentes.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  Falta: {pendentes.map((p) => p.label).join(' · ')}
                </p>
              )}
            </div>
            <Button
              className="gap-1.5"
              disabled={avancando || pendentes.length > 0}
              onClick={onAvancar}
            >
              Avançar <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
