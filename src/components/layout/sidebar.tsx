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
  CalendarDays,
  Coins,
  Compass,
  Flag,
  GraduationCap,
  Home,
  Megaphone,
  Newspaper,
  Route as RouteIcon,
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
  /** módulo ainda não disponível — renderiza desabilitado, sem link morto */
  soon?: boolean
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
      { label: 'Dashboards', icon: BarChart3, to: '/dashboards', onlyLeaders: true },
      { label: 'Calendário', icon: CalendarDays, to: '/agenda' },
      { label: 'EPEAS', icon: RouteIcon, to: '/epeas' },
      { label: 'Avisos', icon: Megaphone, to: '/comunicados' },
      { label: 'BevSkills', icon: GraduationCap, to: '/bevskills' },
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
  if (item.soon) {
    return (
      <span
        aria-disabled="true"
        title="Em breve"
        className="text-sidebar-foreground/45 flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm select-none"
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{item.label}</span>
        <span className="text-muted-foreground/70 ml-auto rounded-full border border-sidebar-border px-1.5 text-[10px] font-medium">
          em breve
        </span>
      </span>
    )
  }
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
  const { isLeader } = useApp()
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
