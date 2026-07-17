/**
 * Estado global da aplicação autenticada:
 * sessão, pessoa, occupations do ciclo vigente e o Seletor de
 * Contexto da Topbar (Blueprint §2) — "de qual área eu estou
 * olhando os dados agora".
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import {
  getCurrentCycle,
  getMyOccupations,
  getPerson,
  type Cycle,
  type Occupation,
  type Person,
} from './org'
import { isDirexMember, isLeaderMember, isPcMember } from './permissions'

// ---------- Sessão ----------

export type SessionState =
  | { status: 'loading'; session: null }
  | { status: 'anon'; session: null }
  | { status: 'authed'; session: Session }

export function useSupabaseSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null })

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setState(
        data.session
          ? { status: 'authed', session: data.session }
          : { status: 'anon', session: null },
      )
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setState(session ? { status: 'authed', session } : { status: 'anon', session: null })
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return state
}

// ---------- Seletor de Contexto (Blueprint §2) ----------

export type AppContextSelection =
  | { kind: 'subarea'; subareaId: string; directorateId: string; label: string }
  | { kind: 'diretoria'; directorateId: string; label: string } // "Minha Diretoria" (Diretor)
  | { kind: 'bev'; label: 'Visão Geral BEV' } // só Diretor
  | { kind: 'direx'; label: 'Direx' } // só Diretor (Gerente vê resumo)

export interface AppState {
  session: Session
  person: Person
  cycle: Cycle
  occupations: Occupation[]
  /** Vínculo principal (is_hibrido = false). */
  primary: Occupation
  isDirex: boolean
  isLeader: boolean
  souPC: boolean
  /** Opções disponíveis no seletor, conforme papel. */
  contextOptions: AppContextSelection[]
  context: AppContextSelection
  setContext: (c: AppContextSelection) => void
}

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp deve ser usado dentro de <AppProvider>')
  return v
}

const CONTEXT_STORAGE_KEY = 'bevos-context'

function buildContextOptions(occupations: Occupation[]): AppContextSelection[] {
  const primary = occupations.find((o) => !o.is_hibrido)
  if (!primary) return []

  if (primary.role === 'diretor') {
    return [
      {
        kind: 'diretoria',
        directorateId: primary.directorate.id,
        label: `Minha Área · ${primary.directorate.nome}`,
      },
      { kind: 'bev', label: 'Visão Geral BEV' },
      { kind: 'direx', label: 'Direx' },
    ]
  }

  // Gerente/Coordenador: "Minha Área" fixo.
  // Analista/Assessor: "Minha Área"; se híbrido, alterna entre as duas áreas.
  const options: AppContextSelection[] = occupations.map((o) => ({
    kind: 'subarea',
    subareaId: o.subarea.id,
    directorateId: o.directorate.id,
    label: o.is_hibrido ? `${o.subarea.nome} (híbrido)` : `Minha Área · ${o.subarea.nome}`,
  }))
  return options
}

export function AppProvider({
  session,
  children,
  fallback,
}: {
  session: Session
  children: ReactNode
  fallback: ReactNode
}) {
  const uid = session.user.id

  const personQ = useQuery({ queryKey: ['person', uid], queryFn: () => getPerson(uid) })
  const cycleQ = useQuery({ queryKey: ['current-cycle'], queryFn: getCurrentCycle })
  const occQ = useQuery({
    queryKey: ['my-occupations', uid, cycleQ.data?.id],
    queryFn: () => getMyOccupations(uid, cycleQ.data!.id),
    enabled: !!cycleQ.data,
  })

  const [stored, setStored] = useState<string | null>(null)
  useEffect(() => {
    setStored(localStorage.getItem(CONTEXT_STORAGE_KEY))
  }, [])

  const contextOptions = useMemo(
    () => (occQ.data ? buildContextOptions(occQ.data) : []),
    [occQ.data],
  )

  const [selected, setSelected] = useState<AppContextSelection | null>(null)

  const setContext = useCallback((c: AppContextSelection) => {
    setSelected(c)
    try {
      localStorage.setItem(CONTEXT_STORAGE_KEY, c.label)
    } catch {
      /* noop */
    }
  }, [])

  const context = useMemo(() => {
    if (selected) return selected
    const restored = contextOptions.find((o) => o.label === stored)
    return restored ?? contextOptions[0] ?? null
  }, [selected, contextOptions, stored])

  if (personQ.isPending || cycleQ.isPending || occQ.isPending) return <>{fallback}</>

  if (personQ.isError || cycleQ.isError || occQ.isError || !personQ.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">Não foi possível carregar seus dados</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Verifique sua conexão e recarregue a página. Se o problema persistir, fale com
            Pessoas e Cultura.
          </p>
        </div>
      </div>
    )
  }

  const occupations = occQ.data ?? []
  const primary = occupations.find((o) => !o.is_hibrido)

  if (!primary || !context) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">Sem vínculo no ciclo vigente</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Sua conta existe, mas não há vínculo de área registrado para o ciclo atual. Fale com
            Pessoas e Cultura.
          </p>
        </div>
      </div>
    )
  }

  // Regras de negócio centralizadas
  const isDirex = isDirexMember(occupations)
  const isLeader = isLeaderMember(occupations)
  const isPc = isPcMember(occupations)

  const value: AppState = {
    session,
    person: personQ.data,
    cycle: cycleQ.data!,
    occupations,
    primary,
    isDirex,
    isLeader,
    souPC: isPc,
    contextOptions,
    context,
    setContext,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
