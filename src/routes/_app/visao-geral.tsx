/**
 * Visão Geral BEV (Blueprint §5.2) — só Diretor.
 * Painel de leitura consolidada, sem módulos de ação. Na Onda 0
 * mostra a composição de pessoas por diretoria; os indicadores por
 * módulo (demandas, comercial, financeiro…) se somam a cada onda.
 */
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Eye, Lock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/lib/app-context'
import { getDirectory } from '@/lib/org'
import { DashboardsPanel } from '@/components/dashboards-panel'

export const Route = createFileRoute('/_app/visao-geral')({ component: VisaoGeralPage })

function VisaoGeralPage() {
  const { isDirex, cycle } = useApp()

  const dirQ = useQuery({
    queryKey: ['directory', cycle.id, null],
    queryFn: () => getDirectory(cycle.id, null),
    enabled: isDirex,
  })

  if (!isDirex) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <Lock className="text-muted-foreground mx-auto mb-3 size-8" />
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          A Visão Geral BEV é exclusiva de Diretores.
        </p>
      </div>
    )
  }

  const porDiretoria = new Map<string, { total: number; lideranca: number }>()
  for (const e of dirQ.data ?? []) {
    if (e.occupation.is_hibrido) continue
    const nome = e.occupation.directorate.nome
    const atual = porDiretoria.get(nome) ?? { total: 0, lideranca: 0 }
    atual.total += 1
    if (['diretor', 'gerente', 'coordenador'].includes(e.occupation.role)) atual.lideranca += 1
    porDiretoria.set(nome, atual)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Eye className="size-6" />
          Visão Geral BEV
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Leitura consolidada de todas as áreas · Ciclo {cycle.nome} · somente leitura
        </p>
      </header>

      {dirQ.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...porDiretoria.entries()].map(([nome, v]) => (
            <Card key={nome}>
              <CardHeader>
                <CardTitle className="text-base">{nome}</CardTitle>
                <CardDescription>
                  {v.total} {v.total === 1 ? 'membro' : 'membros'} · {v.lideranca} em liderança
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">
                  Indicadores de demandas, entregas e financeiro somam-se aqui nas próximas ondas.
                </p>
              </CardContent>
            </Card>
          ))}
          {porDiretoria.size === 0 && (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="text-muted-foreground p-8 text-center text-sm">
                Nenhum membro cadastrado ainda.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">Indicadores consolidados</h2>
        <DashboardsPanel />
      </div>
    </div>
  )
}
