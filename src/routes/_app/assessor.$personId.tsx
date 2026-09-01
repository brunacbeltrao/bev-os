/**
 * /assessor/$personId — Perfil do Assessor (PRD §11).
 * Abre a partir de Meus Liderados. A aba ativa vive na URL (?tab=),
 * então dá para mandar o link direto de uma aba para outra pessoa.
 */
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/app-context'
import {
  PerfilAssessor,
  type AbaPerfil,
} from '@/components/features/perfil-assessor/perfil-assessor'

const ABAS_VALIDAS: AbaPerfil[] = ['entregas', 'lideranca', 'encerramento']

export const Route = createFileRoute('/_app/assessor/$personId')({
  validateSearch: (search: Record<string, unknown>): { tab: AbaPerfil } => ({
    tab: ABAS_VALIDAS.includes(search.tab as AbaPerfil) ? (search.tab as AbaPerfil) : 'entregas',
  }),
  component: AssessorPage,
})

function AssessorPage() {
  const { personId } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = useNavigate()
  const { isLeader, souPC, person } = useApp()

  if (!isLeader && !souPC && person.id !== personId) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <Lock className="text-muted-foreground mx-auto mb-3 size-8" />
        <h1 className="text-lg font-semibold">Somente lideranças</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          O perfil de um membro é visível para a liderança dele, para a Direx e para Pessoas e
          Cultura.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2 mb-3">
        <Link to="/pdi">
          <ArrowLeft className="size-4" />
          Voltar ao PDI
        </Link>
      </Button>

      <PerfilAssessor
        personId={personId}
        aba={tab}
        onAbaChange={(a) =>
          navigate({ to: '/assessor/$personId', params: { personId }, search: { tab: a } })
        }
      />
    </div>
  )
}
