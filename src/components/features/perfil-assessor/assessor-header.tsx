/**
 * Header Fixo do Perfil do Assessor (PRD §4) — o raio-X de 3 segundos:
 * quem é a pessoa, há quanto tempo está no BEV, para onde quer ir e
 * como está a elegibilidade ao Banco de Talentos.
 */
import { useState } from 'react'
import { Briefcase, Check, Compass, Info, ShieldCheck, ShieldAlert, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ROLE_LABELS } from '@/lib/org'
import { initials } from '@/lib/utils'
import { tempoDeBev, type Elegibilidade, type PerfilPessoa } from '@/lib/perfil-assessor'

export function AssessorHeader({
  pessoa,
  ciclos,
  focoArea,
  buscaEstagio,
  elegibilidade,
  cicloNome,
}: {
  pessoa: PerfilPessoa
  ciclos: number
  focoArea: string | null
  buscaEstagio: boolean
  elegibilidade?: Elegibilidade
  cicloNome: string
}) {
  const [aberto, setAberto] = useState(false)
  const principal = pessoa.occupations.find((o) => !o.is_hibrido) ?? pessoa.occupations[0]
  const hibrida = pessoa.occupations.find((o) => o.is_hibrido && o.id !== principal?.id)
  const elegivel = elegibilidade?.elegivel ?? false

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar className="size-14 shrink-0">
            {pessoa.foto_url && <AvatarImage src={pessoa.foto_url} alt={pessoa.nome} />}
            <AvatarFallback className="text-base">{initials(pessoa.nome)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight">{pessoa.nome}</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {principal ? (
                <>
                  {ROLE_LABELS[principal.role]} · {principal.subarea.nome}
                  <span className="hidden sm:inline"> · {principal.directorate.nome}</span>
                </>
              ) : (
                'Sem vínculo neste ciclo'
              )}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Chip icon={Briefcase} texto={tempoDeBev(pessoa.entrou_em, ciclos)} />
              <Chip
                icon={Compass}
                texto={focoArea ? `Foco de PDI: ${focoArea}` : 'PDI sem foco definido'}
                atenuado={!focoArea}
              />
              {buscaEstagio && (
                <Badge variant="info" className="py-1">
                  Busca estágio neste ciclo
                </Badge>
              )}
              {hibrida && (
                <Badge variant="secondary" className="py-1">
                  Híbrido: {hibrida.subarea.nome}
                </Badge>
              )}
            </div>
          </div>

          {elegibilidade && (
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => setAberto((v) => !v)}
                aria-expanded={aberto}
                className={`flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85 sm:w-auto ${
                  elegivel
                    ? 'bg-status-success-bg text-status-success'
                    : 'bg-status-danger-bg text-status-danger'
                }`}
              >
                {elegivel ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
                {elegivel ? 'Elegível ao Banco de Talentos' : 'Inelegível ao Banco de Talentos'}
                <Info className="size-3 opacity-60" />
              </button>
            </div>
          )}
        </div>

        {aberto && elegibilidade && (
          <div className="bg-muted/40 mt-4 rounded-xl border p-3.5">
            <p className="text-muted-foreground mb-2.5 text-xs">
              Critérios objetivos do ciclo {cicloNome}. O sistema calcula sozinho — ninguém marca
              na mão.
            </p>
            <ul className="flex flex-col gap-2">
              {elegibilidade.criterios.map((c) => (
                <li key={c.chave} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${
                      c.ok
                        ? 'bg-status-success-bg text-status-success'
                        : 'bg-status-danger-bg text-status-danger'
                    }`}
                  >
                    {c.ok ? <Check className="size-2.5" /> : <X className="size-2.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className={c.ok ? '' : 'font-medium'}>{c.label}</span>
                    <span className="text-muted-foreground"> — {c.detalhe}</span>
                  </span>
                </li>
              ))}
            </ul>
            {elegibilidade.override && (
              <p className="text-muted-foreground mt-3 border-t pt-2.5 text-xs">
                <strong className="text-foreground">Decisão manual da P&C:</strong>{' '}
                {elegibilidade.override_motivo || 'sem justificativa registrada'}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Chip({
  icon: Icon,
  texto,
  atenuado,
}: {
  icon: typeof Briefcase
  texto: string
  atenuado?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        atenuado ? 'text-muted-foreground border-dashed' : 'text-foreground'
      }`}
    >
      <Icon className="size-3.5 shrink-0 opacity-70" />
      {texto}
    </span>
  )
}
