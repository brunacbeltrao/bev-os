import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addEventDoc,
  createEvent,
  deleteEvent,
  deleteEventDoc,
  getEvents,
  getEventDocs,
  getEventRsvps,
  getMeetingTypes,
  getMinute,
  setRsvp,
  updateEvent,
  updateEventPauta,
  upsertMinute,
  type EventAudience
} from '@/lib/agenda'
import { createJustification } from '@/lib/frequencia'
import { useApp } from '@/lib/app-context'

export function useAgendaTypes() {
  return useQuery({
    queryKey: ['meeting-types'],
    queryFn: getMeetingTypes,
    staleTime: Infinity,
  })
}

export function useAgendaEvents(ano: number, mes: number) {
  const fromIso = new Date(ano, mes, 1).toISOString()
  const toIso = new Date(ano, mes + 1, 1).toISOString()
  
  return useQuery({
    queryKey: ['events', ano, mes],
    queryFn: () => getEvents(fromIso, toIso),
  })
}

export function useAgendaEventRsvps(eventId: string) {
  return useQuery({
    queryKey: ['event-rsvps', eventId],
    queryFn: () => getEventRsvps(eventId),
    enabled: !!eventId,
  })
}

export function useAgendaEventDocs(eventId: string) {
  return useQuery({
    queryKey: ['event-docs', eventId],
    queryFn: () => getEventDocs(eventId),
    enabled: !!eventId,
  })
}

export function useAgendaEventMinute(eventId: string) {
  return useQuery({
    queryKey: ['minute', eventId],
    queryFn: () => getMinute(eventId),
    enabled: !!eventId,
  })
}

export function useAgendaMutations() {
  const queryClient = useQueryClient()
  const { person } = useApp()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['events'] })
    queryClient.invalidateQueries({ queryKey: ['upcoming-events'] })
  }

  const createMut = useMutation({
    mutationFn: (data: {
      meeting_type_id: string
      data: string
      titulo?: string
      pauta?: string
      audiencia: EventAudience
      link_reuniao?: string
      obrig_diretores: boolean
      obrig_gerentes: boolean
      obrig_assessores: boolean
      targetDirectorateIds: string[]
    }) => createEvent({ ...data, criado_por: person.id, subarea_id: null }),
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({
      id,
      data,
      alvos,
    }: {
      id: string
      data: any
      alvos: string[]
    }) => updateEvent(id, data, alvos),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}

export function useRsvpMutations(eventId: string) {
  const queryClient = useQueryClient()
  const { person } = useApp()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['events'] })
    queryClient.invalidateQueries({ queryKey: ['event-rsvps', eventId] })
    queryClient.invalidateQueries({ queryKey: ['pending-confirmations'] })
  }

  const confirmMut = useMutation({
    mutationFn: () => setRsvp(eventId, person.id, 'confirmado'),
    onSuccess: invalidate,
  })

  const recusaMut = useMutation({
    mutationFn: async (motivo: string) => {
      await setRsvp(eventId, person.id, 'recusado')
      await createJustification(person.id, eventId, motivo)
    },
    onSuccess: invalidate,
  })

  return { confirmMut, recusaMut }
}

export function useEventDetailMutations(eventId: string) {
  const queryClient = useQueryClient()
  const { person } = useApp()

  const savePautaMut = useMutation({
    mutationFn: (pauta: string) => updateEventPauta(eventId, pauta),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })

  const saveAtaMut = useMutation({
    mutationFn: (ata: string) => upsertMinute(eventId, ata, person.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['minute', eventId] }),
  })

  const addDocMut = useMutation({
    mutationFn: ({ nome, url }: { nome: string; url: string }) => addEventDoc(eventId, nome, url),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-docs', eventId] }),
  })

  const delDocMut = useMutation({
    mutationFn: (id: string) => deleteEventDoc(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-docs', eventId] }),
  })

  return { savePautaMut, saveAtaMut, addDocMut, delDocMut }
}
