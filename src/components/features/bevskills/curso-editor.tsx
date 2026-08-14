/**
 * CMS do BevSkills (PRD §4.2). Formulário enxuto, árvore de módulos e
 * aulas reordenável, embed por URL (nunca upload de vídeo) e recursos
 * complementares por aula.
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Video,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useApp } from '@/lib/app-context'
import {
  atualizarAula,
  atualizarCurso,
  atualizarModulo,
  criarAula,
  criarModulo,
  criarRecurso,
  detectarFonte,
  FONTE_LABEL,
  getCurso,
  RECURSO_LABEL,
  removerAula,
  removerCurso,
  removerModulo,
  removerRecurso,
  reordenar,
  STATUS_LABEL,
  subirCapa,
  subirMaterial,
  uploadErro,
  urlDeEmbed,
  type BevLesson,
  type CourseStatus,
  type ResourceTipo,
  type VideoFonte,
} from '@/lib/bevskills'
import { ListaOrdenavel } from './lista-ordenavel'

const CAMPO =
  'border-input bg-card focus-visible:ring-ring/60 h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2'

const STATUS: CourseStatus[] = ['rascunho', 'em_breve', 'publicado']
const FONTES: VideoFonte[] = ['youtube', 'drive', 'vimeo', 'loom']
const TIPOS: ResourceTipo[] = ['arquivo', 'canva', 'miro', 'notion', 'drive', 'link']

export function CursoEditor({ courseId, onVoltar }: { courseId: string; onVoltar: () => void }) {
  const confirmar = useConfirm()
  const qc = useQueryClient()
  const { person } = useApp()
  const [aulaAberta, setAulaAberta] = useState<BevLesson | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const capaRef = useRef<HTMLInputElement>(null)

  const cursoQ = useQuery({ queryKey: ['bev-curso', courseId], queryFn: () => getCurso(courseId) })
  const curso = cursoQ.data

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [instrutor, setInstrutor] = useState('')
  const [status, setStatus] = useState<CourseStatus>('rascunho')
  const [capa, setCapa] = useState<string | null>(null)

  useEffect(() => {
    if (!curso) return
    setTitulo(curso.titulo)
    setDescricao(curso.descricao ?? '')
    setInstrutor(curso.instrutor ?? '')
    setStatus(curso.status)
    setCapa(curso.capa_url)
  }, [curso?.id])

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['bev-curso', courseId] })
    qc.invalidateQueries({ queryKey: ['bevskills-catalogo'] })
  }

  const salvarMut = useMutation({
    mutationFn: () =>
      atualizarCurso(courseId, {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        instrutor: instrutor.trim() || null,
        status,
        capa_url: capa,
      }),
    onSuccess: invalidar,
  })

  const capaMut = useMutation({
    mutationFn: (file: File) => subirCapa(courseId, file),
    onSuccess: async (url) => {
      setCapa(url)
      setErro(null)
      await atualizarCurso(courseId, { capa_url: url })
      invalidar()
    },
    onError: (e) => setErro(uploadErro(e)),
  })

  const excluirMut = useMutation({
    mutationFn: () => removerCurso(courseId),
    onSuccess: () => {
      invalidar()
      onVoltar()
    },
  })

  const moduloMut = useMutation({
    mutationFn: (titulo: string) => criarModulo(courseId, titulo, (curso?.modulos.length ?? 0) + 1),
    onSuccess: invalidar,
  })
  const aulaMut = useMutation({
    mutationFn: (v: { moduleId: string; titulo: string; ordem: number }) =>
      criarAula(v.moduleId, v.titulo, v.ordem),
    onSuccess: invalidar,
  })
  const ordemMut = useMutation({
    mutationFn: (v: { tabela: 'bev_modules' | 'bev_lessons'; ids: string[] }) =>
      reordenar(v.tabela, v.ids),
    onSuccess: invalidar,
  })
  const apagarModuloMut = useMutation({ mutationFn: removerModulo, onSuccess: invalidar })
  const apagarAulaMut = useMutation({ mutationFn: removerAula, onSuccess: invalidar })
  const moduloPatchMut = useMutation({
    mutationFn: (v: { id: string; patch: Partial<{ titulo: string; bloqueado: boolean }> }) =>
      atualizarModulo(v.id, v.patch),
    onSuccess: invalidar,
  })

  if (cursoQ.isPending || !curso) return <Skeleton className="h-96 w-full" />

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2" onClick={onVoltar}>
          <ArrowLeft className="size-4" />
          Catálogo
        </Button>
        <Badge variant="secondary">{curso.diretoria.nome}</Badge>
        <div className="ml-auto flex gap-2">
          <Button size="sm" disabled={!titulo.trim() || salvarMut.isPending} onClick={() => salvarMut.mutate()}>
            {salvarMut.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar curso
          </Button>
        </div>
      </div>

      {/* ---------- Dados do curso ---------- */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[220px_1fr]">
          <div>
            <Label className="mb-1.5 block">Capa (16:9)</Label>
            <button
              type="button"
              onClick={() => capaRef.current?.click()}
              className="bg-muted hover:border-ring relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-dashed transition-colors"
            >
              {capa ? (
                <img src={capa} alt="Capa do curso" className="size-full object-cover" />
              ) : (
                <span className="text-muted-foreground flex flex-col items-center gap-1 text-xs">
                  <ImagePlus className="size-5" />
                  Enviar imagem
                </span>
              )}
              {capaMut.isPending && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="size-5 animate-spin text-white" />
                </span>
              )}
            </button>
            <input
              ref={capaRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) capaMut.mutate(f)
              }}
            />
            <p className="text-muted-foreground mt-1.5 text-xs">JPG, PNG ou WEBP · até 2 MB</p>
            {erro && <p className="text-destructive mt-1 text-xs">{erro}</p>}
          </div>

          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-titulo">Título do curso</Label>
              <Input id="c-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-desc">Descrição</Label>
              <Textarea
                id="c-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Em duas linhas: o que a pessoa sai sabendo fazer depois deste curso."
              />
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-instrutor">Instrutor / facilitador</Label>
                <Input
                  id="c-instrutor"
                  value={instrutor}
                  onChange={(e) => setInstrutor(e.target.value)}
                  placeholder="Nome de quem conduz"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-status">Status de publicação</Label>
                <select
                  id="c-status"
                  className={CAMPO}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CourseStatus)}
                >
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground text-xs">
                  {status === 'rascunho'
                    ? 'Só a liderança da diretoria enxerga.'
                    : status === 'em_breve'
                      ? 'Aparece na vitrine com cadeado, sem permitir entrar.'
                      : 'Visível e liberado para todo o BEV.'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Módulos e aulas ---------- */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Conteúdo do curso</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Arraste pela alça para reordenar, ou use as setinhas.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const t = prompt('Nome do módulo')
                if (t?.trim()) moduloMut.mutate(t.trim())
              }}
            >
              <Plus className="size-4" />
              Novo módulo
            </Button>
          </div>

          {curso.modulos.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Nenhum módulo ainda. Comece criando o primeiro.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              <ListaOrdenavel
                ids={curso.modulos.map((m) => m.id)}
                onReordenar={(ids) => ordemMut.mutate({ tabela: 'bev_modules', ids })}
              >
                {(id, alca) => {
                  const m = curso.modulos.find((x) => x.id === id)!
                  return (
                    <div className="bg-card rounded-xl border p-3">
                      <div className="flex items-center gap-2">
                        {alca}
                        <Input
                          defaultValue={m.titulo}
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            if (v && v !== m.titulo) moduloPatchMut.mutate({ id: m.id, patch: { titulo: v } })
                          }}
                          className="h-8 flex-1 border-transparent bg-transparent px-1 font-medium shadow-none"
                        />
                        <label className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={m.bloqueado}
                            onChange={(e) =>
                              moduloPatchMut.mutate({ id: m.id, patch: { bloqueado: e.target.checked } })
                            }
                            className="accent-primary size-3.5"
                          />
                          Bloqueado
                        </label>
                        <button
                          type="button"
                          aria-label="Excluir módulo"
                          onClick={async () => {
                            if (
                              await confirmar({
                                titulo: `Excluir o módulo "${m.titulo}"?`,
                                descricao: 'As aulas dentro dele também serão excluídas.',
                                destrutivo: true,
                              })
                            )
                              apagarModuloMut.mutate(m.id)
                          }}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      <div className="mt-2 flex flex-col gap-1.5 pl-6">
                        <ListaOrdenavel
                          ids={m.aulas.map((a) => a.id)}
                          onReordenar={(ids) => ordemMut.mutate({ tabela: 'bev_lessons', ids })}
                        >
                          {(aid, alcaAula) => {
                            const a = m.aulas.find((x) => x.id === aid)!
                            return (
                              <div className="hover:bg-accent/40 flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition-colors">
                                {alcaAula}
                                <button
                                  type="button"
                                  onClick={() => setAulaAberta(a)}
                                  className="min-w-0 flex-1 truncate text-left"
                                >
                                  {a.titulo}
                                </button>
                                {a.video_url ? (
                                  <Video className="text-status-success size-3.5 shrink-0" />
                                ) : (
                                  <Video className="text-muted-foreground/40 size-3.5 shrink-0" />
                                )}
                                {a.recursos.length > 0 && (
                                  <span className="text-muted-foreground flex shrink-0 items-center gap-0.5 text-xs">
                                    <Paperclip className="size-3" />
                                    {a.recursos.length}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  aria-label="Excluir aula"
                                  onClick={async () => {
                                    if (
                                      await confirmar({
                                        titulo: `Excluir a aula "${a.titulo}"?`,
                                        destrutivo: true,
                                      })
                                    )
                                      apagarAulaMut.mutate(a.id)
                                  }}
                                  className="text-muted-foreground hover:text-destructive shrink-0"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            )
                          }}
                        </ListaOrdenavel>

                        <button
                          type="button"
                          onClick={() => {
                            const t = prompt('Título da aula')
                            if (t?.trim())
                              aulaMut.mutate({
                                moduleId: m.id,
                                titulo: t.trim(),
                                ordem: m.aulas.length + 1,
                              })
                          }}
                          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 self-start rounded-md px-1 py-1 text-xs font-medium"
                        >
                          <Plus className="size-3.5" />
                          Nova aula
                        </button>
                      </div>
                    </div>
                  )
                }}
              </ListaOrdenavel>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={async () => {
            if (
              await confirmar({
                titulo: `Excluir o curso "${curso.titulo}"?`,
                descricao: 'Todos os módulos, aulas e o progresso de quem já fez o curso serão perdidos.',
                destrutivo: true,
              })
            )
              excluirMut.mutate()
          }}
        >
          <Trash2 className="size-4" />
          Excluir curso
        </Button>
      </div>

      {aulaAberta && (
        <AulaDialog
          aula={curso.modulos.flatMap((m) => m.aulas).find((a) => a.id === aulaAberta.id) ?? aulaAberta}
          onFechar={() => setAulaAberta(null)}
          onMudou={invalidar}
          personId={person.id}
        />
      )}
    </div>
  )
}

function AulaDialog({
  aula,
  onFechar,
  onMudou,
}: {
  aula: BevLesson
  onFechar: () => void
  onMudou: () => void
  personId: string
}) {
  const [titulo, setTitulo] = useState(aula.titulo)
  const [descricao, setDescricao] = useState(aula.descricao ?? '')
  const [url, setUrl] = useState(aula.video_url ?? '')
  const [fonte, setFonte] = useState<VideoFonte | ''>(aula.video_fonte ?? '')
  const [duracao, setDuracao] = useState(aula.duracao_min?.toString() ?? '')
  const [novoRecurso, setNovoRecurso] = useState<{ titulo: string; tipo: ResourceTipo; url: string }>({
    titulo: '',
    tipo: 'link',
    url: '',
  })
  const [erro, setErro] = useState<string | null>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

  const fonteEfetiva = (fonte || detectarFonte(url) || '') as VideoFonte | ''
  const preview = urlDeEmbed(url, fonteEfetiva || null)

  const salvarMut = useMutation({
    mutationFn: () =>
      atualizarAula(aula.id, {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        video_url: url.trim() || null,
        video_fonte: (fonteEfetiva || null) as VideoFonte | null,
        duracao_min: duracao ? Number(duracao) : null,
      }),
    onSuccess: () => {
      onMudou()
      onFechar()
    },
  })

  const recursoMut = useMutation({
    mutationFn: (r: { titulo: string; tipo: ResourceTipo; url: string }) =>
      criarRecurso({
        lesson_id: aula.id,
        titulo: r.titulo,
        tipo: r.tipo,
        url: r.url,
        ordem: aula.recursos.length + 1,
      }),
    onSuccess: () => {
      setNovoRecurso({ titulo: '', tipo: 'link', url: '' })
      onMudou()
    },
  })

  const arquivoMut = useMutation({
    mutationFn: (f: File) => subirMaterial(aula.id, f).then((u) => ({ u, nome: f.name })),
    onSuccess: ({ u, nome }) =>
      recursoMut.mutate({ titulo: nome, tipo: 'arquivo', url: u }),
    onError: (e) => setErro(uploadErro(e)),
  })

  const apagarRecursoMut = useMutation({ mutationFn: removerRecurso, onSuccess: onMudou })

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar aula</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="a-titulo">Título</Label>
            <Input id="a-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="a-desc">Descrição</Label>
            <Textarea id="a-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <div className="rounded-xl border p-3.5">
            <p className="mb-2.5 text-sm font-medium">Vídeo</p>
            <p className="text-muted-foreground mb-3 text-xs">
              Cole o link do vídeo já hospedado. Nada de subir arquivo aqui — o BevSkills só
              incorpora o player da fonte.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="a-url">URL</Label>
                <Input
                  id="a-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtu.be/… · https://drive.google.com/file/d/…"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="a-fonte">Fonte</Label>
                <select
                  id="a-fonte"
                  className={CAMPO}
                  value={fonteEfetiva}
                  onChange={(e) => setFonte(e.target.value as VideoFonte)}
                >
                  <option value="">Detectar pela URL</option>
                  {FONTES.map((f) => (
                    <option key={f} value={f}>
                      {FONTE_LABEL[f]}
                    </option>
                  ))}
                </select>
              </div>
              {url && (
                <div className="bg-muted aspect-video w-full overflow-hidden rounded-lg border">
                  {preview ? (
                    <iframe src={preview} title="Prévia" allowFullScreen className="size-full" />
                  ) : (
                    <div className="text-muted-foreground flex size-full items-center justify-center p-4 text-center text-xs">
                      Não reconhecemos essa URL. Confira o link ou escolha a fonte na mão.
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="a-dur">Duração em minutos (opcional)</Label>
                <Input
                  id="a-dur"
                  type="number"
                  min={1}
                  value={duracao}
                  onChange={(e) => setDuracao(e.target.value)}
                  className="sm:w-40"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-3.5">
            <p className="mb-2.5 text-sm font-medium">Recursos complementares</p>
            {aula.recursos.length > 0 && (
              <ul className="mb-3 flex flex-col gap-1.5">
                {aula.recursos.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{r.titulo}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {RECURSO_LABEL[r.tipo]}
                    </span>
                    <button
                      type="button"
                      aria-label="Remover recurso"
                      onClick={() => apagarRecursoMut.mutate(r.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={novoRecurso.titulo}
                onChange={(e) => setNovoRecurso((r) => ({ ...r, titulo: e.target.value }))}
                placeholder="Nome do material"
                className="sm:flex-1"
              />
              <select
                className={`${CAMPO} sm:w-36`}
                value={novoRecurso.tipo}
                onChange={(e) =>
                  setNovoRecurso((r) => ({ ...r, tipo: e.target.value as ResourceTipo }))
                }
              >
                {TIPOS.filter((t) => t !== 'arquivo').map((t) => (
                  <option key={t} value={t}>
                    {RECURSO_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                value={novoRecurso.url}
                onChange={(e) => setNovoRecurso((r) => ({ ...r, url: e.target.value }))}
                placeholder="https://…"
                className="sm:flex-1"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!novoRecurso.titulo.trim() || !novoRecurso.url.trim() || recursoMut.isPending}
                onClick={() =>
                  recursoMut.mutate({
                    titulo: novoRecurso.titulo.trim(),
                    tipo: novoRecurso.tipo,
                    url: novoRecurso.url.trim(),
                  })
                }
              >
                <Plus className="size-4" />
                Adicionar link
              </Button>
            </div>

            <div className="mt-3 border-t pt-3">
              <Button
                size="sm"
                variant="outline"
                disabled={arquivoMut.isPending}
                onClick={() => arquivoRef.current?.click()}
              >
                {arquivoMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Paperclip className="size-4" />
                )}
                Enviar arquivo (PDF, planilha, modelo)
              </Button>
              <input
                ref={arquivoRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) arquivoMut.mutate(f)
                }}
              />
              {erro && <p className="text-destructive mt-1.5 text-xs">{erro}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onFechar}>
              Fechar
            </Button>
            <Button disabled={!titulo.trim() || salvarMut.isPending} onClick={() => salvarMut.mutate()}>
              Salvar aula
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
