/**
 * Topbar (Blueprint §1): fixa e igual em todo o sistema.
 * menu (mobile) | logo BEV OS | Seletor de Contexto | Busca | Tema | Avatar
 */
import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut, Menu, UserCircle } from 'lucide-react'
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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SidebarContent } from './sidebar'
import { GlobalSearch } from './global-search'
import { ThemeToggle } from './theme-toggle'
import { useApp } from '@/lib/app-context'
import { occupationAreaLabel, ROLE_LABELS } from '@/lib/org'
import { initials } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export function Topbar() {
  const { person, primary, cycle, isLeader, isDirex, bevCoinsBalance } = useApp()
  const navigate = useNavigate()
  const [menuAberto, setMenuAberto] = useState(false)

  async function sair() {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  return (
    <header className="bg-topbar/90 sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-4 backdrop-blur-md">
      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="bg-sidebar flex w-72 flex-col gap-0 overflow-y-auto p-0 pt-10"
        >
          <SheetTitle className="sr-only">Navegação</SheetTitle>
          <div className="flex flex-col gap-1 p-3 md:hidden border-b border-sidebar-border">
            {isLeader && (
              <Link
                to="/gerente"
                onClick={() => setMenuAberto(false)}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md hover:bg-sidebar-accent"
                activeProps={{ className: 'bg-primary/10 text-primary hover:bg-primary/20 font-bold' }}
              >
                Painel da Gerência
              </Link>
            )}
            {isDirex && (
              <Link
                to="/diretor"
                onClick={() => setMenuAberto(false)}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md hover:bg-sidebar-accent"
                activeProps={{ className: 'bg-primary/10 text-primary hover:bg-primary/20 font-bold' }}
              >
                Painel da Diretoria
              </Link>
            )}
          </div>
          <SidebarContent onNavigate={() => setMenuAberto(false)} />
        </SheetContent>
      </Sheet>

      <Link
        to="/"
        className="focus-visible:ring-ring/60 flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2"
      >
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-bold">
          B
        </span>
        <span className="text-sm font-semibold tracking-tight">BEV OS</span>
      </Link>

      <div className="ml-auto flex items-center gap-3">
        {/* Painéis de Liderança na barra superior */}
        <div className="hidden md:flex items-center gap-1.5">
          {isLeader && (
            <Link
              to="/gerente"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted"
              activeProps={{ className: 'bg-primary/10 text-primary hover:bg-primary/20' }}
            >
              Painel da Gerência
            </Link>
          )}
          {isDirex && (
            <Link
              to="/diretor"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted"
              activeProps={{ className: 'bg-primary/10 text-primary hover:bg-primary/20' }}
            >
              Painel da Diretoria
            </Link>
          )}
        </div>

        {/* Saldo de BevCoins */}
        <Link
          to="/fid"
          className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-yellow-500/20 transition-all shadow-xs"
        >
          <span>🪙</span>
          <span>
            {bevCoinsBalance.toLocaleString('pt-BR', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 1,
            })}{' '}
            BC
          </span>
        </Link>

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
