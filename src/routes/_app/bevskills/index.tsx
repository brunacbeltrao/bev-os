/**
 * BevSkills — Dashboard de Aprendizagem (/bevskills).
 * Resumo do progresso do aluno, trilhas disponíveis, cursos em
 * destaque e categorias. Ponto de entrada do módulo educacional.
 */
import { useMemo } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Award,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Layers,
  PlayCircle,
  Settings,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useApp } from '@/lib/app-context'
import { firstName } from '@/lib/utils'
import { CourseCard } from '@/components/features/bevskills/course-card'
import { ProgressCircle } from '@/components/features/bevskills/progress-circle'
import {
  getCategories,
  getCourses,
  getLearningPaths,
  getMyCertificates,
  getMyCourseProgress,
} from '@/lib/bevskills'

export const Route = createFileRoute('/_app/bevskills/')({ component: BevSkillsDashboard })

function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof BookOpen
  value: number | string
  label: string
}) {
  return (
    <div className="bg-card flex items-center gap-3 rounded-xl border p-4 shadow-xs">
      <span className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-none tabular-nums">{value}</div>
        <div className="text-muted-foreground mt-1 truncate text-xs">{label}</div>
      </div>
    </div>
  )
}

function BevSkillsDashboard() {
  const { person, isDirex, souPC, isLeader } = useApp()
  const canAdmin = isDirex || (souPC && isLeader)

  const pathsQ = useQuery({ queryKey: ['bevskills', 'paths'], queryFn: getLearningPaths })
  const coursesQ = useQuery({ queryKey: ['bevskills', 'courses'], queryFn: getCourses })
  const progQ = useQuery({ queryKey: ['bevskills', 'my-course-progress'], queryFn: getMyCourseProgress })
  const certsQ = useQuery({ queryKey: ['bevskills', 'my-certs'], queryFn: getMyCertificates })
  const catsQ = useQuery({ queryKey: ['bevskills', 'categories'], queryFn: getCategories })

  const progressByCourse = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of progQ.data ?? []) map.set(p.course_id, p.progress_percentage)
    return map
  }, [progQ.data])

  const courses = coursesQ.data ?? []
  const totalCourses = courses.length
  const completed = (progQ.data ?? []).filter((p) => p.completed).length
  const inProgress = (progQ.data ?? []).filter((p) => p.progress_percentage > 0 && !p.completed)
  const overall = totalCourses ? Math.round((completed / totalCourses) * 100) : 0

  const continueCourses = inProgress
    .map((p) => courses.find((c) => c.id === p.course_id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))

  const coursesByPath = (pathId: string) => courses.filter((c) => c.learning_path_id === pathId)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        icon={GraduationCap}
        title="BevSkills"
        description="Trilhas e cursos para você evoluir dentro do Bevilaqua."
        actions={
          canAdmin ? (
            <Button variant="outline" asChild>
              <Link to="/bevskills/admin">
                <Settings className="size-4" /> Gerenciar
              </Link>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link to="/bevskills/certificados">
                <Award className="size-4" /> Meus certificados
              </Link>
            </Button>
          )
        }
      />

      {/* Resumo do progresso */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
        <Card className="from-primary/10 to-card overflow-hidden bg-gradient-to-br">
          <CardContent className="flex items-center gap-5 p-5">
            <ProgressCircle value={overall} size={92} stroke={9} />
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">
                Olá, {firstName(person.nome)} 👋
              </p>
              <p className="mt-0.5 text-lg font-bold leading-tight">Seu progresso geral</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {completed} de {totalCourses} cursos concluídos
              </p>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-3 gap-4">
          <StatTile icon={PlayCircle} value={inProgress.length} label="Em andamento" />
          <StatTile icon={BookOpen} value={completed} label="Concluídos" />
          <StatTile icon={Award} value={(certsQ.data ?? []).length} label="Certificados" />
        </div>
      </section>

      {/* Continue de onde parou */}
      {continueCourses.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <PlayCircle className="text-primary size-4.5" /> Continue de onde parou
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {continueCourses.map((c) => (
              <CourseCard key={c.id} course={c} progress={progressByCourse.get(c.id) ?? 0} />
            ))}
          </div>
        </section>
      )}

      {/* Trilhas */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Layers className="text-primary size-4.5" /> Trilhas de aprendizagem
          </h2>
        </div>
        {pathsQ.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : (pathsQ.data ?? []).length === 0 ? (
          <EmptyState icon={Layers} title="Nenhuma trilha ainda" description="As trilhas aparecerão aqui em breve." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(pathsQ.data ?? []).map((path) => {
              const list = coursesByPath(path.id)
              const avg = list.length
                ? Math.round(
                    list.reduce((s, c) => s + (progressByCourse.get(c.id) ?? 0), 0) / list.length,
                  )
                : 0
              return (
                <Link
                  key={path.id}
                  to="/bevskills/trilha/$slug"
                  params={{ slug: path.slug }}
                  className="group bg-card hover:border-ring relative flex items-center gap-4 overflow-hidden rounded-xl border p-5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <ProgressCircle value={avg} size={64} stroke={6} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{path.title}</h3>
                      {path.is_required && <Badge variant="warning">Obrigatória</Badge>}
                    </div>
                    {path.description && (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                        {path.description}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-2 text-xs font-medium">
                      {list.length} curso{list.length === 1 ? '' : 's'}
                      {path.estimated_hours ? ` · ${path.estimated_hours}h estimadas` : ''}
                    </p>
                  </div>
                  <ChevronRight className="text-muted-foreground group-hover:text-foreground size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Categorias */}
      {(catsQ.data ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Sparkles className="text-primary size-4.5" /> Categorias
          </h2>
          <div className="flex flex-wrap gap-2">
            {(catsQ.data ?? []).map((cat) => (
              <span
                key={cat.id}
                className="bg-secondary text-secondary-foreground rounded-full px-3 py-1.5 text-sm font-medium"
              >
                {cat.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Todos os cursos */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <BookOpen className="text-primary size-4.5" /> Todos os cursos
        </h2>
        {coursesQ.isPending ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nenhum curso publicado" description="Os cursos aparecerão aqui assim que forem publicados." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} progress={progressByCourse.get(c.id) ?? 0} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
