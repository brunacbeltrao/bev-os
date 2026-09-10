/**
 * A cláusula de prazo do contrato, como está escrita.
 *
 * Sem esta tela as colunas de prazo contratual seriam decoração — foi
 * exatamente o que aconteceu com `servico_etapas.prazo_dias`, que passou
 * semanas no banco sem ninguém conseguir preencher.
 *
 * O campo de redação literal não é enfeite: é a prova de onde o número
 * saiu. Quando alguém questionar um prazo daqui a três meses, a resposta
 * tem que estar na tela, não na memória de quem digitou.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import * as E from '@/lib/epeas'
import {
  EVENTO_LABELS,
  PRAZO_TIPO_LABELS,
  UNIDADE_LABELS,
  type EventoTipo,
  type PrazoTipo,
  type UnidadePrazo,
} from '@/lib/prazos'

const TIPOS = Object.keys(PRAZO_TIPO_LABELS) as PrazoTipo[]
const UNIDADES = Object.keys(UNIDADE_LABELS) as UnidadePrazo[]
const GATILHOS = Object.keys(EVENTO_LABELS) as EventoTipo[]

/** Só números, e vazio vira nulo em vez de zero. */
function paraInteiro(v: string): number | null {
  const n = Number(v)
  return v.trim() === '' || !Number.isFinite(n) || n <= 0 ? null : Math.trunc(n)
}

export function ClausulaPrazo({ contrato }: { contrato: E.EpeasContrato }) {
  const qc = useQueryClient()
  const [aberto, setAberto] = useState(false)

  const [tipo, setTipo] = useState<PrazoTipo>((contrato.prazo_tipo ?? 'apos_evento') as PrazoTipo)
  const [unidade, setUnidade] = useState<UnidadePrazo>(
    (contrato.prazo_unidade ?? 'dias_uteis') as UnidadePrazo,
  )
  const [quantidade, setQuantidade] = useState(String(contrato.prazo_quantidade ?? ''))
  const [minimo, setMinimo] = useState(String(contrato.prazo_quantidade_min ?? ''))
  const [gatilho, setGatilho] = useState<string>(contrato.prazo_evento_gatilho ?? '')
  const [dataFixa, setDataFixa] = useState(contrato.prazo_entrega ?? '')
  const [condicao, setCondicao] = useState(contrato.prazo_condicao ?? '')
  const [clausula, setClausula] = useState(contrato.prazo_clausula ?? '')

  const mut = useMutation({
    mutationFn: () => {
      const qtd = paraInteiro(quantidade)
      const min = paraInteiro(minimo)
      return E.atualizarEpeas(contrato.contrato_id, {
        prazo_tipo: tipo,
        prazo_clausula: clausula.trim() || null,
        // Cada tipo zera o que não é dele: prazo antigo sobrando em coluna
        // que o motor não lê é a receita para a tela mentir depois.
        prazo_quantidade: tipo === 'apos_evento' ? qtd : null,
        prazo_unidade: tipo === 'apos_evento' ? unidade : 'dias_uteis',
        prazo_quantidade_min: tipo === 'apos_evento' && min !== qtd ? min : null,
        prazo_evento_gatilho: tipo === 'apos_evento' ? gatilho || null : null,
        prazo_entrega: tipo === 'data_fixa' ? dataFixa || null : null,
        prazo_condicao: tipo === 'condicionado' ? condicao.trim() || null : null,
      })
    },
    onSuccess: () => {
      toast.success('Cláusula de prazo registrada.')
      setAberto(false)
      qc.invalidateQueries({ queryKey: ['epeas-contrato', contrato.contrato_id] })
      qc.invalidateQueries({ queryKey: ['epeas'] })
    },
    onError: () => toast.error('Não foi possível salvar. Confira se o piso da faixa é menor que o teto.'),
  })

  const invalido =
    (tipo === 'apos_evento' && paraInteiro(quantidade) === null) ||
    (tipo === 'data_fixa' && !dataFixa)

  if (!aberto) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <div className="min-w-0 text-xs">
          <p className="font-medium">Cláusula de prazo</p>
          <p className="text-muted-foreground">
            {contrato.prazo_clausula ? `"${contrato.prazo_clausula}"` : 'Não registrada.'}
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAberto(true)}>
          <FileText className="size-3.5" />
          {contrato.prazo_clausula || contrato.prazo_quantidade ? 'Editar' : 'Registrar'}
        </Button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-3 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!invalido) mut.mutate()
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tipo-prazo">Como o prazo é definido</Label>
        <select
          id="tipo-prazo"
          className="border-input bg-card h-9 rounded-md border px-3 text-sm shadow-xs"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as PrazoTipo)}
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {PRAZO_TIPO_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {tipo === 'apos_evento' && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-24">
              <Label htmlFor="qtd-prazo">Prazo</Label>
              <Input
                id="qtd-prazo"
                inputMode="numeric"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="40"
              />
            </div>
            <div className="min-w-40 flex-1">
              <Label htmlFor="unidade-prazo">Unidade</Label>
              <select
                id="unidade-prazo"
                className="border-input bg-card h-9 w-full rounded-md border px-3 text-sm shadow-xs"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value as UnidadePrazo)}
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {UNIDADE_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <Label htmlFor="min-prazo">Piso da faixa</Label>
              <Input
                id="min-prazo"
                inputMode="numeric"
                value={minimo}
                onChange={(e) => setMinimo(e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Em cláusula com faixa ("60 a 90 dias"), o piso vai no último campo e o teto no
            primeiro. O prazo é cobrado pelo teto — é ele que gera responsabilidade.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gatilho-prazo">Conta a partir de</Label>
            <select
              id="gatilho-prazo"
              className="border-input bg-card h-9 rounded-md border px-3 text-sm shadow-xs"
              value={gatilho}
              onChange={(e) => setGatilho(e.target.value)}
            >
              <option value="">Assinatura (marco zero do contrato)</option>
              {GATILHOS.map((g) => (
                <option key={g} value={g}>
                  {EVENTO_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {tipo === 'data_fixa' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="data-clausula">Data da cláusula</Label>
          <input
            id="data-clausula"
            type="date"
            className="border-input bg-card h-9 w-fit rounded-md border px-3 text-sm shadow-xs"
            value={dataFixa}
            onChange={(e) => setDataFixa(e.target.value)}
          />
        </div>
      )}

      {tipo === 'condicionado' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="condicao-prazo">O que se está esperando</Label>
          <Input
            id="condicao-prazo"
            value={condicao}
            onChange={(e) => setCondicao(e.target.value)}
            placeholder="Ex.: decisão de mérito do INPI"
          />
          <p className="text-muted-foreground text-xs">
            Prazo condicionado nunca aparece como atrasado: o gatilho é de fora, e cobrar quem
            não pode agir não ajuda ninguém.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="texto-clausula">Redação da cláusula</Label>
        <Textarea
          id="texto-clausula"
          rows={2}
          value={clausula}
          onChange={(e) => setClausula(e.target.value)}
          placeholder="Copie do contrato assinado. Ex.: 60 a 90 dias úteis contados do protocolo no INPI."
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={invalido || mut.isPending}>
          {mut.isPending ? 'Salvando…' : 'Salvar cláusula'}
        </Button>
      </div>
    </form>
  )
}
