/**
 * Reuniões de Área (Onda 3.2). Reuniões semanais da área (seg. 22h).
 * · Assessor: acompanha um resumo (pautas, insights, repasses, ações).
 * · Liderança: gestão completa — tipo, pautas, insights, observações,
 *   transcrição (IA), repasses, ações + controle de presença, que
 *   alimenta a frequência em "Meus Liderados".
 */
import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Check, Plus, Trash2, Users, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-context'
import { useContextScope } from '@/lib/use-context-scope'
import {
  createRaMeeting,
  deleteMeeting,
  getAreaCallList,
  getRaMeetings,
  nextMondayAt22,
  setAttendance,
  updateMeetingBasics,
  upsertRaDetails,
  RA_TIPO_BADGE,
  RA_TIPO_LABELS,
  RA_TIPO_ORDER,
  type RaMeeting,
  type RaTipo,
} from '@/lib/reunioes'
import { initials } from '@/lib/utils'

export const Route = createFileRoute('/_app/reunioes')({ component: ReunioesPage })

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
function isoToLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const localInputToIso = (s: string) => new Date(s).toISOString()

function ReunioesPage() {
  const { person, cycle } = useApp()
  const { subareaIds, scopeSubareas, leadsSubarea } = useContextScope()
  const queryClient = useQueryClient()
  const [selId, setSelId] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)

  const q = useQuery({
    queryKey: ['ra-meetings', subareaIds, cycle.id],
    queryFn: () => getRaMeetings(subareaIds, cycle.id),
  })
  const meetings = q.data ?? []
  const selecionada = meetings.find((m) => m.id === selId) ?? null

  const liderSubareas = scopeSubareas.filter((s) => leadsSubarea(s.id))
  const podeCriar = liderSubareas.length > 0

  const [novaSub, setNovaSub] = useState('')
  const [novaData, setNovaData] = useState(() => isoToLocalInput(nextMondayAt22()))
  useEffect(() => {
    if (criando && !novaSub && liderSubareas[0]) setNovaSub(liderSubareas[0].id)
  }, [criando, liderSubareas, novaSub])

  const criarMut = useMutation({
    mutationFn: () => createRaMeeting(novaSub, localInputToIso(novaData), person.id),
    onSuccess: (id) => {
      setCriando(false)
      setNovaData(isoToLocalInput(nextMondayAt22()))
      queryClient.invalidateQueries({ queryKey: ['ra-meetings'] })
      setSelId(id)
    },
  })

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <CalendarClock className="size-4.5" />
          </span>
            Reuniões de Área
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Reuniões semanais da área · segundas, 22h · Ciclo {cycle.nome}
          </p>
        </div>
        {podeCriar && (
          <Button onClick={() => setCriando((v) => !v)} variant={criando ? 'ghost' : 'default'}>
            {criando ? <X className="size-4" /> : <Plus className="size-4" />}
            {criando ? 'Cancelar' : 'Nova reunião'}
          </Button>
        )}
      </header>

      {criando && (
        <Card className="mb-4">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            {liderSubareas.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label>Área</Label>
                <div className="flex gap-1.5">
                  {liderSubareas.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setNovaSub(s.id)}
                      className={`rounded-md border px-3 py-1.5 text-sm ${novaSub === s.id ? 'bg-accent border-ring' : 'bg-card'}`}
                    >
                      {s.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>Data e hora</Label>
              <Input
                type="datetime-local"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                className="sm:w-56"
              />
            </div>
            <Button disabled={!novaSub || criarMut.isPending} onClick={() => criarMut.mutate()}>
              Criar reunião
            </Button>
          </CardContent>
        </Card>
      )}

      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : meetings.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">
            Nenhuma reunião de área registrada neste ciclo.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="flex flex-col gap-3 lg:col-span-2">
            {meetings.map((m) => (
              <MeetingCard
                key={m.id}
                m={m}
                selected={selId === m.id}
                onSelect={() => setSelId(m.id)}
              />
            ))}
          </div>
          <div className="lg:col-span-3">
            {selecionada ? (
              leadsSubarea(selecionada.subarea_id) ? (
                <LeaderPanel key={selecionada.id} meeting={selecionada} />
              ) : (
                <SummaryPanel meeting={selecionada} />
              )
            ) : (
              <Card>
                <CardContent className="text-muted-foreground p-10 text-center text-sm">
                  Selecione uma reunião para ver os detalhes.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MeetingCard({
  m,
  selected,
  onSelect,
}: {
  m: RaMeeting
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${
        selected ? 'bg-accent border-ring' : 'bg-card hover:bg-accent/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Reunião de {m.subarea_nome}</span>
        <Badge variant="neutral">
          {m.presentes}/{m.total} presentes
        </Badge>
      </div>
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <CalendarClock className="size-3.5" />
        {fmtDateTime(m.data)}
        {m.details?.tipo && (
          <Badge variant={RA_TIPO_BADGE[m.details.tipo]}>{RA_TIPO_LABELS[m.details.tipo]}</Badge>
        )}
      </div>
      {m.pauta && <p className="text-muted-foreground line-clamp-2 text-xs">{m.pauta}</p>}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function LeaderPanel({ meeting }: { meeting: RaMeeting }) {
  const { cycle } = useApp()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    tipo: meeting.details?.tipo ?? ('' as RaTipo | ''),
    pauta: meeting.pauta ?? '',
    insights: meeting.details?.insights ?? '',
    observacoes: meeting.details?.observacoes ?? '',
    repasses: meeting.details?.repasses ?? '',
    acoes: meeting.details?.acoes ?? '',
    transcricao: meeting.details?.transcricao ?? '',
    data: isoToLocalInput(meeting.data),
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const callQ = useQuery({
    queryKey: ['ra-calllist', meeting.id, meeting.subarea_id],
    queryFn: () => getAreaCallList(meeting.subarea_id, meeting.id),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ra-meetings'] })
    queryClient.invalidateQueries({ queryKey: ['ra-calllist', meeting.id] })
  }
  const saveMut = useMutation({
    mutationFn: async () => {
      await updateMeetingBasics(meeting.id, {
        pauta: form.pauta || null,
        data: localInputToIso(form.data),
      })
      await upsertRaDetails(meeting.id, {
        tipo: form.tipo || null,
        insights: form.insights || null,
        observacoes: form.observacoes || null,
        repasses: form.repasses || null,
        acoes: form.acoes || null,
        transcricao: form.transcricao || null,
      })
    },
    onSuccess: invalidate,
  })
  const delMut = useMutation({
    mutationFn: () => deleteMeeting(meeting.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ra-meetings'] }),
  })
  const attMut = useMutation({
    mutationFn: ({ email, presente }: { email: string; presente: boolean }) =>
      setAttendance(meeting.id, email, presente),
    onSuccess: invalidate,
  })

  const membros = callQ.data ?? []
  const presentes = membros.filter((m) => m.presente).length

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Reunião de {meeting.subarea_nome}</h2>
            <p className="text-muted-foreground text-sm">Ciclo {cycle.nome}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600"
            onClick={() => {
              if (confirm('Excluir esta reunião? A presença e o conteúdo serão perdidos.'))
                delMut.mutate()
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Data e hora">
            <Input
              type="datetime-local"
              value={form.data}
              onChange={(e) => set('data', e.target.value)}
            />
          </Field>
          <Field label="Tipo da reunião">
            <div className="flex flex-wrap gap-1.5">
              {RA_TIPO_ORDER.map((t) => (
                <button
                  key={t}
                  onClick={() => set('tipo', form.tipo === t ? '' : t)}
                  className={`rounded-md border px-2.5 py-1 text-xs ${form.tipo === t ? 'bg-accent border-ring' : 'bg-card'}`}
                >
                  {RA_TIPO_LABELS[t]}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Pautas abordadas">
          <Textarea value={form.pauta} onChange={(e) => set('pauta', e.target.value)} placeholder="Tópicos da reunião…" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Insights">
            <Textarea value={form.insights} onChange={(e) => set('insights', e.target.value)} />
          </Field>
          <Field label="Observações">
            <Textarea value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
          </Field>
          <Field label="Repasses dados">
            <Textarea value={form.repasses} onChange={(e) => set('repasses', e.target.value)} />
          </Field>
          <Field label="Ações / próximos passos">
            <Textarea value={form.acoes} onChange={(e) => set('acoes', e.target.value)} />
          </Field>
        </div>
        <Field label="Transcrição (ferramenta de IA)">
          <Textarea
            value={form.transcricao}
            onChange={(e) => set('transcricao', e.target.value)}
            placeholder="Cole aqui a transcrição gerada pela IA…"
            className="min-h-28"
          />
        </Field>
        <Button className="self-start" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
          Salvar reunião
        </Button>

        {/* Presença */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="size-4" /> Presença
            </div>
            <Badge variant="neutral">
              {presentes}/{membros.length} presentes
            </Badge>
          </div>
          {callQ.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : membros.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum assessor no roster desta área.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {membros.map((m) => (
                <div
                  key={m.email}
                  className="flex items-center gap-2.5 rounded-lg border p-2.5"
                >
                  <Avatar className="size-8">
                    {m.foto_url && <AvatarImage src={m.foto_url} alt={m.nome} />}
                    <AvatarFallback className="text-xs">{initials(m.nome)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.nome}</p>
                    {!m.ativo && <p className="text-muted-foreground text-xs">não ativou a conta</p>}
                  </div>
                  <Button
                    size="sm"
                    variant={m.presente ? 'default' : 'outline'}
                    className="h-8"
                    onClick={() => attMut.mutate({ email: m.email, presente: !m.presente })}
                  >
                    <Check className="size-4" />
                    {m.presente ? 'Presente' : 'Marcar'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryBlock({ titulo, texto }: { titulo: string; texto: string | null }) {
  if (!texto) return null
  return (
    <div>
      <div className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
        {titulo}
      </div>
      <p className="whitespace-pre-wrap text-sm">{texto}</p>
    </div>
  )
}

function SummaryPanel({ meeting }: { meeting: RaMeeting }) {
  const d = meeting.details
  const vazio = !meeting.pauta && !d?.insights && !d?.repasses && !d?.acoes
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Reunião de {meeting.subarea_nome}</h2>
            <p className="text-muted-foreground text-sm">{fmtDateTime(meeting.data)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="neutral">
              {meeting.presentes}/{meeting.total} presentes
            </Badge>
            {d?.tipo && <Badge variant={RA_TIPO_BADGE[d.tipo]}>{RA_TIPO_LABELS[d.tipo]}</Badge>}
          </div>
        </div>
        {vazio ? (
          <p className="text-muted-foreground text-sm">
            A liderança ainda não publicou o resumo desta reunião.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <SummaryBlock titulo="Pautas abordadas" texto={meeting.pauta} />
            <SummaryBlock titulo="Insights" texto={d?.insights ?? null} />
            <SummaryBlock titulo="Repasses" texto={d?.repasses ?? null} />
            <SummaryBlock titulo="Ações / próximos passos" texto={d?.acoes ?? null} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
