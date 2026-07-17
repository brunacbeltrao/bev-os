/**
 * Bev News (Onda 1) — feed de cultura e integração, distinto dos
 * Comunicados: qualquer membro publica, com reações, sem hierarquia.
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, Send, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-context'
import {
  createNewsPost,
  deleteNewsPost,
  getNewsFeed,
  toggleReaction,
  NEWS_TIPO_LABELS,
  type NewsTipo,
} from '@/lib/bev-news'
import { fmtDate } from '@/lib/use-context-scope'
import { cn, initials } from '@/lib/utils'

export const Route = createFileRoute('/_app/bev-news')({ component: BevNewsPage })

function BevNewsPage() {
  const { person, cycle } = useApp()
  const queryClient = useQueryClient()
  const [texto, setTexto] = useState('')
  const [tipo, setTipo] = useState<NewsTipo>('outro')
  const [imagemUrl, setImagemUrl] = useState('')

  const feedQ = useQuery({
    queryKey: ['news-feed', cycle.id],
    queryFn: () => getNewsFeed(cycle.id),
  })

  const postMut = useMutation({
    mutationFn: () => createNewsPost(person.id, tipo, texto, imagemUrl),
    onSuccess: () => {
      setTexto('')
      setImagemUrl('')
      setTipo('outro')
      queryClient.invalidateQueries({ queryKey: ['news-feed'] })
    },
  })

  const reactMut = useMutation({
    mutationFn: ({ postId, hasReacted }: { postId: string; hasReacted: boolean }) =>
      toggleReaction(postId, person.id, hasReacted),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['news-feed'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (postId: string) => deleteNewsPost(postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['news-feed'] }),
  })

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Bev News</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Cultura, integração e pertencimento — qualquer membro publica.
        </p>
      </header>

      <Card className="mb-5">
        <CardContent className="p-4">
          <form
            className="flex flex-col gap-2.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (texto.trim()) postMut.mutate()
            }}
          >
            <Textarea
              placeholder="Compartilhe uma conquista, vivência, aniversário…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as NewsTipo)}
                aria-label="Tipo de publicação"
              >
                {(Object.keys(NEWS_TIPO_LABELS) as NewsTipo[]).map((t) => (
                  <option key={t} value={t}>
                    {NEWS_TIPO_LABELS[t]}
                  </option>
                ))}
              </select>
              <Input
                className="h-8 max-w-56 text-xs"
                placeholder="URL de imagem (opcional)"
                value={imagemUrl}
                onChange={(e) => setImagemUrl(e.target.value)}
              />
              <Button type="submit" size="sm" className="ml-auto" disabled={postMut.isPending}>
                <Send className="size-4" />
                Publicar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {feedQ.isPending ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
        ) : (feedQ.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground p-8 text-center text-sm">
              O feed está vazio — seja a primeira pessoa a publicar!
            </CardContent>
          </Card>
        ) : (
          feedQ.data!.map((post) => {
            const reagiu = post.reactions.some((r) => r.person_id === person.id)
            return (
              <Card key={post.id}>
                <CardContent className="flex flex-col gap-2.5 p-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8">
                      {post.autor.foto_url && (
                        <AvatarImage src={post.autor.foto_url} alt={post.autor.nome} />
                      )}
                      <AvatarFallback className="text-xs">{initials(post.autor.nome)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{post.autor.nome}</p>
                      <p className="text-muted-foreground text-xs">{fmtDate(post.created_at, true)}</p>
                    </div>
                    <Badge variant="secondary" className="ml-auto shrink-0">
                      {NEWS_TIPO_LABELS[post.tipo]}
                    </Badge>
                    {post.autor_id === person.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground size-7 shrink-0"
                        onClick={() => {
                          if (confirm('Excluir esta publicação?')) deleteMut.mutate(post.id)
                        }}
                        aria-label="Excluir publicação"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.texto}</p>
                  {post.imagem_url && (
                    <img
                      src={post.imagem_url}
                      alt=""
                      className="max-h-80 rounded-md border object-cover"
                    />
                  )}
                  <button
                    onClick={() => reactMut.mutate({ postId: post.id, hasReacted: reagiu })}
                    className={cn(
                      'flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                      reagiu
                        ? 'bg-status-danger-bg text-status-danger border-transparent'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <Heart className={cn('size-3.5', reagiu && 'fill-current')} />
                    {post.reactions.length}
                  </button>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
