/** Memória Institucional (Onda 4) — POPs, atas, templates, contratos
 *  com busca. Só P&C + Direx publicam; todos leem. */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-context'
import { useAllSubareas, fmtDate } from '@/lib/use-context-scope'
import {
  createMemoryDoc,
  deleteMemoryDoc,
  getMemoryDocs,
  updateMemoryDoc,
  MEMORY_TIPO_BADGE,
  MEMORY_TIPO_LABELS,
  MEMORY_TIPO_ORDER,
  type MemoryDoc,
  type MemoryTipo,
} from '@/lib/memoria'

export const Route = createFileRoute('/_app/memoria')({ component: MemoriaPage })

const emptyForm = { titulo: '', tipo: 'pop' as MemoryTipo, subarea_id: '', conteudo: '' }

function MemoriaPage() {
  const { person, occupations, isDirex } = useApp()
  const queryClient = useQueryClient()
  const subareasQ = useAllSubareas()
  const canManage =
    isDirex ||
    occupations.some(
      (o) =>
        o.subarea.slug === 'pessoas_cultura' && (o.role === 'gerente' || o.role === 'coordenador'),
    )

  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<MemoryTipo | 'todos'>('todos')
  const [selId, setSelId] = useState<string | null>(null)
  const [modo, setModo] = useState<'ver' | 'editar' | 'novo'>('ver')
  const [form, setForm] = useState(emptyForm)
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const q = useQuery({
    queryKey: ['memory', search, tipoFiltro],
    queryFn: () => getMemoryDocs(search, tipoFiltro),
  })
  const docs = q.data ?? []
  const selecionado = docs.find((d) => d.id === selId) ?? null

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['memory'] })
  const saveMut = useMutation({
    mutationFn: async () => {
      if (modo === 'novo') {
        return await createMemoryDoc({
          titulo: form.titulo,
          conteudo: form.conteudo,
          tipo: form.tipo,
          subarea_id: form.subarea_id || null,
          autor_id: person.id,
        })
      }
      await updateMemoryDoc(selId!, {
        titulo: form.titulo,
        conteudo: form.conteudo,
        tipo: form.tipo,
        subarea_id: form.subarea_id || null,
      })
      return selId!
    },
    onSuccess: (id) => {
      setModo('ver')
      setSelId(id)
      invalidate()
    },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => deleteMemoryDoc(id),
    onSuccess: () => {
      setSelId(null)
      invalidate()
    },
  })

  function abrirNovo() {
    setForm(emptyForm)
    setSelId(null)
    setModo('novo')
  }
  function abrirEditar(d: MemoryDoc) {
    setForm({ titulo: d.titulo, tipo: d.tipo, subarea_id: d.subarea_id ?? '', conteudo: d.conteudo })
    setModo('editar')
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <BookOpen className="size-4.5" />
          </span>
            Memória Institucional
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            POPs, atas, templates e contratos · base de conhecimento do BEV
          </p>
        </div>
        {canManage && (
          <Button onClick={abrirNovo}>
            <Plus className="size-4" /> Novo documento
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Lista */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título ou conteúdo…"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['todos', ...MEMORY_TIPO_ORDER] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipoFiltro(t)}
                className={`rounded-full border px-2.5 py-1 text-xs ${tipoFiltro === t ? 'bg-neutral-900 text-neutral-0 border-neutral-900' : 'bg-card'}`}
              >
                {t === 'todos' ? 'Todos' : MEMORY_TIPO_LABELS[t]}
              </button>
            ))}
          </div>
          {q.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : docs.length === 0 ? (
            <p className="text-muted-foreground px-1 text-sm">Nenhum documento encontrado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setSelId(d.id)
                    setModo('ver')
                  }}
                  className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors ${
                    selId === d.id && modo === 'ver' ? 'bg-accent border-ring' : 'bg-card hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={MEMORY_TIPO_BADGE[d.tipo]}>{MEMORY_TIPO_LABELS[d.tipo]}</Badge>
                    <span className="truncate text-sm font-medium">{d.titulo}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {d.subarea?.nome ? `${d.subarea.nome} · ` : ''}atualizado {fmtDate(d.updated_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalhe / editor */}
        <div className="lg:col-span-3">
          {modo === 'novo' || modo === 'editar' ? (
            <Card>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">
                    {modo === 'novo' ? 'Novo documento' : 'Editar documento'}
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => setModo('ver')}>
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Título</Label>
                  <Input value={form.titulo} onChange={(e) => set('titulo', e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Tipo</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {MEMORY_TIPO_ORDER.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => set('tipo', t)}
                          className={`rounded-md border px-2.5 py-1 text-xs ${form.tipo === t ? 'bg-accent border-ring' : 'bg-card'}`}
                        >
                          {MEMORY_TIPO_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Área (opcional)</Label>
                    <select
                      value={form.subarea_id}
                      onChange={(e) => set('subarea_id', e.target.value)}
                      className="border-input bg-card h-9 rounded-md border px-2 text-sm"
                    >
                      <option value="">Institucional</option>
                      {(subareasQ.data ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Conteúdo</Label>
                  <Textarea
                    value={form.conteudo}
                    onChange={(e) => set('conteudo', e.target.value)}
                    className="min-h-64"
                    placeholder="Conteúdo do documento (texto/markdown)…"
                  />
                </div>
                <Button
                  className="self-start"
                  disabled={saveMut.isPending || !form.titulo.trim()}
                  onClick={() => saveMut.mutate()}
                >
                  Salvar documento
                </Button>
              </CardContent>
            </Card>
          ) : selecionado ? (
            <Card>
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant={MEMORY_TIPO_BADGE[selecionado.tipo]}>
                        {MEMORY_TIPO_LABELS[selecionado.tipo]}
                      </Badge>
                      {selecionado.subarea?.nome && (
                        <span className="text-muted-foreground text-xs">{selecionado.subarea.nome}</span>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold">{selecionado.titulo}</h2>
                    <p className="text-muted-foreground text-xs">
                      {selecionado.autor?.nome ? `${selecionado.autor.nome} · ` : ''}atualizado{' '}
                      {fmtDate(selecionado.updated_at)}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(selecionado)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => {
                          if (confirm('Excluir este documento?')) delMut.mutate(selecionado.id)
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {selecionado.conteudo.trim() ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{selecionado.conteudo}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">Documento sem conteúdo.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-muted-foreground p-10 text-center text-sm">
                Selecione um documento para ler.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
