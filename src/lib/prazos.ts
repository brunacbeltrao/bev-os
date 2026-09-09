/**
 * Motor de prazos do EPEAS.
 *
 * O motor antigo contava dias corridos a partir da entrada na etapa. Para
 * operação jurídica isso é falso em três pontos, e cada um deles produzia
 * atraso onde não havia:
 *
 *   1. prazo jurídico corre em dias ÚTEIS, não corridos;
 *   2. prazo nasce de um EVENTO (assinatura, protocolo, pagamento de GRU),
 *      não da data em que alguém cadastrou o contrato — contrato migrado
 *      herdava a data da migração como se fosse a assinatura;
 *   3. prazo PARA quando a bola está com o cliente ou com o órgão público.
 *
 * Daí os 97% da carteira aparecerem atrasados: um número que ninguém olha
 * duas vezes, e que por isso não servia para nada.
 *
 * Este arquivo é puro de propósito — sem Supabase, sem `new Date()` solto.
 * Tudo entra por parâmetro, inclusive `hoje`, para poder ser testado.
 *
 * Datas trafegam como 'AAAA-MM-DD'. Não usamos objetos Date locais porque
 * `new Date('2026-09-09')` é meia-noite UTC, e em Recife (UTC-3) isso é dia
 * 8 — a mesma classe de erro que já apareceu na Home.
 */

export type PrazoTipo = 'data_fixa' | 'dias_uteis_apos_evento' | 'condicionado'

export type EventoTipo =
  | 'assinatura'
  | 'protocolo_inpi'
  | 'entrega_documentos_cliente'
  | 'pagamento_gru'
  | 'publicacao_rpi'
  | 'outro'

export type SuspensaoMotivo = 'aguardando_cliente' | 'aguardando_orgao_publico'

export const EVENTO_LABELS: Record<EventoTipo, string> = {
  assinatura: 'Assinatura do contrato',
  protocolo_inpi: 'Protocolo no INPI',
  entrega_documentos_cliente: 'Entrega de documentos pelo cliente',
  pagamento_gru: 'Pagamento da GRU',
  publicacao_rpi: 'Publicação na RPI',
  outro: 'Outro evento',
}

export const SUSPENSAO_LABELS: Record<SuspensaoMotivo, string> = {
  aguardando_cliente: 'Aguardando o cliente',
  aguardando_orgao_publico: 'Aguardando órgão público',
}

export interface Evento {
  tipo: EventoTipo
  /** 'AAAA-MM-DD' — quando aconteceu, não quando foi digitado. */
  ocorrido_em: string
}

export interface Suspensao {
  motivo: SuspensaoMotivo
  /** 'AAAA-MM-DD' */
  iniciada_em: string
  /** 'AAAA-MM-DD' ou null enquanto a pausa estiver aberta. */
  retomada_em: string | null
}

export interface ConfigPrazo {
  tipo: PrazoTipo
  /** data_fixa: a data da cláusula. */
  dataFixa?: string | null
  /** dias_uteis_apos_evento: quantos dias úteis. */
  diasUteis?: number | null
  /** dias_uteis_apos_evento: de qual evento parte. Nulo = parte do baseline informado. */
  eventoGatilho?: EventoTipo | null
  /** condicionado: o que se está esperando, em texto, para a tela mostrar. */
  condicao?: string | null
}

export type PrazoSituacao =
  | 'sem_baseline'
  | 'aguardando_gatilho'
  | 'suspenso'
  | 'no_prazo'
  | 'perto'
  | 'estourado'
  | 'sem_prazo'

export interface ResultadoPrazo {
  situacao: PrazoSituacao
  /** Frase pronta para a tela — o motivo, não só o rótulo. */
  explicacao: string
  /** Dias úteis já consumidos, descontadas as suspensões. Null quando não corre. */
  decorridos: number | null
  /** Negativo = estourou por tantos dias úteis. */
  restantes: number | null
  /** Data-limite já empurrada pelas suspensões. */
  dataPrevista: string | null
  /** Dias úteis congelados no total. */
  diasSuspensos: number
  suspensaoAtiva: Suspensao | null
  /** Só conta como atraso quando isto é verdade. */
  atrasado: boolean
}

// ---------------------------------------------------------------------------
// Datas — tudo em UTC sobre 'AAAA-MM-DD', sem fuso no meio
// ---------------------------------------------------------------------------

const DIA_MS = 86_400_000

function paraNumero(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

function paraIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Sábado e domingo não contam; feriado é o conjunto de 'AAAA-MM-DD'. */
export function ehDiaUtil(iso: string, feriados: ReadonlySet<string>): boolean {
  const dia = new Date(paraNumero(iso)).getUTCDay()
  if (dia === 0 || dia === 6) return false
  return !feriados.has(iso.slice(0, 10))
}

/**
 * Dias úteis em (inicio, fim] — exclui o dia do evento e inclui o fim.
 *
 * A exclusão do primeiro dia é a convenção jurídica brasileira: o prazo
 * começa a correr no primeiro dia útil SEGUINTE ao ato. Se `fim` vem antes
 * de `inicio`, devolve 0 em vez de negativo — quem chama trata o caso.
 */
export function diasUteisEntre(
  inicio: string,
  fim: string,
  feriados: ReadonlySet<string>,
): number {
  let cursor = paraNumero(inicio)
  const alvo = paraNumero(fim)
  if (alvo <= cursor) return 0
  let n = 0
  while (cursor < alvo) {
    cursor += DIA_MS
    if (ehDiaUtil(paraIso(cursor), feriados)) n++
  }
  return n
}

/** Avança N dias úteis a partir de `inicio`, sem contar o próprio dia. */
export function somarDiasUteis(
  inicio: string,
  n: number,
  feriados: ReadonlySet<string>,
): string {
  let cursor = paraNumero(inicio)
  let faltam = n
  while (faltam > 0) {
    cursor += DIA_MS
    if (ehDiaUtil(paraIso(cursor), feriados)) faltam--
  }
  return paraIso(cursor)
}

/**
 * Dias úteis congelados dentro da janela (depois, ate].
 *
 * Recorta cada suspensão à janela do prazo: pausa aberta antes do evento
 * baseline, ou depois de hoje, não pode descontar dia que o prazo nem
 * chegou a consumir.
 */
export function diasUteisSuspensos(
  suspensoes: readonly Suspensao[],
  depois: string,
  ate: string,
  feriados: ReadonlySet<string>,
): number {
  let total = 0
  for (const s of suspensoes) {
    const ini = s.iniciada_em.slice(0, 10)
    const fim = (s.retomada_em ?? ate).slice(0, 10)
    const de = paraNumero(ini) > paraNumero(depois) ? ini : depois
    const a = paraNumero(fim) < paraNumero(ate) ? fim : ate
    if (paraNumero(a) <= paraNumero(de)) continue
    total += diasUteisEntre(de, a, feriados)
  }
  return total
}

export function suspensaoAberta(suspensoes: readonly Suspensao[]): Suspensao | null {
  return suspensoes.find((s) => s.retomada_em === null) ?? null
}

/** Primeira ocorrência do evento — a que dá início ao prazo. */
export function primeiroEvento(
  eventos: readonly Evento[],
  tipo: EventoTipo,
): Evento | null {
  const doTipo = eventos
    .filter((e) => e.tipo === tipo)
    .sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em))
  return doTipo[0] ?? null
}

// ---------------------------------------------------------------------------
// O motor
// ---------------------------------------------------------------------------

export interface EntradaPrazo {
  config: ConfigPrazo
  eventos: readonly Evento[]
  suspensoes: readonly Suspensao[]
  feriados: ReadonlySet<string>
  /** 'AAAA-MM-DD' */
  hoje: string
  /**
   * Data de início quando a config não aponta para um evento — tipicamente a
   * entrada na etapa, que o próprio sistema carimba. Sem isto e sem evento,
   * o prazo fica "sem baseline" em vez de inventar uma data.
   */
  baseline?: string | null
}

const SEM_PRAZO: ResultadoPrazo = {
  situacao: 'sem_prazo',
  explicacao: 'Sem prazo definido.',
  decorridos: null,
  restantes: null,
  dataPrevista: null,
  diasSuspensos: 0,
  suspensaoAtiva: null,
  atrasado: false,
}

export function calcularPrazo(entrada: EntradaPrazo): ResultadoPrazo {
  const { config, eventos, suspensoes, feriados, hoje } = entrada
  const pausa = suspensaoAberta(suspensoes)

  // Condicionado nunca atrasa: o gatilho é de fora, e cobrar prazo de quem
  // não pode agir é o erro que este motor existe para não repetir.
  if (config.tipo === 'condicionado') {
    return {
      ...SEM_PRAZO,
      situacao: 'aguardando_gatilho',
      explicacao: config.condicao
        ? `Aguardando: ${config.condicao}`
        : 'Aguardando evento externo — prazo ainda não começou a correr.',
      suspensaoAtiva: pausa,
    }
  }

  // De onde o prazo parte.
  let inicio: string | null = null
  let prazo: number | null = null

  if (config.tipo === 'data_fixa') {
    if (!config.dataFixa) {
      return {
        ...SEM_PRAZO,
        situacao: 'sem_baseline',
        explicacao: 'Prazo por data fixa, mas a data da cláusula não foi informada.',
        suspensaoAtiva: pausa,
      }
    }
  } else {
    // dias_uteis_apos_evento
    if (config.diasUteis == null) return { ...SEM_PRAZO, suspensaoAtiva: pausa }
    prazo = config.diasUteis

    if (config.eventoGatilho) {
      const ev = primeiroEvento(eventos, config.eventoGatilho)
      if (!ev) {
        return {
          ...SEM_PRAZO,
          situacao: 'sem_baseline',
          explicacao: `Prazo começa em "${EVENTO_LABELS[config.eventoGatilho]}", que ainda não foi registrado.`,
          suspensaoAtiva: pausa,
        }
      }
      inicio = ev.ocorrido_em.slice(0, 10)
    } else {
      if (!entrada.baseline) {
        return {
          ...SEM_PRAZO,
          situacao: 'sem_baseline',
          explicacao: 'Migrado, sem baseline — informe a data de início para o prazo passar a valer.',
          suspensaoAtiva: pausa,
        }
      }
      inicio = entrada.baseline.slice(0, 10)
    }
  }

  // Suspensões congelam o contador. A janela vai do início até hoje.
  const janelaDe = config.tipo === 'data_fixa' ? hoje : inicio!
  const congelados =
    config.tipo === 'data_fixa'
      ? 0
      : diasUteisSuspensos(suspensoes, janelaDe, hoje, feriados)

  if (config.tipo === 'data_fixa') {
    const alvo = config.dataFixa!.slice(0, 10)
    const restantes =
      paraNumero(alvo) >= paraNumero(hoje)
        ? diasUteisEntre(hoje, alvo, feriados)
        : -diasUteisEntre(alvo, hoje, feriados)
    if (pausa) {
      return {
        situacao: 'suspenso',
        explicacao: `Prazo suspenso — ${SUSPENSAO_LABELS[pausa.motivo].toLowerCase()}. Data de cláusula: ${alvo}.`,
        decorridos: null,
        restantes,
        dataPrevista: alvo,
        diasSuspensos: 0,
        suspensaoAtiva: pausa,
        atrasado: false,
      }
    }
    return montar(restantes, null, alvo, 0, null, `Data de cláusula: ${alvo}.`)
  }

  const decorridos = Math.max(0, diasUteisEntre(inicio!, hoje, feriados) - congelados)
  const restantes = prazo! - decorridos
  const dataPrevista = somarDiasUteis(inicio!, prazo! + congelados, feriados)

  if (pausa) {
    return {
      situacao: 'suspenso',
      explicacao: `Prazo congelado — ${SUSPENSAO_LABELS[pausa.motivo].toLowerCase()}. Consumidos ${decorridos} de ${prazo} dias úteis.`,
      decorridos,
      restantes,
      dataPrevista,
      diasSuspensos: congelados,
      suspensaoAtiva: pausa,
      atrasado: false,
    }
  }

  const sufixo =
    congelados > 0
      ? ` ${congelados} dia(s) útil(eis) não contaram por suspensão.`
      : ''
  return montar(
    restantes,
    decorridos,
    dataPrevista,
    congelados,
    null,
    `Consumidos ${decorridos} de ${prazo} dias úteis.${sufixo}`,
  )
}

function montar(
  restantes: number,
  decorridos: number | null,
  dataPrevista: string,
  diasSuspensos: number,
  pausa: Suspensao | null,
  detalhe: string,
): ResultadoPrazo {
  const situacao: PrazoSituacao =
    restantes < 0 ? 'estourado' : restantes <= 1 ? 'perto' : 'no_prazo'
  const explicacao =
    restantes < 0
      ? `Estourou há ${Math.abs(restantes)} dia(s) útil(eis). ${detalhe}`
      : restantes === 0
        ? `Vence hoje. ${detalhe}`
        : `Faltam ${restantes} dia(s) útil(eis). ${detalhe}`
  return {
    situacao,
    explicacao,
    decorridos,
    restantes,
    dataPrevista,
    diasSuspensos,
    suspensaoAtiva: pausa,
    atrasado: situacao === 'estourado',
  }
}

/** Rótulo curto para badge. */
export const SITUACAO_LABELS: Record<PrazoSituacao, string> = {
  sem_baseline: 'Sem baseline',
  aguardando_gatilho: 'Aguardando gatilho',
  suspenso: 'Suspenso',
  no_prazo: 'No prazo',
  perto: 'No limite',
  estourado: 'Atrasado',
  sem_prazo: 'Sem prazo',
}
