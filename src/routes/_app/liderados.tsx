/**
 * Meus Liderados (Blueprint §5.1) — a porta de entrada do Perfil do
 * Assessor (PRD §11).
 * · Diretor: GERENTES + ASSESSORES da própria diretoria.
 * · Gerente/Coordenador: apenas ASSESSORES da própria subárea.
 * Clicar em alguém abre o perfil completo em /assessor/$personId.
 * O escopo (própria diretoria/subárea) é garantido pela liderados_view.
 */
import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Lock, Search, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/lib/app-context'
import { getLiderados, type Liderado } from '@/lib/pdi'
import { ROLE_LABELS } from '@/lib/org'
import { initials } from '@/lib/utils'

export const Route = createFileRoute('/_app/liderados')({ component: LideradosPage })

const GERENTE_ROLES = ['gerente', 'coordenador']

function LideradosPage() {
  const { isLeader, isDirex, cycle } = useApp()
  const [busca, setBusca] = useState('')
  const q = useQuery({ queryKey: ['liderados'], queryFn: getLiderados, enabled: isLeader })

  const { gerentes, assessores } = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const data = (q.data ?? []).filter((l) => !termo || l.nome.toLowerCase().includes(termo))
    return {
      gerentes: data.filter((l) => GERENTE_ROLES.includes(l.role)),
      assessores: data.filter((l) => !GERENTE_ROLES.includes(l.role)),
    }
  }, [q.data, busca])

  if (!isLeader) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <Lock className="text-muted-foreground mx-auto mb-3 size-8" />
        <h1 className="text-lg font-semibold">Somente lideranças</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Esta área é exclusiva de diretores, gerentes e coordenadores.
        </p>
      </div>
    )
  }

  const emRisco = (q.data ?? []).filter((l) => l.risco).length

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Users className="size-4.5" />
          </span>
          Meus Liderados
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isDirex
            ? 'Gerentes e assessores da sua diretoria'
            : 'Assessores da sua área'}{' '}
          · Ciclo {cycle.nome} ·{' '}
          {emRisco > 0 ? `${emRisco} em risco de desengajamento` : 'ninguém em risco'}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Clique em alguém para abrir o perfil completo — entregas, diário de liderança e
          encerramento de ciclo.
        </p>
      </header>

      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (q.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">
            Nenhum liderado cadastrado ainda neste ciclo.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {(q.data ?? []).length > 6 && (
            <div className="relative max-w-sm">
              <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome…"
                className="pl-9"
              />
            </div>
          )}

          {isDirex && (
            <PeopleSection
              titulo="Gerentes e coordenadores"
              pessoas={gerentes}
              vazio="Nenhum gerente na sua diretoria."
            />
          )}
          <PeopleSection
            titulo="Assessores"
            pessoas={assessores}
            vazio="Nenhum assessor cadastrado."
          />
        </div>
      )}
    </div>
  )
}

function PeopleSection({
  titulo,
  pessoas,
  vazio,
}: {
  titulo: string
  pessoas: Liderado[]
  vazio: string
}) {
  const ordenados = [...pessoas].sort((a, b) => Number(b.risco) - Number(a.risco))
  return (
    <div>
      <div className="text-muted-foreground mb-2.5 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide">
        {titulo}
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
          {pessoas.length}
        </span>
      </div>
      {pessoas.length === 0 ? (
        <p className="text-muted-foreground px-1 text-sm">{vazio}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ordenados.map((l) => (
            <PersonCard key={l.person_id ?? l.email} liderado={l} />
          ))}
        </div>
      )}
    </div>
  )
}

function PersonCard({ liderado: l }: { liderado: Liderado }) {
  const conteudo = (
    <>
      <Avatar className="size-9">
        {l.foto_url && <AvatarImage src={l.foto_url} alt={l.nome} />}
        <AvatarFallback className="text-xs">{initials(l.nome)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{l.nome}</p>
        <p className="text-muted-foreground truncate text-xs">
          {ROLE_LABELS[l.role]} · {l.area}
        </p>
      </div>
      {!l.ativo ? (
        <Badge variant="neutral">Não ativou</Badge>
      ) : l.risco ? (
        <Badge variant="danger">Risco</Badge>
      ) : (
        <Badge variant="success">Ok</Badge>
      )}
    </>
  )

  if (!l.ativo || !l.person_id) {
    return (
      <div
        className="bg-muted/30 flex items-center gap-2.5 rounded-xl border border-dashed p-3"
        title={`${l.nome} está no roster do ciclo, mas ainda não criou a conta no BEV OS.`}
      >
        {conteudo}
      </div>
    )
  }

  return (
    <Link
      to="/assessor/$personId"
      params={{ personId: l.person_id }}
      search={{ tab: 'entregas' as const }}
      className="bg-card hover:bg-accent/50 hover:border-ring flex items-center gap-2.5 rounded-xl border p-3 transition-colors"
    >
      {conteudo}
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </Link>
  )
}
