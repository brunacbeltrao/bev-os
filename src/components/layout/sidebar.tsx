/**
 * Sidebar contextual (Blueprint §1–3, §5).
 * Contexto de área: lista fixa de módulos na ordem do Blueprint §3 —
 * o contexto muda o ESCOPO dos dados, não a lista de módulos.
 * "Visão Geral BEV" e Direx têm sidebars próprias (§5).
 * Módulos das Ondas 1–4 aparecem desabilitados com a onda indicada.
 */
import { Link, useLocation } from '@tanstack/react-router'
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  Compass,
  CalendarDays,
  Flag,
  Home,
  Landmark,
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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useApp } from '@/lib/app-context'
import { cn } from '@/lib/utils'

interface ModuleItem {
  label: string
  icon: LucideIcon
  to?: string // definido = módulo já construído
  wave?: 1 | 2 | 3 | 4 // onda em que o módulo entra
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
    titulo: 'Comunicação & Cultura',
    items: [
      { label: 'Bev News', icon: Newspaper, to: '/bev-news' },
      { label: 'Benchs', icon: Sparkles, to: '/benchs' },
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

function NavItem({ item, active }: { item: ModuleItem; active: boolean }) {
  const Icon = item.icon
  if (item.to) {
    return (
      <Link
        to={item.to}
        className={cn(
          'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
          active && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    )
  }
  return (
    <div
      className="text-sidebar-foreground/50 flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm"
      title={`Chega na Onda ${item.wave}`}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      <Badge variant="neutral" className="ml-auto px-1.5 text-[10px]">
        Onda {item.wave}
      </Badge>
    </div>
  )
}

function AreaSidebar() {
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
              <NavItem key={item.label} item={item} active={item.to === location.pathname} />
            ))}
          </div>
        )
      })}
    </nav>
  )
}

const DIREX_ITEMS: Array<{
  label: string
  to?: string
  nota?: string
  gerenteVe: boolean
}> = [
  { label: 'Resumo (Inbox)', to: '/direx', gerenteVe: true },
  { label: 'To do', to: '/direx/todo', gerenteVe: false },
  { label: 'Reuniões de Diretoria', to: '/direx/atas', gerenteVe: false },
  { label: 'Problemas', to: '/direx/problemas', gerenteVe: false },
  { label: 'P.E 2026.2', to: '/direx/planejamento', gerenteVe: false },
]

function DirexSidebar() {
  const { isDirex } = useApp()
  const location = useLocation()
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      <div className="text-muted-foreground px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide">
        Direx
      </div>
      {DIREX_ITEMS.filter((i) => isDirex || i.gerenteVe).map((i) =>
        i.to ? (
          <Link
            key={i.label}
            to={i.to}
            className={cn(
              'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
              location.pathname === i.to &&
                'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
            )}
          >
            <Landmark className="size-4 shrink-0" />
            <span className="truncate">{i.label}</span>
          </Link>
        ) : (
          <div
            key={i.label}
            className="text-sidebar-foreground/50 flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm"
          >
            <Landmark className="size-4 shrink-0" />
            <span className="truncate">{i.label}</span>
            <Badge variant="neutral" className="ml-auto px-1.5 text-[10px]">
              {i.nota}
            </Badge>
          </div>
        ),
      )}
    </nav>
  )
}

function VisaoGeralSidebar() {
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      <div className="text-muted-foreground px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide">
        Visão Geral BEV
      </div>
      <p className="text-sidebar-foreground/60 px-2.5 py-1.5 text-xs leading-relaxed">
        Leitura consolidada de todas as áreas, lado a lado. Sem módulos de ação — os indicadores
        por área chegam junto com os módulos das próximas ondas.
      </p>
    </nav>
  )
}

export function Sidebar() {
  const location = useLocation()
  const isDirexPage = location.pathname.startsWith('/direx')
  const isVisaoGeral = location.pathname.startsWith('/visao-geral')

  return (
    <aside className="bg-sidebar border-sidebar-border sticky top-14 flex h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col overflow-y-auto border-r">
      {isDirexPage ? <DirexSidebar /> : isVisaoGeral ? <VisaoGeralSidebar /> : <AreaSidebar />}
      <div className="mt-auto p-3 flex flex-col gap-3">
        {/* Módulo Admin escondido no rodapé para não poluir o dia a dia */}
        {location.pathname !== '/admin-pc' && (
          <Link
            to="/admin-pc"
            className="text-sidebar-foreground/50 hover:text-sidebar-foreground flex items-center gap-2 text-[11px] font-medium transition-colors"
          >
            <Settings className="size-3.5" />
            Administração do sistema
          </Link>
        )}
        <Separator className="mb-1" />
        <p className="text-sidebar-foreground/50 text-[11px] leading-relaxed">
          BEV OS<br />
          Sistema operacional do Bevilaqua
        </p>
      </div>
    </aside>
  )
}
