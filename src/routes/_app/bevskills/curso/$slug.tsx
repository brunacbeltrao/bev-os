/**
 * BevSkills — Página do curso (/bevskills/curso/$slug).
 * Cabeçalho + barra de progresso geral + lista de módulos e aulas.
 */
import { useMemo } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Layers,
  Play,
  PlayCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { ProgressBar } from '@/components/features/bevskills/progress-bar'
import {
  fmtDuration,
  getCourseBySlug,
  getCourseCategories,
  getCourseCurriculum,
  getMyCourseProgress,
  getMyLessonProgress,
  LEVEL_BADGE,
  type LessonType,
} from '@/lib/bevskills'

export const Route = createFileRoute('/_app/bevskills/curso/$slug')({ component: CursoPage })

const TYPE_ICON: Record<LessonType, typeof Play> = {
  video: PlayCircle,
  text: FileText,
  pdf: FileText,
  attachment: FileText,
}

function CursoPage() {
  const { slug } = Route.useParams()

  const courseQ = useQuery({
    queryKey: ['bevskills', 'course', slug],
    queryFn: () => getCourseBySlug(slug),
  })
  const curriculumQ = useQuery({
    queryKey: ['bevskills', 'curriculum', courseQ.data?.id],
    queryFn: () => getCourseCurriculum(courseQ.data!.id),
    enabled: !!courseQ.data,
  })
  const catsQ = useQuery({
    queryKey: ['bevskills', 'course-cats', courseQ.data?.id],
    queryFn: () => getCourseCategories(courseQ.data!.id),
    enabled: !!courseQ.data,
  })
  const lessonProgQ = useQuery({
    queryKey: ['bevskills', 'my-lesson-progress'],
    queryFn: getMyLessonProgress,
  })
  const courseProgQ = useQuery({
    queryKey: ['bevskills', 'my-course-progress'],
    queryFn: getMyCourseProgress,
  })

  const completedIds = useMemo(() => {
    const s = new Set<string>()
    for (const p of lessonProgQ.data ?? []) if (p.completed) s.add(p.lesson_id)
    return s
  }, [lessonProgQ.data])

  const modules = curriculumQ.data ?? []
  const allLessons = useMemo(() => modules.flatMap((m) => m.lessons), [modules])
  const totalLessons = allLessons.length
  const doneLessons = allLessons.filter((l) => completedIds.has(l.id)).length
  const pct =
    courseProgQ.data?.find((p) => p.course_id === courseQ.data?.id)?.progress_percentage ??
    (totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0)

  const nextLesson = allLessons.find((l) => !completedIds.has(l.id)) ?? allLessons[0]

  if (courseQ.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  if (!courseQ.data) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Curso não encontrado"
        action={
          <Link to="/bevskills" className="text-primary text-sm font-medium hover:underline">
            Voltar ao BevSkills
          </Link>
        }
      />
    )
  }

  const course = courseQ.data

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/bevskills"
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" /> BevSkills
      </Link>

      {/* Cabeçalho do curso */}
      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-[1.4fr_1fr]">
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-center gap-2">
              {course.level && (
                <Badge variant={LEVEL_BADGE[course.level] ?? 'neutral'}>{course.level}</Badge>
              )}
              {(catsQ.data ?? []).map((c) => (
                <Badge key={c.id} variant="secondary">
                  {c.name}
                </Badge>
              ))}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
              {course.description && (
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {course.description}
                </p>
              )}
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <Layers className="size-3.5" /> {modules.length} módulo
                {modules.length === 1 ? '' : 's'}
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="size-3.5" /> {totalLessons} aula
                {totalLessons === 1 ? '' : 's'}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" /> {fmtDuration(course.estimated_minutes)}
              </span>
            </div>

            <div className="mt-1 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">
                  {doneLessons}/{totalLessons} aulas concluídas
                </span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <ProgressBar value={pct} />
            </div>

            {nextLesson && (
              <Button asChild className="mt-1 w-fit">
                <Link to="/bevskills/aula/$id" params={{ id: nextLesson.id }}>
                  <Play className="size-4" />
                  {pct > 0 && pct < 100 ? 'Continuar curso' : pct >= 100 ? 'Revisar curso' : 'Começar curso'}
                </Link>
              </Button>
            )}
          </CardContent>

          {/* Capa lateral */}
          <div className="relative hidden min-h-full md:block">
            {course.cover_image ? (
              <img src={course.cover_image} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <div className="from-primary/30 via-accent to-card absolute inset-0 bg-gradient-to-br" />
            )}
          </div>
        </div>
      </Card>

      {/* Currículo */}
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">Conteúdo do curso</h2>
        {curriculumQ.isPending ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : modules.length === 0 ? (
          <EmptyState icon={Layers} title="Este curso ainda não tem conteúdo" />
        ) : (
          modules.map((mod, mi) => (
            <div key={mod.id} className="bg-card overflow-hidden rounded-xl border shadow-xs">
              <div className="border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Módulo {mi + 1}
                  </span>
                </div>
                <h3 className="mt-0.5 font-semibold">{mod.title}</h3>
                {mod.description && (
                  <p className="text-muted-foreground mt-0.5 text-xs">{mod.description}</p>
                )}
              </div>
              <ul className="divide-y">
                {mod.lessons.map((lesson) => {
                  const isDone = completedIds.has(lesson.id)
                  const Icon = TYPE_ICON[lesson.lesson_type]
                  return (
                    <li key={lesson.id}>
                      <Link
                        to="/bevskills/aula/$id"
                        params={{ id: lesson.id }}
                        className="group hover:bg-accent/40 flex items-center gap-3 px-4 py-3 transition-colors"
                      >
                        {isDone ? (
                          <CheckCircle2 className="text-status-success size-5 shrink-0" />
                        ) : (
                          <Circle className="text-muted-foreground/50 size-5 shrink-0" />
                        )}
                        <Icon className="text-muted-foreground size-4 shrink-0" />
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-sm',
                            isDone ? 'text-muted-foreground' : 'font-medium',
                          )}
                        >
                          {lesson.title}
                          {lesson.is_preview && (
                            <span className="text-primary ml-2 text-[11px] font-semibold uppercase">
                              prévia
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {lesson.duration_minutes ? fmtDuration(lesson.duration_minutes) : ''}
                        </span>
                      </Link>
                    </li>
                  )
                })}
                {mod.lessons.length === 0 && (
                  <li className="text-muted-foreground px-4 py-3 text-xs">Sem aulas neste módulo.</li>
                )}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
