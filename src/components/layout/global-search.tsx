/**
 * Busca Global (PRD Onda 0) — na Topbar, atalho Cmd/Ctrl+K.
 * Onda 0 busca pessoas, áreas e diretorias; os módulos das
 * próximas ondas (demandas, comunicados, atas…) se encaixam
 * adicionando novos grupos de resultado.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Building2, CheckSquare, Handshake, Megaphone, Search, User, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { globalSearch } from '@/lib/org'
import { useApp } from '@/lib/app-context'

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function GlobalSearch() {
  const { cycle } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [atalho, setAtalho] = useState('⌘K')
  useEffect(() => {
    if (!/Mac/i.test(navigator.platform)) setAtalho('Ctrl K')
  }, [])
  const q = useDebounced(term, 250)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const resultsQ = useQuery({
    queryKey: ['global-search', q, cycle.id],
    queryFn: () => globalSearch(q, cycle.id),
    enabled: open && q.trim().length >= 2,
  })

  const pessoas = (resultsQ.data ?? []).filter((r) => r.kind === 'pessoa')
  const estrutura = (resultsQ.data ?? []).filter(
    (r) => r.kind === 'area' || r.kind === 'diretoria',
  )
  const conteudo = (resultsQ.data ?? []).filter(
    (r) =>
      r.kind === 'demanda' ||
      r.kind === 'comunicado' ||
      r.kind === 'lead' ||
      r.kind === 'projeto',
  )

  function go(kind: string) {
    setOpen(false)
    setTerm('')
    if (kind === 'pessoa') navigate({ to: '/pessoas', search: { q } })
    else if (kind === 'comunicado') navigate({ to: '/comunicados' })
    else if (kind === 'memoria') navigate({ to: '/memoria' })
    else if (kind === 'lead') navigate({ to: '/comercial' })
    else if (kind === 'projeto') navigate({ to: '/projetos' })
    else navigate({ to: '/pessoas', search: { q: undefined } })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-muted-foreground w-56 justify-start gap-2 font-normal"
        onClick={() => setOpen(true)}
      >
        <Search className="size-3.5" />
        Buscar no BEV OS…
        <kbd className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 font-mono text-[10px]">
          {atalho}
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar pessoas, áreas, diretorias…"
          value={term}
          onValueChange={setTerm}
        />
        <CommandList>
          {q.trim().length < 2 ? (
            <CommandEmpty>Digite ao menos 2 caracteres.</CommandEmpty>
          ) : resultsQ.isFetching ? (
            <CommandEmpty>Buscando…</CommandEmpty>
          ) : (
            <CommandEmpty>Nenhum resultado para “{q}”.</CommandEmpty>
          )}
          {pessoas.length > 0 && (
            <CommandGroup heading="Pessoas">
              {pessoas.map((r) => (
                <CommandItem key={r.id} value={r.id} onSelect={() => go('pessoa')}>
                  <User />
                  <div className="flex flex-col">
                    <span>{r.titulo}</span>
                    <span className="text-muted-foreground text-xs">{r.subtitulo}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {estrutura.length > 0 && (
            <CommandGroup heading="Estrutura">
              {estrutura.map((r) => (
                <CommandItem key={r.id} value={r.id} onSelect={() => go(r.kind)}>
                  {r.kind === 'diretoria' ? <Building2 /> : <Users />}
                  <div className="flex flex-col">
                    <span>{r.titulo}</span>
                    <span className="text-muted-foreground text-xs">{r.subtitulo}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {conteudo.length > 0 && (
            <CommandGroup heading="Conteúdo">
              {conteudo.map((r) => (
                <CommandItem key={r.id} value={r.id} onSelect={() => go(r.kind)}>
                  {r.kind === 'demanda' ? (
                    <CheckSquare />
                  ) : r.kind === 'lead' ? (
                    <Handshake />
                  ) : r.kind === 'projeto' ? (
                    <Briefcase />
                  ) : (
                    <Megaphone />
                  )}
                  <div className="flex flex-col">
                    <span>{r.titulo}</span>
                    <span className="text-muted-foreground text-xs">{r.subtitulo}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
