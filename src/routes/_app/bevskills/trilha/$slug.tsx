/**
 * BevSkills — Detalhe da trilha (/bevskills/trilha/$slug).
 * Cabeçalho da trilha + lista de cursos com progresso e indicação
 * visual de concluído/pendente.
 */
import { useMemo } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, Clock, Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { CourseCard } from '@/components/features/bevskills/course-card'
import { ProgressCircle } from '@/components/features/bevskills/progress-circle'
import {
  getCoursesByPath,
  getLearningPathBySlug,
  getMyCourseProgress,
} from '@/lib/bevskills'

export const Route = createFileRoute('/_app/bevskills/trilha/$slug')({ component: TrilhaPage })

function TrilhaPage() {
  const { slug } = Route.useParams()

  const pathQ = useQuery({
    queryKey: ['bevskills', 'path', slug],
    queryFn: () => getLearningPathBySlug(slug),
  })
  const coursesQ = useQuery({
    queryKey: ['bevskills', 'path-courses', pathQ.data?.id],
    queryFn: () => getCoursesByPath(pathQ.data!.id),
    enabled: !!pathQ.data,
  })
  const progQ = useQuery({
    queryKey: ['bevskills', 'my-course-progress'],
    queryFn: getMyCourseProgress,
  })

  const progressByCourse = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of progQ.data ?? []) map.set(p.course_id, p.progress_percentage)
    return map
  }, [progQ.data])

  if (pathQ.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!pathQ.data) {
    return (
      <EmptyState
        icon={Layers}
        title="Trilha não encontrada"
        description="Ela pode ter sido removida ou o link está incorreto."
        action={
          <Link to="/bevskills" className="text-primary text-sm font-medium hover:underline">
            Voltar ao BevSkills
          </Link>
        }
      />
    )
  }

  const path = pathQ.data
  const courses = coursesQ.data ?? []
  const completed = courses.filter((c) => (progressByCourse.get(c.id) ?? 0) >= 100).length
  const overall = courses.length
    ? Math.round(
        courses.reduce((s, c) => s + (progressByCourse.get(c.id) ?? 0), 0) / courses.length,
      )
    : 0

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/bevskills"
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" /> BevSkills
      </Link>

      {/* Cabeçalho da trilha */}
      <Card className="from-primary/10 via-accent/40 to-card overflow-hidden bg-gradient-to-br">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <ProgressCircle value={overall} size={104} stroke={10} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-accent text-accent-foreground flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
                <Layers className="size-3.5" /> Trilha
              </span>
              {path.is_required && <Badge variant="warning">Obrigatória</Badge>}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{path.title}</h1>
            {path.description && (
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                {path.description}
              </p>
            )}
            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <BookOpen className="size-3.5" /> {courses.length} curso
                {courses.length === 1 ? '' : 's'}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" /> {path.estimated_hours}h estimadas
              </span>
              <span>
                {completed}/{courses.length} concluídos
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cursos da trilha */}
      {coursesQ.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nenhum curso nesta trilha ainda" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c, i) => (
            <div key={c.id} className="relative">
              <span className="bg-primary text-primary-foreground absolute -left-1 -top-1 z-10 flex size-7 items-center justify-center rounded-full text-xs font-bold shadow-sm">
                {i + 1}
              </span>
              <CourseCard course={c} progress={progressByCourse.get(c.id) ?? 0} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
