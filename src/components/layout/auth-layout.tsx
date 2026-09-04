/**
 * Layout das telas de autenticação: painel institucional à esquerda
 * (grafite + verde Bevilaqua, fixo e independente do tema) e o
 * formulário à direita. Em telas pequenas, só o formulário.
 */
import type { ReactNode } from 'react'
import { Marca } from '@/components/layout/marca'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen">
      {/* Painel institucional — cores da marca, não muda com o tema */}
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-[#212021] p-10 text-[#f3f3f3] lg:flex">
        {/* O painel é sempre grafite, então a marca aqui é sempre a clara. */}
        <Marca peca="completa" tom="claro" className="h-9 w-auto">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#a9cf44] text-sm font-bold text-[#212021]">
              B
            </span>
            <span className="text-base font-semibold tracking-tight">BEV OS</span>
          </div>
        </Marca>

        <div>
          <h1 className="max-w-md text-balance text-4xl font-bold leading-[1.15] tracking-tight">
            O sistema operacional do <span className="text-[#a9cf44]">Bevilaqua</span>.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#f3f3f3]/70">
            Demandas, calendário, comercial, projetos e desenvolvimento de pessoas — tudo da EJ em
            um só lugar.
          </p>
        </div>

        <p className="text-xs text-[#f3f3f3]/50">
          Escritório Modelo Empresarial Bevilaqua · FDR/UFPE
        </p>

        {/* brilho sutil da marca no canto */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-40 size-96 rounded-full bg-[#a9cf44]/15 blur-3xl"
        />
      </aside>

      <section className="flex min-w-0 flex-1 items-center justify-center p-4 sm:p-8">
        <div className="animate-fade-up w-full max-w-sm">{children}</div>
      </section>
    </main>
  )
}
