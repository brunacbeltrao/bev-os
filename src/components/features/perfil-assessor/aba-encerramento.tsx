/**
 * Aba 3 — Encerramento de Ciclo (PRD §7).
 * Parecer Final da liderança, endosso da P&C e o status no Banco de
 * Talentos. Depois de assinado, trava.
 */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileSignature,
  Info,
  Lock,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { fmtDate } from '@/lib/use-context-scope'
import {
  getEndorsement,
  getLeadershipEntries,
  parecerErrorMessage,
  STATUS_PARECER_BADGE,
  STATUS_PARECER_LABEL,
  upsertEndorsement,
  type CycleEndorsement,
  type Elegibilidade,
} from '@/lib/perfil-assessor'

export function AbaEncerramento({
  personId,
  cycleId,
  cicloNome,
  podeEditar,
  ehPC,
  elegibilidade,
}: {
  personId: string
  cycleId: string
  cicloNome: string
  podeEditar: boolean
  ehPC: boolean
  elegibilidade?: Elegibilidade
}) {
  const qc = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)

  const parecerQ = useQuery({
    queryKey: ['perfil-parecer', personId, cycleId],
    queryFn: () => getEndorsement(personId, cycleId),
  })
  const entriesQ = useQuery({
    queryKey: ['perfil-lideranca', personId],
    queryFn: () => getLeadershipEntries(personId),
  })

  const parecer = parecerQ.data
  const assinado = parecer?.status === 'assinado'
  const travado = assinado && !ehPC

  const [sintese, setSintese] = useState('')
  const [destaques, setDestaques] = useState('')
  const [desenvolver, setDesenvolver] = useState('')
  const [parecerDiretor, setParecerDiretor] = useState('')
  const [motivoOverride, setMotivoOverride] = useState('')

  useEffect(() => {
    if (!parecer) return
    setSintese(parecer.sintese ?? '')
    setDestaques(parecer.destaques ?? '')
    setDesenvolver(parecer.desenvolver ?? '')
    setParecerDiretor(parecer.parecer_diretor ?? '')
    setMotivoOverride(parecer.talento_override_motivo ?? '')
  }, [parecer?.id, parecer?.status])

  const salvarMut = useMutation({
    mutationFn: (patch: Partial<CycleEndorsement>) => upsertEndorsement(personId, cycleId, patch),
    onSuccess: () => {
      setErro(null)
      qc.invalidateQueries({ queryKey: ['perfil-parecer', personId, cycleId] })
      qc.invalidateQueries({ queryKey: ['perfil-elegibilidade', personId, cycleId] })
    },
    onError: (e) => setErro(parecerErrorMessage(e)),
  })

  const reconhecimentos = (entriesQ.data ?? []).filter(
    (e) => e.tipo === 'reconhecimento' && e.cycle_id === cycleId,
  )

  const elegivel = elegibilidade?.elegivel ?? false
  const naoAtendidos = (elegibilidade?.criterios ?? []).filter((c) => !c.ok)

  if (parecerQ.isPending) return <Skeleton className="h-64 w-full" />

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- Parecer Final ---------- */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <FileSignature className="size-4" />
                Parecer Final da liderança
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Fecha o ciclo {cicloNome} e vira memória permanente da pessoa.
              </p>
            </div>
            <Badge variant={STATUS_PARECER_BADGE[parecer?.status ?? 'rascunho']}>
              {STATUS_PARECER_LABEL[parecer?.status ?? 'rascunho']}
            </Badge>
          </div>

          {assinado ? (
            <div className="bg-status-success-bg text-status-success mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
              <Lock className="size-3.5 shrink-0" />
              Assinado em {fmtDate(parecer.assinado_em)}
              {parecer.assinante?.nome && ` por ${parecer.assinante.nome}`}. O parecer está travado.
            </div>
          ) : (
            <div className="bg-muted/50 text-muted-foreground mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Esta aba é escrita no encerramento do ciclo. Enquanto isso, o que você registra nas
              abas 1 e 2 vai alimentando o material para escrever aqui.
            </div>
          )}

          <div className="flex flex-col gap-4">
            <CampoParecer
              id="pf-sintese"
              label="Síntese do ciclo — trajetória e evolução"
              valor={sintese}
              onChange={setSintese}
              max={1500}
              editavel={podeEditar && !travado}
              placeholder="Como essa pessoa começou o ciclo e como está terminando?"
            />
            <CampoParecer
              id="pf-destaques"
              label="Pontos de destaque"
              valor={destaques}
              onChange={setDestaques}
              max={800}
              editavel={podeEditar && !travado}
            />
            <CampoParecer
              id="pf-desenvolver"
              label="Pontos a desenvolver no próximo ciclo"
              valor={desenvolver}
              onChange={setDesenvolver}
              max={800}
              editavel={podeEditar && !travado}
            />

            {(ehPC || parecer?.parecer_diretor) && (
              <CampoParecer
                id="pf-diretor"
                label="Endosso da Diretoria de Pessoas e Cultura"
                valor={parecerDiretor}
                onChange={setParecerDiretor}
                max={500}
                editavel={ehPC && !assinado}
              />
            )}
          </div>

          {podeEditar && !travado && (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={salvarMut.isPending}
                onClick={() =>
                  salvarMut.mutate({
                    sintese,
                    destaques,
                    desenvolver,
                    ...(ehPC ? { parecer_diretor: parecerDiretor } : {}),
                  })
                }
              >
                Salvar rascunho
              </Button>

              {parecer?.status !== 'aguardando_pc' && !assinado && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!sintese.trim() || salvarMut.isPending}
                  onClick={() =>
                    salvarMut.mutate({
                      sintese,
                      destaques,
                      desenvolver,
                      status: 'aguardando_pc',
                    })
                  }
                >
                  <Send className="size-4" />
                  Enviar para revisão da P&C
                </Button>
              )}

              {ehPC && !assinado && (
                <Button
                  size="sm"
                  disabled={!sintese.trim() || salvarMut.isPending}
                  onClick={() =>
                    salvarMut.mutate({
                      sintese,
                      destaques,
                      desenvolver,
                      parecer_diretor: parecerDiretor,
                      status: 'assinado',
                      talento_elegivel: elegivel,
                    })
                  }
                >
                  <FileSignature className="size-4" />
                  Assinar e finalizar
                </Button>
              )}
            </div>
          )}

          {erro && <p className="text-destructive mt-3 text-xs">{erro}</p>}
        </CardContent>
      </Card>

      {/* ---------- Reconhecimentos do ciclo ---------- */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Star className="size-4" />
            Reconhecimentos neste ciclo
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
              {reconhecimentos.length}
            </span>
          </h2>
          {reconhecimentos.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum reconhecimento registrado. Eles vêm da aba Diário de Liderança.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {reconhecimentos.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <Sparkles className="text-status-success size-3.5 shrink-0" />
                  <span className="font-medium">{r.reconhecimento_tipo}</span>
                  <span className="text-muted-foreground text-xs">· {fmtDate(r.data)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ---------- Banco de Talentos ---------- */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            {elegivel ? (
              <ShieldCheck className="text-status-success size-4" />
            ) : (
              <ShieldAlert className="text-status-danger size-4" />
            )}
            Banco de Talentos
          </h2>

          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              elegivel
                ? 'bg-status-success-bg text-status-success'
                : 'bg-status-danger-bg text-status-danger'
            }`}
          >
            <p className="font-medium">
              {elegivel
                ? `Elegível — entra no Banco de Talentos do ciclo ${cicloNome}`
                : 'Inelegível neste ciclo'}
            </p>
            {!elegivel && naoAtendidos.length > 0 && (
              <ul className="mt-1.5 list-disc pl-4 text-xs opacity-90">
                {naoAtendidos.map((c) => (
                  <li key={c.chave}>
                    {c.label} — {c.detalhe}
                  </li>
                ))}
              </ul>
            )}
            {elegibilidade?.override && (
              <p className="mt-1.5 text-xs opacity-90">
                Decisão manual da P&C: {elegibilidade.override_motivo || 'sem justificativa'}
              </p>
            )}
          </div>

          {ehPC && (
            <div className="mt-4 border-t pt-4">
              <Label htmlFor="bt-motivo">Sobrescrever manualmente (P&C)</Label>
              <p className="text-muted-foreground mb-2 mt-0.5 text-xs">
                Só para casos excepcionais. A justificativa fica registrada.
              </p>
              <Textarea
                id="bt-motivo"
                value={motivoOverride}
                onChange={(e) => setMotivoOverride(e.target.value)}
                placeholder="Por que esta pessoa foge do critério automático?"
                maxLength={500}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!motivoOverride.trim() || salvarMut.isPending}
                  onClick={() =>
                    salvarMut.mutate({
                      talento_override: true,
                      talento_elegivel: true,
                      talento_override_motivo: motivoOverride.trim(),
                    })
                  }
                >
                  Marcar como elegível
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!motivoOverride.trim() || salvarMut.isPending}
                  onClick={() =>
                    salvarMut.mutate({
                      talento_override: true,
                      talento_elegivel: false,
                      talento_override_motivo: motivoOverride.trim(),
                    })
                  }
                >
                  Marcar como inelegível
                </Button>
                {elegibilidade?.override && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={salvarMut.isPending}
                    onClick={() =>
                      salvarMut.mutate({
                        talento_override: false,
                        talento_elegivel: null,
                        talento_override_motivo: null,
                      })
                    }
                  >
                    Voltar ao cálculo automático
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CampoParecer({
  id,
  label,
  valor,
  onChange,
  max,
  editavel,
  placeholder,
}: {
  id: string
  label: string
  valor: string
  onChange: (v: string) => void
  max: number
  editavel: boolean
  placeholder?: string
}) {
  if (!editavel) {
    return (
      <div>
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
          {valor || <span className="text-muted-foreground">Não preenchido.</span>}
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-muted-foreground text-[11px] tabular-nums">
          {valor.length}/{max}
        </span>
      </div>
      <Textarea
        id={id}
        maxLength={max}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-24"
      />
    </div>
  )
}
