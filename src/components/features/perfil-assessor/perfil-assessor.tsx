/**
 * Perfil do Assessor — 1 Header Fixo + 3 Abas (PRD §3).
 * Usado em três lugares: /assessor/$personId (liderança), a visão
 * pessoal em /perfil e a leitura da Direx em Meus Liderados.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/lib/app-context'
import { getPdiByPerson, updatePlan, createPdi } from '@/lib/pdi'
import { firstName } from '@/lib/utils'
import {
  getCiclosNoBev,
  getElegibilidade,
  getPerfilPessoa,
} from '@/lib/perfil-assessor'
import { AssessorHeader } from './assessor-header'
import { AbaEntregas } from './aba-entregas'
import { AbaLideranca } from './aba-lideranca'
import { AbaEncerramento } from './aba-encerramento'

export type AbaPerfil = 'entregas' | 'lideranca' | 'encerramento'

export const ABAS: Array<{ value: AbaPerfil; label: string }> = [
  { value: 'entregas', label: 'Entregas e Competências' },
  { value: 'lideranca', label: 'Diário de Liderança' },
  { value: 'encerramento', label: 'Encerramento de Ciclo' },
]

export function PerfilAssessor({
  personId,
  aba,
  onAbaChange,
}: {
  personId: string
  aba: AbaPerfil
  onAbaChange: (a: AbaPerfil) => void
}) {
  const { person, cycle, occupations, souPC } = useApp()
  const qc = useQueryClient()
  const [editandoPdi, setEditandoPdi] = useState(false)

  const pessoaQ = useQuery({
    queryKey: ['perfil-pessoa', personId, cycle.id],
    queryFn: () => getPerfilPessoa(personId, cycle.id),
  })
  const ciclosQ = useQuery({
    queryKey: ['perfil-ciclos', personId],
    queryFn: () => getCiclosNoBev(personId),
  })
  const planQ = useQuery({
    queryKey: ['pdi-person', personId, cycle.id],
    queryFn: () => getPdiByPerson(personId, cycle.id),
  })
  const elegQ = useQuery({
    queryKey: ['perfil-elegibilidade', personId, cycle.id],
    queryFn: () => getElegibilidade(personId, cycle.id),
  })

  const pessoa = pessoaQ.data
  const ehOProprio = person.id === personId

  /** Lidero essa pessoa? (gerente/coord da subárea, diretor da diretoria, ou P&C) */
  const podeEditar = useMemo(() => {
    if (souPC) return true
    if (!pessoa || ehOProprio) return false
    return pessoa.occupations.some((alvo) =>
      occupations.some(
        (minha) =>
          (['gerente', 'coordenador'].includes(minha.role) &&
            minha.subarea.id === alvo.subarea.id) ||
          (minha.role === 'diretor' && minha.directorate.id === alvo.directorate.id),
      ),
    )
  }, [pessoa, occupations, souPC, ehOProprio])

  const subareaId =
    pessoa?.occupations.find((o) => !o.is_hibrido)?.subarea.id ??
    pessoa?.occupations[0]?.subarea.id ??
    null

  const salvarPdiMut = useMutation({
    mutationFn: async (patch: { foco_area: string | null; busca_estagio: boolean }) => {
      let planId = planQ.data?.id
      if (!planId) planId = await createPdi(personId, person.id)
      await updatePlan(planId, patch)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pdi-person', personId, cycle.id] })
      setEditandoPdi(false)
    },
  })

  if (pessoaQ.isPending || !pessoa) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const foco = planQ.data?.foco_area ?? null
  const buscaEstagio = planQ.data?.busca_estagio ?? false

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <AssessorHeader
          pessoa={pessoa}
          ciclos={ciclosQ.data ?? 1}
          focoArea={foco}
          buscaEstagio={buscaEstagio}
          elegibilidade={elegQ.data}
          cicloNome={cycle.nome}
        />
        {podeEditar && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground absolute bottom-3 right-3 h-7 text-xs"
            onClick={() => setEditandoPdi(true)}
          >
            <Pencil className="size-3.5" />
            Editar foco de PDI
          </Button>
        )}
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <Segmented value={aba} onChange={onAbaChange} options={ABAS} />
      </div>

      {aba === 'entregas' && (
        <AbaEntregas
          personId={personId}
          cycleId={cycle.id}
          cicloNome={cycle.nome}
          subareaId={subareaId}
          authorId={person.id}
          podeEditar={podeEditar}
          ehOProprio={ehOProprio}
        />
      )}
      {aba === 'lideranca' && (
        <AbaLideranca
          personId={personId}
          cycleId={cycle.id}
          authorId={person.id}
          podeEditar={podeEditar}
          primeiroNome={firstName(pessoa.nome)}
        />
      )}
      {aba === 'encerramento' && (
        <AbaEncerramento
          personId={personId}
          cycleId={cycle.id}
          cicloNome={cycle.nome}
          podeEditar={podeEditar}
          ehPC={souPC}
          elegibilidade={elegQ.data}
        />
      )}

      <EditarFocoDialog
        aberto={editandoPdi}
        onFechar={() => setEditandoPdi(false)}
        focoInicial={foco ?? ''}
        buscaInicial={buscaEstagio}
        salvando={salvarPdiMut.isPending}
        onSalvar={(foco_area, busca_estagio) =>
          salvarPdiMut.mutate({ foco_area: foco_area || null, busca_estagio })
        }
      />
    </div>
  )
}

function EditarFocoDialog({
  aberto,
  onFechar,
  focoInicial,
  buscaInicial,
  salvando,
  onSalvar,
}: {
  aberto: boolean
  onFechar: () => void
  focoInicial: string
  buscaInicial: boolean
  salvando: boolean
  onSalvar: (foco: string, busca: boolean) => void
}) {
  const [foco, setFoco] = useState(focoInicial)
  const [busca, setBusca] = useState(buscaInicial)

  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        if (o) {
          setFoco(focoInicial)
          setBusca(buscaInicial)
        } else onFechar()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Foco de desenvolvimento</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSalvar(foco.trim(), busca)
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="foco-area">Área jurídica de interesse</Label>
            <Input
              id="foco-area"
              value={foco}
              onChange={(e) => setFoco(e.target.value)}
              placeholder="Ex.: Direito Societário, Trabalhista"
            />
            <p className="text-muted-foreground text-xs">
              Aparece no header e vai junto para o Banco de Talentos.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={busca}
              onChange={(e) => setBusca(e.target.checked)}
              className="accent-primary size-4"
            />
            Está buscando estágio neste ciclo
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
