/** Redireciona para /liderados — a página passou a ser única e acessível
 *  a toda liderança (não só à Direx). Mantido para não quebrar links. */
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/diretor/liderados')({
  beforeLoad: () => {
    throw redirect({ to: '/liderados' })
  },
})
