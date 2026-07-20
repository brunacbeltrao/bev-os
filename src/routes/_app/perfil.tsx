/**
 * Meu perfil — mínimo da Onda 0 para validar o cadastro via roster.
 * O Perfil de Pessoa completo (PDI, advertências, demandas, projetos)
 * cresce nas Ondas 1 e 3.
 */
import { useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useApp } from '@/lib/app-context'
import { occupationAreaLabel, ROLE_LABELS } from '@/lib/org'
import { initials } from '@/lib/utils'

export const Route = createFileRoute('/_app/perfil')({ component: PerfilPage })

function tempoDeEJ(entrouEm: string): string {
  const inicio = new Date(entrouEm)
  const agora = new Date()
  const meses =
    (agora.getFullYear() - inicio.getFullYear()) * 12 + (agora.getMonth() - inicio.getMonth())
  if (meses < 1) return 'menos de 1 mês'
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(meses / 12)
  const resto = meses % 12
  return `${anos} ${anos === 1 ? 'ano' : 'anos'}${resto > 0 ? ` e ${resto} ${resto === 1 ? 'mês' : 'meses'}` : ''}`
}

const MAX_FOTO_MB = 5
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp']

function PerfilPage() {
  const { person, occupations, cycle } = useApp()
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(person.nome)
  const [erroFoto, setErroFoto] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  /** Sobe a imagem para o bucket `avatares` (pasta = id do usuário) e
   *  grava a URL pública em people.foto_url. */
  const fotoMut = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const caminho = `${person.id}/avatar-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatares')
        .upload(caminho, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr

      const { data } = supabase.storage.from('avatares').getPublicUrl(caminho)
      const { error } = await supabase
        .from('people')
        .update({ foto_url: data.publicUrl })
        .eq('id', person.id)
      if (error) throw error
    },
    onSuccess: () => {
      setErroFoto(null)
      queryClient.invalidateQueries({ queryKey: ['person'] })
    },
    onError: () => setErroFoto('Não foi possível enviar a foto. Tente novamente.'),
  })

  const removerFotoMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('people')
        .update({ foto_url: null })
        .eq('id', person.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['person'] }),
  })

  function selecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!TIPOS_ACEITOS.includes(file.type)) {
      setErroFoto('Use uma imagem JPG, PNG ou WEBP.')
      return
    }
    if (file.size > MAX_FOTO_MB * 1024 * 1024) {
      setErroFoto(`A imagem precisa ter no máximo ${MAX_FOTO_MB} MB.`)
      return
    }
    setErroFoto(null)
    fotoMut.mutate(file)
  }

  const nomeMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('people')
        .update({ nome: nome.trim() })
        .eq('id', person.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person'] })
      setEditando(false)
    },
  })

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Meu perfil</h1>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar className="size-16">
                {person.foto_url && <AvatarImage src={person.foto_url} alt={person.nome} />}
                <AvatarFallback className="text-base">{initials(person.nome)}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                aria-label="Alterar foto de perfil"
                onClick={() => fileRef.current?.click()}
                disabled={fotoMut.isPending}
                className="bg-primary text-primary-foreground ring-card absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full ring-2 transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {fotoMut.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Camera className="size-3.5" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={selecionarFoto}
              />
            </div>
            <div className="min-w-0 flex-1">
              {editando ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (nome.trim()) nomeMut.mutate()
                  }}
                >
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-8" />
                  <Button type="submit" size="sm" disabled={nomeMut.isPending}>
                    Salvar
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)}>
                    Cancelar
                  </Button>
                </form>
              ) : (
                <CardTitle className="flex items-center gap-2 text-lg">
                  {person.nome}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    aria-label="Editar nome"
                    onClick={() => {
                      setNome(person.nome)
                      setEditando(true)
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </CardTitle>
              )}
              <CardDescription>{person.email}</CardDescription>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
                >
                  {person.foto_url ? 'Trocar foto' : 'Adicionar foto'}
                </button>
                {person.foto_url && (
                  <button
                    type="button"
                    onClick={() => removerFotoMut.mutate()}
                    disabled={removerFotoMut.isPending}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium transition-colors"
                  >
                    <Trash2 className="size-3" />
                    Remover
                  </button>
                )}
              </div>
              {erroFoto && <p className="mt-1 text-xs text-red-600">{erroFoto}</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Separator />
          <div>
            <h2 className="mb-2 text-sm font-medium">Vínculos no ciclo {cycle.nome}</h2>
            <div className="flex flex-col gap-2">
              {occupations.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center gap-1.5 text-sm">
                  <Badge variant="secondary">{ROLE_LABELS[o.role]}</Badge>
                  <Badge variant="outline">{occupationAreaLabel(o)}</Badge>
                  {o.role !== 'diretor' && (
                    <span className="text-muted-foreground">· {o.directorate.nome}</span>
                  )}
                  {o.is_hibrido && <Badge variant="info">Vínculo híbrido</Badge>}
                </div>
              ))}
            </div>
          </div>
          <Separator />
          <div className="text-sm">
            <span className="text-muted-foreground">Tempo de EJ (desde o cadastro): </span>
            <span className="font-medium">{tempoDeEJ(person.entrou_em)}</span>
          </div>
          <p className="text-muted-foreground text-xs">
            PDI, advertências/agravos (visíveis só a você e à P&C), demandas e projetos aparecem
            aqui nas próximas ondas.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
