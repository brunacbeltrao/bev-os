import { CalendarClock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { fmtDate } from '@/lib/use-context-scope'
import { eventDisplayName, MEETING_BADGE, MEETING_CHIP, type AgendaEvent } from '@/lib/agenda'

interface UpcomingPanelProps {
  events: AgendaEvent[]
  onSelect: (id: string) => void
}

export function AgendaUpcomingPanel({ events, onSelect }: UpcomingPanelProps) {
  const proximos = [...events]
    .filter((e) => new Date(e.data) >= new Date(new Date().toDateString()))
    .sort((a, b) => +new Date(a.data) - +new Date(b.data))
    .slice(0, 8)

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
        <CalendarClock className="size-4 text-primary" /> Próximos compromissos
      </div>
      
      {proximos.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-card/50 border border-dashed rounded-lg">
          <CalendarClock className="size-8 text-muted-foreground/30 mb-2" />
          <p className="text-muted-foreground text-sm font-medium">Agenda livre</p>
          <p className="text-muted-foreground/70 text-xs mt-1">Nada agendado para os próximos dias.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {proximos.map((e) => (
            <button
              key={e.id}
              onClick={() => onSelect(e.id)}
              className="bg-card hover:bg-accent focus-visible:ring-ring/60 flex items-center gap-3 rounded-lg border p-3 text-left shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              <Badge variant={MEETING_BADGE[e.meeting_type.slug]}>{MEETING_CHIP[e.meeting_type.slug]}</Badge>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-semibold">{eventDisplayName(e)}</p>
                <p className="text-muted-foreground text-xs font-medium">{fmtDate(e.data, true)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
