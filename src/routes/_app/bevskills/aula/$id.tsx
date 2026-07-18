/**
 * BevSkills — Player de aula (/bevskills/aula/$id).
 * Consumo focado: player/conteúdo + anexos à esquerda, navegação entre
 * as aulas do curso à direita. Botão flutuante "Marcar como concluída".
 */
import { useMemo } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  PlayCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-context'
import { LessonPlayer } from '@/components/features/bevskills/lesson-player'
import {
  fmtDuration,
  getCourseCurriculum,
  getLesson,
  getMyLessonProgress,
  LESSON_TYPE_LABELS,
  setLessonCompleted,
} from '@/lib/bevskills'

export const Route = createFileRoute('/_app/bevskills/aula/$id')({ component: AulaPage })

function AulaPage() {
  const { id } = Route.useParams()
  const { session } = useApp()
  const uid = session.user.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const lessonQ = useQuery({
    queryKey: ['bevskills', 'lesson', id],
    queryFn: () => getLesson(id),
  })
  const courseId = lessonQ.data?.module.course.id
  const curriculumQ = useQuery({
    queryKey: ['bevskills', 'curriculum', courseId],
    queryFn: () => getCourseCurriculum(courseId!),
    enabled: !!courseId,
  })
  const progQ = useQuery({
    queryKey: ['bevskills', 'my-lesson-progress'],
    queryFn: getMyLessonProgress,
  })

  const completedIds = useMemo(() => {
    const s = new Set<string>()
    for (const p of progQ.data ?? []) if (p.completed) s.add(p.lesson_id)
    return s
  }, [progQ.data])

  const flatLessons = useMemo(
    () => (curriculumQ.data ?? []).flatMap((m) => m.lessons),
    [curriculumQ.data],
  )
  const idx = flatLessons.findIndex((l) => l.id === id)
  const prev = idx > 0 ? flatLessons[idx - 1] : null
  const next = idx >= 0 && idx < flatLessons.length - 1 ? flatLessons[idx + 1] : null

  const toggleMut = useMutation({
    mutationFn: (completed: boolean) => setLessonCompleted(uid, id, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bevskills', 'my-lesson-progress'] })
      queryClient.invalidateQueries({ queryKey: ['bevskills', 'my-course-progress'] })
      queryClient.invalidateQueries({ queryKey: ['bevskills', 'my-certs'] })
    },
  })

  if (lessonQ.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!lessonQ.data) {
    return (
      <EmptyState
        icon={PlayCircle}
        title="Aula não encontrada"
        action={
          <Link to="/bevskills" className="text-primary text-sm font-medium hover:underline">
            Voltar ao BevSkills
          </Link>
        }
      />
    )
  }

  const lesson = lessonQ.data
  const course = lesson.module.course
  const isDone = completedIds.has(id)

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/bevskills/curso/$slug"
        params={{ slug: course.slug }}
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" /> {course.title}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Conteúdo principal */}
        <div className="flex min-w-0 flex-col gap-5">
          <LessonPlayer lesson={lesson} />

          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
              <span>{LESSON_TYPE_LABELS[lesson.lesson_type]}</span>
              {lesson.duration_minutes > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" /> {fmtDuration(lesson.duration_minutes)}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{lesson.title}</h1>
            {lesson.description && (
              <p className="text-muted-foreground text-sm leading-relaxed">{lesson.description}</p>
            )}
          </div>

          {/* Navegação anterior / próxima */}
          <div className="flex items-center justify-between gap-3 border-t pt-4">
            {prev ? (
              <Button variant="outline" asChild>
                <Link to="/bevskills/aula/$id" params={{ id: prev.id }}>
                  <ChevronLeft className="size-4" /> Anterior
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button variant="outline" asChild>
                <Link to="/bevskills/aula/$id" params={{ id: next.id }}>
                  Próxima <ChevronRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link to="/bevskills/curso/$slug" params={{ slug: course.slug }}>
                  Concluir curso <ChevronRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar de navegação do curso */}
        <aside className="lg:sticky lg:top-20 lg:h-fit">
          <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
            <div className="border-b px-4 py-3">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Conteúdo do curso
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold">{course.title}</p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {(curriculumQ.data ?? []).map((mod, mi) => (
                <div key={mod.id} className="border-b last:border-b-0">
                  <div className="text-muted-foreground bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide">
                    {mi + 1}. {mod.title}
                  </div>
                  <ul>
                    {mod.lessons.map((l) => {
                      const active = l.id === id
                      const done = completedIds.has(l.id)
                      return (
                        <li key={l.id}>
                          <Link
                            to="/bevskills/aula/$id"
                            params={{ id: l.id }}
                            className={cn(
                              'flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors',
                              active
                                ? 'bg-accent text-accent-foreground font-medium'
                                : 'hover:bg-accent/40',
                            )}
                          >
                            {done ? (
                              <CheckCircle2 className="text-status-success size-4 shrink-0" />
                            ) : active ? (
                              <PlayCircle className="text-primary size-4 shrink-0" />
                            ) : (
                              <Circle className="text-muted-foreground/50 size-4 shrink-0" />
                            )}
                            <span className="min-w-0 flex-1 truncate">{l.title}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Botão flutuante — marcar como concluída */}
      <button
        onClick={() => {
          const willComplete = !isDone
          toggleMut.mutate(willComplete, {
            onSuccess: () => {
              if (willComplete && next) {
                setTimeout(
                  () => navigate({ to: '/bevskills/aula/$id', params: { id: next.id } }),
                  400,
                )
              }
            },
          })
        }}
        disabled={toggleMut.isPending}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:scale-95 disabled:opacity-70',
          isDone
            ? 'bg-status-success-bg text-status-success ring-status-success/30 ring-1'
            : 'bg-primary text-primary-foreground hover:bg-primary/90',
        )}
      >
        {toggleMut.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isDone ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <Circle className="size-4" />
        )}
        {isDone ? 'Aula concluída' : 'Marcar como concluída'}
      </button>
    </div>
  )
}
