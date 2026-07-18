/**
 * BevSkills — Galeria de certificados (/bevskills/certificados).
 * Certificados conquistados pelo usuário, emitidos automaticamente
 * pelo banco ao concluir 100% de um curso.
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Award, Download, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useApp } from '@/lib/app-context'
import { fmtDate } from '@/lib/use-context-scope'
import { getMyCertificates } from '@/lib/bevskills'

export const Route = createFileRoute('/_app/bevskills/certificados')({ component: CertificadosPage })

function CertificadosPage() {
  const { person } = useApp()
  const certsQ = useQuery({ queryKey: ['bevskills', 'my-certs'], queryFn: getMyCertificates })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Award}
        title="Meus certificados"
        description="Conquistas emitidas ao concluir 100% de um curso."
        actions={
          <Button variant="outline" asChild>
            <Link to="/bevskills">
              <GraduationCap className="size-4" /> Ir para cursos
            </Link>
          </Button>
        }
      />

      {certsQ.isPending ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : (certsQ.data ?? []).length === 0 ? (
        <EmptyState
          icon={Award}
          title="Nenhum certificado ainda"
          description="Conclua um curso por completo para ganhar seu primeiro certificado."
          action={
            <Button asChild>
              <Link to="/bevskills">Explorar cursos</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {(certsQ.data ?? []).map((cert) => (
            <div
              key={cert.id}
              className="group from-primary/10 via-card to-accent/30 relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-br p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            >
              {/* Selo decorativo */}
              <div className="bg-primary/10 pointer-events-none absolute -right-8 -top-8 size-32 rounded-full blur-2xl" />
              <div className="flex items-start justify-between">
                <span className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl shadow-sm">
                  <Award className="size-6" />
                </span>
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Certificado
                </span>
              </div>

              <div className="mt-5">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Concedido a
                </p>
                <p className="text-lg font-bold">{person.nome}</p>
              </div>

              <div className="mt-3">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Curso concluído
                </p>
                <p className="font-semibold">{cert.course?.title ?? 'Curso'}</p>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3 border-t pt-4">
                <div className="min-w-0">
                  <p className="text-muted-foreground font-mono text-xs">{cert.certificate_code}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Emitido em {fmtDate(cert.issued_at)}
                  </p>
                </div>
                {cert.file_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={cert.file_url} target="_blank" rel="noopener noreferrer">
                      <Download className="size-4" /> PDF
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
