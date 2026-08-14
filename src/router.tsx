import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ErrorState } from './components/ui/error-state'
import { routeTree } from './routeTree.gen'

/**
 * Erro em qualquer rota. Como o errorComponent substitui apenas o conteúdo
 * da rota que falhou, o layout do _app (sidebar e topbar) continua de pé —
 * a pessoa consegue navegar para outro módulo em vez de ficar presa.
 */
function RouteError({ error, reset }: { error: unknown; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-8">
      <ErrorState error={error} reset={reset} />
    </div>
  )
}

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
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
        // Sem isto, uma query que falha devolve data: undefined e a tela
        // renderiza vazia — indistinguível de "não há nada aqui". Lançando
        // o erro, ele sobe para o errorComponent da rota e a pessoa entende
        // o que aconteceu. Cobre as ~116 queries sem tocar em cada uma.
        throwOnError: true,
      },
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
    defaultErrorComponent: RouteError,
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
