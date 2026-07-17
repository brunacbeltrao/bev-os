import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { routeTree } from './routeTree.gen'

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="text-primary text-6xl font-bold">404</span>
      <p className="text-muted-foreground">Essa página não existe no BEV OS.</p>
      <a href="/" className="text-primary font-medium hover:underline">
        Voltar para a Home
      </a>
    </div>
  )
}

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    },
    // Feedback global e consistente para toda mutação (Blueprint §8:
    // padrões transversais) — sucesso e erro sempre visíveis.
    mutationCache: new MutationCache({
      onSuccess: () => {
        toast.success('Salvo!', { duration: 1800 })
      },
      onError: (error) => {
        const msg = error instanceof Error ? error.message : ''
        toast.error(
          msg.includes('BEV_OS_')
            ? msg.split(':').slice(1).join(':').trim() || 'Ação não permitida.'
            : 'Não foi possível concluir a ação. Tente novamente.',
        )
      },
    }),
  })

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
