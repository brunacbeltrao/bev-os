/**
 * Topbar (Blueprint §1): fixa e igual em todo o sistema.
 * logo BEV OS | Seletor de Contexto | Busca | Toggle de tema | Avatar
 */
import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut, UserCircle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ContextSelector } from './context-selector'
import { GlobalSearch } from './global-search'
import { ThemeToggle } from './theme-toggle'
import { useApp } from '@/lib/app-context'
import { occupationAreaLabel, ROLE_LABELS } from '@/lib/org'
import { initials } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export function Topbar() {
  const { person, primary, cycle } = useApp()
  const navigate = useNavigate()

  async function sair() {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  return (
    <header className="bg-topbar sticky top-0 z-40 flex h-14 items-center gap-4 border-b px-4">
      <Link to="/" className="flex items-center gap-2">
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-bold">
          B
        </span>
        <span className="text-sm font-semibold tracking-tight">BEV OS</span>
      </Link>

      <ContextSelector />

      <div className="ml-auto flex items-center gap-1.5">
        <GlobalSearch />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar>
                {person.foto_url && <AvatarImage src={person.foto_url} alt={person.nome} />}
                <AvatarFallback>{initials(person.nome)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{person.nome}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {ROLE_LABELS[primary.role]} · {occupationAreaLabel(primary)} · Ciclo {cycle.nome}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate({ to: '/perfil' })}>
              <UserCircle />
              Meu perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={sair}>
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
