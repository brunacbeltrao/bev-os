import { useState } from 'react'
import {
  Check,
  ExternalLink,
  FileText,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-context'
import { fmtDate } from '@/lib/use-context-scope'
import { initials } from '@/lib/utils'
import {
  audienceLabel,
  eventDisplayName,
  isObrigatorio,
  MEETING_BADGE,
  MEETING_CHIP,
  type AgendaEvent,
} from '@/lib/agenda'
import type { Directorate } from '@/lib/planejamento'
import {
  useAgendaMutations,
  useRsvpMutations,
  useEventDetailMutations,
  useAgendaEventRsvps,
  useAgendaEventDocs,
  useAgendaEventMinute
} from '@/hooks/use-agenda'
import { AgendaFormDrawer } from './agenda-form-drawer'

function RsvpBox({ event }: { event: AgendaEvent }) {
  const { person, primary } = useApp()
  const [motivo, setMotivo] = useState('')
  const [recusando, setRecusando] = useState(false)
  
  const { confirmMut, recusaMut } = useRsvpMutations(event.id)
  
  const meu = event.rsvps.find((r) => r.person_id === person.id)
  const obrigatorio = isObrigatorio(event, primary.role)

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">Sua presença</span>
        <div className="flex gap-2">
          {obrigatorio && <Badge variant="warning">Obrigatória</Badge>}
          {meu && (
            <Badge variant={meu.status === 'confirmado' ? 'success' : 'danger'}>
              {meu.status === 'confirmado' ? 'Confirmada' : 'Você não vai'}
            </Badge>
          )}
        </div>
      </div>
      
      {recusando ? (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1">
          <Input
            placeholder="Motivo da ausência…"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="bg-background text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!motivo.trim() || recusaMut.isPending} onClick={() => recusaMut.mutate(motivo)}>
              Enviar justificativa
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRecusando(false)}>
              Cancelar
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">A justificativa vai direto para a Frequência.</p>
        </div>
      ) : (
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            className="w-full"
            variant={meu?.status === 'confirmado' ? 'default' : 'outline'}
            disabled={confirmMut.isPending}
            onClick={() => confirmMut.mutate()}
          >
            <Check className="size-4 mr-2" /> Confirmar
          </Button>
          <Button size="sm" className="w-full" variant="secondary" onClick={() => setRecusando(true)}>
            Não poderei
          </Button>
        </div>
      )}
    </div>
  )
}

interface EventDetailProps {
  event: AgendaEvent
  dirNome: (id: string) => string
  dirs: Directorate[]
}

export function AgendaEventDetail({ event, dirNome, dirs }: EventDetailProps) {
  const { person, isDirex } = useApp()
  const canManage = isDirex || event.criado_por === person.id
  
  const [pauta, setPauta] = useState(event.pauta ?? '')
  const [docNome, setDocNome] = useState('')
  const [docUrl, setDocUrl] = useState('')
  const [ata, setAta] = useState<string | null>(null)

  const { deleteMut } = useAgendaMutations()
  const { savePautaMut, saveAtaMut, addDocMut, delDocMut } = useEventDetailMutations(event.id)
  
  const rsvpsQ = useAgendaEventRsvps(event.id)
  const docsQ = useAgendaEventDocs(event.id)
  const minuteQ = useAgendaEventMinute(event.id)
  
  const ataAtual = ata ?? minuteQ.data?.conteudo ?? ''

  const confirmados = event.rsvps.filter((r) => r.status === 'confirmado').length
  const recusaram = event.rsvps.filter((r) => r.status === 'recusado').length

  const obrigLabels = [
    event.obrig_diretores && 'Diretores',
    event.obrig_gerentes && 'Gerentes',
    event.obrig_assessores && 'Assessores',
  ].filter(Boolean) as string[]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant={MEETING_BADGE[event.meeting_type.slug]}>{MEETING_CHIP[event.meeting_type.slug]}</Badge>
          <Badge variant="info">{audienceLabel(event, dirNome)}</Badge>
          {canManage && (
            <div className="ml-auto flex items-center gap-1">
              <AgendaFormDrawer event={event} dirs={dirs} />
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => confirm('Excluir este compromisso?') && deleteMut.mutate(event.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">{eventDisplayName(event)}</h2>
        <p className="text-muted-foreground mt-1 text-sm font-medium">{fmtDate(event.data, true)}</p>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-lg border p-3 flex flex-col items-center justify-center text-center shadow-sm">
          <p className="text-emerald-600 text-2xl font-bold">{confirmados}</p>
          <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider mt-1">confirmados</p>
        </div>
        <div className="bg-card rounded-lg border p-3 flex flex-col items-center justify-center text-center shadow-sm">
          <p className="text-2xl font-bold text-red-600">{recusaram}</p>
          <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider mt-1">ausentes</p>
        </div>
      </div>
      
      {obrigLabels.length > 0 && (
        <p className="text-muted-foreground text-xs px-1">
          Presença obrigatória para: <span className="text-foreground font-semibold">{obrigLabels.join(', ')}</span>
        </p>
      )}

      {event.link_reuniao && (
        <a
          href={event.link_reuniao}
          target="_blank"
          rel="noreferrer"
          className="bg-primary/5 text-primary hover:bg-primary/10 flex items-center gap-2 rounded-md p-3 text-sm font-medium transition-colors border border-primary/10"
        >
          <ExternalLink className="size-4" /> Entrar na sala virtual
        </a>
      )}

      <RsvpBox event={event} />

      {/* Quem confirmou */}
      {(rsvpsQ.data ?? []).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="size-4 text-muted-foreground" /> Quem vai
          </div>
          <div className="flex flex-col gap-2 bg-card border rounded-lg p-2 max-h-[250px] overflow-y-auto">
            {(rsvpsQ.data ?? []).map((r) => (
              <div key={r.person_id} className="flex items-center gap-3 text-sm hover:bg-accent/50 p-1.5 rounded-md transition-colors">
                <Avatar className="size-7 border">
                  {r.pessoa.foto_url && <AvatarImage src={r.pessoa.foto_url} alt={r.pessoa.nome} />}
                  <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground">{initials(r.pessoa.nome)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate font-medium text-foreground">{r.pessoa.nome}</span>
                <Badge variant={r.status === 'confirmado' ? 'success' : 'danger'} className="text-[10px]">
                  {r.status === 'confirmado' ? 'Vai' : 'Não vai'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Pauta */}
      <div className="flex flex-col gap-3">
        <Label className="text-sm font-semibold text-foreground">Pauta / Tópicos</Label>
        {canManage ? (
          <div className="space-y-2">
            <Textarea 
              value={pauta} 
              onChange={(e) => setPauta(e.target.value)} 
              className="bg-card resize-y min-h-[80px]"
            />
            <Button size="sm" variant="secondary" disabled={savePautaMut.isPending} onClick={() => savePautaMut.mutate(pauta)}>
              Salvar pauta
            </Button>
          </div>
        ) : (
          <div className="bg-card border rounded-md p-3 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed shadow-sm">
            {event.pauta || 'Sem pauta definida para esta reunião.'}
          </div>
        )}
      </div>

      {/* Documentos */}
      <div className="flex flex-col gap-3">
        <Label className="text-sm font-semibold text-foreground">Documentos Anexos</Label>
        <div className="flex flex-col gap-2">
          {(docsQ.data ?? []).map((d) => (
            <div key={d.id} className="bg-card border group flex items-center gap-3 rounded-md p-2 text-sm shadow-sm transition-colors hover:border-primary/30">
              <div className="bg-primary/10 rounded p-1.5 text-primary">
                <FileText className="size-4" />
              </div>
              <a href={d.url} target="_blank" rel="noreferrer" className="text-foreground flex-1 truncate font-medium hover:underline">
                {d.nome}
              </a>
              {canManage && (
                <button onClick={() => delDocMut.mutate(d.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1">
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
          {(docsQ.data ?? []).length === 0 && !canManage && (
             <p className="text-muted-foreground text-sm italic">Nenhum documento anexado.</p>
          )}
        </div>
        
        {canManage && (
          <form
            className="flex flex-wrap gap-2 mt-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (docUrl.trim()) addDocMut.mutate({ nome: docNome || docUrl, url: docUrl })
            }}
          >
            <Input placeholder="Título (ex: Slides)" value={docNome} onChange={(e) => setDocNome(e.target.value)} className="w-32 bg-card h-9 text-sm" />
            <Input placeholder="Cole o link do drive..." value={docUrl} onChange={(e) => setDocUrl(e.target.value)} className="flex-1 bg-card h-9 text-sm" />
            <Button type="submit" size="sm" variant="secondary" className="h-9" disabled={addDocMut.isPending}>
              Adicionar
            </Button>
          </form>
        )}
      </div>

      {/* Ata */}
      {canManage && (
        <div className="flex flex-col gap-3">
          <Label className="text-sm font-semibold text-foreground">Ata / Registro final</Label>
          <div className="space-y-2">
            <Textarea
              className="bg-card min-h-[120px] text-sm leading-relaxed"
              value={ataAtual}
              onChange={(e) => setAta(e.target.value)}
              placeholder="Após a reunião, registre aqui o que foi decidido..."
            />
            <Button size="sm" variant="secondary" disabled={saveAtaMut.isPending} onClick={() => saveAtaMut.mutate(ataAtual)}>
              Salvar registro
            </Button>
          </div>
        </div>
      )}
      
      {!canManage && ataAtual && (
         <div className="flex flex-col gap-3">
          <Label className="text-sm font-semibold text-foreground">Registro da Reunião</Label>
          <div className="bg-card border rounded-md p-3 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed shadow-sm">
            {ataAtual}
          </div>
         </div>
      )}
    </div>
  )
}
