/**
 * EPEAS — página do contrato (PRD §7.2).
 *
 * Reúne num lugar só o que hoje está espalhado entre Telegram, Notion,
 * Autentique e a memória de quem alocou: timeline macro e de execução,
 * links, alocação em núcleo, exceções abertas e histórico completo.
 */
import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Check, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-context'
import { getDirectory } from '@/lib/org'
import * as E from '@/lib/epeas'
import { supabase } from '@/lib/supabase'
import { fmtBRLCurto, fmtData, LinkExterno, Vazio } from '@/components/features/epeas/epeas-shared'
import { Conversa } from '@/components/features/epeas/conversa'
import { ChecklistEtapa } from '@/components/features/epeas/checklist-etapa'

export const Route = createFileRoute('/_app/epeas/contrato/$contratoId')({
  component: ContratoEpeasPage,
})

function ContratoEpeasPage() {
  const { contratoId } = Route.useParams()
  const { person, cycle } = useApp()
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['epeas-contrato', contratoId],
    queryFn: () => E.getEpeasContrato(contratoId),
  })
  const histQ = useQuery({
    queryKey: ['epeas-historico', contratoId],
    queryFn: () => E.getHistorico(contratoId),
  })
  const excQ = useQuery({
    queryKey: ['epeas-excecoes', contratoId],
    queryFn: () => E.getExcecoes(contratoId),
  })
  const nucleosQ = useQuery({
    queryKey: ['nucleos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_nucleos').select('id, nome, slug').order('nome')
      if (error) throw error
      return data as { id: string; nome: string; slug: string }[]
    },
  })
  const pessoasQ = useQuery({
    queryKey: ['directory-all', cycle.id],
    queryFn: () => getDirectory(cycle.id, null),
  })

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['epeas-contrato', contratoId] })
    qc.invalidateQueries({ queryKey: ['epeas-historico', contratoId] })
    qc.invalidateQueries({ queryKey: ['epeas-excecoes', contratoId] })
    qc.invalidateQueries({ queryKey: ['epeas'] })
  }

  const mutPatch = useMutation({
    mutationFn: (patch: E.EpeasPatch) => E.atualizarEpeas(contratoId, patch),
    onSuccess: () => {
      toast.success('Contrato atualizado.')
      invalidar()
    },
  })
  const mutExcecao = useMutation({
    mutationFn: (descricao: string) => E.abrirExcecao(contratoId, descricao, person.id),
    onSuccess: () => {
      toast.success('Exceção registrada.')
      setNovaExcecao('')
      invalidar()
    },
  })
  const mutResolver = useMutation({
    mutationFn: (id: string) => E.resolverExcecao(id),
    onSuccess: () => {
      toast.success('Exceção resolvida.')
      invalidar()
    },
  })

  const [novaExcecao, setNovaExcecao] = useState('')

  if (q.isPending) return <div className="mx-auto max-w-3xl p-8"><Skeleton className="h-64 w-full" /></div>
  const c = q.data
  if (!c) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Vazio>Contrato não encontrado, ou você não tem acesso a ele.</Vazio>
      </div>
    )
  }

  const i = E.ETAPAS_MACRO.indexOf(c.etapa_macro)
  const proxima = E.ETAPAS_MACRO[i + 1]
  const emExecucao = c.etapa_macro === 'projetos_em_execucao'
  const abertas = (excQ.data ?? []).filter((e) => e.status === 'aberto')
  const pessoas = pessoasQ.data ?? []
  const alerta = E.alertaPagamento(c)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-8">
      <Link to="/epeas" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" /> Voltar ao EPEAS
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{c.contrato.cliente}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {c.contrato.servico?.nome ?? 'Serviço não informado'} ·{' '}
            {fmtBRLCurto(Number(c.contrato.valor))} · fechado em {fmtData(c.contrato.data_fechamento)}
            {c.contrato.responsavel && ` · por ${c.contrato.responsavel.nome}`}
          </p>
        </div>
        <Badge variant="info">{E.ETAPA_MACRO_LABELS[c.etapa_macro]}</Badge>
      </header>

      {abertas.length > 0 && (
        <Card className="border-status-danger/40 bg-status-danger-bg/40">
          <CardContent className="flex flex-col gap-2 p-4">
            <p className="text-status-danger flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4" />
              {abertas.length} exceção{abertas.length > 1 ? 'ões' : ''} em aberto
            </p>
            {abertas.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p>{e.descricao}</p>
                  <p className="text-muted-foreground text-xs">
                    {e.aberto_por?.nome ?? 'alguém'} · {fmtData(e.created_at)}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => mutResolver.mutate(e.id)}>
                  <Check className="size-3.5" /> Resolver
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {alerta && (
        <Card className={alerta.nivel === 'critico' ? 'border-status-danger/40 bg-status-danger-bg/30' : 'border-status-warning/40 bg-status-warning-bg/30'}>
          <CardContent className="p-4 text-sm">
            <span className={alerta.nivel === 'critico' ? 'text-status-danger font-semibold' : 'text-status-warning font-semibold'}>
              {alerta.nivel === 'critico' ? 'Pagamento crítico' : 'Pagamento pendente'}
            </span>{' '}
            — aguardando há {alerta.dias} dias.
          </CardContent>
        </Card>
      )}

      <ChecklistEtapa
        contrato={c}
        avancando={mutPatch.isPending}
        onAvancar={() =>
          proxima &&
          mutPatch.mutate(
            proxima === 'projetos_em_execucao'
              ? { etapa_macro: proxima, etapa_execucao: 'gru_emitir' }
              : { etapa_macro: proxima },
          )
        }
      />

      {/* -------- execução (Registro de Marca) -------- */}
      {emExecucao && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Execução · {c.contrato.servico?.nome ?? 'serviço'}</CardTitle>
            <CardDescription>
              Fluxo de Registro de Marca. Outros serviços entram na Onda B.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {E.ETAPAS_EXECUCAO.map((etapa) => {
              const atual = c.etapa_execucao === etapa
              return (
                <Button
                  key={etapa}
                  size="sm"
                  variant={atual ? 'default' : 'outline'}
                  disabled={mutPatch.isPending}
                  onClick={() => mutPatch.mutate({ etapa_execucao: etapa })}
                >
                  {E.ETAPA_EXECUCAO_LABELS[etapa]}
                </Button>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* -------- alocação -------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alocação</CardTitle>
          <CardDescription>Núcleo e time responsável pela execução.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Campo label="Núcleo">
            <Sel
              value={c.nucleo_id ?? ''}
              onChange={(v) =>
                mutPatch.mutate({
                  nucleo_id: v || null,
                  data_alocacao: v ? new Date().toISOString() : null,
                })
              }
              opcoes={(nucleosQ.data ?? []).map((n) => ({ id: n.id, nome: n.nome }))}
            />
          </Campo>
          <Campo label="Gerente do núcleo">
            <Sel
              value={c.gerente_nucleo_id ?? ''}
              onChange={(v) => mutPatch.mutate({ gerente_nucleo_id: v || null })}
              opcoes={pessoas.map((p) => ({ id: p.person.id, nome: p.person.nome }))}
            />
          </Campo>
          <Campo label="Scrum master">
            <Sel
              value={c.scrum_master_id ?? ''}
              onChange={(v) => mutPatch.mutate({ scrum_master_id: v || null })}
              opcoes={pessoas.map((p) => ({ id: p.person.id, nome: p.person.nome }))}
            />
          </Campo>
          <Campo label="Assessor de Gestão">
            <Sel
              value={c.gestao_responsavel_id ?? ''}
              onChange={(v) => mutPatch.mutate({ gestao_responsavel_id: v || null })}
              opcoes={pessoas.map((p) => ({ id: p.person.id, nome: p.person.nome }))}
            />
          </Campo>
          <div className="sm:col-span-2">
            <Campo label="Assessores do projeto">
              <div className="flex flex-wrap items-center gap-1.5">
                {c.assessores_projeto_ids.length === 0 && (
                  <span className="text-muted-foreground text-sm">Ninguém alocado ainda.</span>
                )}
                {c.assessores_projeto_ids.map((id) => {
                  const p = pessoas.find((x) => x.person.id === id)
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={mutPatch.isPending}
                      aria-label={`Remover ${p?.person.nome ?? 'assessor'} do projeto`}
                      onClick={() =>
                        mutPatch.mutate({
                          assessores_projeto_ids: c.assessores_projeto_ids.filter((x) => x !== id),
                        })
                      }
                      className="bg-accent text-accent-foreground hover:bg-accent/70 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                    >
                      {p?.person.nome ?? 'Removido'}
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  )
                })}
                <Sel
                  value=""
                  onChange={(v) =>
                    v &&
                    mutPatch.mutate({
                      assessores_projeto_ids: [...c.assessores_projeto_ids, v],
                    })
                  }
                  opcoes={pessoas
                    .filter((p) => !c.assessores_projeto_ids.includes(p.person.id))
                    .map((p) => ({ id: p.person.id, nome: p.person.nome }))}
                  placeholder="+ adicionar assessor"
                />
              </div>
            </Campo>
          </div>
        </CardContent>
      </Card>

      <Conversa
        contratoId={contratoId}
        pessoas={pessoas.map((p) => ({ id: p.person.id, nome: p.person.nome }))}
      />

      {/* -------- links -------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <LinkCampo
            label="Formulário do cliente (Notion)"
            valor={c.link_formulario_notion}
            onSalvar={(v) => mutPatch.mutate({ link_formulario_notion: v })}
          />
          <LinkCampo
            label="Contrato (Autentique)"
            valor={c.link_autentique}
            onSalvar={(v) => mutPatch.mutate({ link_autentique: v })}
          />
          <LinkCampo
            label="Grupo de WhatsApp"
            valor={c.link_grupo_whatsapp}
            onSalvar={(v) => mutPatch.mutate({ link_grupo_whatsapp: v })}
          />
        </CardContent>
      </Card>

      {/* -------- exceção -------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar exceção</CardTitle>
          <CardDescription>
            Sinaliza um problema sem mudar a etapa do contrato.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (novaExcecao.trim()) mutExcecao.mutate(novaExcecao.trim())
            }}
          >
            <Textarea
              value={novaExcecao}
              onChange={(e) => setNovaExcecao(e.target.value)}
              placeholder="Ex.: cliente informou pagamento, comprovante não localizado"
            />
            <Button type="submit" size="sm" className="w-fit gap-1.5" disabled={mutExcecao.isPending}>
              <Plus className="size-3.5" /> Registrar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* -------- timeline -------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
          <CardDescription>Toda mudança de etapa, do fechamento até aqui.</CardDescription>
        </CardHeader>
        <CardContent>
          {histQ.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (histQ.data ?? []).length === 0 ? (
            <Vazio>Sem movimentações registradas.</Vazio>
          ) : (
            <ol className="flex flex-col gap-3">
              {(histQ.data ?? []).map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <div className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" aria-hidden="true" />
                  <div>
                    <p>
                      {h.etapa_anterior && (
                        <span className="text-muted-foreground">
                          {E.rotuloEtapa(h.campo, h.etapa_anterior)} →{' '}
                        </span>
                      )}
                      <span className="font-medium">{E.rotuloEtapa(h.campo, h.etapa_nova)}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {h.alterado_por?.nome ?? 'sistema'} ·{' '}
                      {new Date(h.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Sel({
  value,
  onChange,
  opcoes,
  placeholder = '— não definido —',
}: {
  value: string
  onChange: (v: string) => void
  opcoes: { id: string; nome: string }[]
  placeholder?: string
}) {
  return (
    <select
      className="border-input bg-card h-9 rounded-md border px-3 text-sm shadow-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {opcoes.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nome}
        </option>
      ))}
    </select>
  )
}

function LinkCampo({
  label,
  valor,
  onSalvar,
}: {
  label: string
  valor: string | null
  onSalvar: (v: string | null) => void
}) {
  const [editando, setEditando] = useState(false)
  const [txt, setTxt] = useState(valor ?? '')

  if (!editando) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          {valor ? <LinkExterno href={valor}>Abrir</LinkExterno> : <p className="text-sm">—</p>}
        </div>
        <Button size="sm" variant="outline" onClick={() => { setTxt(valor ?? ''); setEditando(true) }}>
          {valor ? 'Alterar' : 'Adicionar'}
        </Button>
      </div>
    )
  }

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSalvar(txt.trim() || null)
        setEditando(false)
      }}
    >
      <div className="flex-1">
        <Campo label={label}>
          <Input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="https://…" autoFocus />
        </Campo>
      </div>
      <Button type="submit" size="sm">Salvar</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)}>
        Cancelar
      </Button>
    </form>
  )
}
