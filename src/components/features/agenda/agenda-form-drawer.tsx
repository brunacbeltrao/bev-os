import { useState, useEffect } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useApp } from '@/lib/app-context'
import type { Directorate } from '@/lib/planejamento'
import {
  AUDIENCE_LABELS,
  MEETING_LABELS,
  type AgendaEvent,
  type EventAudience,
  type MeetingSlug,
} from '@/lib/agenda'
import { useAgendaTypes, useAgendaMutations } from '@/hooks/use-agenda'

const CATS_CAL: MeetingSlug[] = ['rg', 'rd', 'rl', 'capacitacao', 'evento_mej', 'coworking', 'outro']
const AUD_DEFAULT: Record<string, EventAudience> = {
  rg: 'bev',
  rd: 'diretores',
  rl: 'diretores_gerentes',
  capacitacao: 'areas',
  evento_mej: 'bev',
  coworking: 'areas',
  outro: 'bev',
}

/** ISO (UTC) → valor para <input type="datetime-local"> em horário local. */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface AgendaFormDrawerProps {
  dirs: Directorate[]
  event?: AgendaEvent // Se passado, modo de edição
}

export function AgendaFormDrawer({ dirs, event }: AgendaFormDrawerProps) {
  const { isDirex, isLeader } = useApp()
  const typesQ = useAgendaTypes()
  const { createMut, updateMut } = useAgendaMutations()
  const [open, setOpen] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Form State
  const [tipo, setTipo] = useState<MeetingSlug>(event?.meeting_type.slug ?? 'rl')
  const [audiencia, setAudiencia] = useState<EventAudience>(event?.audiencia ?? 'bev')
  const [alvos, setAlvos] = useState<string[]>(event?.target_directorate_ids ?? [])
  const [obrig, setObrig] = useState({
    diretores: event?.obrig_diretores ?? false,
    gerentes: event?.obrig_gerentes ?? false,
    assessores: event?.obrig_assessores ?? false,
  })
  const [titulo, setTitulo] = useState(event?.titulo ?? '')
  const [dataHora, setDataHora] = useState(event ? toDatetimeLocal(event.data) : '')
  const [link, setLink] = useState(event?.link_reuniao ?? '')
  const [pauta, setPauta] = useState(event?.pauta ?? '')

  useEffect(() => {
    if (open && !event) {
      setTipo('rl')
      setAudiencia('bev')
      setAlvos([])
      setObrig({ diretores: false, gerentes: false, assessores: false })
      setTitulo('')
      setDataHora('')
      setLink('')
      setPauta('')
      setErro(null)
    }
  }, [open, event])

  const cats = isDirex ? CATS_CAL : CATS_CAL.filter((c) => c !== 'rd')
  if (!isLeader && !event) return null // Somente líderes podem criar

  function pickTipo(t: MeetingSlug) {
    setTipo(t)
    setAudiencia(AUD_DEFAULT[t] ?? 'bev')
  }

  const toggleAlvo = (id: string) =>
    setAlvos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!dataHora) return

    const mt = (typesQ.data ?? []).find((t) => t.slug === tipo)
    if (!mt) {
      setErro('Categoria inválida')
      return
    }

    if (event) {
      updateMut.mutate({
        id: event.id,
        data: {
          meeting_type_id: mt.id,
          data: new Date(dataHora).toISOString(),
          titulo: titulo.trim() || null,
          audiencia,
          link_reuniao: link.trim() || null,
          obrig_diretores: obrig.diretores,
          obrig_gerentes: obrig.gerentes,
          obrig_assessores: obrig.assessores,
        },
        alvos: audiencia === 'areas' ? alvos : [],
      }, {
        onSuccess: () => setOpen(false),
        onError: () => setErro('Não foi possível salvar as alterações.')
      })
    } else {
      createMut.mutate({
        meeting_type_id: mt.id,
        data: new Date(dataHora).toISOString(),
        titulo: titulo.trim() || undefined,
        pauta,
        audiencia,
        link_reuniao: link.trim() || undefined,
        obrig_diretores: obrig.diretores,
        obrig_gerentes: obrig.gerentes,
        obrig_assessores: obrig.assessores,
        targetDirectorateIds: audiencia === 'areas' ? alvos : [],
      }, {
        onSuccess: () => setOpen(false),
        onError: () => setErro('Não foi possível criar. Confira o público-alvo e a data.')
      })
    }
  }

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {event ? (
          <Button size="icon" variant="ghost" aria-label="Editar compromisso">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" /> Novo compromisso
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>{event ? 'Editar compromisso' : 'Novo compromisso'}</SheetTitle>
        </SheetHeader>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label>Categoria</Label>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => pickTipo(c)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${tipo === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground hover:bg-accent'}`}
                >
                  {MEETING_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Nome do compromisso</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Capacitação de Vendas" />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Público-alvo (quem vê)</Label>
            <select
              value={audiencia}
              onChange={(e) => setAudiencia(e.target.value as EventAudience)}
              className="border-input bg-card h-10 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {(Object.keys(AUDIENCE_LABELS) as EventAudience[]).map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABELS[a]}
                </option>
              ))}
            </select>
            {audiencia === 'areas' && (
              <div className="mt-2 flex flex-wrap gap-2">
                {dirs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleAlvo(d.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${alvos.includes(d.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground hover:bg-accent'}`}
                  >
                    {d.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Presença obrigatória para</Label>
            <div className="flex flex-wrap gap-4 text-sm mt-1">
              {([['diretores', 'Diretores'], ['gerentes', 'Gerentes'], ['assessores', 'Assessores']] as const).map(
                ([k, lbl]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-gray-300"
                      checked={obrig[k]}
                      onChange={(e) => setObrig({ ...obrig, [k]: e.target.checked })}
                    />
                    <span>{lbl}</span>
                  </label>
                ),
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Data e hora</Label>
              <Input type="datetime-local" required value={dataHora} onChange={(e) => setDataHora(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Link (opcional)</Label>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Meet, Zoom…" />
            </div>
          </div>

          {!event && (
            <div className="flex flex-col gap-2">
              <Label>Pauta inicial</Label>
              <Textarea value={pauta} onChange={(e) => setPauta(e.target.value)} className="min-h-[100px]" />
            </div>
          )}

          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button type="submit" disabled={isPending} className="mt-4 w-full">
            {isPending ? 'Salvando…' : event ? 'Salvar alterações' : 'Agendar compromisso'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
