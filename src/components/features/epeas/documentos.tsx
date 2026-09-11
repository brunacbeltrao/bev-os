/**
 * Documentos do contrato.
 *
 * O contrato assinado vivia como link do Autentique — que expira, muda de
 * dono e some quando a conta de quem enviou sai. Aqui o PDF fica no bucket
 * privado do BEV OS, com tipo, autor e data, e a checagem "o contrato
 * assinado está aqui?" passa a ter resposta.
 */
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileText, RefreshCw, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/lib/app-context'
import * as E from '@/lib/epeas'
import { Vazio } from '@/components/features/epeas/epeas-shared'

export function Documentos({ contratoId }: { contratoId: string }) {
  const { person } = useApp()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const substituirRef = useRef<HTMLInputElement>(null)
  const [tipo, setTipo] = useState<E.DocumentoTipo>('contrato_assinado')
  const [mostrarAntigas, setMostrarAntigas] = useState(false)
  /** Qual documento a próxima escolha de arquivo vai substituir. */
  const [substituindo, setSubstituindo] = useState<E.Documento | null>(null)

  const q = useQuery({
    queryKey: ['epeas-documentos', contratoId],
    queryFn: () => E.getDocumentos(contratoId),
  })

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['epeas-documentos', contratoId] })
    qc.invalidateQueries({ queryKey: ['epeas-carteira-docs'] })
    qc.invalidateQueries({ queryKey: ['epeas-historico', contratoId] })
  }

  const mutEnviar = useMutation({
    mutationFn: (arquivo: File) => E.enviarDocumento(contratoId, arquivo, tipo, person.id),
    onSuccess: () => {
      toast.success('Documento anexado.')
      invalidar()
    },
    onError: () => toast.error('Não foi possível anexar o documento.'),
  })

  /**
   * Substituir NÃO apaga: a versão antiga aponta para a nova e continua
   * acessível. Quem precisar saber o que foi enviado ao cliente em março
   * ainda chega lá.
   */
  const mutSubstituir = useMutation({
    mutationFn: (arquivo: File) =>
      E.enviarDocumento(contratoId, arquivo, substituindo!.tipo, person.id, {
        substitui: substituindo!,
        etapaMacro: substituindo!.etapa_macro,
      }),
    onSuccess: () => {
      toast.success(`Nova versão anexada. A v${substituindo!.versao} continua no histórico.`)
      setSubstituindo(null)
      invalidar()
    },
    onError: () => {
      setSubstituindo(null)
      toast.error('Não foi possível substituir o documento.')
    },
  })

  const mutRemover = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) => E.removerDocumento(id, path),
    onSuccess: () => {
      toast.success('Documento removido.')
      invalidar()
    },
    onError: () => toast.error('Não foi possível remover o documento.'),
  })

  /** Abre a aba antes do await: depois dele o navegador trata como popup. */
  async function abrir(path: string) {
    const aba = window.open('', '_blank', 'noopener,noreferrer')
    try {
      const url = await E.urlDocumento(path)
      if (aba) aba.location.href = url
      else window.location.href = url
    } catch {
      aba?.close()
      toast.error('Não foi possível abrir o documento.')
    }
  }

  const todos = q.data ?? []
  const docs = mostrarAntigas ? todos : E.vigentes(todos)
  const antigas = todos.length - E.vigentes(todos).length
  const temContrato = E.vigentes(todos).some((d) => d.tipo === 'contrato_assinado')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documentos</CardTitle>
        <CardDescription>
          {temContrato
            ? 'Contrato assinado anexado.'
            : 'O contrato assinado ainda não foi anexado aqui.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {q.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : docs.length === 0 ? (
          <Vazio>Nenhum documento anexado.</Vazio>
        ) : (
          <ul className="flex flex-col divide-y">
            {docs.map((d) => (
              <li
                key={d.id}
                className={`flex items-center gap-3 py-2 ${d.substituido_por ? 'opacity-60' : ''}`}
              >
                <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {d.nome}
                    {d.versao > 1 && (
                      <span className="text-muted-foreground font-normal"> · v{d.versao}</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {E.DOCUMENTO_LABELS[d.tipo]} · {d.enviado_por?.nome ?? 'alguém'} ·{' '}
                    {new Date(d.created_at).toLocaleDateString('pt-BR')}
                    {d.etapa_macro && ` · ${E.ETAPA_MACRO_LABELS[d.etapa_macro]}`}
                    {d.substituido_por && ' · substituído'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 gap-1.5"
                  onClick={() => abrir(d.path)}
                >
                  <Download className="size-3.5" /> Abrir
                </Button>
                {!d.substituido_por && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 gap-1.5"
                    aria-label={`Substituir ${d.nome}`}
                    disabled={mutSubstituir.isPending}
                    onClick={() => {
                      setSubstituindo(d)
                      substituirRef.current?.click()
                    }}
                  >
                    <RefreshCw className="size-3.5" /> Substituir
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remover ${d.nome}`}
                  disabled={mutRemover.isPending}
                  onClick={() => mutRemover.mutate({ id: d.id, path: d.path })}
                >
                  <Trash2 className="text-muted-foreground size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <select
            className="border-input bg-card h-9 rounded-md border px-3 text-sm shadow-xs"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as E.DocumentoTipo)}
            aria-label="Tipo do documento"
          >
            {E.DOCUMENTO_TIPOS.map((t) => (
              <option key={t} value={t}>
                {E.DOCUMENTO_LABELS[t]}
              </option>
            ))}
          </select>

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) mutEnviar.mutate(f)
              e.target.value = ''
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={mutEnviar.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-3.5" />
            {mutEnviar.isPending ? 'Enviando…' : 'Anexar'}
          </Button>
          <span className="text-muted-foreground text-xs">PDF ou imagem, até 10 MB.</span>

          {/* Input separado do de anexar: o de substituir carrega o documento
              que está sendo trocado, e misturar os dois trocaria o errado. */}
          <input
            ref={substituirRef}
            type="file"
            className="hidden"
            accept=".pdf,image/png,image/jpeg,image/webp"
            aria-label="Arquivo da nova versão"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f && substituindo) mutSubstituir.mutate(f)
              else setSubstituindo(null)
              e.target.value = ''
            }}
          />
        </div>

        {antigas > 0 && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground self-start text-xs underline"
            onClick={() => setMostrarAntigas((v) => !v)}
          >
            {mostrarAntigas
              ? 'Esconder versões antigas'
              : `Mostrar ${antigas} versão(ões) antiga(s)`}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
