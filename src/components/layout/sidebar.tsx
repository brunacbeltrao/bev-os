/**
 * Sidebar contextual (Blueprint §1–3, §5).
 * Contexto de área: lista fixa de módulos na ordem do Blueprint §3 —
 * o contexto muda o ESCOPO dos dados, não a lista de módulos.
 * "Visão Geral BEV" e Direx têm sidebars próprias (§5).
 * Em telas pequenas o mesmo conteúdo abre em um drawer (Sheet) via Topbar.
 */
import { Link, useLocation } from '@tanstack/react-router'
import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarClock,
  CalendarDays,
  Coins,
  Compass,
  Flag,
  Handshake,
  Home,
  Megaphone,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Target,
  UserCog,
  Users,
  Wallet,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useApp } from '@/lib/app-context'
import { cn } from '@/lib/utils'

interface ModuleItem {
  label: string
  icon: LucideIcon
  to?: string
  href?: string
  /** slugs de subárea em que o módulo aparece (Blueprint §3, itens 7–8) */
  onlyInSubareas?: string[]
  /** módulo exclusivo de lideranças (diretor/gerente/coordenador) */
  onlyLeaders?: boolean
}

interface ModuleGroup {
  titulo?: string
  items: ModuleItem[]
}

const GROUPS: ModuleGroup[] = [
  { items: [{ label: 'Início', icon: Home, to: '/' }] },
  {
    titulo: 'Dia a dia',
    items: [
      { label: 'Calendário', icon: CalendarDays, to: '/agenda' },
      { label: 'Reuniões de Área', icon: CalendarClock, to: '/reunioes' },
      { label: 'Avisos', icon: Megaphone, to: '/comunicados' },
    ],
  },
  {
    titulo: 'Operação',
    items: [
      { label: 'Comercial', icon: Handshake, href: 'https://bevilaqua-comercial.lovable.app/' },
      { label: 'Projetos', icon: Briefcase, href: '#' },
      { label: 'Institucional', icon: Sparkles, href: 'https://mg.mail.notion.so/c/eJxMkL1u4zoQhZ-G6mSQQ4o_hYp747jcVxCGnHFMQJa0Imkgb79wrN2knG9Occ5Ho3QmgOp4VM4bUINztuM75nlqLdMo3P8C4BsIAKH_EwAkkzRI1HtOujekdR-JsDfRhqvUhpNUz7A7d7cxaFLGWSRLzAQQTUgmDNZyjMpp1-URJFjplFUDBG1P1vtBaQwOpNQYB2Hks8NpWWtel1NZu3m81bqVrzYXARfctr_ftN4FXDYBlzde6o5zT2v__vbe6-BYs4-oLXmZYhiiT1dyzg9XtkEJfVmEPr_mbq3cBNgnwFTzI9fPKS-PXJkOzJTrtOEHTzXXmQ_6BV5BAXZ7FKHPsrtzRcKKh9GyYeLpp89gv6upmIJHklJqr8CDGuLhch_j3haMPNcdV2Fk5Eee8XfD07p_nOLe1fFVv35uLPS58EK_1pqvOeFTzr9_afGItMJ7fyzr2lJaLGnPkUcBw49zavssYOgeI_wJAAD__wOhsKo' },
      { label: 'Marketing', icon: Megaphone, href: '#' },
    ],
  },
  {
    titulo: 'Vivência & Cultura',
    items: [
      { label: 'Bev News', icon: Newspaper, to: '/bev-news' },
      { label: 'Benchs', icon: Sparkles, to: '/benchs' },
      { label: 'FID / BevCoins', icon: Coins, to: '/fid' },
    ],
  },
  {
    titulo: 'Estratégia',
    items: [
      { label: 'Planejamento Estratégico', icon: Compass, to: '/planejamento' },
      { label: 'Dashboards', icon: BarChart3, to: '/dashboards', onlyLeaders: true },
      { label: 'Financeiro', icon: Wallet, to: '/financeiro' },
    ],
  },
  {
    titulo: 'Pessoas & Desenvolvimento',
    items: [
      { label: 'PDI', icon: Target, to: '/pdi' },
      { label: 'Meus Liderados', icon: UserCog, to: '/liderados', onlyLeaders: true },
      { label: 'Warnings', icon: Flag, to: '/warnings' },
      { label: 'Frequência', icon: ShieldCheck, to: '/frequencia' },
      { label: 'Pessoas', icon: Users, to: '/pessoas' },
    ],
  },
  {
    titulo: 'Conhecimento',
    items: [{ label: 'Memória Institucional', icon: BookOpen, to: '/memoria' }],
  },
]

function NavItem({
  item,
  active,
  onNavigate,
}: {
  item: ModuleItem
  active: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={cn(
          'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-ring/60 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2',
          active && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </a>
    )
  }

  return (
    <Link
      to={item.to!}
      onClick={onNavigate}
      className={cn(
        'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-ring/60 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2',
        active && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

function AreaNav({ onNavigate }: { onNavigate?: () => void }) {
  const { isLeader, isDirex } = useApp()
  const location = useLocation()

  return (
    <nav className="flex flex-col gap-3 p-2">
      {GROUPS.map((g) => {
        const items = g.items.filter((m) => !(m.onlyLeaders && !isLeader))
        if (items.length === 0) return null
        return (
          <div key={g.titulo ?? 'root'} className="flex flex-col gap-0.5">
            {g.titulo && (
              <div className="text-muted-foreground px-2.5 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide">
                {g.titulo}
              </div>
            )}
            {items.map((item) => (
              <NavItem
                key={item.label}
                item={item}
                active={item.to === location.pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )
      })}
      
      {/* Nova Área de Liderança (Gerente / Diretor) */}
      {(isLeader || isDirex) && (
        <div className="flex flex-col gap-1">
          <Separator className="bg-border/60 my-2" />
          <div className="text-muted-foreground px-2 text-xs font-semibold uppercase tracking-wider">
            Liderança
          </div>
          
          {isLeader && (
            <NavItem
              item={{ label: 'Painel da Gerência', icon: Target, to: '/gerente' }}
              active={location.pathname === '/gerente'}
              onNavigate={onNavigate}
            />
          )}

          {isDirex && (
            <NavItem
              item={{ label: 'Painel da Diretoria', icon: Compass, to: '/diretor' }}
              active={location.pathname === '/diretor'}
              onNavigate={onNavigate}
            />
          )}
        </div>
      )}
    </nav>
  )
}

/** Conteúdo da sidebar — usado no <aside> fixo (desktop) e no drawer (mobile). */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()

  return (
    <>
      <AreaNav onNavigate={onNavigate} />
      <div className="mt-auto flex flex-col gap-3 p-3">
        {location.pathname !== '/admin-pc' && (
          <Link
            to="/admin-pc"
            onClick={onNavigate}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground flex items-center gap-2 text-[11px] font-medium transition-colors"
          >
            <Settings className="size-3.5" />
            Administração do sistema
          </Link>
        )}
        <Separator className="mb-1" />
        <p className="text-sidebar-foreground/60 text-[11px] leading-relaxed">
          BEV OS
          <br />
          Sistema operacional do Bevilaqua
        </p>
      </div>
    </>
  )
}

export function Sidebar() {
  return (
    <aside className="bg-sidebar border-sidebar-border sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col overflow-y-auto border-r md:flex">
      <SidebarContent />
    </aside>
  )
}
