/**
 * Seletor de Contexto (Blueprint §2) — mecanismo central de navegação.
 * Diretor: "Minha Diretoria" · "Visão Geral BEV" · Direx.
 * Gerente/Coordenador: "Minha Área" (fixo).
 * Analista/Assessor: "Minha Área"; híbrido alterna entre as duas áreas.
 */
import { useNavigate } from '@tanstack/react-router'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useApp, type AppContextSelection } from '@/lib/app-context'

export function ContextSelector() {
  const { context, contextOptions, setContext } = useApp()
  const navigate = useNavigate()

  function select(option: AppContextSelection) {
    setContext(option)
    // Visão Geral BEV e Direx têm telas (e sidebars) próprias — Blueprint §5.
    if (option.kind === 'bev') navigate({ to: '/visao-geral' })
    else if (option.kind === 'direx') navigate({ to: '/direx' })
    else navigate({ to: '/' })
  }

  if (contextOptions.length <= 1) {
    // "Minha Área" fixo, sem opção de trocar
    return (
      <div className="text-foreground bg-secondary rounded-md px-3 py-1.5 text-sm font-medium">
        {context.label}
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 font-medium">
          {context.label}
          <ChevronsUpDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Contexto</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {contextOptions.map((option) => (
          <DropdownMenuItem key={option.label} onSelect={() => select(option)}>
            <span className="flex-1">{option.label}</span>
            {option.label === context.label && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
