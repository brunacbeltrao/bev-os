/**
 * Testes do motor de prazos.
 *
 * As quatro garantias que o motor precisa dar, e que o motor antigo não
 * dava: prazo condicionado nunca atrasa, pausa congela o contador,
 * retomada continua de onde parou, e dia útil pula feriado.
 *
 * Os feriados aqui são os reais de Pernambuco em 2026 — os mesmos que a
 * migration semeia. Páscoa 2026 caiu em 05/04, então Sexta-feira Santa é
 * 03/04, Carnaval 16 e 17/02 e Corpus Christi 04/06.
 */
import { describe, expect, it } from 'vitest'
import {
  calcularPrazo,
  diasUteisEntre,
  diasUteisSuspensos,
  ehDiaUtil,
  somarDiasUteis,
  type Evento,
  type Suspensao,
} from './prazos'

const FERIADOS = new Set([
  '2026-01-01', // Confraternização
  '2026-02-16', // Carnaval segunda
  '2026-02-17', // Carnaval terça
  '2026-03-06', // Revolução Pernambucana
  '2026-04-03', // Sexta-feira Santa
  '2026-04-21', // Tiradentes
  '2026-05-01', // Dia do Trabalho
  '2026-06-04', // Corpus Christi
  '2026-09-07', // Independência
  '2026-12-08', // N. Sra. da Conceição (Recife)
  '2026-12-25', // Natal
])

// ---------------------------------------------------------------------------
describe('dia útil', () => {
  it('pula sábado e domingo', () => {
    expect(ehDiaUtil('2026-09-11', FERIADOS)).toBe(true) // sexta
    expect(ehDiaUtil('2026-09-12', FERIADOS)).toBe(false) // sábado
    expect(ehDiaUtil('2026-09-13', FERIADOS)).toBe(false) // domingo
  })

  it('pula feriado nacional', () => {
    expect(ehDiaUtil('2026-09-07', FERIADOS)).toBe(false) // Independência, segunda
  })

  it('pula feriado estadual e municipal', () => {
    expect(ehDiaUtil('2026-03-06', FERIADOS)).toBe(false) // Data Magna de PE, sexta
    expect(ehDiaUtil('2026-12-08', FERIADOS)).toBe(false) // padroeira do Recife, terça
  })

  it('somar dias úteis atravessa o Carnaval sem contá-lo', () => {
    // Sexta 13/02 + 3 úteis: 16 e 17 são Carnaval, então 18, 19 e 20.
    expect(somarDiasUteis('2026-02-13', 3, FERIADOS)).toBe('2026-02-20')
  })

  it('não conta o próprio dia do evento (prazo corre do dia seguinte)', () => {
    // Segunda 07/09 é feriado; 1 dia útil após sexta 04/09 é terça 08/09.
    expect(somarDiasUteis('2026-09-04', 1, FERIADOS)).toBe('2026-09-08')
  })

  it('conta o intervalo excluindo o início e incluindo o fim', () => {
    // (04/09, 11/09]: 08, 09, 10, 11 — 07 é feriado, 05 e 06 fim de semana.
    expect(diasUteisEntre('2026-09-04', '2026-09-11', FERIADOS)).toBe(4)
  })

  it('intervalo invertido é zero, não negativo', () => {
    expect(diasUteisEntre('2026-09-11', '2026-09-04', FERIADOS)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
describe('prazo condicionado', () => {
  const base = { eventos: [], suspensoes: [], feriados: FERIADOS }

  it('nunca atrasa, por mais antigo que seja', () => {
    const r = calcularPrazo({
      ...base,
      config: { tipo: 'condicionado', condicao: 'decisão de mérito do INPI' },
      hoje: '2029-12-31',
    })
    expect(r.situacao).toBe('aguardando_gatilho')
    expect(r.atrasado).toBe(false)
    expect(r.explicacao).toContain('decisão de mérito do INPI')
  })

  it('mostra qual evento está esperando mesmo sem texto de condição', () => {
    const r = calcularPrazo({ ...base, config: { tipo: 'condicionado' }, hoje: '2026-09-09' })
    expect(r.atrasado).toBe(false)
    expect(r.explicacao).toMatch(/evento externo/i)
  })
})

// ---------------------------------------------------------------------------
describe('sem baseline', () => {
  it('contrato migrado sem evento não conta como atrasado', () => {
    const r = calcularPrazo({
      config: { tipo: 'dias_uteis_apos_evento', diasUteis: 5 },
      eventos: [],
      suspensoes: [],
      feriados: FERIADOS,
      hoje: '2026-09-09',
      baseline: null,
    })
    expect(r.situacao).toBe('sem_baseline')
    expect(r.atrasado).toBe(false)
    expect(r.explicacao).toMatch(/sem baseline/i)
  })

  it('gatilho não registrado não conta como atrasado, e diz o que falta', () => {
    const r = calcularPrazo({
      config: { tipo: 'dias_uteis_apos_evento', diasUteis: 10, eventoGatilho: 'protocolo_inpi' },
      eventos: [{ tipo: 'assinatura', ocorrido_em: '2026-01-05' }],
      suspensoes: [],
      feriados: FERIADOS,
      hoje: '2026-09-09',
    })
    expect(r.situacao).toBe('sem_baseline')
    expect(r.atrasado).toBe(false)
    expect(r.explicacao).toContain('Protocolo no INPI')
  })

  it('com o evento registrado, o prazo passa a correr', () => {
    const eventos: Evento[] = [{ tipo: 'protocolo_inpi', ocorrido_em: '2026-09-01' }]
    const r = calcularPrazo({
      config: { tipo: 'dias_uteis_apos_evento', diasUteis: 10, eventoGatilho: 'protocolo_inpi' },
      eventos,
      suspensoes: [],
      feriados: FERIADOS,
      hoje: '2026-09-09',
    })
    // (01/09, 09/09]: 02,03,04,08,09 — 07 é feriado, 05/06 fim de semana.
    expect(r.decorridos).toBe(5)
    expect(r.restantes).toBe(5)
    expect(r.situacao).toBe('no_prazo')
  })
})

// ---------------------------------------------------------------------------
describe('suspensão', () => {
  const config = { tipo: 'dias_uteis_apos_evento' as const, diasUteis: 10 }

  it('pausa aberta congela: o contador não anda com o tempo', () => {
    const suspensoes: Suspensao[] = [
      { motivo: 'aguardando_cliente', iniciada_em: '2026-09-03', retomada_em: null },
    ]
    const em09 = calcularPrazo({
      config,
      eventos: [],
      suspensoes,
      feriados: FERIADOS,
      hoje: '2026-09-09',
      baseline: '2026-09-01',
    })
    const em30 = calcularPrazo({
      config,
      eventos: [],
      suspensoes,
      feriados: FERIADOS,
      hoje: '2026-09-30',
      baseline: '2026-09-01',
    })
    expect(em09.situacao).toBe('suspenso')
    expect(em30.situacao).toBe('suspenso')
    expect(em30.atrasado).toBe(false)
    // três semanas depois, o consumido é o mesmo: 02 e 03 de setembro.
    expect(em09.decorridos).toBe(2)
    expect(em30.decorridos).toBe(2)
  })

  it('retomada continua de onde parou, não do zero', () => {
    const suspensoes: Suspensao[] = [
      { motivo: 'aguardando_orgao_publico', iniciada_em: '2026-09-03', retomada_em: '2026-09-23' },
    ]
    const r = calcularPrazo({
      config,
      eventos: [],
      suspensoes,
      feriados: FERIADOS,
      hoje: '2026-09-25',
      baseline: '2026-09-01',
    })
    // Consumidos: 02 e 03 antes da pausa, 24 e 25 depois. A janela
    // (03, 23] tem 13 dias úteis — 07/09 é feriado — e não conta.
    expect(r.diasSuspensos).toBe(13)
    expect(r.decorridos).toBe(4)
    expect(r.restantes).toBe(6)
    expect(r.situacao).toBe('no_prazo')
  })

  it('a data prevista é empurrada pelos dias congelados', () => {
    const semPausa = calcularPrazo({
      config,
      eventos: [],
      suspensoes: [],
      feriados: FERIADOS,
      hoje: '2026-09-25',
      baseline: '2026-09-01',
    })
    const comPausa = calcularPrazo({
      config,
      eventos: [],
      suspensoes: [
        { motivo: 'aguardando_cliente', iniciada_em: '2026-09-03', retomada_em: '2026-09-23' },
      ],
      feriados: FERIADOS,
      hoje: '2026-09-25',
      baseline: '2026-09-01',
    })
    expect(comPausa.dataPrevista! > semPausa.dataPrevista!).toBe(true)
  })

  it('pausa anterior ao baseline não desconta dia que o prazo não consumiu', () => {
    const r = calcularPrazo({
      config,
      eventos: [],
      suspensoes: [
        { motivo: 'aguardando_cliente', iniciada_em: '2026-08-01', retomada_em: '2026-08-20' },
      ],
      feriados: FERIADOS,
      hoje: '2026-09-09',
      baseline: '2026-09-01',
    })
    expect(r.diasSuspensos).toBe(0)
    expect(r.decorridos).toBe(5)
  })

  it('conta os dias congelados em dias úteis, não corridos', () => {
    // 04/09 (sexta) a 14/09 (segunda): úteis são 08,09,10,11,14 = 5.
    const dias = diasUteisSuspensos(
      [{ motivo: 'aguardando_cliente', iniciada_em: '2026-09-04', retomada_em: '2026-09-14' }],
      '2026-09-01',
      '2026-09-30',
      FERIADOS,
    )
    expect(dias).toBe(5)
  })
})

// ---------------------------------------------------------------------------
describe('atraso de verdade', () => {
  it('estoura só quando os dias úteis realmente passaram', () => {
    const r = calcularPrazo({
      config: { tipo: 'dias_uteis_apos_evento', diasUteis: 3 },
      eventos: [],
      suspensoes: [],
      feriados: FERIADOS,
      hoje: '2026-09-11',
      baseline: '2026-09-01',
    })
    // (01/09, 11/09] = 02,03,04,08,09,10,11 = 7 úteis contra prazo de 3.
    expect(r.decorridos).toBe(7)
    expect(r.restantes).toBe(-4)
    expect(r.situacao).toBe('estourado')
    expect(r.atrasado).toBe(true)
  })

  it('data fixa no futuro não está atrasada', () => {
    const r = calcularPrazo({
      config: { tipo: 'data_fixa', dataFixa: '2026-12-01' },
      eventos: [],
      suspensoes: [],
      feriados: FERIADOS,
      hoje: '2026-09-09',
    })
    expect(r.atrasado).toBe(false)
    expect(r.dataPrevista).toBe('2026-12-01')
  })

  it('data fixa no passado está atrasada, em dias úteis', () => {
    const r = calcularPrazo({
      config: { tipo: 'data_fixa', dataFixa: '2026-09-04' },
      eventos: [],
      suspensoes: [],
      feriados: FERIADOS,
      hoje: '2026-09-11',
    })
    expect(r.situacao).toBe('estourado')
    expect(r.restantes).toBe(-4) // 08,09,10,11
  })

  it('data fixa sem data informada é sem baseline, não atraso', () => {
    const r = calcularPrazo({
      config: { tipo: 'data_fixa', dataFixa: null },
      eventos: [],
      suspensoes: [],
      feriados: FERIADOS,
      hoje: '2026-09-09',
    })
    expect(r.situacao).toBe('sem_baseline')
    expect(r.atrasado).toBe(false)
  })

  it('suspenso nunca é atraso, mesmo com o prazo já vencido', () => {
    const r = calcularPrazo({
      config: { tipo: 'dias_uteis_apos_evento', diasUteis: 1 },
      eventos: [],
      suspensoes: [
        { motivo: 'aguardando_orgao_publico', iniciada_em: '2026-09-08', retomada_em: null },
      ],
      feriados: FERIADOS,
      hoje: '2026-09-30',
      baseline: '2026-09-01',
    })
    expect(r.situacao).toBe('suspenso')
    expect(r.atrasado).toBe(false)
    expect(r.restantes! < 0).toBe(true) // já devia ter vencido, mas está congelado
  })
})

// ---------------------------------------------------------------------------
describe('fuso horário', () => {
  it('não desloca a data por causa de UTC', () => {
    // O erro clássico: new Date('2026-09-07') é meia-noite UTC, que em
    // Recife (UTC-3) ainda é dia 6. Aqui 07/09 tem que ser feriado.
    expect(ehDiaUtil('2026-09-07', FERIADOS)).toBe(false)
    expect(somarDiasUteis('2026-09-04', 1, FERIADOS)).toBe('2026-09-08')
  })
})
