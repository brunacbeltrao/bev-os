/**
 * Direx — Centro de Comando (Blueprint §5.1 / ADD).
 * Para Gerentes: exibe apenas os agregados da direx_summary_view.
 * Para Diretores: exibe a Inbox com semáforos de prioridade + Gestão de OTOs.
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Gavel, Landmark, Lock, CheckCircle2, Clock, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Segmented } from '@/components/ui/segmented'
import { useApp } from '@/lib/app-context'
import { getDirexSummary, getInboxItems } from '@/lib/direx'
import { getOtos, createOto } from '@/lib/gerente'
import { useAllSubareas, fmtDate } from '@/lib/use-context-scope'

export const Route = createFileRoute('/_app/diretor/')({ component: DirexResumoPage })

const OTO_STATUS_LABELS = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

const OTO_STATUS_COLORS = {
  pendente: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  em_andamento: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  concluido: 'bg-green-500/10 text-green-500 border-green-500/20',
  cancelado: 'bg-red-500/10 text-red-500 border-red-500/20',
}

function DirexResumoPage() {
  const { isDirex, primary, cycle } = useApp()
  const isGerente = primary.role === 'gerente'
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'inbox' | 'otos'>('inbox')

  // Queries
  const summaryQ = useQuery({
    queryKey: ['direx-summary', cycle.id],
    queryFn: () => getDirexSummary(cycle.id),
    enabled: isDirex || isGerente,
  })

  const inboxQ = useQuery({
    queryKey: ['direx-inbox', cycle.id],
    queryFn: () => getInboxItems(cycle.id),
    enabled: isDirex,
  })

  const otosQ = useQuery({
    queryKey: ['otos', cycle.id, undefined, primary.directorate.id],
    queryFn: () => getOtos(cycle.id, undefined, primary.directorate.id),
    enabled: isDirex,
  })

  const subareasQ = useAllSubareas()

  // Form State para Novo OTO
  const [openOto, setOpenOto] = useState(false)
  const [otoTitulo, setOtoTitulo] = useState('')
  const [otoDescricao, setOtoDescricao] = useState('')
  const [otoPrazo, setOtoPrazo] = useState('')
  const [otoSubareaId, setOtoSubareaId] = useState('')

  // Mutations
  const mutCreateOto = useMutation({
    mutationFn: () =>
      createOto({
        directorate_id: primary.directorate.id,
        subarea_id: otoSubareaId,
        cycle_id: cycle.id,
        titulo: otoTitulo,
        descricao: otoDescricao || null,
        prazo: otoPrazo || null,
        status: 'pendente',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['otos'] })
      setOpenOto(false)
      setOtoTitulo('')
      setOtoDescricao('')
      setOtoPrazo('')
      setOtoSubareaId('')
    },
  })

  if (!isDirex && !isGerente) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <Lock className="text-muted-foreground mx-auto mb-3 size-8" />
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          O painel da diretoria é acessível a Diretores e, de forma resumida, a Gerentes.
        </p>
      </div>
    )
  }

  const s = summaryQ.data
  const myInbox = (inboxQ.data ?? []).filter((item) => item.responsavel_id === primary.id)
  
  // Filtra as subáreas pertencentes apenas a esta diretoria
  const minhasSubareas = (subareasQ.data ?? []).filter(
    (sub) => sub.directorate_id === primary.directorate.id
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Landmark className="size-4.5" />
          </span>
          Painel da Diretoria
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isDirex
            ? `Visão estratégica da diretoria de ${primary.directorate.nome} · Ciclo ${cycle.nome}`
            : `Visão resumida para Gerentes · Ciclo ${cycle.nome} — sem acesso a atas completas e decisões.`}
        </p>
      </header>

      {summaryQ.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="sm:col-span-1 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="size-4" /> Atas de RD
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s?.total_atas ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Última: {fmtDate(s?.ultima_rd)}</p>
            </CardContent>
          </Card>
          <Card className="sm:col-span-1 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Gavel className="size-4" /> Decisões Macro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s?.total_decisoes ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Última: {fmtDate(s?.ultima_decisao)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isDirex && (
        <div className="space-y-6">
          {/* Seletor Segmentado de Visualização para Diretores */}
          <div className="flex justify-center border-b pb-4">
            <Segmented
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: 'inbox', label: 'Inbox (Minhas Pendências)', count: myInbox.length },
                { value: 'otos', label: 'Objetivos Táticos (OTOs)', count: otosQ.data?.length },
              ]}
            />
          </div>

          {activeTab === 'inbox' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">
                Minhas Pendências
              </h2>

              {inboxQ.isPending ? (
                <Skeleton className="h-40" />
              ) : myInbox.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="size-10 text-muted-foreground/30 mb-4" />
                    <h3 className="font-medium text-lg">Inbox Zero!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Nenhuma tarefa, decisão pendente ou problema crítico sob sua responsabilidade neste momento.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {myInbox.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div
                        className={`size-2.5 shrink-0 rounded-full ${
                          item.cor === 'vermelho'
                            ? 'bg-red-500'
                            : item.cor === 'amarelo'
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                            {item.tipo}
                          </Badge>
                          {item.prazo && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="size-3" /> {fmtDate(item.prazo)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate">{item.titulo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'otos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">
                  Objetivos Táticos Operacionais (OTOs)
                </h2>

                <Dialog open={openOto} onOpenChange={setOpenOto}>
                  <DialogTrigger asChild>
                    <Button className="gap-1.5">
                      <Plus className="size-4" /> Cadastrar OTO
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cadastrar Novo OTO</DialogTitle>
                      <DialogDescription>
                        Crie um objetivo tático-operacional para uma das gerências da sua diretoria.
                      </DialogDescription>
                    </DialogHeader>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        mutCreateOto.mutate()
                      }}
                      className="space-y-4 mt-4"
                    >
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="oto-titulo">Título do Objetivo</Label>
                        <Input
                          id="oto-titulo"
                          required
                          placeholder="Ex: Atingir 20k em faturamento"
                          value={otoTitulo}
                          onChange={(e) => setOtoTitulo(e.target.value)}
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="oto-desc">Descrição / Contexto</Label>
                        <Textarea
                          id="oto-desc"
                          placeholder="Descreva o objetivo detalhadamente..."
                          value={otoDescricao}
                          onChange={(e) => setOtoDescricao(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="oto-subarea">Gerência / Time Responsável</Label>
                          <select
                            id="oto-subarea"
                            required
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={otoSubareaId}
                            onChange={(e) => setOtoSubareaId(e.target.value)}
                          >
                            <option value="" disabled>Selecione um time...</option>
                            {minhasSubareas.map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.nome}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="oto-prazo">Prazo Estimado</Label>
                          <Input
                            id="oto-prazo"
                            type="date"
                            value={otoPrazo}
                            onChange={(e) => setOtoPrazo(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpenOto(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={mutCreateOto.isPending}>
                          {mutCreateOto.isPending ? 'Salvando...' : 'Salvar Objetivo'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {otosQ.isPending ? (
                <Skeleton className="h-40" />
              ) : (otosQ.data ?? []).length === 0 ? (
                <Card className="border-dashed py-12 text-center">
                  <CardContent className="text-muted-foreground">
                    Nenhum OTO cadastrado para sua diretoria neste ciclo.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {(otosQ.data ?? []).map((o) => (
                    <Card key={o.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base">{o.titulo}</h3>
                            <Badge className={OTO_STATUS_COLORS[o.status] + ' border'}>
                              {OTO_STATUS_LABELS[o.status]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{o.descricao}</p>
                          <div className="flex gap-4 text-xs text-muted-foreground/80 mt-1">
                            <span>Responsável: <strong className="text-foreground">{o.subarea?.nome}</strong></span>
                            {o.prazo && (
                              <span>Prazo: <strong className="text-foreground">{fmtDate(o.prazo)}</strong></span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
