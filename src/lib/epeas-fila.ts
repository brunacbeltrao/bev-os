/**
 * Quem responde pelo contrato agora, e de quem é a fila.
 *
 * Antes disto, "Precisa de mim" era montado por FASE: todo contrato em etapa
 * de Gestão aparecia para toda a Gestão. Quando a fila é de todo mundo, ela
 * não é de ninguém — e foi assim que 31 contratos ficaram parados na mesma
 * etapa sem que ninguém se sentisse cobrado.
 *
 * Aqui o caminho é o inverso: a etapa declara um PAPEL, o papel mais a
 * alocação do contrato resolvem PESSOAS, e cada item da fila carrega o
 * motivo de estar ali.
 *
 * Este arquivo é puro de propósito — sem Supabase e sem relógio. Tudo entra
 * por parâmetro, porque a invariante que ele precisa garantir só se testa
 * assim: contrato atrasado aparece na fila de pelo menos uma pessoa.
 */

export type Papel =
  | 'comercial'
  | 'gestao'
  | 'gerente_nucleo'
  | 'scrum_master'
  | 'assessor_projeto'

export const PAPEL_LABELS: Record<Papel, string> = {
  comercial: 'Comercial',
  gestao: 'Assessor de Gestão',
  gerente_nucleo: 'Gerente de núcleo',
  scrum_master: 'Scrum master',
  assessor_projeto: 'Assessor de projeto',
}

export type Estado = 'em_execucao' | 'pausado' | 'distratado' | 'cancelado' | 'concluido'

/**
 * `em_execucao` na tela é "Em andamento", de propósito.
 *
 * O valor no banco segue `em_execucao`, como especificado, mas já existe uma
 * ETAPA chamada "Em execução" (`projetos_em_execucao`), e um contrato em
 * "Formulário conferido" está no estado em_execucao sem estar naquela etapa.
 * Dois "em execução" com significados diferentes na mesma tela é confusão
 * garantida — o rótulo separa o que o valor não separa.
 */
export const ESTADO_LABELS: Record<Estado, string> = {
  em_execucao: 'Em andamento',
  pausado: 'Pausado',
  distratado: 'Distratado',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
}

/** Estados que continuam na carteira ativa e continuam sendo cobrados. */
export const ESTADOS_ATIVOS: readonly Estado[] = ['em_execucao', 'pausado']

/** Quem está alocado no contrato, por papel. */
export interface Alocacao {
  comercial: string | null
  gestao: string | null
  gerente_nucleo: string | null
  scrum_master: string | null
  assessor_projeto: string[]
}

/**
 * Resolve o papel para pessoas.
 *
 * Devolve lista porque `assessor_projeto` é o time inteiro: quando a etapa é
 * do time, a pendência é de todos eles, não de um eleito arbitrariamente.
 * Lista vazia significa etapa sem dono — que é erro, não ausência benigna.
 */
export function resolverPapel(alocacao: Alocacao, papel: Papel): string[] {
  if (papel === 'assessor_projeto') return alocacao.assessor_projeto.filter(Boolean)
  const id = alocacao[papel]
  return id ? [id] : []
}

export type MotivoFila =
  | 'responsavel'
  | 'mencionado'
  | 'atrasado'
  | 'documento_faltando'
  | 'escalonamento'
  | 'sem_responsavel'

export const MOTIVO_LABELS: Record<MotivoFila, string> = {
  responsavel: 'Você responde por esta etapa',
  mencionado: 'Você foi citado',
  atrasado: 'Atrasado sob sua responsabilidade',
  documento_faltando: 'Falta documento que é seu',
  escalonamento: 'Escalonado para você',
  sem_responsavel: 'Etapa sem responsável',
}

/** Peso para ordenar a fila. Maior aparece primeiro. */
const PESO: Record<MotivoFila, number> = {
  sem_responsavel: 60,
  escalonamento: 50,
  atrasado: 40,
  documento_faltando: 30,
  mencionado: 20,
  responsavel: 10,
}

/**
 * Um degrau de escalonamento: passado tanto atraso, sobe para tal papel — e,
 * quando o papel não resolve ninguém, para a diretoria nomeada.
 */
export interface Degrau {
  dias_uteis: number
  papel: Papel
  diretoria_slug: string | null
  rotulo: string
}

/** O que o motor de fila precisa saber sobre um contrato. */
export interface SituacaoContrato {
  contratoId: string
  estado: Estado
  alocacao: Alocacao
  /** Papel que a etapa atual declara. */
  papelDaEtapa: Papel
  /** Nome da etapa, para a frase do item. */
  etapaLabel: string
  /** Dias úteis de atraso. 0 ou menos = não está atrasado. */
  atrasoDiasUteis: number
  /** Requisitos de documento ainda não cumpridos nesta etapa. */
  documentosFaltando: string[]
  /** Pessoas citadas com @ que ainda não leram. */
  mencionados: string[]
}

/**
 * Para quem este contrato deve aparecer.
 *
 * `diretoriaSlug` em vez de `pessoaId` significa "toda a diretoria X" — é o
 * último degrau, e existe justamente para que nunca sobre contrato atrasado
 * sem ninguém olhando.
 */
export interface Destinatario {
  pessoaId: string | null
  diretoriaSlug: string | null
  motivo: MotivoFila
  explicacao: string
  peso: number
}

/**
 * A diretoria que recebe o que não tem dono.
 *
 * Negócios responde pela carteira de contratos de ponta a ponta, então é
 * para lá que vai tanto o escalonamento final quanto a etapa órfã.
 */
export const DIRETORIA_ULTIMA_INSTANCIA = 'negocios'

/**
 * Quem precisa ver este contrato, e por quê.
 *
 * A garantia estrutural está no bloco `sem_responsavel`: se a alocação não
 * resolve ninguém, o contrato não some — ele cai na Diretoria de Negócios
 * com o motivo explícito. É isso que faz a invariante valer mesmo para
 * contrato migrado sem alocação nenhuma.
 */
export function destinatarios(
  s: SituacaoContrato,
  degraus: readonly Degrau[] = [],
): Destinatario[] {
  // Contrato fora da carteira ativa não cobra ninguém. Distratado não tem
  // prazo a cumprir, e concluído já cumpriu.
  if (!ESTADOS_ATIVOS.includes(s.estado)) return []

  const saida: Destinatario[] = []
  const responsaveis = resolverPapel(s.alocacao, s.papelDaEtapa)
  const atrasado = s.atrasoDiasUteis > 0

  const add = (
    pessoaId: string | null,
    diretoriaSlug: string | null,
    motivo: MotivoFila,
    explicacao: string,
  ) => saida.push({ pessoaId, diretoriaSlug, motivo, explicacao, peso: PESO[motivo] })

  if (responsaveis.length === 0) {
    // Erro visível, não silêncio: alguém precisa alocar, e enquanto não
    // alocar é a Diretoria de Negócios que carrega.
    add(
      null,
      DIRETORIA_ULTIMA_INSTANCIA,
      'sem_responsavel',
      `"${s.etapaLabel}" espera ${PAPEL_LABELS[s.papelDaEtapa]}, e não há ninguém nesse papel neste contrato.`,
    )
  } else {
    for (const id of responsaveis) {
      if (atrasado) {
        add(
          id,
          null,
          'atrasado',
          `"${s.etapaLabel}" está ${s.atrasoDiasUteis} dia(s) útil(eis) além do previsto.`,
        )
      } else {
        add(id, null, 'responsavel', `Você responde por "${s.etapaLabel}".`)
      }
      for (const doc of s.documentosFaltando) {
        add(id, null, 'documento_faltando', `Falta anexar: ${doc}.`)
      }
    }
  }

  // Menção é independente de papel: quem foi citado precisa ver, mesmo sem
  // responder pela etapa.
  for (const id of s.mencionados) {
    add(id, null, 'mencionado', 'Citaram você na conversa deste contrato.')
  }

  // Escalonamento: cada degrau vencido acrescenta destinatário, sem tirar
  // ninguém. Quem estava cobrado continua cobrado.
  if (atrasado) {
    for (const d of degraus) {
      if (s.atrasoDiasUteis <= d.dias_uteis) continue
      const acima = resolverPapel(s.alocacao, d.papel)
      for (const id of acima) {
        add(id, null, 'escalonamento', `${d.rotulo}: "${s.etapaLabel}".`)
      }
      // Papel que não resolve cai para a diretoria do degrau, quando houver.
      if (acima.length === 0 && d.diretoria_slug) {
        add(null, d.diretoria_slug, 'escalonamento', `${d.rotulo}: "${s.etapaLabel}".`)
      }
    }
  }

  return saida
}

/**
 * A fila de uma pessoa.
 *
 * `diretoriasDaPessoa` traz os slugs das diretorias em que ela atua, para os
 * itens escalonados que são da diretoria e não de alguém em particular.
 */
export function filaDe(
  pessoaId: string,
  diretoriasDaPessoa: readonly string[],
  situacoes: readonly SituacaoContrato[],
  degraus: readonly Degrau[] = [],
): { contratoId: string; motivo: MotivoFila; explicacao: string; peso: number }[] {
  const itens: { contratoId: string; motivo: MotivoFila; explicacao: string; peso: number }[] = []

  for (const s of situacoes) {
    // Um contrato entra na fila de alguém UMA vez, pelo motivo mais forte.
    // Listar o mesmo contrato quatro vezes não ajuda quem vai agir.
    let melhor: Destinatario | null = null
    for (const d of destinatarios(s, degraus)) {
      const meu =
        (d.pessoaId !== null && d.pessoaId === pessoaId) ||
        (d.diretoriaSlug !== null && diretoriasDaPessoa.includes(d.diretoriaSlug))
      if (!meu) continue
      if (!melhor || d.peso > melhor.peso) melhor = d
    }
    if (melhor) {
      itens.push({
        contratoId: s.contratoId,
        motivo: melhor.motivo,
        explicacao: melhor.explicacao,
        peso: melhor.peso,
      })
    }
  }

  return itens.sort((a, b) => b.peso - a.peso)
}
