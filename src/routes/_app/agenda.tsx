/**
 * Calendário 2.0 — compromissos institucionais.
 * Refatorado para separar lógica de estado (hooks) e UI (components/features).
 */
import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Calendar as CalIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/lib/app-context'
import { getDirectorates } from '@/lib/planejamento'
import { MEETING_BADGE, MEETING_CHIP, type AgendaEvent } from '@/lib/agenda'
import { useAgendaEvents } from '@/hooks/use-agenda'

import { AgendaFormDrawer } from '@/components/features/agenda/agenda-form-drawer'
import { AgendaEventDetail } from '@/components/features/agenda/agenda-event-detail'
import { AgendaUpcomingPanel } from '@/components/features/agenda/agenda-upcoming-panel'

export const Route = createFileRoute('/_app/agenda')({ component: AgendaPage })

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function AgendaPage() {
  const { cycle } = useApp()
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const dirsQ = useQuery({ queryKey: ['directorates'], queryFn: getDirectorates, staleTime: Infinity })
  const dirNome = (id: string) => dirsQ.data?.find((d) => d.id === id)?.nome ?? 'Área'

  const eventsQ = useAgendaEvents(ano, mes)

  const eventsByDay = useMemo(() => {
    const map = new Map<number, AgendaEvent[]>()
    for (const e of eventsQ.data ?? []) {
      const d = new Date(e.data)
      if (d.getMonth() !== mes || d.getFullYear() !== ano) continue
      map.set(d.getDate(), [...(map.get(d.getDate()) ?? []), e])
    }
    return map
  }, [eventsQ.data, ano, mes])

  const selected = (eventsQ.data ?? []).find((e) => e.id === selectedId) ?? null
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const celulas: Array<number | null> = [
    ...Array.from({ length: primeiroDiaSemana }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ]

  function navegar(delta: number) {
    const d = new Date(ano, mes + delta, 1)
    setAno(d.getFullYear())
    setMes(d.getMonth())
  }
  const nomeMes = new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="mx-auto max-w-6xl animate-in fade-in duration-500">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <CalIcon className="size-6 text-primary" /> Calendário
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Compromissos institucionais do BEV · Ciclo {cycle.nome}
          </p>
        </div>
        <AgendaFormDrawer dirs={dirsQ.data ?? []} />
      </header>

      <div className="mb-4 flex items-center gap-2 bg-card p-2 rounded-lg border w-fit shadow-sm">
        <Button size="icon" variant="ghost" onClick={() => navegar(-1)} aria-label="Mês anterior" className="h-8 w-8 hover:bg-accent hover:text-accent-foreground">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-40 text-center text-sm font-bold capitalize text-foreground">{nomeMes}</span>
        <Button size="icon" variant="ghost" onClick={() => navegar(1)} aria-label="Próximo mês" className="h-8 w-8 hover:bg-accent hover:text-accent-foreground">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 shadow-md border-muted/50 overflow-hidden">
          <CardContent className="p-0">
            {eventsQ.isLoading ? (
              <div className="p-4 grid gap-4">
                <Skeleton className="h-[400px] w-full rounded-md bg-muted/30" />
              </div>
            ) : (
              <div className="grid grid-cols-7 border-b bg-muted/20">
                {DIAS_SEMANA.map((d) => (
                  <div key={d} className="border-r border-b border-border/50 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {d}
                  </div>
                ))}
                {celulas.map((dia, i) => {
                  const evts = dia ? (eventsByDay.get(dia) ?? []) : []
                  const isHoje = dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear()
                  return (
                    <div
                      key={i}
                      className={`min-h-32 border-r border-b border-border/50 p-2 transition-colors ${
                        !dia ? 'bg-muted/10' : 'bg-card hover:bg-accent/10'
                      }`}
                    >
                      {dia && (
                        <>
                          <div className={`mb-1 text-xs font-semibold ${isHoje ? 'text-primary flex h-6 w-6 items-center justify-center rounded-full bg-primary/10' : 'text-muted-foreground'}`}>
                            {dia}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {evts.map((e) => (
                              <button
                                key={e.id}
                                onClick={() => setSelectedId(e.id)}
                                className={`flex w-full items-center gap-1.5 rounded p-1.5 text-left text-[11px] transition-all hover:brightness-95 ${
                                  selectedId === e.id ? 'ring-2 ring-primary ring-offset-1 bg-accent/80 font-bold' : 'bg-muted/40 font-medium'
                                }`}
                              >
                                <div className={`size-2 shrink-0 rounded-full bg-${MEETING_BADGE[e.meeting_type.slug]}-500/80 shadow-sm`} />
                                <span className="truncate">{e.titulo || MEETING_CHIP[e.meeting_type.slug]}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {selected ? (
            <div className="sticky top-20 bg-card/40 rounded-xl border p-5 shadow-sm backdrop-blur-sm">
              <Button
                variant="ghost"
                size="sm"
                className="mb-4 text-muted-foreground hover:text-foreground -ml-2 h-8 px-2"
                onClick={() => setSelectedId(null)}
              >
                <ChevronLeft className="mr-1 size-4" /> Voltar aos próximos
              </Button>
              <AgendaEventDetail event={selected} dirNome={dirNome} dirs={dirsQ.data ?? []} />
            </div>
          ) : (
            <div className="sticky top-20">
              <AgendaUpcomingPanel events={eventsQ.data ?? []} onSelect={setSelectedId} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
