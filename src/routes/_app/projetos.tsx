/**
 * Projetos (Onda 2) — projetos nascem do Comercial (lead fechado)
 * sem núcleo; a liderança de Projetos aloca Capiba/Suassuna,
 * define prazo, monta a equipe e conclui. Sem financeiro por
 * projeto (caixa único da EJ).
 */
import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Briefcase, Check, Lock, UserPlus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/lib/app-context'
import { getDirectory } from '@/lib/org'
import {
  addProjectMember,
  getNucleos,
  getProjects,
  getServices,
  removeProjectMember,
  updateProject,
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
} from '@/lib/projetos'
import { fmtDate, useContextScope } from '@/lib/use-context-scope'
import { initials } from '@/lib/utils'

export const Route = createFileRoute('/_app/projetos')({ component: ProjetosPage })

function ProjectCard({ project, souLider }: { project: Project; souLider: boolean }) {
  const { cycle } = useApp()
  const { allSubareas } = useContextScope()
  const queryClient = useQueryClient()
  const projetosSubarea = allSubareas.find((s) => s.slug === 'projetos')
  const [prazo, setPrazo] = useState(project.prazo ?? '')

  const nucleosQ = useQuery({ queryKey: ['nucleos'], queryFn: getNucleos, staleTime: Infinity })
  const servicosQ = useQuery({ queryKey: ['project-services'], queryFn: getServices, staleTime: Infinity })
  const membersQ = useQuery({
    queryKey: ['directory', cycle.id, projetosSubarea?.id],
    queryFn: () => getDirectory(cycle.id, projetosSubarea!.id),
    enabled: souLider && !!projetosSubarea,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['projects'] })
  const updateMut = useMutation({
    mutationFn: (patch: Parameters<typeof updateProject>[1]) => updateProject(project.id, patch),
    onSuccess: invalidate,
  })
  const memberMut = useMutation({
    mutationFn: ({ personId, add }: { personId: string; add: boolean }) =>
      add ? addProjectMember(project.id, personId) : removeProjectMember(project.id, personId),
    onSuccess: invalidate,
  })

  const memberIds = new Set(project.members.map((m) => m.id))

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={project.status === 'concluido' ? 'success' : 'info'}>
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
          {project.nucleo ? (
            <Badge variant="secondary">{project.nucleo.nome}</Badge>
          ) : (
            <Badge variant="warning">Sem núcleo</Badge>
          )}
          {project.servico && <Badge variant="info">{project.servico.nome}</Badge>}
          <span className="text-muted-foreground ml-auto text-xs">
            desde {fmtDate(project.created_at)}
          </span>
        </div>

        <div>
          <p className="font-medium">{project.cliente}</p>
          <p className="text-muted-foreground text-xs">
            Prazo: {fmtDate(project.prazo)}
            {project.lead_id ? ' · origem: Comercial' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {project.members.map((m) => (
            <div key={m.id} className="bg-muted flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2">
              <Avatar className="size-5">
                {m.foto_url && <AvatarImage src={m.foto_url} alt={m.nome} />}
                <AvatarFallback className="text-[9px]">{initials(m.nome)}</AvatarFallback>
              </Avatar>
              <span className="text-[11px]">{m.nome.split(' ')[0]}</span>
            </div>
          ))}
          {project.members.length === 0 && (
            <span className="text-muted-foreground text-xs">Equipe não definida</span>
          )}
        </div>

        {souLider && project.status === 'em_andamento' && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <select
              className="border-input bg-background h-8 rounded-md border px-2 text-xs"
              value={project.nucleo_id ?? ''}
              onChange={(e) => updateMut.mutate({ nucleo_id: e.target.value || null })}
              aria-label="Alocar núcleo"
            >
              <option value="">Alocar núcleo…</option>
              {(nucleosQ.data ?? []).map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome}
                </option>
              ))}
            </select>
            <select
              className="border-input bg-background h-8 rounded-md border px-2 text-xs"
              value={project.servico_id ?? ''}
              onChange={(e) => updateMut.mutate({ servico_id: e.target.value || null })}
              aria-label="Definir serviço"
            >
              <option value="">Definir serviço…</option>
              {(servicosQ.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                className="h-8 w-36 text-xs"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                aria-label="Prazo"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                disabled={updateMut.isPending || prazo === (project.prazo ?? '')}
                onClick={() => updateMut.mutate({ prazo: prazo || null })}
              >
                Salvar prazo
              </Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs">
                  <UserPlus className="size-3.5" />
                  Equipe
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60">
                <DropdownMenuLabel>Membros de Projetos</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(membersQ.data ?? []).map(({ person: p }) => (
                  <DropdownMenuCheckboxItem
                    key={p.id}
                    checked={memberIds.has(p.id)}
                    onCheckedChange={(checked) =>
                      memberMut.mutate({ personId: p.id, add: !!checked })
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    {p.nome}
                  </DropdownMenuCheckboxItem>
                ))}
                {(membersQ.data ?? []).length === 0 && (
                  <p className="text-muted-foreground p-2 text-xs">
                    Ninguém de Projetos cadastrado ainda.
                  </p>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              className="ml-auto h-8 text-xs"
              disabled={updateMut.isPending}
              onClick={() => updateMut.mutate({ status: 'concluido' })}
            >
              <Check className="size-3.5" />
              Concluir
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ProjetosPage() {
  const { cycle, occupations, isDirex } = useApp()
  const { allSubareas, leadsSubarea } = useContextScope()
  const [filtro, setFiltro] = useState<ProjectStatus | 'todos'>('todos')

  const projetosSubarea = allSubareas.find((s) => s.slug === 'projetos')
  const acessa = isDirex || occupations.some((o) => o.subarea.slug === 'projetos')
  const souLider = projetosSubarea ? leadsSubarea(projetosSubarea.id) : false

  const projectsQ = useQuery({
    queryKey: ['projects', cycle.id],
    queryFn: () => getProjects(cycle.id),
    enabled: acessa,
  })

  const projects = useMemo(() => {
    let list = projectsQ.data ?? []
    if (filtro !== 'todos') list = list.filter((p) => p.status === filtro)
    return list
  }, [projectsQ.data, filtro])

  if (!acessa) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <Lock className="text-muted-foreground mx-auto mb-3 size-8" />
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          O módulo Projetos é visível para a área de Projetos e a Direx.
        </p>
      </div>
    )
  }

  const aguardando = (projectsQ.data ?? []).filter(
    (p) => p.status === 'em_andamento' && !p.nucleo_id,
  )

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Briefcase className="size-6" />
          Projetos
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Projetos vendidos, alocados aos núcleos Capiba e Suassuna · Ciclo {cycle.nome}
        </p>
      </header>

      {aguardando.length > 0 && souLider && (
        <div className="bg-status-warning-bg mb-4 rounded-md border p-3">
          <p className="text-status-warning text-sm font-medium">
            {aguardando.length} projeto{aguardando.length > 1 ? 's' : ''} aguardando alocação de
            núcleo — use o seletor no card para alocar.
          </p>
        </div>
      )}

      <div className="mb-4 flex gap-1.5">
        {(['todos', 'em_andamento', 'concluido'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filtro === f ? 'secondary' : 'ghost'}
            onClick={() => setFiltro(f)}
          >
            {f === 'todos' ? 'Todos' : PROJECT_STATUS_LABELS[f]}
          </Button>
        ))}
      </div>

      {projectsQ.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">
            Nenhum projeto {filtro !== 'todos' ? 'neste status' : 'ainda'}. Projetos nascem
            automaticamente quando o Comercial fecha um contrato.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} souLider={souLider} />
          ))}
        </div>
      )}
    </div>
  )
}
