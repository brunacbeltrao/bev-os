/**
 * Estado global da aplicação autenticada:
 * sessão, pessoa, occupations do ciclo vigente e o Seletor de
 * Contexto da Topbar (Blueprint §2) — "de qual área eu estou
 * olhando os dados agora".
 */
import {
  createContext,
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
import { getMyWallet } from './fid'

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
  bevCoinsBalance: number
}

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp deve ser usado dentro de <AppProvider>')
  return v
}

// A navegação agora é estática baseada no cargo (isLeader, isDirex)

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

  const walletQ = useQuery({
    queryKey: ['my-wallet', cycleQ.data?.id, uid],
    queryFn: () => getMyWallet(cycleQ.data!.id),
    enabled: !!cycleQ.data,
  })


  const value = useMemo<AppState | null>(() => {
    if (!personQ.data || !cycleQ.data || !occQ.data || occQ.data.length === 0) return null

    const occs = occQ.data
    const primary = occs.find((o) => !o.is_hibrido) || occs[0]

    return {
      session,
      person: personQ.data,
      cycle: cycleQ.data,
      occupations: occs,
      primary,
      isDirex: isDirexMember(occs),
      isLeader: isLeaderMember(occs),
      souPC: isPcMember(occs),
      bevCoinsBalance: walletQ.data?.available_balance ?? 0,
    }
  }, [personQ.data, cycleQ.data, occQ.data, session, walletQ.data])

  if (personQ.isLoading || cycleQ.isLoading || occQ.isLoading) {
    return <>{fallback}</>
  }
  
  if (!value) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-sm">Nenhum vínculo ativo neste ciclo.</p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-primary hover:underline text-sm font-medium"
        >
          Sair
        </button>
      </div>
    )
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
