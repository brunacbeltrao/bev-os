import { Download, FileText, Paperclip, Video } from 'lucide-react'
import { LESSON_TYPE_LABELS, type LessonDetail } from '@/lib/bevskills'

/** Converte URLs de YouTube/Vimeo em URL de embed; senão retorna null. */
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    if (host.endsWith('youtube.com')) {
      const id = u.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
      if (u.pathname.startsWith('/embed/')) return url
    }
    if (host.endsWith('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      if (id) return `https://player.vimeo.com/video/${id}`
    }
    return null
  } catch {
    return null
  }
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)
}

/** Área principal de consumo de uma aula: vídeo/PDF/texto + anexos. */
export function LessonPlayer({ lesson }: { lesson: LessonDetail }) {
  const url = lesson.video_url ?? ''
  const embed = url ? toEmbedUrl(url) : null
  const direct = url ? isDirectVideo(url) : false
  const isPdf = lesson.lesson_type === 'pdf' && url

  return (
    <div className="flex flex-col gap-5">
      {/* Player / mídia principal */}
      {lesson.lesson_type === 'video' && (
        <div className="bg-card relative aspect-video w-full overflow-hidden rounded-xl border shadow-sm">
          {embed ? (
            <iframe
              src={embed}
              title={lesson.title}
              className="size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : direct ? (
            <video src={url} controls className="size-full bg-black" />
          ) : (
            <div className="from-primary/15 via-accent/60 to-card text-muted-foreground flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br">
              <Video className="size-9" />
              <p className="text-sm font-medium">Vídeo indisponível</p>
              {url && <p className="max-w-md break-all px-6 text-center text-xs opacity-70">{url}</p>}
            </div>
          )}
        </div>
      )}

      {isPdf && (
        <div className="bg-card aspect-[4/3] w-full overflow-hidden rounded-xl border shadow-sm">
          <iframe src={url} title={lesson.title} className="size-full" />
        </div>
      )}

      {/* Conteúdo em texto */}
      {lesson.content && (
        <div className="bg-card rounded-xl border p-5 shadow-xs sm:p-6">
          <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            <FileText className="size-3.5" /> {LESSON_TYPE_LABELS[lesson.lesson_type]}
          </div>
          <div className="text-foreground/90 whitespace-pre-wrap text-sm leading-relaxed">
            {lesson.content}
          </div>
        </div>
      )}

      {/* Nada de mídia nem texto */}
      {lesson.lesson_type !== 'video' && !isPdf && !lesson.content && (
        <div className="text-muted-foreground bg-card rounded-xl border border-dashed p-8 text-center text-sm">
          Esta aula ainda não tem conteúdo publicado.
        </div>
      )}

      {/* Anexos */}
      {lesson.lesson_attachments.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Paperclip className="size-4" /> Materiais da aula
          </h3>
          <div className="flex flex-col gap-2">
            {lesson.lesson_attachments.map((a) => (
              <a
                key={a.id}
                href={a.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-card hover:border-ring hover:bg-accent/40 flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors"
              >
                <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
                  <FileText className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.file_name}</span>
                  {a.file_type && (
                    <span className="text-muted-foreground text-xs uppercase">{a.file_type}</span>
                  )}
                </span>
                <Download className="text-muted-foreground group-hover:text-foreground size-4 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
