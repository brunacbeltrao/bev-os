import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  Target,
  CalendarCheck,
  Plus,
  UserCheck,
  Lock,
  AlertTriangle,
  ArrowLeft,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Segmented } from '@/components/ui/segmented'
import { useApp } from '@/lib/app-context'
import { getLiderados } from '@/lib/pdi'
import { getOtos, getOneOnOnes, createOneOnOne, updateOtoStatus, type Oto } from '@/lib/gerente'
import { fmtDate } from '@/lib/use-context-scope'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/_app/gerente')({
  component: GerentePainelPage,
})

const OTO_STATUS_LABELS = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

const OTO_STATUS_COLORS = {
  pendente: 'bg-status-warning-bg text-status-warning border-status-warning/25',
  em_andamento: 'bg-status-info-bg text-status-info border-status-info/25',
  concluido: 'bg-status-success-bg text-status-success border-status-success/25',
  cancelado: 'bg-status-danger-bg text-status-danger border-status-danger/25',
}

function GerentePainelPage() {
  const { isLeader, isDirex, primary, cycle } = useApp()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'liderados' | 'otos' | '1on1s'>('liderados')

  // Seletor de Gerência para Diretores
  const [selectedSubareaId, setSelectedSubareaId] = useState<string>(
    isDirex ? '' : primary.subarea.id
  )
  const [selectedGerenteId, setSelectedGerenteId] = useState<string>(
    isDirex ? '' : primary.person_id
  )
  const [selectedGerenteNome, setSelectedGerenteNome] = useState<string>('')
  const [selectedSubareaNome, setSelectedSubareaNome] = useState<string>('')

  // Busca as gerências da diretoria do diretor
  const gerenciasQ = useQuery({
    queryKey: ['gerencias-selector', primary.directorate.id, cycle.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approved_roster')
        .select('nome, role, email, subarea:subareas(id, nome, slug), people:people!inner(id)')
        .eq('directorate_id', primary.directorate.id)
        .eq('cycle_id', cycle.id)
        .eq('role', 'gerente')
      if (error) throw error
      return data as unknown as Array<{
        nome: string
        role: string
        email: string
        subarea: { id: string; nome: string; slug: string }
        people: { id: string }
      }>
    },
    enabled: isDirex,
  })

  // Queries
  const lideradosQ = useQuery({
    queryKey: ['liderados', cycle.id],
    queryFn: getLiderados,
    enabled: isLeader || isDirex,
  })

  const otosQ = useQuery({
    queryKey: ['otos', cycle.id, selectedSubareaId],
    queryFn: () => getOtos(cycle.id, selectedSubareaId),
    enabled: !!selectedSubareaId,
  })

  const meetingsQ = useQuery({
    queryKey: ['one_on_ones', cycle.id, selectedGerenteId],
    queryFn: () => getOneOnOnes(cycle.id, selectedGerenteId),
    enabled: !!selectedGerenteId,
  })

  // State para o Form de 1:1
  const [openOneOnOne, setOpenOneOnOne] = useState(false)
  const [selectedLideradoId, setSelectedLideradoId] = useState('')
  const [dataReuniao, setDataReuniao] = useState(new Date().toISOString().slice(0, 10))
  const [relatorio, setRelatorio] = useState('')
  const [acoes, setAcoes] = useState('')
  const [insights, setInsights] = useState('')
  const [pretensao, setPretensao] = useState('talvez')
  const [dificuldades, setDificuldades] = useState('')

  // Mutations
  const mutOneOnOne = useMutation({
    mutationFn: () =>
      createOneOnOne({
        gerente_id: selectedGerenteId,
        liderado_id: selectedLideradoId,
        cycle_id: cycle.id,
        data_reuniao: dataReuniao,
        relatorio,
        acoes,
        insights,
        pretensao_lideranca: pretensao,
        dificuldades,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['one_on_ones'] })
      setOpenOneOnOne(false)
      // Reset
      setSelectedLideradoId('')
      setRelatorio('')
      setAcoes('')
      setInsights('')
      setPretensao('talvez')
      setDificuldades('')
    },
  })

  const mutUpdateOto = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Oto['status'] }) =>
      updateOtoStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['otos'] })
    },
  })

  if (!isLeader && !isDirex) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <Lock className="text-muted-foreground mx-auto mb-3 size-8" />
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Este painel é de uso exclusivo de lideranças (Diretores e Gerentes).
        </p>
      </div>
    )
  }

  // Filtrar apenas assessores/analistas no roster de liderados da subárea selecionada
  const assessores = (lideradosQ.data ?? []).filter(
    (l) =>
      (l.role === 'assessor' || l.role === 'analista') &&
      l.subarea_id === selectedSubareaId
  )

  // Se o diretor ainda não selecionou qual gerência ver, mostramos a tela de seleção
  if (isDirex && !selectedSubareaId) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Users className="size-4.5" />
            </span>
            Painel da Gerência
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Como diretora de <span className="font-semibold">{primary.directorate.nome}</span>, selecione qual gerência deseja visualizar e gerenciar:
          </p>
        </div>

        {gerenciasQ.isPending ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : (gerenciasQ.data ?? []).length === 0 ? (
          <Card className="border-dashed py-12 text-center">
            <CardContent className="text-muted-foreground">
              Nenhuma gerência/subárea ativa cadastrada sob sua diretoria neste ciclo.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(gerenciasQ.data ?? []).map((g) => (
              <Card
                key={g.subarea.id}
                className="hover:border-primary/50 cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
                onClick={() => {
                  setSelectedSubareaId(g.subarea.id)
                  setSelectedGerenteId(g.people.id)
                  setSelectedGerenteNome(g.nome)
                  setSelectedSubareaNome(g.subarea.nome)
                }}
              >
                <CardHeader>
                  <CardTitle className="text-lg font-bold">{g.subarea.nome}</CardTitle>
                  <CardDescription>Gerente: {g.nome}</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-end pb-4 pt-0">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-primary">
                    Visualizar <ChevronRight className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          {isDirex && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 mb-2"
              onClick={() => {
                setSelectedSubareaId('')
                setSelectedGerenteId('')
                setSelectedGerenteNome('')
                setSelectedSubareaNome('')
              }}
            >
              <ArrowLeft className="size-4" /> Voltar para Gerências
            </Button>
          )}
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Users className="size-4.5" />
            </span>
            Painel do Gerente
          </h1>
          <p className="text-muted-foreground text-sm">
            {isDirex ? (
              <>
                Visualizando gerência de{' '}
                <span className="font-semibold text-foreground">{selectedSubareaNome}</span> (Gerente:{' '}
                <span className="font-semibold text-foreground">{selectedGerenteNome}</span>)
              </>
            ) : (
              <>
                Gestão da equipe de <span className="font-semibold">{primary.subarea.nome}</span> · Ciclo {cycle.nome}
              </>
            )}
          </p>
        </div>
      </header>

      {/* Navegação por Abas Segmentadas */}
      <div className="flex justify-start overflow-x-auto border-b pb-4 md:justify-center">
        <Segmented
          value={tab}
          onChange={setTab}
          className="shrink-0"
          options={[
            { value: 'liderados', label: 'Meus Liderados', count: assessores.length },
            { value: 'otos', label: 'OTOs', count: otosQ.data?.length },
            { value: '1on1s', label: 'Sessões 1:1', count: meetingsQ.data?.length },
          ]}
        />
      </div>

      {/* CONTEÚDO DAS ABAS */}
      {tab === 'liderados' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Users className="size-5 text-indigo-500" />
              Equipe ({assessores.length})
            </h2>
          </div>

          {lideradosQ.isPending ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : assessores.length === 0 ? (
            <Card className="border-dashed py-12 text-center">
              <CardContent className="text-muted-foreground">
                Nenhum assessor ou analista associado a este time neste ciclo.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assessores.map((l) => (
                <Card key={l.person_id} className="hover:border-primary/40 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-sm">
                        {l.nome.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold">{l.nome}</CardTitle>
                        <CardDescription>{l.email}</CardDescription>
                      </div>
                    </div>
                    {l.risco && (
                      <Badge variant="danger">
                        <AlertTriangle className="size-3 mr-1" /> Risco
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="pt-2 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-2 mt-2">
                      <span>Metas Ativas: <strong className="text-foreground">{l.metas_abertas}</strong></span>
                      <span>Agravos: <strong className="text-foreground">{l.agravos}</strong></span>
                      <span>Atualizado em: <strong className="text-foreground">{fmtDate(l.pdi_atualizado_em)}</strong></span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'otos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Target className="size-5 text-indigo-500" />
              Objetivos Táticos Operacionais (OTOs)
            </h2>
          </div>

          {otosQ.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : (otosQ.data ?? []).length === 0 ? (
            <Card className="border-dashed py-12 text-center">
              <CardContent className="text-muted-foreground">
                Nenhum OTO atribuído para esta gerência neste ciclo.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {(otosQ.data ?? []).map((o) => (
                <Card key={o.id} className="overflow-hidden">
                  <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{o.titulo}</h3>
                        <Badge className={OTO_STATUS_COLORS[o.status] + ' border'}>
                          {OTO_STATUS_LABELS[o.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{o.descricao || 'Sem descrição cadastrada.'}</p>
                      {o.prazo && (
                        <p className="text-xs text-muted-foreground/80 mt-1">
                          Prazo final: <strong className="text-foreground">{fmtDate(o.prazo)}</strong>
                        </p>
                      )}
                    </div>
                    
                    {/* Alterar status só se for o próprio gerente (Diretor apenas visualiza) */}
                    {!isDirex && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Label htmlFor={`status-${o.id}`} className="sr-only">Alterar Status</Label>
                        <select
                          id={`status-${o.id}`}
                          className="bg-background border border-input h-9 px-3 rounded-md text-sm ring-offset-background focus:outline-hidden focus:ring-2 focus:ring-ring"
                          value={o.status}
                          onChange={(e) => mutUpdateOto.mutate({ id: o.id, status: e.target.value as Oto['status'] })}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="em_andamento">Em Andamento</option>
                          <option value="concluido">Concluído</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === '1on1s' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <CalendarCheck className="size-5 text-indigo-500" />
              Sessões 1:1
            </h2>

            {/* Apenas gerentes podem registrar novas 1:1s */}
            {!isDirex && (
              <Dialog open={openOneOnOne} onOpenChange={setOpenOneOnOne}>
                <DialogTrigger asChild>
                  <Button className="gap-1.5 shadow-sm">
                    <Plus className="size-4" /> Registrar 1:1
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Registrar Ciclo de 1:1</DialogTitle>
                    <DialogDescription>
                      Registre os feedbacks combinados, insights e pretensão do assessor.
                    </DialogDescription>
                  </DialogHeader>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      mutOneOnOne.mutate()
                    }}
                    className="space-y-4 mt-4"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="liderado">Membro Liderado</Label>
                        <select
                          id="liderado"
                          required
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={selectedLideradoId}
                          onChange={(e) => setSelectedLideradoId(e.target.value)}
                        >
                          <option value="" disabled>Selecione um assessor...</option>
                          {assessores.map((a) => (
                            <option key={a.person_id} value={a.person_id ?? ''}>
                              {a.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="data">Data da Reunião</Label>
                        <Input
                          id="data"
                          type="date"
                          required
                          value={dataReuniao}
                          onChange={(e) => setDataReuniao(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="relatorio">Relatório da 1:1 (Discussão principal)</Label>
                      <Textarea
                        id="relatorio"
                        placeholder="Resumo do que foi conversado e discutido na sessão..."
                        value={relatorio}
                        onChange={(e) => setRelatorio(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="acoes">Ações Combinadas</Label>
                        <Textarea
                          id="acoes"
                          placeholder="Próximos passos e combinados práticos..."
                          value={acoes}
                          onChange={(e) => setAcoes(e.target.value)}
                          rows={2}
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="insights">Insights sobre o Membro</Label>
                        <Textarea
                          id="insights"
                          placeholder="Sentimento geral do membro, atitude e energia..."
                          value={insights}
                          onChange={(e) => setInsights(e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="pretensao">Pretensão de Liderança?</Label>
                        <select
                          id="pretensao"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={pretensao}
                          onChange={(e) => setPretensao(e.target.value)}
                        >
                          <option value="sim">Sim, tem pretensão clara</option>
                          <option value="nao">Não, prefere área técnica</option>
                          <option value="talvez">Talvez / Incerto</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="dificuldades">Dificuldades Mapeadas</Label>
                        <Input
                          id="dificuldades"
                          placeholder="Ex: conciliação de horários, ansiedade..."
                          value={dificuldades}
                          onChange={(e) => setDificuldades(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setOpenOneOnOne(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={mutOneOnOne.isPending}>
                        {mutOneOnOne.isPending ? 'Salvando...' : 'Salvar Registro'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {meetingsQ.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : (meetingsQ.data ?? []).length === 0 ? (
            <Card className="border-dashed py-12 text-center">
              <CardContent className="text-muted-foreground">
                Nenhuma sessão de 1:1 registrada para esta gerência neste ciclo.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {(meetingsQ.data ?? []).map((m) => (
                <Card key={m.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="size-4 text-indigo-500" />
                        <span className="font-bold">{m.liderado?.nome}</span>
                      </div>
                      <Badge variant="outline">{fmtDate(m.data_reuniao)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    {m.relatorio && (
                      <p className="text-muted-foreground"><strong className="text-foreground">Relatório:</strong> {m.relatorio}</p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border-t pt-2 mt-2">
                      <div>
                        <strong className="text-foreground">Ações Combinadas:</strong>
                        <p className="text-muted-foreground mt-0.5">{m.acoes || '—'}</p>
                      </div>
                      <div>
                        <strong className="text-foreground">Dificuldades / Pontos de Atenção:</strong>
                        <p className="text-muted-foreground mt-0.5">{m.dificuldades || '—'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
