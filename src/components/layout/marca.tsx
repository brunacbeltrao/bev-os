/**
 * Marca Bevilaqua.
 *
 * O símbolo tem duas versões: preto+verde para fundo claro e branco+verde
 * para fundo escuro. Em vez de recolorir por CSS — o que quebraria a marca,
 * porque o verde não muda e o preto sim — cada versão é um arquivo, e a
 * troca é feita por classe do Tailwind, sem JavaScript.
 *
 * `onError` existe porque os arquivos da marca ainda não estão no
 * repositório: enquanto não estiverem, cada ponto de uso volta a mostrar o
 * texto que mostrava antes, em vez de um ícone quebrado. Assim que os SVGs
 * entrarem em `public/marca/`, a marca aparece sozinha, sem tocar em código.
 */
import { useState } from 'react'

const ARQUIVOS = {
  simbolo: {
    escuro: '/marca/bevilaqua-simbolo.png', // preto + verde, para fundo claro
    claro: '/marca/bevilaqua-simbolo-claro.png', // branco + verde, para fundo escuro
  },
  completa: {
    escuro: '/marca/bevilaqua-completo.png',
    claro: '/marca/bevilaqua-completo-claro.png',
  },
} as const

type Peca = keyof typeof ARQUIVOS
/** `auto` segue o tema; `claro`/`escuro` forçam, para painéis de cor fixa. */
type Tom = 'auto' | 'claro' | 'escuro'

function Imagem({
  peca,
  tom,
  className,
  onError,
}: {
  peca: Peca
  tom: 'claro' | 'escuro'
  className?: string
  onError: () => void
}) {
  return (
    <img
      src={ARQUIVOS[peca][tom]}
      alt="Bevilaqua"
      className={className}
      onError={onError}
      draggable={false}
    />
  )
}

export function Marca({
  peca = 'simbolo',
  tom = 'auto',
  className,
  children,
}: {
  peca?: Peca
  tom?: Tom
  className?: string
  /** O que mostrar se o arquivo da marca ainda não existir. */
  children: React.ReactNode
}) {
  const [semArquivo, setSemArquivo] = useState(false)
  if (semArquivo) return <>{children}</>

  const falhou = () => setSemArquivo(true)

  if (tom !== 'auto') {
    return <Imagem peca={peca} tom={tom} className={className} onError={falhou} />
  }

  // Fundo claro mostra a versão preta; o tema escuro troca pela branca.
  return (
    <>
      <Imagem peca={peca} tom="escuro" className={`${className} dark:hidden`} onError={falhou} />
      <Imagem
        peca={peca}
        tom="claro"
        className={`${className} hidden dark:block`}
        onError={falhou}
      />
    </>
  )
}
