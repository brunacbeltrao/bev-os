/**
 * Estado de erro padrão (Blueprint §8: padrões transversais).
 *
 * Existe para que uma falha nunca vire tela em branco. Distingue os casos
 * que o usuário consegue interpretar — sessão expirada, sem permissão,
 * sem conexão — do erro genérico, que oferece "tentar de novo".
 */
import { AlertTriangle, Lock, RefreshCw, WifiOff } from 'lucide-react'
import { Button } from './button'

type Tipo = 'permissao' | 'sessao' | 'rede' | 'generico'

function classificar(error: unknown): Tipo {
  const msg = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()

  if (msg.includes('jwt') || msg.includes('session') || msg.includes('refresh token')) {
    return 'sessao'
  }
  // Postgres 42501 = insufficient_privilege; PostgREST devolve "permission denied"
  if (msg.includes('42501') || msg.includes('permission denied') || msg.includes('row-level security')) {
    return 'permissao'
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
    return 'rede'
  }
  return 'generico'
}

const CONTEUDO: Record<Tipo, { icone: typeof AlertTriangle; titulo: string; texto: string }> = {
  sessao: {
    icone: Lock,
    titulo: 'Sua sessão expirou',
    texto: 'Entre de novo para continuar de onde parou.',
  },
  permissao: {
    icone: Lock,
    titulo: 'Você não tem acesso a esta área',
    texto: 'Se acha que deveria ter, fale com a Diretoria de Gestão ou com P&C.',
  },
  rede: {
    icone: WifiOff,
    titulo: 'Sem conexão',
    texto: 'Não conseguimos falar com o servidor. Verifique sua internet.',
  },
  generico: {
    icone: AlertTriangle,
    titulo: 'Algo deu errado por aqui',
    texto: 'A falha foi só nesta tela — o resto do BEV OS continua funcionando.',
  },
}

export function ErrorState({
  error,
  reset,
  className,
}: {
  error: unknown
  reset?: () => void
  className?: string
}) {
  const tipo = classificar(error)
  const { icone: Icone, titulo, texto } = CONTEUDO[tipo]
  const detalhe = error instanceof Error ? error.message : null

  return (
    <div
      role="alert"
      className={
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center ' +
        (className ?? '')
      }
    >
      <Icone className="text-muted-foreground size-8" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{titulo}</p>
        <p className="text-muted-foreground max-w-sm text-sm">{texto}</p>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {tipo === 'sessao' ? (
          <Button asChild size="sm">
            <a href="/login">Entrar de novo</a>
          </Button>
        ) : (
          reset && (
            <Button size="sm" variant="outline" onClick={reset} className="gap-2">
              <RefreshCw className="size-4" aria-hidden="true" />
              Tentar de novo
            </Button>
          )
        )}
      </div>

      {detalhe && (
        <details className="mt-2 max-w-full">
          <summary className="text-muted-foreground cursor-pointer text-xs hover:underline">
            Detalhes técnicos
          </summary>
          <pre className="text-muted-foreground mt-2 max-w-full overflow-x-auto rounded bg-muted p-2 text-left text-[11px] whitespace-pre-wrap">
            {detalhe}
          </pre>
        </details>
      )}
    </div>
  )
}
