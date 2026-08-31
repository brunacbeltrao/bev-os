/**
 * EPEAS — home da aba (PRD §7.1).
 *
 * A visão muda conforme o papel de quem entra: Comercial vê os próprios
 * contratos, Gestão a fila de elaboração, Projetos a fila de alocação e o
 * núcleo os contratos alocados. Quem acumula papéis vê as abas de todos,
 * em vez de o sistema escolher por ele.
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Route as RouteIcon, ArrowRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { isDirexMember } from '@/lib/permissions'
import { ContratoCard, Vazio } from '@/components/features/epeas/epeas-shared'

export const Route = createFileRoute('/_app/epeas')({ component: EpeasPage })

type Aba = 'comercial' | 'gestao' | 'alocacao' | 'nucleo'

function EpeasPage() {
  const { person, cycle, occupations } = useApp()
  const qc = useQueryClient()

  const ehGestao = occupations.some((o) => o.directorate.slug === 'gestao')
  const ehProjetos = occupations.some(
    (o) => o.directorate.slug === 'projetos' && ['diretor', 'gerente', 'coordenador'].includes(o.role),
  )
  const ehNegocios = occupations.some((o) => o.directorate.slug === 'negocios')
  const ehDirex = isDirexMember(occupations)

  const q = useQuery({ queryKey: ['epeas', cycle.id], queryFn: E.getEpeasContratos })
  const todos = q.data ?? []

  // Quais abas fazem sentido para esta pessoa
  const abas: { id: Aba; label: string; n: number }[] = []
  const meus = todos.filter(
    (c) => c.contrato.responsavel_id === person.id || c.gestao_responsavel_id === person.id,
  )
  const filaGestao = todos.filter((c) => E.faseDaEtapa(c.etapa_macro) === 'gestao')
  const filaAlocacao = todos.filter((c) => c.etapa_macro === 'projetos_aguardando_alocacao')
  const doNucleo = todos.filter(
    (c) =>
      c.nucleo_id &&
      (c.gerente_nucleo_id === person.id ||
        c.scrum_master_id === person.id ||
        c.assessores_projeto_ids.includes(person.id) ||
        ehProjetos ||
        ehDirex),
  )

  if (ehNegocios || meus.length > 0) abas.push({ id: 'comercial', label: 'Meus contratos', n: meus.length })
  if (ehGestao || ehDirex) abas.push({ id: 'gestao', label: 'Fila de Gestão', n: filaGestao.length })
  if (ehProjetos || ehDirex) abas.push({ id: 'alocacao', label: 'Aguardando alocação', n: filaAlocacao.length })
  if (doNucleo.length > 0 || ehProjetos || ehDirex)
    abas.push({ id: 'nucleo', label: 'Contratos do núcleo', n: doNucleo.length })
  if (abas.length === 0) abas.push({ id: 'comercial', label: 'Meus contratos', n: meus.length })

  const [aba, setAba] = useState<Aba>(abas[0].id)
  const ativa = abas.find((a) => a.id === aba) ? aba : abas[0].id

  const mutAvancar = useMutation({
    mutationFn: ({ id, atual }: { id: string; atual: E.EtapaMacro }) => E.avancarEtapa(id, atual),
    onSuccess: () => {
      toast.success('Etapa avançada.')
      qc.invalidateQueries({ queryKey: ['epeas'] })
    },
  })

  function botaoAvancar(c: E.EpeasContrato) {
    const i = E.ETAPAS_MACRO.indexOf(c.etapa_macro)
    const proxima = E.ETAPAS_MACRO[i + 1]
    if (!proxima) return null
    // O grupo de WhatsApp é checklist obrigatório antes da execução (PRD §9.9)
    const travadoSemGrupo = proxima === 'projetos_em_execucao' && !c.link_grupo_whatsapp
    return (
      <Button
        size="sm"
        className="gap-1.5"
        disabled={mutAvancar.isPending || travadoSemGrupo}
        title={travadoSemGrupo ? 'Registre o link do grupo de WhatsApp antes de iniciar a execução' : undefined}
        onClick={() => mutAvancar.mutate({ id: c.contrato_id, atual: c.etapa_macro })}
      >
        {E.ETAPA_MACRO_LABELS[proxima]}
        <ArrowRight className="size-3.5" />
      </Button>
    )
  }

  const lista =
    ativa === 'comercial' ? meus : ativa === 'gestao' ? filaGestao : ativa === 'alocacao' ? filaAlocacao : doNucleo

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <RouteIcon className="size-4.5" />
            </span>
            EPEAS
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Ciclo de vida do contrato, do fechamento à entrega.
          </p>
        </div>
        {ehNegocios && <NovoContratoDialog />}
      </header>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {abas.map((a) => (
          <Button
            key={a.id}
            size="sm"
            variant={ativa === a.id ? 'default' : 'ghost'}
            onClick={() => setAba(a.id)}
            className="gap-2"
          >
            {a.label}
            {a.n > 0 && (
              <Badge variant={ativa === a.id ? 'secondary' : 'neutral'} className="px-1.5">
                {a.n}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {q.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : lista.length === 0 ? (
        <Vazio>
          {ativa === 'gestao'
            ? 'Nenhum contrato aguardando Gestão.'
            : ativa === 'alocacao'
              ? 'Nenhum contrato aguardando alocação em núcleo.'
              : ativa === 'nucleo'
                ? 'Nenhum contrato alocado ao seu núcleo.'
                : 'Você ainda não tem contratos no EPEAS.'}
        </Vazio>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((c) => (
            <ContratoCard key={c.id} c={c} acao={botaoAvancar(c)} />
          ))}
        </div>
      )}
    </div>
  )
}

/** PRD §7.3 — o Comercial abre o registro no fechamento. */
function NovoContratoDialog() {
  const { person, cycle } = useApp()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [cliente, setCliente] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState('')
  const [servicoId, setServicoId] = useState('')
  const [notion, setNotion] = useState('')

  const servicosQ = useQuery({ queryKey: ['project-services'], queryFn: C.getServicos, enabled: open })
  const pessoasQ = useQuery({
    queryKey: ['directory-all', cycle.id],
    queryFn: () => getDirectory(cycle.id, null),
    enabled: open,
  })
  const [responsavelId, setResponsavelId] = useState('')

  const mut = useMutation({
    mutationFn: async () => {
      // O contrato nasce em `contratos` — mesma fonte do faturamento — e o
      // EPEAS pendura o ciclo de vida nele.
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
      const novo = criados.find(
        (c) => c.cliente === cliente.trim() && c.data_fechamento === data,
      )
      if (!novo) throw new Error('Contrato criado, mas não foi possível abrir o ciclo de vida.')
      await E.iniciarCicloDeVida(novo.id)
      if (notion.trim()) {
        await E.atualizarEpeas(novo.id, {
          link_formulario_notion: notion.trim(),
          etapa_macro: 'comercial_formulario_enviado',
        })
      }
    },
    onSuccess: () => {
      toast.success('Contrato aberto no EPEAS.')
      setOpen(false)
      setCliente('')
      setValor('')
      setData('')
      setServicoId('')
      setNotion('')
      setResponsavelId('')
      qc.invalidateQueries({ queryKey: ['epeas'] })
      qc.invalidateQueries({ queryKey: ['contratos'] })
    },
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
            O contrato entra também no faturamento do ano — é o mesmo registro.
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
              <Input
                required
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
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
          <div className="flex flex-col gap-1.5">
            <Label>Link do formulário (Notion)</Label>
            <Input
              value={notion}
              onChange={(e) => setNotion(e.target.value)}
              placeholder="Opcional — se já enviou ao cliente"
            />
          </div>
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? 'Abrindo…' : 'Abrir contrato'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
