/**
 * Avisos (ex-Comunicados) — Padrão Lista + Detalhe (Blueprint §6).
 * Só a DIRETORIA publica; todos leem; histórico buscável.
 * Suporta link, imagens e arquivos anexados (Storage "avisos").
 * Abrir um aviso marca leitura.
 */
import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, LinkIcon, Megaphone, Paperclip, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-context'
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  markAsRead,
  updateAnnouncement,
  type Announcement,
} from '@/lib/comunicados'
import { fmtDate } from '@/lib/use-context-scope'
import { initials } from '@/lib/utils'

export const Route = createFileRoute('/_app/comunicados')({ component: AvisosPage })

function NovoAvisoDialog() {
  const { person, isDirex } = useApp()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [nFiles, setNFiles] = useState(0)
  const [erro, setErro] = useState<string | null>(null)

  const createMut = useMutation({
    mutationFn: () =>
      createAnnouncement({
        titulo,
        texto,
        autorId: person.id,
        linkUrl,
        files: Array.from(fileRef.current?.files ?? []),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      setOpen(false)
      setTitulo('')
      setTexto('')
      setLinkUrl('')
      setNFiles(0)
      setErro(null)
    },
    onError: () =>
      setErro('Não foi possível publicar. Apenas a Diretoria publica avisos; confira também os anexos.'),
  })

  if (!isDirex) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Novo aviso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo aviso</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (titulo.trim() && texto.trim()) createMut.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-titulo">Título</Label>
            <Input id="c-titulo" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-texto">Texto</Label>
            <Textarea
              id="c-texto"
              className="min-h-[110px]"
              required
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-link">Link (opcional)</Label>
            <Input
              id="c-link"
              type="url"
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-files">Imagens e arquivos (opcional)</Label>
            <input
              id="c-files"
              ref={fileRef}
              type="file"
              multiple
              className="text-sm"
              onChange={(e) => setNFiles(e.target.files?.length ?? 0)}
            />
            {nFiles > 0 && (
              <span className="text-muted-foreground text-xs">
                {nFiles} arquivo{nFiles > 1 ? 's' : ''} selecionado{nFiles > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {erro && <p className="text-destructive text-sm">{erro}</p>}
          <Button type="submit" disabled={createMut.isPending}>
            {createMut.isPending ? 'Publicando…' : 'Publicar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AvisoDetail({ announcement }: { announcement: Announcement }) {
  const { person, isDirex } = useApp()
  const queryClient = useQueryClient()
  const podeGerenciar = isDirex || announcement.autor_id === person.id
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    titulo: announcement.titulo,
    texto: announcement.texto,
    linkUrl: announcement.link_url ?? '',
  })

  // Abrir o aviso marca como lido
  useEffect(() => {
    if (!announcement.reads.some((r) => r.person_id === person.id)) {
      markAsRead(announcement.id, person.id).then(() =>
        queryClient.invalidateQueries({ queryKey: ['announcements'] }),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcement.id])

  const inv = () => queryClient.invalidateQueries({ queryKey: ['announcements'] })
  const updateMut = useMutation({
    mutationFn: () => updateAnnouncement(announcement.id, form),
    onSuccess: () => {
      setEditando(false)
      inv()
    },
  })
  const deleteMut = useMutation({ mutationFn: () => deleteAnnouncement(announcement.id), onSuccess: inv })

  const imagens = announcement.attachments.filter((a) => a.tipo === 'imagem')
  const arquivos = announcement.attachments.filter((a) => a.tipo !== 'imagem')

  if (editando) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Editar aviso</h2>
          <Button size="icon" variant="ghost" onClick={() => setEditando(false)}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Título</Label>
          <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Texto</Label>
          <Textarea
            className="min-h-[120px]"
            value={form.texto}
            onChange={(e) => setForm({ ...form, texto: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Link (opcional)</Label>
          <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://…" />
        </div>
        <Button
          className="self-start"
          disabled={updateMut.isPending || !form.titulo.trim() || !form.texto.trim()}
          onClick={() => updateMut.mutate()}
        >
          Salvar alterações
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar className="size-9">
          {announcement.autor.foto_url && (
            <AvatarImage src={announcement.autor.foto_url} alt={announcement.autor.nome} />
          )}
          <AvatarFallback>{initials(announcement.autor.nome)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{announcement.autor.nome}</p>
          <p className="text-muted-foreground text-xs">{fmtDate(announcement.created_at, true)}</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Badge variant="secondary">
            {announcement.reads.length} {announcement.reads.length === 1 ? 'leitura' : 'leituras'}
          </Badge>
          {podeGerenciar && (
            <>
              <Button size="icon" variant="ghost" onClick={() => setEditando(true)} aria-label="Editar">
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-red-600"
                aria-label="Excluir"
                onClick={() => confirm('Excluir este aviso?') && deleteMut.mutate()}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      <h2 className="text-lg font-semibold">{announcement.titulo}</h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{announcement.texto}</p>

      {announcement.link_url && (
        <a
          href={announcement.link_url}
          target="_blank"
          rel="noreferrer"
          className="text-primary flex w-fit items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <LinkIcon className="size-3.5" />
          {announcement.link_url}
        </a>
      )}

      {imagens.map((img) => (
        <img key={img.id} src={img.url} alt={img.nome} className="max-h-96 rounded-md border object-contain" />
      ))}

      {arquivos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {arquivos.map((f) => (
            <a
              key={f.id}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="hover:bg-accent flex items-center gap-2 rounded-md border p-2.5 text-sm transition-colors"
            >
              <FileText className="text-muted-foreground size-4" />
              <span className="flex-1 truncate">{f.nome}</span>
              <span className="text-primary text-xs font-medium">Baixar ↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function AvisosPage() {
  const { cycle, person } = useApp()
  const [busca, setBusca] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const announcementsQ = useQuery({
    queryKey: ['announcements', cycle.id, busca],
    queryFn: () => getAnnouncements(cycle.id, busca),
  })

  const list = announcementsQ.data ?? []
  const selected = list.find((a) => a.id === selectedId) ?? null

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Avisos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Mural institucional oficial — publicado pela Diretoria · Ciclo {cycle.nome}
          </p>
        </div>
        <NovoAvisoDialog />
      </header>

      <div className="relative mb-4 max-w-sm">
        <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Buscar no histórico…"
          className="pl-9"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-2 lg:col-span-2">
          {announcementsQ.isPending ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : list.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-center text-sm">
                {busca ? `Nada encontrado para “${busca}”.` : 'Nenhum aviso publicado ainda.'}
              </CardContent>
            </Card>
          ) : (
            list.map((a) => {
              const lido = a.reads.some((r) => r.person_id === person.id)
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`rounded-xl border p-3.5 text-left transition-colors ${
                    selectedId === a.id ? 'bg-accent border-ring' : 'bg-card hover:bg-accent/50'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Megaphone className="text-muted-foreground size-3.5" />
                    <span className="text-muted-foreground text-xs">
                      {fmtDate(a.created_at)} · {a.autor.nome}
                    </span>
                    {a.attachments.length > 0 && (
                      <Paperclip className="text-muted-foreground size-3" />
                    )}
                    {!lido && <Badge variant="info" className="ml-auto">Novo</Badge>}
                  </div>
                  <p className={`text-sm ${lido ? '' : 'font-semibold'}`}>{a.titulo}</p>
                </button>
              )
            })
          )}
        </div>
        <div className="lg:col-span-3">
          {selected ? (
            <Card>
              <CardContent className="p-5">
                <AvisoDetail key={selected.id} announcement={selected} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-muted-foreground p-10 text-center text-sm">
                Selecione um aviso para ler.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
