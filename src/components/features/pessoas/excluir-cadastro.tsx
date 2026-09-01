/**
 * Excluir cadastro de um membro — só Diretoria.
 *
 * Mostra o estrago antes de perguntar. As FKs de `people` apagam em
 * cascata BevCoins, advertências, agravos e PDI; e travam a operação se
 * a pessoa criou contratos, demandas ou eventos. Um botão "excluir" sem
 * essa prévia destruiria histórico disciplinar em silêncio.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { excluirCadastro, getResumoExclusao } from '@/lib/admin'

export function ExcluirCadastro({
  personId,
  nome,
  onExcluido,
}: {
  personId: string
  nome: string
  onExcluido?: () => void
}) {
  const qc = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const [confirmacao, setConfirmacao] = useState('')

  const q = useQuery({
    queryKey: ['resumo-exclusao', personId],
    queryFn: () => getResumoExclusao(personId),
    enabled: aberto,
  })

  const mut = useMutation({
    mutationFn: () => excluirCadastro(personId),
    onSuccess: (r) => {
      toast.success(`Cadastro de ${r.nome} excluído.`)
      setAberto(false)
      setConfirmacao('')
      qc.invalidateQueries({ queryKey: ['directory'] })
      qc.invalidateQueries({ queryKey: ['roster'] })
      onExcluido?.()
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : ''
      toast.error(
        msg.includes('TEM_HISTORICO')
          ? 'Esta pessoa tem registros usados por outras áreas. Remova do roster em vez de excluir.'
          : msg.includes('AUTOEXCLUSAO')
            ? 'Você não pode excluir o próprio cadastro.'
            : msg.includes('SEM_PERMISSAO')
              ? 'Apenas a Diretoria pode excluir cadastros.'
              : 'Não foi possível excluir o cadastro.',
      )
    },
  })

  const r = q.data
  const bloqueado = (r?.bloqueios?.length ?? 0) > 0
  const primeiroNome = nome.split(' ')[0]
  const confere = confirmacao.trim().toLowerCase() === primeiroNome.toLowerCase()

  const perdas = r
    ? [
        r.apaga_junto.bevcoins > 0 &&
          `${r.apaga_junto.bevcoins} lançamento(s) de BevCoins · saldo ${Number(
            r.apaga_junto.bevcoins_saldo,
          ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        r.apaga_junto.advertencias > 0 && `${r.apaga_junto.advertencias} advertência(s)`,
        r.apaga_junto.agravos > 0 && `${r.apaga_junto.agravos} agravo(s)`,
        r.apaga_junto.pdi > 0 && `${r.apaga_junto.pdi} plano(s) de PDI`,
        r.apaga_junto.ocupacoes > 0 && `${r.apaga_junto.ocupacoes} vínculo(s) de área`,
      ].filter(Boolean)
    : []

  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        setAberto(o)
        if (!o) setConfirmacao('')
      }}
    >
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Excluir cadastro de ${nome}`}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setAberto(true)}
      >
        <Trash2 className="size-4" />
      </Button>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Excluir cadastro de {nome}?</DialogTitle>
          <DialogDescription>
            A conta de acesso e o vínculo com o ciclo são removidos. O e-mail volta a ficar livre
            para um cadastro novo.
          </DialogDescription>
        </DialogHeader>

        {q.isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Conferindo o que está vinculado…
          </div>
        ) : bloqueado ? (
          <div className="border-status-warning/40 bg-status-warning-bg/30 flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <p className="text-status-warning flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4" />
              Não dá para excluir
            </p>
            <p>
              {primeiroNome} criou registros que outras áreas usam. Excluir apagaria o rastro de
              quem fez o quê:
            </p>
            <ul className="list-inside list-disc">
              {r!.bloqueios.map((b) => (
                <li key={b.o_que}>
                  {b.quantos} {b.o_que}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              Para tirá-la do ciclo, remova a pessoa do roster em Admin P&C — o histórico fica de pé.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {perdas.length > 0 ? (
              <div className="border-status-danger/40 bg-status-danger-bg/30 flex flex-col gap-2 rounded-lg border p-3 text-sm">
                <p className="text-status-danger flex items-center gap-2 font-semibold">
                  <AlertTriangle className="size-4" />
                  Isto será apagado junto, sem volta
                </p>
                <ul className="list-inside list-disc">
                  {perdas.map((p) => (
                    <li key={String(p)}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Não há BevCoins, advertências nem PDI vinculados a este cadastro.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmar-nome">
                Para confirmar, digite <span className="font-semibold">{primeiroNome}</span>
              </Label>
              <Input
                id="confirmar-nome"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          {!bloqueado && (
            <Button
              variant="destructive"
              disabled={!confere || mut.isPending || q.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? 'Excluindo…' : 'Excluir cadastro'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
