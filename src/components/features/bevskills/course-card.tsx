import { Link } from '@tanstack/react-router'
import { CheckCircle2, Clock, PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { fmtDuration, LEVEL_BADGE, type Course } from '@/lib/bevskills'
import { ProgressBar } from './progress-bar'

/**
 * Cartão de curso: capa (ou gradiente institucional), nível, título,
 * descrição, duração e barra de progresso do aluno. Micro-interações
 * de hover — elevação, leve escala e zoom na capa.
 */
export function CourseCard({
  course,
  progress = 0,
  className,
}: {
  course: Course
  progress?: number
  className?: string
}) {
  const done = progress >= 100
  const started = progress > 0

  return (
    <Link
      to="/bevskills/curso/$slug"
      params={{ slug: course.slug }}
      className={cn(
        'group bg-card focus-visible:ring-ring/60 relative flex flex-col overflow-hidden rounded-xl border shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2',
        className,
      )}
    >
      {/* Capa */}
      <div className="relative aspect-video overflow-hidden">
        {course.cover_image ? (
          <img
            src={course.cover_image}
            alt=""
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="from-primary/25 via-accent to-card size-full bg-gradient-to-br transition-transform duration-500 group-hover:scale-105" />
        )}
        {/* Overlay play */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/15">
          <PlayCircle className="size-11 text-white opacity-0 drop-shadow transition-all duration-300 group-hover:opacity-90" />
        </div>
        {course.level && (
          <div className="absolute left-2.5 top-2.5">
            <Badge variant={LEVEL_BADGE[course.level] ?? 'neutral'}>{course.level}</Badge>
          </div>
        )}
        {done && (
          <div className="absolute right-2.5 top-2.5">
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="size-3" /> Concluído
            </Badge>
          </div>
        )}
      </div>

      {/* Corpo */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-foreground line-clamp-2 text-sm font-semibold leading-snug">
          {course.title}
        </h3>
        {course.description && (
          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
            {course.description}
          </p>
        )}
        <div className="text-muted-foreground mt-auto flex items-center gap-1.5 pt-1 text-xs">
          <Clock className="size-3.5" />
          {fmtDuration(course.estimated_minutes)}
        </div>
        {started ? (
          <ProgressBar value={progress} showLabel size="sm" />
        ) : (
          <span className="text-muted-foreground/80 text-[11px] font-medium">Não iniciado</span>
        )}
      </div>
    </Link>
  )
}
