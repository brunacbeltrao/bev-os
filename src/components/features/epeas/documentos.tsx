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
import { Download, FileText, Trash2, Upload } from 'lucide-react'
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
  const [tipo, setTipo] = useState<E.DocumentoTipo>('contrato_assinado')

  const q = useQuery({
    queryKey: ['epeas-documentos', contratoId],
    queryFn: () => E.getDocumentos(contratoId),
  })

  const mutEnviar = useMutation({
    mutationFn: (arquivo: File) => E.enviarDocumento(contratoId, arquivo, tipo, person.id),
    onSuccess: () => {
      toast.success('Documento anexado.')
      qc.invalidateQueries({ queryKey: ['epeas-documentos', contratoId] })
    },
    onError: () => toast.error('Não foi possível anexar o documento.'),
  })

  const mutRemover = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) => E.removerDocumento(id, path),
    onSuccess: () => {
      toast.success('Documento removido.')
      qc.invalidateQueries({ queryKey: ['epeas-documentos', contratoId] })
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

  const docs = q.data ?? []
  const temContrato = docs.some((d) => d.tipo === 'contrato_assinado')

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
              <li key={d.id} className="flex items-center gap-3 py-2">
                <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.nome}</p>
                  <p className="text-muted-foreground text-xs">
                    {E.DOCUMENTO_LABELS[d.tipo]} · {d.enviado_por?.nome ?? 'alguém'} ·{' '}
                    {new Date(d.created_at).toLocaleDateString('pt-BR')}
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
        </div>
      </CardContent>
    </Card>
  )
}
