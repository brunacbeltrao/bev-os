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
  const { person, primary, cycle } = useApp()
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
