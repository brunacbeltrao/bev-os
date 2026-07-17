/** Dashboards consolidados — indicadores por diretoria, visíveis a
 *  todos os membros. Cada diretoria edita a própria seção. */
import { createFileRoute } from '@tanstack/react-router'
import { BarChart3 } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { DashboardsPanel } from '@/components/dashboards-panel'

export const Route = createFileRoute('/_app/dashboards')({ component: DashboardsPage })

function DashboardsPage() {
  const { cycle } = useApp()
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BarChart3 className="size-6" />
          Dashboards
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Indicadores por diretoria · Ciclo {cycle.nome}
        </p>
      </header>
      <DashboardsPanel />
    </div>
  )
}
