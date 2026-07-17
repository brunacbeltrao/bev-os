/**
 * Direx — Centro de Comando (Blueprint §5.1 / ADD).
 * Para Gerentes: exibe apenas os agregados da direx_summary_view.
 * Para Diretores: exibe a Inbox com semáforos de prioridade.
 */
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FileText, Gavel, Landmark, Lock, CheckCircle2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useApp } from '@/lib/app-context'
import { getDirexSummary, getInboxItems } from '@/lib/direx'
import { fmtDate } from '@/lib/use-context-scope'

export const Route = createFileRoute('/_app/direx/')({ component: DirexResumoPage })

function DirexResumoPage() {
  const { isDirex, primary, cycle } = useApp()
  const isGerente = primary.role === 'gerente'

  const summaryQ = useQuery({
    queryKey: ['direx-summary', cycle.id],
    queryFn: () => getDirexSummary(cycle.id),
    enabled: isDirex || isGerente,
  })

  const inboxQ = useQuery({
    queryKey: ['direx-inbox', cycle.id],
    queryFn: () => getInboxItems(cycle.id),
    enabled: isDirex,
  })

  if (!isDirex && !isGerente) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <Lock className="text-muted-foreground mx-auto mb-3 size-8" />
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          O módulo Direx é acessível a Diretores e, de forma resumida, a Gerentes.
        </p>
      </div>
    )
  }

  const s = summaryQ.data
  const myInbox = (inboxQ.data ?? []).filter((item) => item.responsavel_id === primary.id)

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Landmark className="size-6" />
          Centro de Comando
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isDirex
            ? `Visão executiva e Inbox de pendências · Ciclo ${cycle.nome}`
            : `Visão resumida para Gerentes · Ciclo ${cycle.nome} — sem acesso a atas completas e decisões.`}
        </p>
      </header>

      {summaryQ.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="sm:col-span-1 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="size-4" /> Atas de RD
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s?.total_atas ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Última: {fmtDate(s?.ultima_rd)}</p>
            </CardContent>
          </Card>
          <Card className="sm:col-span-1 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Gavel className="size-4" /> Decisões Macro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s?.total_decisoes ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Última: {fmtDate(s?.ultima_decisao)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isDirex && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            Inbox: O que depende de mim?
            <Badge variant="secondary" className="ml-2">
              {myInbox.length} itens
            </Badge>
          </h2>

          {inboxQ.isPending ? (
            <Skeleton className="h-40" />
          ) : myInbox.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="size-10 text-muted-foreground/30 mb-4" />
                <h3 className="font-medium text-lg">Inbox Zero!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Nenhuma tarefa, decisão pendente ou problema crítico sob sua responsabilidade neste momento.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {myInbox.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-sm"
                >
                  <div
                    className={`size-2.5 shrink-0 rounded-full ${
                      item.cor === 'vermelho'
                        ? 'bg-red-500'
                        : item.cor === 'amarelo'
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                        {item.tipo}
                      </Badge>
                      {item.prazo && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" /> {fmtDate(item.prazo)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{item.titulo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
