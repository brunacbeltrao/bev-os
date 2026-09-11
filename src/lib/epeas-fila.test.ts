/**
 * Testes da fila do EPEAS.
 *
 * A invariante que dá nome a tudo isto: contrato atrasado aparece na fila de
 * pelo menos uma pessoa. Ela não é um detalhe — é a diferença entre um
 * sistema que cobra e um painel que enfeita. O caso difícil é o contrato
 * migrado, sem alocação nenhuma: é justamente nele que uma fila montada por
 * papel deixaria o atraso órfão.
 */
import { describe, expect, it } from 'vitest'
import {
  destinatarios,
  filaDe,
  resolverPapel,
  DIRETORIA_ULTIMA_INSTANCIA,
  type Degrau,
  type SituacaoContrato,
} from './epeas-fila'

const VAZIA = {
  comercial: null,
  gestao: null,
  gerente_nucleo: null,
  scrum_master: null,
  assessor_projeto: [],
}

const DEGRAUS: Degrau[] = [
  { dias_uteis: 3, papel: 'gerente_nucleo', diretoria_slug: null, rotulo: 'Atraso acima de 3 dias úteis' },
  { dias_uteis: 7, papel: 'gerente_nucleo', diretoria_slug: 'negocios', rotulo: 'Atraso acima de 7 dias úteis' },
]

function situacao(over: Partial<SituacaoContrato> = {}): SituacaoContrato {
  return {
    contratoId: 'c1',
    estado: 'em_execucao',
    alocacao: { ...VAZIA },
    papelDaEtapa: 'gestao',
    etapaLabel: 'Formulário conferido',
    atrasoDiasUteis: 0,
    documentosFaltando: [],
    mencionados: [],
    ...over,
  }
}

// ---------------------------------------------------------------------------
describe('resolver papel para pessoa', () => {
  it('cada papel lê a sua coluna de alocação', () => {
    const a = { ...VAZIA, gestao: 'p-gestao', gerente_nucleo: 'p-ger' }
    expect(resolverPapel(a, 'gestao')).toEqual(['p-gestao'])
    expect(resolverPapel(a, 'gerente_nucleo')).toEqual(['p-ger'])
    expect(resolverPapel(a, 'comercial')).toEqual([])
  })

  it('assessor de projeto resolve para o time inteiro, não para um eleito', () => {
    const a = { ...VAZIA, assessor_projeto: ['p1', 'p2', 'p3'] }
    expect(resolverPapel(a, 'assessor_projeto')).toEqual(['p1', 'p2', 'p3'])
  })
})

// ---------------------------------------------------------------------------
describe('a invariante', () => {
  it('contrato atrasado sem alocação nenhuma ainda cai na fila de alguém', () => {
    // O caso dos 31 migrados: nenhum papel resolve.
    const d = destinatarios(situacao({ atrasoDiasUteis: 12 }), DEGRAUS)
    expect(d.length).toBeGreaterThan(0)
    expect(d.some((x) => x.diretoriaSlug === DIRETORIA_ULTIMA_INSTANCIA)).toBe(true)
    expect(d[0]!.motivo).toBe('sem_responsavel')
  })

  it('vale para toda combinação de papel e atraso', () => {
    const papeis = ['comercial', 'gestao', 'gerente_nucleo', 'scrum_master', 'assessor_projeto'] as const
    const alocacoes = [
      { ...VAZIA },
      { ...VAZIA, gestao: 'p1' },
      { ...VAZIA, comercial: 'p2', gerente_nucleo: 'p3' },
      { ...VAZIA, assessor_projeto: ['p4', 'p5'] },
      { ...VAZIA, scrum_master: 'p6' },
    ]
    for (const papelDaEtapa of papeis) {
      for (const alocacao of alocacoes) {
        for (const atrasoDiasUteis of [1, 4, 9, 40]) {
          const d = destinatarios(situacao({ papelDaEtapa, alocacao, atrasoDiasUteis }), DEGRAUS)
          expect(
            d.length,
            `atraso órfão: papel=${papelDaEtapa} atraso=${atrasoDiasUteis}`,
          ).toBeGreaterThan(0)
        }
      }
    }
  })

  it('a invariante sobrevive à fila montada por pessoa', () => {
    // Não basta existir destinatário: alguém tem que de fato ver o item.
    const s = situacao({ atrasoDiasUteis: 5, papelDaEtapa: 'assessor_projeto' })
    const daDiretoria = filaDe('qualquer', ['negocios'], [s], DEGRAUS)
    expect(daDiretoria).toHaveLength(1)
    expect(daDiretoria[0]!.motivo).toBe('sem_responsavel')
  })
})

// ---------------------------------------------------------------------------
describe('motivos da fila', () => {
  it('sem atraso, o responsável vê como tarefa; com atraso, como cobrança', () => {
    const emDia = destinatarios(situacao({ alocacao: { ...VAZIA, gestao: 'p1' } }))
    expect(emDia[0]!.motivo).toBe('responsavel')

    const atrasado = destinatarios(
      situacao({ alocacao: { ...VAZIA, gestao: 'p1' }, atrasoDiasUteis: 2 }),
    )
    expect(atrasado[0]!.motivo).toBe('atrasado')
    expect(atrasado[0]!.explicacao).toContain('2 dia')
  })

  it('quem foi citado entra mesmo sem responder pela etapa', () => {
    const d = destinatarios(
      situacao({ alocacao: { ...VAZIA, gestao: 'p1' }, mencionados: ['p9'] }),
    )
    expect(d.some((x) => x.pessoaId === 'p9' && x.motivo === 'mencionado')).toBe(true)
  })

  it('documento obrigatório faltando é item próprio, com o nome do documento', () => {
    const d = destinatarios(
      situacao({
        alocacao: { ...VAZIA, gestao: 'p1' },
        documentosFaltando: ['Contrato assinado (PDF)'],
      }),
    )
    const item = d.find((x) => x.motivo === 'documento_faltando')
    expect(item?.explicacao).toContain('Contrato assinado (PDF)')
  })

  it('cada pessoa vê o contrato uma vez só, pelo motivo mais forte', () => {
    // p1 é responsável, foi citado E o documento é dele.
    const s = situacao({
      alocacao: { ...VAZIA, gestao: 'p1' },
      atrasoDiasUteis: 4,
      documentosFaltando: ['Procuração'],
      mencionados: ['p1'],
    })
    const fila = filaDe('p1', [], [s], DEGRAUS)
    expect(fila).toHaveLength(1)
    expect(fila[0]!.motivo).toBe('atrasado')
  })
})

// ---------------------------------------------------------------------------
describe('escalonamento', () => {
  const comTime = { ...VAZIA, gestao: 'p-gestao', gerente_nucleo: 'p-gerente' }

  it('abaixo de 3 dias úteis não sobe para o gerente', () => {
    const d = destinatarios(situacao({ alocacao: comTime, atrasoDiasUteis: 3 }), DEGRAUS)
    expect(d.some((x) => x.pessoaId === 'p-gerente')).toBe(false)
  })

  it('acima de 3 sobe para o gerente do núcleo, sem tirar o responsável', () => {
    const d = destinatarios(situacao({ alocacao: comTime, atrasoDiasUteis: 4 }), DEGRAUS)
    expect(d.some((x) => x.pessoaId === 'p-gerente' && x.motivo === 'escalonamento')).toBe(true)
    expect(d.some((x) => x.pessoaId === 'p-gestao')).toBe(true)
  })

  it('acima de 7 entra também a Diretoria de Negócios', () => {
    const d = destinatarios(situacao({ alocacao: comTime, atrasoDiasUteis: 8 }), DEGRAUS)
    // o degrau de 7 resolve para o gerente (papel), e o de 3 também: a
    // diretoria só entra quando o papel não resolve ninguém
    expect(d.filter((x) => x.pessoaId === 'p-gerente')).toHaveLength(2)
  })

  it('sem gerente de núcleo, o degrau de 7 cai na Diretoria de Negócios', () => {
    const d = destinatarios(
      situacao({ alocacao: { ...VAZIA, gestao: 'p-gestao' }, atrasoDiasUteis: 8 }),
      DEGRAUS,
    )
    expect(d.some((x) => x.diretoriaSlug === 'negocios' && x.motivo === 'escalonamento')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('estado de ciclo de vida', () => {
  it('distratado e cancelado param de cobrar, por mais atrasados que estejam', () => {
    for (const estado of ['distratado', 'cancelado', 'concluido'] as const) {
      const d = destinatarios(
        situacao({ estado, alocacao: { ...VAZIA, gestao: 'p1' }, atrasoDiasUteis: 90 }),
        DEGRAUS,
      )
      expect(d, `${estado} continuou cobrando`).toEqual([])
    }
  })

  it('pausado continua na carteira: o relógio para, a responsabilidade não', () => {
    const d = destinatarios(
      situacao({ estado: 'pausado', alocacao: { ...VAZIA, gestao: 'p1' } }),
      DEGRAUS,
    )
    expect(d.length).toBeGreaterThan(0)
  })
})
