/**
 * EPEAS — home.
 *
 * Três leituras da mesma base, porque as três áreas perguntam coisas
 * diferentes: "o que precisa de mim agora" (todo mundo), "como está o
 * pipeline" (liderança) e "onde está o contrato X" (busca).
 */
import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  AtSign,
  Inbox,
  KanbanSquare,
  Plus,
  Route as RouteIcon,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useApp } from '@/lib/app-context'
import { getDirectory } from '@/lib/org'
import * as C from '@/lib/contratos'
import * as E from '@/lib/epeas'
import * as P from '@/lib/epeas-prazos'
import { isDirexMember } from '@/lib/permissions'
import { ContratoCard, PrazoResumo, Vazio } from '@/components/features/epeas/epeas-shared'
import { BaselineEmLote } from '@/components/features/epeas/baseline-em-lote'

export const Route = createFileRoute('/_app/epeas/')({ component: EpeasPage })

type Vista = 'pendencias' | 'pipeline' | 'todos'

function EpeasPage() {
  const { person, cycle, occupations } = useApp()
  const qc = useQueryClient()
  const [vista, setVista] = useState<Vista>('pendencias')
  const [busca, setBusca] = useState('')

  const ehGestao = occupations.some((o) => o.directorate.slug === 'gestao')
  const ehProjetos = occupations.some(
    (o) => o.directorate.slug === 'projetos' && ['diretor', 'gerente', 'coordenador'].includes(o.role),
  )
  const ehNegocios = occupations.some((o) => o.directorate.slug === 'negocios')
  const ehDirex = isDirexMember(occupations)

  const q = useQuery({ queryKey: ['epeas', cycle.id], queryFn: E.getEpeasContratos })
  const resumoQ = useQuery({
    queryKey: ['epeas-resumo', person.id],
    queryFn: () => E.getResumoConversa(person.id),
  })
  // Eventos, suspensões e feriados da carteira inteira em três consultas —
  // o motor precisa deles para dizer o que está de fato atrasado.
  const prazosQ = useQuery({ queryKey: ['epeas-prazos'], queryFn: P.getContextoPrazos })

  const todos = q.data ?? []
  const ctxPrazos = prazosQ.data ?? P.CONTEXTO_VAZIO
  const naoLidos = resumoQ.data?.naoLidos ?? new Map<string, number>()
  const mencionado = resumoQ.data?.mencionado ?? new Set<string>()

  const mutAvancar = useMutation({
    // o serviço vai junto: é dele que sai a primeira etapa da trilha quando
    // o contrato entra em execução
    mutationFn: ({ id, atual, servicoId }: { id: string; atual: E.EtapaMacro; servicoId: string | null }) =>
      E.avancarEtapa(id, atual, servicoId),
    onSuccess: () => {
      toast.success('Etapa avançada.')
      qc.invalidateQueries({ queryKey: ['epeas'] })
    },
  })

  /**
   * A bola está comigo? A regra é de quem é a fase, mais menção direta.
   * Sem isso cada pessoa teria que varrer a lista para descobrir.
   */
  const pendencias = useMemo(() => {
    return todos
      .filter((c) => {
        const fase = E.faseDaEtapa(c.etapa_macro)
        const minhaFase =
          (fase === 'comercial' && (ehNegocios || c.contrato.responsavel_id === person.id)) ||
          (fase === 'gestao' && (ehGestao || c.gestao_responsavel_id === person.id)) ||
          (fase === 'projetos' &&
            (ehProjetos ||
              c.gerente_nucleo_id === person.id ||
              c.scrum_master_id === person.id ||
              c.assessores_projeto_ids.includes(person.id)))
        const prazoEstourado = P.prazoContratual(c, ctxPrazos).atrasado
        return minhaFase || mencionado.has(c.contrato_id) || c.excecoes_abertas > 0 || prazoEstourado
      })
      .sort((a, b) => {
        // prazo contratual estourado vem antes de tudo: é o único destes
        // que o cliente enxerga. Depois exceção, SLA interno e menção.
        const peso = (c: E.EpeasContrato) => {
          const sla = P.slaDaEtapa(c, ctxPrazos)
          return (
            (P.prazoContratual(c, ctxPrazos).atrasado ? 200 : 0) +
            (c.excecoes_abertas > 0 ? 100 : 0) +
            (sla.atrasado ? 50 : 0) +
            (mencionado.has(c.contrato_id) ? 25 : 0) +
            (sla.decorridos ?? 0)
          )
        }
        return peso(b) - peso(a)
      })
  }, [todos, ehNegocios, ehGestao, ehProjetos, person.id, mencionado, ctxPrazos])

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return todos
    return todos.filter(
      (c) =>
        c.contrato.cliente.toLowerCase().includes(t) ||
        (c.contrato.nome_comercial ?? '').toLowerCase().includes(t) ||
        (c.contrato.servico?.nome ?? '').toLowerCase().includes(t) ||
        (c.nucleo?.nome ?? '').toLowerCase().includes(t),
    )
  }, [todos, busca])

  // As duas camadas contadas separadamente, porque respondem a perguntas
  // diferentes: "devemos ao cliente" e "estamos devagar internamente". Antes
  // só a primeira aparecia aqui, e os cartões mostravam a segunda em
  // vermelho — daí "Atrasados: 0" com 31 cartões vermelhos embaixo.
  const atrasados = todos.filter((c) => P.prazoContratual(c, ctxPrazos).atrasado).length
  const acimaDoSla = todos.filter((c) => P.slaDaEtapa(c, ctxPrazos).atrasado).length
  const semBaseline = todos.filter((c) => !P.temBaseline(c.contrato_id, ctxPrazos)).length
  const suspensos = todos.filter(
    (c) => P.prazoContratual(c, ctxPrazos).situacao === 'suspenso',
  ).length
  const comExcecao = todos.filter((c) => c.excecoes_abertas > 0).length

  function acaoDe(c: E.EpeasContrato) {
    const i = E.ETAPAS_MACRO.indexOf(c.etapa_macro)
    const proxima = E.ETAPAS_MACRO[i + 1]
    if (!proxima) return null
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link to="/epeas/contrato/$contratoId" params={{ contratoId: c.contrato_id }}>
            Abrir
          </Link>
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={mutAvancar.isPending}
          onClick={() =>
            mutAvancar.mutate({
              id: c.contrato_id,
              atual: c.etapa_macro,
              servicoId: c.contrato.servico?.id ?? null,
            })
          }
        >
          {E.ETAPA_MACRO_LABELS[proxima]}
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <RouteIcon className="size-4.5" />
            </span>
            EPEAS
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Do fechamento à entrega — Comercial, Gestão e Projetos no mesmo lugar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ehDirex && <BaselineEmLote contratos={todos} ctx={ctxPrazos} />}
          {(ehNegocios || ehDirex) && <NovoContratoDialog />}
        </div>
      </header>

      {/* ---- termômetro ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Indicador rotulo="Em andamento" valor={todos.filter((c) => c.etapa_macro !== 'projetos_entregue').length} />
        <Indicador rotulo="Precisam de mim" valor={pendencias.length} destaque={pendencias.length > 0} />
        <Indicador
          rotulo="Atrasados com o cliente"
          valor={atrasados}
          tom={atrasados > 0 ? 'danger' : undefined}
        />
        <Indicador rotulo="Acima do SLA interno" valor={acimaDoSla} />
        <Indicador rotulo="Sem baseline" valor={semBaseline} />
        <Indicador rotulo="Com exceção" valor={comExcecao} tom={comExcecao > 0 ? 'danger' : undefined} />
      </div>
      {suspensos > 0 && (
        <p className="text-muted-foreground -mt-2 text-xs">
          {suspensos} contrato(s) com prazo suspenso — o contador está congelado neles.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        <Aba id="pendencias" atual={vista} set={setVista} icone={Inbox}>
          Precisa de mim
          {pendencias.length > 0 && (
            <Badge variant={vista === 'pendencias' ? 'secondary' : 'neutral'} className="ml-1.5 px-1.5">
              {pendencias.length}
            </Badge>
          )}
        </Aba>
        <Aba id="pipeline" atual={vista} set={setVista} icone={KanbanSquare}>
          Pipeline
        </Aba>
        <Aba id="todos" atual={vista} set={setVista} icone={Search}>
          Buscar
        </Aba>
      </div>

      {q.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : vista === 'pendencias' ? (
        pendencias.length === 0 ? (
          <Vazio>Nada esperando por você agora.</Vazio>
        ) : (
          <div className="flex flex-col gap-3">
            {pendencias.map((c) => (
              <ContratoCard
                key={c.id}
                c={c}
                ctx={ctxPrazos}
                naoLidos={naoLidos.get(c.contrato_id) ?? 0}
                mencionado={mencionado.has(c.contrato_id)}
                acao={acaoDe(c)}
              />
            ))}
          </div>
        )
      ) : vista === 'pipeline' ? (
        <Pipeline
          contratos={todos}
          naoLidos={naoLidos}
          mencionado={mencionado}
          ctxPrazos={ctxPrazos}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, serviço ou núcleo…"
          />
          {filtrados.length === 0 ? (
            <Vazio>Nenhum contrato encontrado.</Vazio>
          ) : (
            filtrados.map((c) => (
              <ContratoCard
                key={c.id}
                c={c}
                ctx={ctxPrazos}
                naoLidos={naoLidos.get(c.contrato_id) ?? 0}
                mencionado={mencionado.has(c.contrato_id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function Aba({
  id,
  atual,
  set,
  icone: Icone,
  children,
}: {
  id: Vista
  atual: Vista
  set: (v: Vista) => void
  icone: typeof Inbox
  children: React.ReactNode
}) {
  return (
    <Button size="sm" variant={atual === id ? 'default' : 'ghost'} onClick={() => set(id)} className="gap-1.5">
      <Icone className="size-4" />
      {children}
    </Button>
  )
}

function Indicador({
  rotulo,
  valor,
  tom,
  destaque,
}: {
  rotulo: string
  valor: number
  tom?: 'danger'
  destaque?: boolean
}) {
  return (
    <Card className={destaque ? 'border-primary/50 bg-accent/40' : 'bg-card/60'}>
      <CardContent className="p-3">
        <p className={`text-2xl font-semibold ${tom === 'danger' && valor > 0 ? 'text-status-danger' : ''}`}>
          {valor}
        </p>
        <p className="text-muted-foreground text-xs">{rotulo}</p>
      </CardContent>
    </Card>
  )
}

/** Quadro por fase — o substituto visual da lista de emojis do Telegram. */
function Pipeline({
  contratos,
  naoLidos,
  mencionado,
  ctxPrazos,
}: {
  contratos: E.EpeasContrato[]
  naoLidos: Map<string, number>
  mencionado: Set<string>
  ctxPrazos: P.ContextoPrazos
}) {
  const fases = ['comercial', 'gestao', 'projetos'] as const
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {fases.map((fase) => {
        const doFase = contratos.filter(
          (c) => E.faseDaEtapa(c.etapa_macro) === fase && c.etapa_macro !== 'projetos_entregue',
        )
        return (
          <div key={fase} className="bg-muted/40 flex flex-col gap-2 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{E.FASE_LABELS[fase]}</h2>
              <Badge variant="neutral">{doFase.length}</Badge>
            </div>
            {doFase.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
                Vazio
              </p>
            ) : (
              doFase.map((c) => {
                const contratual = P.prazoContratual(c, ctxPrazos)
                const sla = P.slaDaEtapa(c, ctxPrazos)
                return (
                  <Link
                    key={c.id}
                    to="/epeas/contrato/$contratoId"
                    params={{ contratoId: c.contrato_id }}
                    // A tarja vermelha é do prazo do cliente. SLA interno
                    // estourado é âmbar: chama atenção sem virar alarme.
                    className={`bg-card hover:bg-accent/50 block rounded-lg border border-l-[3px] p-3 transition-colors ${
                      contratual.atrasado
                        ? 'border-l-status-danger'
                        : sla.atrasado || sla.situacao === 'perto'
                          ? 'border-l-status-warning'
                          : 'border-l-primary'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {c.contrato.nome_comercial ?? c.contrato.cliente}
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        {mencionado.has(c.contrato_id) && (
                          <AtSign className="text-primary size-3.5" aria-label="Você foi citado" />
                        )}
                        {(naoLidos.get(c.contrato_id) ?? 0) > 0 && (
                          <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-medium">
                            {naoLidos.get(c.contrato_id)}
                          </span>
                        )}
                        {c.excecoes_abertas > 0 && (
                          <AlertTriangle className="text-status-danger size-3.5" aria-label="Exceção aberta" />
                        )}
                      </div>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {E.ETAPA_MACRO_LABELS[c.etapa_macro]}
                    </p>
                    <div className="mt-1">
                      <PrazoResumo contratual={contratual} sla={sla} alinhar="start" />
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        )
      })}
    </div>
  )
}

/** O Comercial abre o registro no fechamento — nasce em `contratos`. */
function NovoContratoDialog() {
  const { person, cycle } = useApp()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [cliente, setCliente] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState('')
  const [servicoId, setServicoId] = useState('')
  const [responsavelId, setResponsavelId] = useState('')

  const servicosQ = useQuery({ queryKey: ['project-services'], queryFn: C.getServicos, enabled: open })
  const pessoasQ = useQuery({
    queryKey: ['directory-all', cycle.id],
    queryFn: () => getDirectory(cycle.id, null),
    enabled: open,
  })

  const mut = useMutation({
    mutationFn: async () => {
      await C.createContrato(
        {
          cliente: cliente.trim(),
          valor: Number(valor),
          data_fechamento: data,
          servico_id: servicoId || null,
          responsavel_id: responsavelId || person.id,
          segmento: 'outro',
        },
        person.id,
      )
      const criados = await C.getContratos(Number(data.slice(0, 4)))
      const novo = criados.find((c) => c.cliente === cliente.trim() && c.data_fechamento === data)
      if (!novo) throw new Error('Contrato criado, mas não foi possível abrir o ciclo de vida.')
      await E.iniciarCicloDeVida(novo.id)
    },
    onSuccess: () => {
      toast.success('Contrato aberto no EPEAS.')
      setOpen(false)
      setCliente('')
      setValor('')
      setData('')
      setServicoId('')
      setResponsavelId('')
      qc.invalidateQueries({ queryKey: ['epeas'] })
      qc.invalidateQueries({ queryKey: ['contratos'] })
    },
    onError: () => toast.error('Não foi possível abrir o contrato.'),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Novo contrato
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir contrato no EPEAS</DialogTitle>
          <DialogDescription>
            É o mesmo registro do faturamento — não precisa cadastrar em dois lugares.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            mut.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label>Cliente</Label>
            <Input required value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Valor (R$)</Label>
              <Input required type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Data de fechamento</Label>
              <Input required type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Serviço</Label>
            <select
              className="border-input bg-card h-9 rounded-md border px-3 text-sm shadow-xs"
              value={servicoId}
              onChange={(e) => setServicoId(e.target.value)}
            >
              <option value="">— não informado —</option>
              {(servicosQ.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Responsável pelo fechamento</Label>
            <select
              className="border-input bg-card h-9 rounded-md border px-3 text-sm shadow-xs"
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
            >
              <option value="">Eu mesmo(a)</option>
              {(pessoasQ.data ?? []).map((d) => (
                <option key={d.person.id} value={d.person.id}>
                  {d.person.nome}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? 'Abrindo…' : 'Abrir contrato'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
