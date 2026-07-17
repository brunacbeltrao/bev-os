/**
 * Layout autenticado: guarda de sessão + Topbar + Sidebar contextual
 * (Blueprint §1). Tudo dentro de /_app exige login.
 */
import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { AppProvider, useSupabaseSession } from '@/lib/app-context'

export const Route = createFileRoute('/_app')({ component: AppLayout })

function LoadingShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex h-14 items-center gap-4 border-b px-4">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="ml-auto h-7 w-56" />
      </div>
      <div className="flex flex-1">
        <div className="w-60 border-r p-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-7 w-full" />
          ))}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="mb-4 h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  )
}

function AppLayout() {
  const auth = useSupabaseSession()

  if (auth.status === 'loading') return <LoadingShell />
  if (auth.status === 'anon') return <Navigate to="/login" />

  return (
    <AppProvider session={auth.session} fallback={<LoadingShell />}>
      <div className="flex min-h-screen flex-col">
        <Topbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AppProvider>
  )
}
