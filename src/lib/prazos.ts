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

export type PrazoTipo = 'data_fixa' | 'apos_evento' | 'condicionado'

/**
 * Unidade em que a cláusula (ou o SLA) está escrita.
 *
 * Não dá para ter uma regra global: depende de quem executa. Etapa tocada
 * pela nossa equipe corre em dia útil; espera por órgão público (INPI, Junta
 * Comercial, Receita) é calendário — os 60 e 90 dias do Registro de Marca
 * lidos como dias úteis viram 12 e 18 semanas em vez de 2 e 3 meses.
 */
export type UnidadePrazo = 'dias_uteis' | 'dias_corridos' | 'meses'

/** Em que se conta decorrido e restante. Mês vira calendário na contagem. */
export type ContagemPrazo = 'dias_uteis' | 'dias_corridos'

export const PRAZO_TIPO_LABELS: Record<PrazoTipo, string> = {
  apos_evento: 'Contado a partir de um evento',
  data_fixa: 'Data fixa na cláusula',
  condicionado: 'Depende de terceiro (não corre por nossa conta)',
}

export const UNIDADE_LABELS: Record<UnidadePrazo, string> = {
  dias_uteis: 'dias úteis',
  dias_corridos: 'dias corridos',
  meses: 'meses',
}

export function contagemDe(u: UnidadePrazo): ContagemPrazo {
  return u === 'dias_uteis' ? 'dias_uteis' : 'dias_corridos'
}

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
  /**
   * apos_evento: quanto, na unidade abaixo.
   *
   * Quando a cláusula traz faixa ("60 a 90 dias úteis"), aqui vai o teto —
   * é ele que gera responsabilidade. O piso é só previsão (`quantidadeMin`).
   */
  quantidade?: number | null
  /** Como contar. Ausente = dias úteis, que é o caso mais comum. */
  unidade?: UnidadePrazo | null
  /** Piso da faixa, apenas para a tela mostrar "60 a 90". Não entra na conta. */
  quantidadeMin?: number | null
  /** apos_evento: de qual evento parte. Nulo = parte do baseline informado. */
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
  /** Dias já consumidos, descontadas as suspensões. Null quando não corre. */
  decorridos: number | null
  /** Negativo = estourou por tantos dias. */
  restantes: number | null
  /** Em que unidade `decorridos` e `restantes` estão. */
  contagem: ContagemPrazo
  /** Data-limite já empurrada pelas suspensões. */
  dataPrevista: string | null
  /** Dias congelados no total, na unidade de contagem. */
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

/** Dias corridos em (inicio, fim]. Zero quando o fim vem antes. */
export function diasCorridosEntre(inicio: string, fim: string): number {
  const d = (paraNumero(fim) - paraNumero(inicio)) / DIA_MS
  return d > 0 ? d : 0
}

export function somarDiasCorridos(inicio: string, n: number): string {
  return paraIso(paraNumero(inicio) + n * DIA_MS)
}

/**
 * Avança N meses de calendário, prendendo ao último dia quando o mês de
 * destino é mais curto: 31/01 + 1 mês é 28/02, não 03/03.
 */
export function somarMeses(inicio: string, n: number): string {
  const [a, m, d] = inicio.slice(0, 10).split('-').map(Number)
  const bruto = m - 1 + n
  const ano = a + Math.floor(bruto / 12)
  const mes = ((bruto % 12) + 12) % 12
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
  return paraIso(Date.UTC(ano, mes, Math.min(d, ultimoDia)))
}

/**
 * Prazo que vence em dia não útil prorroga para o próximo dia útil.
 *
 * Vale para prazo em dias corridos e em meses; em dias úteis o vencimento
 * já cai em dia útil por construção.
 */
export function proximoDiaUtil(iso: string, feriados: ReadonlySet<string>): string {
  let cursor = paraNumero(iso)
  while (!ehDiaUtil(paraIso(cursor), feriados)) cursor += DIA_MS
  return paraIso(cursor)
}

/** Conta o intervalo (de, ate] na unidade pedida. */
export function contarEntre(
  de: string,
  ate: string,
  contagem: ContagemPrazo,
  feriados: ReadonlySet<string>,
): number {
  return contagem === 'dias_uteis' ? diasUteisEntre(de, ate, feriados) : diasCorridosEntre(de, ate)
}

/**
 * Dias congelados dentro da janela (depois, ate], na unidade de contagem.
 *
 * Recorta cada suspensão à janela do prazo: pausa aberta antes do evento
 * baseline, ou depois de hoje, não pode descontar dia que o prazo nem
 * chegou a consumir.
 */
export function suspensosNaJanela(
  suspensoes: readonly Suspensao[],
  depois: string,
  ate: string,
  contagem: ContagemPrazo,
  feriados: ReadonlySet<string>,
): number {
  let total = 0
  for (const s of suspensoes) {
    const ini = s.iniciada_em.slice(0, 10)
    const fim = (s.retomada_em ?? ate).slice(0, 10)
    const de = paraNumero(ini) > paraNumero(depois) ? ini : depois
    const a = paraNumero(fim) < paraNumero(ate) ? fim : ate
    if (paraNumero(a) <= paraNumero(de)) continue
    total += contarEntre(de, a, contagem, feriados)
  }
  return total
}

/** Atalho para o caso mais comum. */
export function diasUteisSuspensos(
  suspensoes: readonly Suspensao[],
  depois: string,
  ate: string,
  feriados: ReadonlySet<string>,
): number {
  return suspensosNaJanela(suspensoes, depois, ate, 'dias_uteis', feriados)
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
  contagem: 'dias_uteis',
  dataPrevista: null,
  diasSuspensos: 0,
  suspensaoAtiva: null,
  atrasado: false,
}

/**
 * Data-limite a partir do início, na unidade da cláusula, já empurrada
 * pelos dias congelados em suspensão.
 */
function vencimentoDe(
  inicio: string,
  quantidade: number,
  unidade: UnidadePrazo,
  congelados: number,
  feriados: ReadonlySet<string>,
): string {
  if (unidade === 'dias_uteis') return somarDiasUteis(inicio, quantidade + congelados, feriados)
  const base =
    unidade === 'meses' ? somarMeses(inicio, quantidade) : somarDiasCorridos(inicio, quantidade)
  return proximoDiaUtil(somarDiasCorridos(base, congelados), feriados)
}

export function calcularPrazo(entrada: EntradaPrazo): ResultadoPrazo {
  const { config, eventos, suspensoes, feriados, hoje } = entrada
  const pausa = suspensaoAberta(suspensoes)
  const unidade: UnidadePrazo = config.unidade ?? 'dias_uteis'
  const contagem = contagemDe(unidade)

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

  // De onde o prazo parte, e até onde vai.
  let inicio: string | null = null
  let alvo: string
  let congelados = 0
  let detalhe: string

  if (config.tipo === 'data_fixa') {
    if (!config.dataFixa) {
      return {
        ...SEM_PRAZO,
        situacao: 'sem_baseline',
        explicacao: 'Prazo por data fixa, mas a data da cláusula não foi informada.',
        suspensaoAtiva: pausa,
      }
    }
    // A data da cláusula é a data da cláusula: suspensão não a move.
    alvo = config.dataFixa.slice(0, 10)
    detalhe = `Data de cláusula: ${alvo}.`
  } else {
    if (config.quantidade == null) return { ...SEM_PRAZO, suspensaoAtiva: pausa }

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

    // Suspensões congelam o contador. A janela vai do início até hoje.
    congelados = suspensosNaJanela(suspensoes, inicio, hoje, contagem, feriados)
    alvo = vencimentoDe(inicio, config.quantidade, unidade, congelados, feriados)

    const faixa =
      config.quantidadeMin != null && config.quantidadeMin !== config.quantidade
        ? `${config.quantidadeMin} a ${config.quantidade}`
        : `${config.quantidade}`
    const consumido = Math.max(0, contarEntre(inicio, hoje, contagem, feriados) - congelados)
    detalhe =
      `Prazo de ${faixa} ${UNIDADE_LABELS[unidade]}. ` +
      `Consumidos ${consumido} ${UNIDADE_LABELS[contagem]}.` +
      (congelados > 0 ? ` ${congelados} não contaram por suspensão.` : '')
  }

  // Decorrido e restante saem do mesmo par (início, alvo), então sempre
  // fecham entre si — foi somar os dois por caminhos diferentes que fez a
  // tela mostrar número que não batia com a data.
  const decorridos =
    inicio === null ? null : Math.max(0, contarEntre(inicio, hoje, contagem, feriados) - congelados)
  const restantes =
    paraNumero(alvo) >= paraNumero(hoje)
      ? contarEntre(hoje, alvo, contagem, feriados)
      : -contarEntre(alvo, hoje, contagem, feriados)

  if (pausa) {
    return {
      situacao: 'suspenso',
      explicacao: `Prazo congelado — ${SUSPENSAO_LABELS[pausa.motivo].toLowerCase()}. ${detalhe}`,
      decorridos,
      restantes,
      contagem,
      dataPrevista: alvo,
      diasSuspensos: congelados,
      suspensaoAtiva: pausa,
      atrasado: false,
    }
  }

  const unidadeRestante = UNIDADE_LABELS[contagem]
  const situacao: PrazoSituacao =
    restantes < 0 ? 'estourado' : restantes <= 1 ? 'perto' : 'no_prazo'
  const explicacao =
    restantes < 0
      ? `Estourou há ${Math.abs(restantes)} ${unidadeRestante}. ${detalhe}`
      : restantes === 0
        ? `Vence hoje. ${detalhe}`
        : `Faltam ${restantes} ${unidadeRestante}. ${detalhe}`

  return {
    situacao,
    explicacao,
    decorridos,
    restantes,
    contagem,
    dataPrevista: alvo,
    diasSuspensos: congelados,
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
