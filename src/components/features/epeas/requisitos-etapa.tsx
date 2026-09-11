/**
 * O que falta para o contrato poder sair desta etapa.
 *
 * Diferente do checklist, que é declaração humana ("marquei que conferi"),
 * requisito é verificado contra o dado: ou o documento está anexado e o
 * campo preenchido, ou não está. Marcar caixinha é promessa; isto é fato.
 *
 * Cada pendência é acionável no lugar — campo vira input, documento vira
 * botão de anexar. Listar o que falta sem oferecer como resolver é o tipo de
 * tela que faz a pessoa abrir outra aba e esquecer.
 */
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, Paperclip, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useApp } from '@/lib/app-context'
import * as E from '@/lib/epeas'
import { isDirexMember } from '@/lib/permissions'

export function RequisitosEtapa({
  contrato,
  pendencias,
  carregando,
}: {
  contrato: E.EpeasContrato
  pendencias: E.Pendencia[]
  carregando: boolean
}) {
  const { person, occupations } = useApp()
  const qc = useQueryClient()

  // Dispensar é poder pular uma exigência. Fica com quem responde pelo
  // resultado: gerente do núcleo deste contrato, liderança de Projetos, Direx.
  const podeDispensar =
    isDirexMember(occupations) ||
    contrato.gerente_nucleo_id === person.id ||
    occupations.some(
      (o) => o.directorate.slug === 'projetos' && ['diretor', 'gerente'].includes(o.role),
    )

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['epeas-contrato', contrato.contrato_id] })
    qc.invalidateQueries({ queryKey: ['epeas-documentos', contrato.contrato_id] })
    qc.invalidateQueries({ queryKey: ['epeas-dispensas', contrato.contrato_id] })
    qc.invalidateQueries({ queryKey: ['epeas'] })
  }

  if (carregando) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requisitos da etapa</CardTitle>
          <CardDescription>Conferindo…</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (pendencias.length === 0) {
    return (
      <Card className="border-status-success/40">
        <CardContent className="flex items-center gap-2 p-4 text-sm">
          <Check className="text-status-success size-4 shrink-0" aria-hidden="true" />
          <span>Requisitos desta etapa cumpridos.</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-status-warning/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="text-status-warning size-4" aria-hidden="true" />
          Falta {pendencias.length} para avançar
        </CardTitle>
        <CardDescription>
          O avanço fica travado até isto existir no sistema — não basta marcar como feito.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {pendencias.map((p) => (
          <ItemPendente
            key={p.requisito.id}
            contrato={contrato}
            pendencia={p}
            podeDispensar={podeDispensar}
            aoResolver={invalidar}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function ItemPendente({
  contrato,
  pendencia,
  podeDispensar,
  aoResolver,
}: {
  contrato: E.EpeasContrato
  pendencia: E.Pendencia
  podeDispensar: boolean
  aoResolver: () => void
}) {
  const { person } = useApp()
  const { requisito } = pendencia
  const fileRef = useRef<HTMLInputElement>(null)
  const [valor, setValor] = useState('')
  const [dispensando, setDispensando] = useState(false)
  const [justificativa, setJustificativa] = useState('')

  const mutCampo = useMutation({
    mutationFn: () =>
      E.atualizarEpeas(contrato.contrato_id, {
        [requisito.campo!]: valor.trim(),
      } as E.EpeasPatch),
    onSuccess: () => {
      toast.success(`${requisito.label} preenchido.`)
      aoResolver()
    },
    onError: () => toast.error('Não foi possível salvar. Você tem permissão nesta fase?'),
  })

  const mutDoc = useMutation({
    mutationFn: (arquivo: File) =>
      E.enviarDocumento(contrato.contrato_id, arquivo, requisito.documento_tipo!, person.id, {
        etapaMacro: contrato.etapa_macro,
      }),
    onSuccess: () => {
      toast.success(`${requisito.label} anexado.`)
      aoResolver()
    },
    onError: () => toast.error('Não foi possível anexar.'),
  })

  const mutDispensa = useMutation({
    mutationFn: () =>
      E.dispensarRequisito(contrato.contrato_id, requisito.id, justificativa, person.id),
    onSuccess: () => {
      toast.success('Requisito dispensado. A justificativa ficou no histórico.')
      setDispensando(false)
      setJustificativa('')
      aoResolver()
    },
    onError: () =>
      toast.error('Não foi possível dispensar. A justificativa precisa ter ao menos 10 caracteres.'),
  })

  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{requisito.label}</p>
          {requisito.ajuda && (
            <p className="text-muted-foreground text-xs">{requisito.ajuda}</p>
          )}
        </div>
        {podeDispensar && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground gap-1.5"
            onClick={() => setDispensando(true)}
          >
            <ShieldOff className="size-3.5" /> Dispensar
          </Button>
        )}
      </div>

      {requisito.tipo === 'campo' ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (valor.trim()) mutCampo.mutate()
          }}
        >
          <Input
            className="min-w-48 flex-1"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={requisito.ajuda ?? requisito.label}
            aria-label={requisito.label}
          />
          <Button type="submit" size="sm" disabled={!valor.trim() || mutCampo.isPending}>
            Salvar
          </Button>
        </form>
      ) : (
        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            aria-label={`Anexar ${requisito.label}`}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) mutDoc.mutate(f)
              e.target.value = ''
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={mutDoc.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-3.5" />
            {mutDoc.isPending ? 'Enviando…' : 'Anexar agora'}
          </Button>
        </div>
      )}

      <Dialog open={dispensando} onOpenChange={setDispensando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispensar "{requisito.label}"</DialogTitle>
            <DialogDescription>
              O contrato vai poder avançar sem isto. A justificativa entra no histórico com o seu
              nome, e é o que vai explicar a decisão para quem ler daqui a seis meses.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`just-${requisito.id}`}>Por quê</Label>
            <Textarea
              id={`just-${requisito.id}`}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: cliente assinou em papel, fora do Autentique; original arquivado na sala."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDispensando(false)}>
              Cancelar
            </Button>
            <Button
              disabled={justificativa.trim().length < 10 || mutDispensa.isPending}
              onClick={() => mutDispensa.mutate()}
            >
              Dispensar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
