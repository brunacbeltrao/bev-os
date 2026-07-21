/**
 * Lista reordenável (PRD RF-07). Arrastar e soltar nativo, com botões
 * de subir/descer ao lado — quem usa teclado ou toque não fica de fora.
 */
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ListaOrdenavel({
  ids,
  onReordenar,
  children,
}: {
  ids: string[]
  onReordenar: (novaOrdem: string[]) => void
  children: (id: string, alca: ReactNode, indice: number) => ReactNode
}) {
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)

  function mover(de: number, para: number) {
    if (para < 0 || para >= ids.length || de === para) return
    const copia = [...ids]
    const [item] = copia.splice(de, 1)
    copia.splice(para, 0, item)
    onReordenar(copia)
  }

  return (
    <>
      {ids.map((id, i) => {
        const alca = (
          <span className="flex shrink-0 items-center gap-0.5">
            <span
              className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
              title="Arraste para reordenar"
            >
              <GripVertical className="size-4" />
            </span>
            <span className="flex flex-col">
              <button
                type="button"
                aria-label="Mover para cima"
                disabled={i === 0}
                onClick={() => mover(i, i - 1)}
                className="text-muted-foreground hover:text-foreground disabled:opacity-25"
              >
                <ChevronUp className="size-3" />
              </button>
              <button
                type="button"
                aria-label="Mover para baixo"
                disabled={i === ids.length - 1}
                onClick={() => mover(i, i + 1)}
                className="text-muted-foreground hover:text-foreground disabled:opacity-25"
              >
                <ChevronDown className="size-3" />
              </button>
            </span>
          </span>
        )

        return (
          <div
            key={id}
            draggable
            onDragStart={() => setArrastando(id)}
            onDragEnd={() => {
              setArrastando(null)
              setSobre(null)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (sobre !== id) setSobre(id)
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (!arrastando || arrastando === id) return
              mover(ids.indexOf(arrastando), i)
              setArrastando(null)
              setSobre(null)
            }}
            className={cn(
              'transition-opacity',
              arrastando === id && 'opacity-40',
              sobre === id && arrastando && arrastando !== id && 'ring-ring rounded-lg ring-2',
            )}
          >
            {children(id, alca, i)}
          </div>
        )
      })}
    </>
  )
}
