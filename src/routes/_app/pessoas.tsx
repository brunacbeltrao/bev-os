/**
 * Pessoas — diretório de membros (Blueprint §3, item 15).
 * O Seletor de Contexto define o escopo: contexto de área mostra a
 * área; "Visão Geral BEV"/Direx mostram o BEV inteiro.
 */
import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/lib/app-context'
import { getDirectory, occupationAreaLabel, ROLE_LABELS } from '@/lib/org'
import { initials } from '@/lib/utils'

interface PessoasSearch {
  q?: string
}

export const Route = createFileRoute('/_app/pessoas')({
  validateSearch: (search: Record<string, unknown>): PessoasSearch => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  component: PessoasPage,
})

function PessoasPage() {
  const { cycle, context } = useApp()
  const { q } = Route.useSearch()
  const [filtro, setFiltro] = useState(q ?? '')

  const subareaId = context.kind === 'subarea' ? context.subareaId : null
  const directorateId = context.kind === 'diretoria' ? context.directorateId : null

  const dirQ = useQuery({
    queryKey: ['directory', cycle.id, subareaId],
    queryFn: () => getDirectory(cycle.id, subareaId),
  })

  const entries = useMemo(() => {
    let list = dirQ.data ?? []
    if (directorateId) {
      list = list.filter((e) => e.occupation.directorate.id === directorateId)
    }
    const f = filtro.trim().toLowerCase()
    if (f) {
      list = list.filter(
        (e) =>
          e.person.nome.toLowerCase().includes(f) || e.person.email.toLowerCase().includes(f),
      )
    }
    return list
  }, [dirQ.data, directorateId, filtro])

  const escopo =
    context.kind === 'subarea' || context.kind === 'diretoria'
      ? context.label
      : 'BEV inteiro'

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Pessoas</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Diretório de membros · {escopo} · Ciclo {cycle.nome}
        </p>
      </header>

      <div className="relative mb-4 max-w-sm">
        <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Filtrar por nome ou e-mail…"
          className="pl-9"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </div>

      {dirQ.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">
            {filtro
              ? `Ninguém encontrado para “${filtro}”.`
              : 'Ainda não há membros cadastrados neste escopo. Conforme as pessoas criarem conta (validadas pelo roster), elas aparecem aqui.'}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map(({ person, occupation }) => (
            <Card key={occupation.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar className="size-10">
                  {person.foto_url && <AvatarImage src={person.foto_url} alt={person.nome} />}
                  <AvatarFallback>{initials(person.nome)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{person.nome}</p>
                  <p className="text-muted-foreground truncate text-sm">{person.email}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <Badge variant="secondary">{ROLE_LABELS[occupation.role]}</Badge>
                  <Badge variant="outline">{occupationAreaLabel(occupation)}</Badge>
                  {occupation.is_hibrido && <Badge variant="info">Híbrido</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
