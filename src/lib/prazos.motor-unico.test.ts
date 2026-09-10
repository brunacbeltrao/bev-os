/**
 * Guarda: um motor de prazo só.
 *
 * Este teste existe por um erro concreto. Depois da reescrita do motor, em
 * 09/09, o EPEAS ficou com dois cálculos vivos: o indicador do topo dizia
 * "Atrasados: 0" enquanto 31 dos 32 cartões logo abaixo apareciam em
 * vermelho, porque cartão, checklist e pipeline ainda liam a conta antiga.
 * Um painel que se contradiz na mesma tela destrói a confiança da equipe
 * mais rápido do que qualquer prazo errado.
 *
 * A regra que este arquivo protege: aritmética de data no EPEAS só existe
 * dentro de `lib/prazos.ts`. Todo o resto do módulo consome o resultado.
 *
 * Se este teste falhar, a correção NÃO é adicionar o arquivo novo à lista de
 * exceções — é mover a conta para o motor.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = new URL('../..', import.meta.url).pathname

/** Onde o módulo EPEAS vive. */
const ALVOS = [
  'src/lib/epeas.ts',
  'src/lib/epeas-prazos.ts',
  'src/components/features/epeas',
  'src/routes/_app/epeas.index.tsx',
  'src/routes/_app/epeas.contrato.$contratoId.tsx',
]

/** O único arquivo autorizado a fazer conta de dia. */
const MOTOR = 'src/lib/prazos.ts'

function arquivosDe(alvo: string): string[] {
  const caminho = join(RAIZ, alvo)
  if (!statSync(caminho).isDirectory()) return [alvo]
  return readdirSync(caminho)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts'))
    .map((f) => `${alvo}/${f}`)
}

const ARQUIVOS = ALVOS.flatMap(arquivosDe)

/**
 * Aritmética de prazo, em qualquer arquivo do módulo.
 *
 * Estes dois padrões só servem para uma coisa: transformar diferença de
 * milissegundos em dias. Os dois estavam nas três funções que esta mudança
 * aposentou (statusEtapa, statusEtapaServico, statusPrazo).
 */
const CONTA_DE_DIA: { re: RegExp; oque: string }[] = [
  { re: /86_?400_?000/, oque: 'milissegundos de um dia (86400000)' },
  { re: /setHours\(/, oque: 'setHours() para normalizar data' },
]

/**
 * Leitura de relógio na camada de tela.
 *
 * Em componente e rota não existe uso legítimo: qualquer conta com "agora"
 * ali é duplicação do motor, que recebe `hoje` por parâmetro justamente para
 * poder ser testado. Em `lib/epeas.ts` os dois usos que sobraram não são
 * prazo — carimbo de nome de arquivo no upload e comparação de comentário
 * lido — e por isso a regra da tela não vale lá; o que vale lá é a de cima.
 */
const RELOGIO: { re: RegExp; oque: string }[] = [
  { re: /Date\.now\(\)/, oque: 'Date.now()' },
  { re: /\.getTime\(\)/, oque: '.getTime()' },
]

/** Sem comentários: é neles que a explicação do padrão costuma morar. */
function semComentario(linha: string): string {
  return linha.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
}

function varrer(arquivos: string[], padroes: typeof CONTA_DE_DIA): string[] {
  const achados: string[] = []
  for (const arquivo of arquivos) {
    readFileSync(join(RAIZ, arquivo), 'utf8')
      .split('\n')
      .forEach((linha, i) => {
        for (const { re, oque } of padroes) {
          if (re.test(semComentario(linha))) achados.push(`${arquivo}:${i + 1} usa ${oque}`)
        }
      })
  }
  return achados
}

describe('um motor de prazo só', () => {
  it('nenhum arquivo do EPEAS converte milissegundos em dias', () => {
    const achados = varrer(ARQUIVOS, CONTA_DE_DIA)
    expect(achados, `conta de dia fora de ${MOTOR}:\n${achados.join('\n')}`).toEqual([])
  })

  it('nenhuma tela do EPEAS lê o relógio por conta própria', () => {
    const telas = ARQUIVOS.filter((a) => a.startsWith('src/components') || a.startsWith('src/routes'))
    const achados = varrer(telas, RELOGIO)
    expect(achados, `relógio na camada de tela:\n${achados.join('\n')}`).toEqual([])
  })

  it('o motor continua sendo a única porta de entrada do cálculo', () => {
    const motor = readFileSync(join(RAIZ, MOTOR), 'utf8')
    expect(motor).toContain('export function calcularPrazo')

    // Quem calcula prazo tem que importar do motor, e não reimplementá-lo.
    const cola = readFileSync(join(RAIZ, 'src/lib/epeas-prazos.ts'), 'utf8')
    expect(cola).toMatch(/import\s*\{[\s\S]*calcularPrazo[\s\S]*\}\s*from\s*'\.\/prazos'/)
  })

  it('as funções de prazo aposentadas não voltaram para lib/epeas.ts', () => {
    const epeas = readFileSync(join(RAIZ, 'src/lib/epeas.ts'), 'utf8')
    for (const morta of ['statusEtapa', 'statusEtapaServico', 'statusPrazo', 'SLA_DIAS']) {
      expect(epeas, `${morta} voltou a existir em lib/epeas.ts`).not.toMatch(
        new RegExp(`export (function|const) ${morta}\\b`),
      )
    }
  })

  it('só uma função no módulo decide o que é atraso', () => {
    // `atrasado` é o campo que a tela lê para pintar de vermelho. Ele nasce
    // em um lugar só; se dois arquivos passarem a produzi-lo, a divergência
    // de 09/09 está de volta.
    const produtores = ARQUIVOS.concat(MOTOR).filter((arquivo) =>
      /atrasado:\s*(true|false|situacao)/.test(readFileSync(join(RAIZ, arquivo), 'utf8')),
    )
    expect(produtores).toEqual([MOTOR])
  })
})
