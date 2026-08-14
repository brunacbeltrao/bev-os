/**
 * Confirmação de ações destrutivas (Blueprint §8: padrões transversais).
 *
 * Substitui o confirm() nativo, que rompia a identidade visual, não
 * distinguia ação destrutiva de trivial e — pior — é suprimido por alguns
 * navegadores móveis, caso em que a exclusão acontecia sem confirmação.
 *
 * Uso:
 *   const confirmar = useConfirm()
 *   if (await confirmar({ titulo: 'Excluir X?', destrutivo: true })) mut.mutate()
 */
import { createContext, use, useCallback, useRef, useState } from 'react'
import { Button } from './button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'

export interface ConfirmOptions {
  titulo: string
  descricao?: string
  /** Rótulo do botão de ação. Padrão: "Excluir" se destrutivo, "Confirmar" caso contrário. */
  confirmar?: string
  cancelar?: string
  destrutivo?: boolean
}

type Resolver = (ok: boolean) => void

const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null)

export function useConfirm() {
  const ctx = use(ConfirmContext)
  if (!ctx) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>')
  return ctx
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opcoes, setOpcoes] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<Resolver | null>(null)

  const confirmar = useCallback((o: ConfirmOptions) => {
    setOpcoes(o)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const responder = useCallback((ok: boolean) => {
    resolverRef.current?.(ok)
    resolverRef.current = null
    setOpcoes(null)
  }, [])

  const destrutivo = opcoes?.destrutivo ?? false

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <Dialog
        open={opcoes !== null}
        // Fechar pelo Esc, pelo X ou clicando fora equivale a cancelar —
        // nunca a confirmar.
        onOpenChange={(aberto) => !aberto && responder(false)}
      >
        <DialogContent className="sm:max-w-md">
          {opcoes && (
            <>
              <DialogHeader>
                <DialogTitle>{opcoes.titulo}</DialogTitle>
                {opcoes.descricao && <DialogDescription>{opcoes.descricao}</DialogDescription>}
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => responder(false)}>
                  {opcoes.cancelar ?? 'Cancelar'}
                </Button>
                <Button
                  autoFocus
                  variant={destrutivo ? 'destructive' : 'default'}
                  onClick={() => responder(true)}
                >
                  {opcoes.confirmar ?? (destrutivo ? 'Excluir' : 'Confirmar')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
