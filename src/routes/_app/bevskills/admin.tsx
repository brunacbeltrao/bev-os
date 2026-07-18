/**
 * BevSkills — Área administrativa (/bevskills/admin).
 * Gestão de Trilhas, Cursos e Conteúdo (módulos e aulas). Acesso
 * restrito a Direx e lideranças de Pessoas & Cultura — o RLS do banco
 * é a garantia final; aqui apenas ocultamos a interface.
 */
import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookOpen,
  Eye,
  EyeOff,
  GraduationCap,
  Layers,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { useApp } from '@/lib/app-context'
import {
  adminGetCourses,
  createCourse,
  createLesson,
  createModule,
  createPath,
  deleteCourse,
  deleteLesson,
  deleteModule,
  deletePath,
  getCourseCurriculum,
  getLearningPaths,
  slugify,
  updateCourse,
  updateLesson,
  updateModule,
  updatePath,
  COURSE_LEVELS,
  LESSON_TYPE_LABELS,
  type Course,
  type LearningPath,
  type Lesson,
  type LessonType,
  type Module,
} from '@/lib/bevskills'

export const Route = createFileRoute('/_app/bevskills/admin')({ component: AdminPage })

type Tab = 'trilhas' | 'cursos' | 'conteudo'

const selectCls =
  'border-input bg-card h-9 w-full rounded-md border px-2 text-sm focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:outline-none focus-visible:ring-2'

// ---------- Blocos de formulário reutilizáveis ----------

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

// ============================================================
// Guard
// ============================================================

function AdminPage() {
  const { isDirex, souPC, isLeader } = useApp()
  const canAdmin = isDirex || (souPC && isLeader)
  const [tab, setTab] = useState<Tab>('trilhas')

  if (!canAdmin) {
    return (
      <EmptyState
        icon={Lock}
        title="Acesso restrito"
        description="A administração do BevSkills é exclusiva da Direx e da liderança de Pessoas & Cultura."
        action={
          <Button asChild>
            <Link to="/bevskills">Voltar ao BevSkills</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/bevskills"
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" /> BevSkills
      </Link>

      <PageHeader
        icon={GraduationCap}
        title="Gerenciar BevSkills"
        description="Crie e organize trilhas, cursos e aulas."
        actions={
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'trilhas', label: 'Trilhas' },
              { value: 'cursos', label: 'Cursos' },
              { value: 'conteudo', label: 'Conteúdo' },
            ]}
          />
        }
      />

      {tab === 'trilhas' && <TrilhasTab />}
      {tab === 'cursos' && <CursosTab />}
      {tab === 'conteudo' && <ConteudoTab />}
    </div>
  )
}

// ============================================================
// Trilhas
// ============================================================

function TrilhasTab() {
  const queryClient = useQueryClient()
  const pathsQ = useQuery({ queryKey: ['bevskills', 'paths'], queryFn: getLearningPaths })
  const [editing, setEditing] = useState<LearningPath | 'new' | null>(null)

  const inv = () => queryClient.invalidateQueries({ queryKey: ['bevskills', 'paths'] })
  const delMut = useMutation({ mutationFn: (id: string) => deletePath(id), onSuccess: inv })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}>
          <Plus className="size-4" /> Nova trilha
        </Button>
      </div>

      {pathsQ.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (pathsQ.data ?? []).length === 0 ? (
        <EmptyState icon={Layers} title="Nenhuma trilha criada" />
      ) : (
        <div className="grid gap-3">
          {(pathsQ.data ?? []).map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Layers className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{p.title}</p>
                    {p.is_required && <Badge variant="warning">Obrigatória</Badge>}
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    /{p.slug} · {p.estimated_hours}h
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Excluir a trilha "${p.title}"?`)) delMut.mutate(p.id)
                  }}
                >
                  <Trash2 className="text-destructive size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <PathDialog
          path={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            inv()
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function PathDialog({
  path,
  onClose,
  onSaved,
}: {
  path: LearningPath | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(path?.title ?? '')
  const [slug, setSlug] = useState(path?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!!path)
  const [description, setDescription] = useState(path?.description ?? '')
  const [hours, setHours] = useState(String(path?.estimated_hours ?? 0))
  const [order, setOrder] = useState(String(path?.order_index ?? 0))
  const [required, setRequired] = useState(path?.is_required ?? false)

  const mut = useMutation({
    mutationFn: () => {
      const patch = {
        title,
        slug: slug || slugify(title),
        description: description || null,
        estimated_hours: Number(hours) || 0,
        order_index: Number(order) || 0,
        is_required: required,
      }
      return path ? updatePath(path.id, patch) : createPath(patch)
    },
    onSuccess: onSaved,
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{path ? 'Editar trilha' : 'Nova trilha'}</DialogTitle>
          <DialogDescription>Organize cursos em uma jornada de aprendizagem.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <FormRow label="Título">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
              placeholder="Onboarding BEV"
            />
          </FormRow>
          <FormRow label="Slug (URL)">
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
              placeholder="onboarding-bev"
            />
          </FormRow>
          <FormRow label="Descrição">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Horas estimadas">
              <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} />
            </FormRow>
            <FormRow label="Ordem">
              <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
            </FormRow>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="accent-primary size-4"
            />
            Trilha obrigatória para novos membros
          </label>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!title || mut.isPending}>
            {path ? 'Salvar' : 'Criar trilha'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Cursos
// ============================================================

function CursosTab() {
  const queryClient = useQueryClient()
  const coursesQ = useQuery({ queryKey: ['bevskills', 'admin-courses'], queryFn: adminGetCourses })
  const pathsQ = useQuery({ queryKey: ['bevskills', 'paths'], queryFn: getLearningPaths })
  const [editing, setEditing] = useState<Course | 'new' | null>(null)

  const inv = () => {
    queryClient.invalidateQueries({ queryKey: ['bevskills', 'admin-courses'] })
    queryClient.invalidateQueries({ queryKey: ['bevskills', 'courses'] })
  }
  const delMut = useMutation({ mutationFn: (id: string) => deleteCourse(id), onSuccess: inv })
  const pubMut = useMutation({
    mutationFn: (c: Course) => updateCourse(c.id, { is_published: !c.is_published }),
    onSuccess: inv,
  })
  const pathName = (id: string | null) =>
    (pathsQ.data ?? []).find((p) => p.id === id)?.title ?? 'Sem trilha'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}>
          <Plus className="size-4" /> Novo curso
        </Button>
      </div>

      {coursesQ.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (coursesQ.data ?? []).length === 0 ? (
        <EmptyState icon={BookOpen} title="Nenhum curso criado" />
      ) : (
        <div className="grid gap-3">
          {(coursesQ.data ?? []).map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <BookOpen className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{c.title}</p>
                    {c.is_published ? (
                      <Badge variant="success">Publicado</Badge>
                    ) : (
                      <Badge variant="neutral">Rascunho</Badge>
                    )}
                    {c.level && <Badge variant="secondary">{c.level}</Badge>}
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    /{c.slug} · {pathName(c.learning_path_id)}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  title={c.is_published ? 'Despublicar' : 'Publicar'}
                  onClick={() => pubMut.mutate(c)}
                >
                  {c.is_published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditing(c)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Excluir o curso "${c.title}"? Isso remove módulos e aulas.`))
                      delMut.mutate(c.id)
                  }}
                >
                  <Trash2 className="text-destructive size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <CourseDialog
          course={editing === 'new' ? null : editing}
          paths={pathsQ.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            inv()
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function CourseDialog({
  course,
  paths,
  onClose,
  onSaved,
}: {
  course: Course | null
  paths: LearningPath[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(course?.title ?? '')
  const [slug, setSlug] = useState(course?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!!course)
  const [description, setDescription] = useState(course?.description ?? '')
  const [level, setLevel] = useState(course?.level ?? 'Iniciante')
  const [minutes, setMinutes] = useState(String(course?.estimated_minutes ?? 0))
  const [order, setOrder] = useState(String(course?.order_index ?? 0))
  const [pathId, setPathId] = useState(course?.learning_path_id ?? '')
  const [cover, setCover] = useState(course?.cover_image ?? '')
  const [published, setPublished] = useState(course?.is_published ?? false)

  const mut = useMutation({
    mutationFn: () => {
      const patch = {
        title,
        slug: slug || slugify(title),
        description: description || null,
        level,
        estimated_minutes: Number(minutes) || 0,
        order_index: Number(order) || 0,
        learning_path_id: pathId || null,
        cover_image: cover || null,
        is_published: published,
      }
      return course ? updateCourse(course.id, patch) : createCourse(patch)
    },
    onSuccess: onSaved,
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course ? 'Editar curso' : 'Novo curso'}</DialogTitle>
          <DialogDescription>Defina os dados e a trilha do curso.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <FormRow label="Título">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
            />
          </FormRow>
          <FormRow label="Slug (URL)">
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
            />
          </FormRow>
          <FormRow label="Descrição">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Nível">
              <select className={selectCls} value={level} onChange={(e) => setLevel(e.target.value)}>
                {COURSE_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Trilha">
              <select
                className={selectCls}
                value={pathId}
                onChange={(e) => setPathId(e.target.value)}
              >
                <option value="">Sem trilha</option>
                {paths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </FormRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Duração (minutos)">
              <Input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </FormRow>
            <FormRow label="Ordem">
              <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
            </FormRow>
          </div>
          <FormRow label="URL da capa (opcional)">
            <Input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…" />
          </FormRow>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="accent-primary size-4"
            />
            Publicado (visível para os membros)
          </label>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!title || mut.isPending}>
            {course ? 'Salvar' : 'Criar curso'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Conteúdo (módulos e aulas)
// ============================================================

function ConteudoTab() {
  const coursesQ = useQuery({ queryKey: ['bevskills', 'admin-courses'], queryFn: adminGetCourses })
  const [courseId, setCourseId] = useState<string>('')

  const selected = useMemo(
    () => (coursesQ.data ?? []).find((c) => c.id === courseId) ?? null,
    [coursesQ.data, courseId],
  )

  return (
    <div className="flex flex-col gap-4">
      <FormRow label="Selecione o curso">
        <select className={selectCls} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">—</option>
          {(coursesQ.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
              {c.is_published ? '' : ' (rascunho)'}
            </option>
          ))}
        </select>
      </FormRow>

      {selected ? (
        <ModulesManager course={selected} />
      ) : (
        <EmptyState icon={Layers} title="Escolha um curso" description="Selecione um curso acima para gerenciar módulos e aulas." />
      )}
    </div>
  )
}

function ModulesManager({ course }: { course: Course }) {
  const queryClient = useQueryClient()
  const curriculumQ = useQuery({
    queryKey: ['bevskills', 'admin-curriculum', course.id],
    queryFn: () => getCourseCurriculum(course.id),
  })
  const [moduleEditing, setModuleEditing] = useState<Module | 'new' | null>(null)
  const [lessonEditing, setLessonEditing] = useState<{ module: Module; lesson: Lesson | null } | null>(
    null,
  )

  const inv = () =>
    queryClient.invalidateQueries({ queryKey: ['bevskills', 'admin-curriculum', course.id] })
  const delModule = useMutation({ mutationFn: (id: string) => deleteModule(id), onSuccess: inv })
  const delLesson = useMutation({ mutationFn: (id: string) => deleteLesson(id), onSuccess: inv })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Módulos de “{course.title}”</h3>
        <Button size="sm" onClick={() => setModuleEditing('new')}>
          <Plus className="size-4" /> Novo módulo
        </Button>
      </div>

      {curriculumQ.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (curriculumQ.data ?? []).length === 0 ? (
        <EmptyState icon={Layers} title="Nenhum módulo ainda" />
      ) : (
        (curriculumQ.data ?? []).map((mod, mi) => (
          <div key={mod.id} className="bg-card overflow-hidden rounded-xl border shadow-xs">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <span className="text-muted-foreground text-xs font-semibold uppercase">
                Módulo {mi + 1}
              </span>
              <span className="flex-1 truncate text-sm font-semibold">{mod.title}</span>
              <Button size="icon" variant="ghost" onClick={() => setModuleEditing(mod)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Excluir o módulo "${mod.title}" e suas aulas?`))
                    delModule.mutate(mod.id)
                }}
              >
                <Trash2 className="text-destructive size-4" />
              </Button>
            </div>
            <ul className="divide-y">
              {mod.lessons.map((l) => (
                <li key={l.id} className="flex items-center gap-2 px-4 py-2.5">
                  <Badge variant="secondary">{LESSON_TYPE_LABELS[l.lesson_type]}</Badge>
                  <span className="min-w-0 flex-1 truncate text-sm">{l.title}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setLessonEditing({ module: mod, lesson: l })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Excluir a aula "${l.title}"?`)) delLesson.mutate(l.id)
                    }}
                  >
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </li>
              ))}
              <li className="px-4 py-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setLessonEditing({ module: mod, lesson: null })}
                >
                  <Plus className="size-4" /> Adicionar aula
                </Button>
              </li>
            </ul>
          </div>
        ))
      )}

      {moduleEditing && (
        <ModuleDialog
          courseId={course.id}
          module={moduleEditing === 'new' ? null : moduleEditing}
          onClose={() => setModuleEditing(null)}
          onSaved={() => {
            inv()
            setModuleEditing(null)
          }}
        />
      )}
      {lessonEditing && (
        <LessonDialog
          moduleId={lessonEditing.module.id}
          lesson={lessonEditing.lesson}
          onClose={() => setLessonEditing(null)}
          onSaved={() => {
            inv()
            setLessonEditing(null)
          }}
        />
      )}
    </div>
  )
}

function ModuleDialog({
  courseId,
  module,
  onClose,
  onSaved,
}: {
  courseId: string
  module: Module | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(module?.title ?? '')
  const [description, setDescription] = useState(module?.description ?? '')
  const [order, setOrder] = useState(String(module?.order_index ?? 0))

  const mut = useMutation({
    mutationFn: () => {
      const patch = { title, description: description || null, order_index: Number(order) || 0 }
      return module
        ? updateModule(module.id, patch)
        : createModule({ course_id: courseId, ...patch })
    },
    onSuccess: onSaved,
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{module ? 'Editar módulo' : 'Novo módulo'}</DialogTitle>
          <DialogDescription>Agrupe as aulas do curso.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <FormRow label="Título">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormRow>
          <FormRow label="Descrição">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
          <FormRow label="Ordem">
            <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
          </FormRow>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!title || mut.isPending}>
            {module ? 'Salvar' : 'Criar módulo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LessonDialog({
  moduleId,
  lesson,
  onClose,
  onSaved,
}: {
  moduleId: string
  lesson: Lesson | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(lesson?.title ?? '')
  const [description, setDescription] = useState(lesson?.description ?? '')
  const [type, setType] = useState<LessonType>(lesson?.lesson_type ?? 'video')
  const [videoUrl, setVideoUrl] = useState(lesson?.video_url ?? '')
  const [content, setContent] = useState(lesson?.content ?? '')
  const [duration, setDuration] = useState(String(lesson?.duration_minutes ?? 0))
  const [order, setOrder] = useState(String(lesson?.order_index ?? 0))
  const [preview, setPreview] = useState(lesson?.is_preview ?? false)

  const mut = useMutation({
    mutationFn: () => {
      const patch = {
        title,
        description: description || null,
        lesson_type: type,
        video_url: videoUrl || null,
        content: content || null,
        duration_minutes: Number(duration) || 0,
        order_index: Number(order) || 0,
        is_preview: preview,
      }
      return lesson ? updateLesson(lesson.id, patch) : createLesson({ module_id: moduleId, ...patch })
    },
    onSuccess: onSaved,
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lesson ? 'Editar aula' : 'Nova aula'}</DialogTitle>
          <DialogDescription>Vídeo, texto, PDF ou material de apoio.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <FormRow label="Título">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Tipo">
              <select
                className={selectCls}
                value={type}
                onChange={(e) => setType(e.target.value as LessonType)}
              >
                {(Object.keys(LESSON_TYPE_LABELS) as LessonType[]).map((t) => (
                  <option key={t} value={t}>
                    {LESSON_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Duração (minutos)">
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </FormRow>
          </div>
          {(type === 'video' || type === 'pdf') && (
            <FormRow label={type === 'video' ? 'URL do vídeo (YouTube, Vimeo ou .mp4)' : 'URL do PDF'}>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://…"
              />
            </FormRow>
          )}
          <FormRow label="Conteúdo em texto (opcional)">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-28"
            />
          </FormRow>
          <FormRow label="Descrição curta (opcional)">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
          <div className="grid grid-cols-2 items-end gap-3">
            <FormRow label="Ordem">
              <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
            </FormRow>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={preview}
                onChange={(e) => setPreview(e.target.checked)}
                className="accent-primary size-4"
              />
              Prévia gratuita
            </label>
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!title || mut.isPending}>
            {lesson ? 'Salvar' : 'Criar aula'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
