/**
 * Conversa do contrato — o que substitui o grupo de Telegram.
 *
 * Diferença que importa: aqui a conversa fica presa ao contrato, não a um
 * grupo que some no scroll. Quem chega depois lê tudo, e a @menção coloca
 * o contrato na caixa de pendências de quem foi citado.
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Paperclip, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-context'
import * as E from '@/lib/epeas'
import { initials } from '@/lib/utils'

interface Pessoa {
  id: string
  nome: string
}

export function Conversa({ contratoId, pessoas }: { contratoId: string; pessoas: Pessoa[] }) {
  const { person } = useApp()
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [sugestoes, setSugestoes] = useState<Pessoa[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fim = useRef<HTMLDivElement>(null)

  /**
   * Abre o anexo por URL assinada (bucket privado).
   *
   * A aba é aberta ANTES do await: navegador só trata window.open como
   * intenção do usuário dentro do clique, e depois do await o popup
   * seria bloqueado.
   */
  async function abrirAnexo(path: string) {
    const aba = window.open('', '_blank', 'noopener,noreferrer')
    try {
      const url = await E.urlAnexo(path)
      if (aba) aba.location.href = url
      else window.location.href = url
    } catch {
      aba?.close()
      toast.error('Não foi possível abrir o anexo.')
    }
  }

  const q = useQuery({
    queryKey: ['epeas-conversa', contratoId],
    queryFn: () => E.getComentarios(contratoId),
    // conversa é o que mais muda; sem isso a pessoa fica olhando texto velho
    refetchInterval: 20_000,
  })

  // marca como lido sempre que a conversa é vista
  useEffect(() => {
    if (!q.data) return
    E.marcarLido(contratoId, person.id).then(() =>
      qc.invalidateQueries({ queryKey: ['epeas-resumo'] }),
    )
    fim.current?.scrollIntoView({ block: 'nearest' })
  }, [q.data, contratoId, person.id, qc])

  const mut = useMutation({
    mutationFn: async () => {
      const corpo = texto.trim()
      if (!corpo && !arquivo) throw new Error('Escreva algo ou anexe um arquivo.')
      const anexo = arquivo ? await E.enviarAnexo(contratoId, arquivo) : undefined
      await E.comentar(
        contratoId,
        person.id,
        corpo || (anexo ? `Enviou ${anexo.nome}` : ''),
        E.extrairMencoes(corpo, pessoas),
        anexo,
      )
    },
    onSuccess: () => {
      setTexto('')
      setArquivo(null)
      if (fileRef.current) fileRef.current.value = ''
      qc.invalidateQueries({ queryKey: ['epeas-conversa', contratoId] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Não foi possível enviar.'),
  })

  /** Sugere pessoas enquanto a pessoa digita @. */
  function aoDigitar(v: string) {
    setTexto(v)
    const m = /@([\p{L}]*)$/u.exec(v)
    if (!m) return setSugestoes([])
    const termo = m[1].toLowerCase()
    setSugestoes(
      pessoas
        .filter((p) => p.nome.toLowerCase().includes(termo))
        .slice(0, 5),
    )
  }

  function aplicarMencao(p: Pessoa) {
    setTexto((t) => t.replace(/@([\p{L}]*)$/u, `@${p.nome.split(' ')[0]} `))
    setSugestoes([])
    inputRef.current?.focus()
  }

  const comentarios = q.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conversa</CardTitle>
        <CardDescription>
          Tudo sobre este contrato num lugar só. Use @ para chamar alguém — o contrato aparece na
          caixa de pendências dessa pessoa.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {q.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : comentarios.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Nenhuma mensagem ainda. Comece por aqui em vez do grupo.
          </p>
        ) : (
          <ol className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
            {comentarios.map((c) => {
              const meu = c.autor?.id === person.id
              const meCitou = c.mencoes.includes(person.id)
              return (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar className="size-7 shrink-0">
                    <AvatarImage src={c.autor?.foto_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {initials(c.autor?.nome ?? '??')}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`min-w-0 flex-1 rounded-lg border p-2.5 ${
                      meCitou ? 'border-primary/40 bg-primary/5' : meu ? 'bg-muted/40' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{c.autor?.nome ?? 'Alguém'}</span>
                      <span className="text-muted-foreground text-xs">
                        {new Date(c.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">{c.corpo}</p>
                    {c.anexo_path && (
                      <button
                        type="button"
                        onClick={() => abrirAnexo(c.anexo_path!)}
                        className="text-primary mt-1.5 inline-flex items-center gap-1 text-xs hover:underline"
                      >
                        <Paperclip className="size-3" aria-hidden="true" />
                        {c.anexo_nome ?? 'anexo'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
            <div ref={fim} />
          </ol>
        )}

        <form
          className="relative flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            mut.mutate()
          }}
        >
          {sugestoes.length > 0 && (
            <div className="bg-popover absolute bottom-full z-10 mb-1 w-64 rounded-md border p-1 shadow-md">
              {sugestoes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="hover:bg-accent w-full rounded px-2 py-1.5 text-left text-sm"
                  onClick={() => aplicarMencao(p)}
                >
                  {p.nome}
                </button>
              ))}
            </div>
          )}

          <Textarea
            ref={inputRef}
            rows={2}
            value={texto}
            onChange={(e) => aoDigitar(e.target.value)}
            placeholder="Escreva uma mensagem… use @ para chamar alguém"
            onKeyDown={(e) => {
              // Enter envia, Shift+Enter quebra linha — como num chat
              if (e.key === 'Enter' && !e.shiftKey && !sugestoes.length) {
                e.preventDefault()
                mut.mutate()
              }
            }}
          />

          {arquivo && (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Paperclip className="size-3" />
              {arquivo.name}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-5"
                aria-label="Remover anexo"
                onClick={() => {
                  setArquivo(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                <X className="size-3" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="size-3.5" />
              Anexar
            </Button>
            <Button type="submit" size="sm" className="gap-1.5" disabled={mut.isPending}>
              <Send className="size-3.5" />
              Enviar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
