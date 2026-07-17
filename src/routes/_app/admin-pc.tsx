import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings, Users, Upload, CheckCircle2, AlertTriangle, PlayCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useApp } from '@/lib/app-context'
import {
  closeAndOpenCycle,
  addRosterMembers,
  getRoster,
  getAllDirectorates,
  getAllSubareas,
  getSystemSettings,
  updateSystemSetting,
  type RosterEntry,
} from '@/lib/admin'
import type { RoleType } from '@/lib/org'
import { ROLE_LABELS } from '@/lib/org'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/_app/admin-pc')({
  component: AdminPcPage,
})

function AdminPcPage() {
  const { cycle, primary } = useApp()
  const [activeTab, setActiveTab] = useState<'ciclo' | 'estrutura' | 'regras'>('ciclo')
  
  const canManage =
    primary.role === 'diretor' ||
    (primary.subarea.slug === 'pessoas_cultura' && ['gerente', 'coordenador'].includes(primary.role))

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertTriangle className="text-muted-foreground mb-4 size-12" />
        <h2 className="text-xl font-semibold">Acesso Negado</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Apenas a Direx ou a liderança de Pessoas e Cultura possuem acesso à gestão institucional.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in duration-300">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Settings className="text-primary size-6" /> Gestão Institucional
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Área restrita (Pessoas e Cultura / Direx). Configure a empresa para as próximas gestões.
        </p>
      </header>

      <div className="flex space-x-1 bg-muted/50 p-1 rounded-lg mb-6 max-w-md">
        <button
          onClick={() => setActiveTab('ciclo')}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'ciclo' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Ciclos e Membros
        </button>
        <button
          onClick={() => setActiveTab('estrutura')}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'estrutura' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Estrutura Org
        </button>
        <button
          onClick={() => setActiveTab('regras')}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'regras' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Regras e Trava
        </button>
      </div>

      {activeTab === 'ciclo' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-1">
            <CycleManager cycleName={cycle.nome} />
          </div>
          <div className="flex flex-col gap-6 lg:col-span-2">
            <RosterManager cycleId={cycle.id} />
          </div>
        </div>
      )}

      {activeTab === 'estrutura' && (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-card/50 border-dashed">
          <AlertTriangle className="text-muted-foreground mb-4 size-8" />
          <p className="text-muted-foreground text-sm">A edição visual da estrutura (Diretorias, Subáreas e Núcleos) será disponibilizada em breve.</p>
        </div>
      )}

      {activeTab === 'regras' && (
        <SettingsManager />
      )}
    </div>
  )
}

function SettingsManager() {
  const queryClient = useQueryClient()
  
  const settingsQ = useQuery({
    queryKey: ['system_settings'],
    queryFn: getSystemSettings,
  })

  const updateMut = useMutation({
    mutationFn: ({ key, value }: { key: string, value: any }) => updateSystemSetting(key, value),
    onSuccess: () => {
      toast.success('Regra atualizada com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['system_settings'] })
    },
    onError: () => toast.error('Erro ao atualizar a regra.')
  })

  if (settingsQ.isLoading) {
    return <p className="text-muted-foreground text-sm">Carregando configurações...</p>
  }

  const settings = settingsQ.data || []

  return (
    <Card className="border-muted shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Regras Dinâmicas do Sistema</CardTitle>
        <CardDescription>
          Em vez de precisar de um programador para alterar o banco de dados, você pode ativar ou desativar as regras de negócio por aqui.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {settings.length === 0 ? (
          <p className="text-sm text-muted-foreground">A tabela de configurações não foi inicializada. Por favor, rode a migration correspondente no banco de dados.</p>
        ) : (
          settings.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
              <div className="flex flex-col gap-1 pr-6">
                <p className="font-semibold text-sm text-foreground">{s.key}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
              <div>
                <label className="flex items-center cursor-pointer gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider">{s.value === 'true' ? 'Ativo' : 'Inativo'}</span>
                  <input 
                    type="checkbox" 
                    className="size-5 rounded cursor-pointer accent-primary" 
                    checked={s.value === 'true'} 
                    onChange={(e) => updateMut.mutate({ key: s.key, value: e.target.checked ? 'true' : 'false' })}
                    disabled={updateMut.isPending}
                  />
                </label>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function CycleManager({ cycleName }: { cycleName: string }) {
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')

  const mut = useMutation({
    mutationFn: () => closeAndOpenCycle(nome, inicio, fim),
    onSuccess: () => {
      toast.success(`Ciclo ${nome} iniciado com sucesso! Recarregando...`)
      setOpen(false)
      setTimeout(() => window.location.reload(), 1500)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao iniciar o ciclo.')
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ciclo vigente</CardTitle>
        <CardDescription>O ciclo que está rodando no momento</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="bg-accent/50 flex flex-col items-center justify-center rounded-lg border p-6 text-center">
          <PlayCircle className="text-primary mb-2 size-8" />
          <h2 className="text-3xl font-bold tracking-tight">{cycleName}</h2>
          <Badge variant="success" className="mt-2">Ativo</Badge>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              Encerrar e iniciar novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Virada de semestre</DialogTitle>
              <DialogDescription>
                Atenção: Ao iniciar um novo ciclo, o sistema atual será "congelado" no passado e todos os membros
                perderão o acesso de escrita, exigindo que você suba um novo Roster para o novo semestre.
              </DialogDescription>
            </DialogHeader>
            <form
              className="mt-4 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                mut.mutate()
              }}
            >
              <div className="flex flex-col gap-2">
                <Label>Nome do novo ciclo</Label>
                <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: 2027.1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Data de início</Label>
                  <Input required type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Data de fim</Label>
                  <Input required type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
                </div>
              </div>
              <Button type="submit" disabled={mut.isPending} variant="destructive">
                {mut.isPending ? 'Iniciando...' : 'Confirmar virada de semestre'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function RosterManager({ cycleId }: { cycleId: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [pastedData, setPastedData] = useState('')

  const dirsQ = useQuery({ queryKey: ['directorates-all'], queryFn: getAllDirectorates })
  const areasQ = useQuery({ queryKey: ['subareas-all'], queryFn: getAllSubareas })
  const rosterQ = useQuery({ queryKey: ['roster', cycleId], queryFn: () => getRoster(cycleId) })

  const parseData = () => {
    if (!dirsQ.data || !areasQ.data) return []
    const lines = pastedData.split('\n').map((l) => l.trim()).filter(Boolean)
    const members: RosterEntry[] = []

    for (const line of lines) {
      const parts = line.split('\t') // Copiar do excel gera tabulação
      if (parts.length < 5) continue
      
      const [email, nome, roleStr, dirStr, areaStr] = parts.map((p) => p.trim())
      
      const dirMatch = dirsQ.data.find((d) => d.nome.toLowerCase() === dirStr.toLowerCase())
      const areaMatch = areasQ.data.find((a) => a.nome.toLowerCase() === areaStr.toLowerCase())
      
      if (dirMatch && areaMatch) {
        let validRole: RoleType = 'assessor'
        const rLower = roleStr.toLowerCase()
        if (rLower.includes('diretor')) validRole = 'diretor'
        else if (rLower.includes('gerente')) validRole = 'gerente'
        else if (rLower.includes('coord')) validRole = 'coordenador'
        else if (rLower.includes('analista')) validRole = 'analista'
        
        members.push({
          email,
          nome,
          role: validRole,
          directorate_id: dirMatch.id,
          subarea_id: areaMatch.id,
        })
      }
    }
    return members
  }

  const parsedMembers = parseData()

  const mut = useMutation({
    mutationFn: async () => addRosterMembers(cycleId, parsedMembers),
    onSuccess: () => {
      toast.success(`${parsedMembers.length} membros importados!`)
      queryClient.invalidateQueries({ queryKey: ['roster', cycleId] })
      setOpen(false)
      setPastedData('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao importar membros.')
    },
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg">Membros aprovados (Roster)</CardTitle>
          <CardDescription>As únicas pessoas que podem acessar o sistema neste ciclo.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Upload className="mr-2 size-4" /> Importar lista
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Importar em lote (Excel)</DialogTitle>
              <DialogDescription>
                Copie e cole os dados da sua planilha. As colunas DEVEM estar na ordem:
                <br />
                <strong className="text-foreground">Email | Nome | Cargo | Diretoria | Área</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex flex-col gap-4">
              <Textarea
                placeholder="nome@bevilaqua.org.br&#9;Nome Sobrenome&#9;Assessor&#9;Negócios&#9;Comercial"
                className="font-mono min-h-[200px] text-xs whitespace-pre"
                value={pastedData}
                onChange={(e) => setPastedData(e.target.value)}
              />
              
              {parsedMembers.length > 0 && (
                <div className="bg-muted/50 max-h-48 overflow-y-auto rounded-md p-2">
                  <p className="mb-2 text-xs font-semibold">{parsedMembers.length} encontrados válidos:</p>
                  {parsedMembers.slice(0, 5).map((m, i) => (
                    <div key={i} className="text-xs">{m.email} - {ROLE_LABELS[m.role as RoleType]}</div>
                  ))}
                  {parsedMembers.length > 5 && <div className="text-muted-foreground text-xs mt-1">...e mais {parsedMembers.length - 5}</div>}
                </div>
              )}

              <Button
                disabled={parsedMembers.length === 0 || mut.isPending}
                onClick={() => mut.mutate()}
              >
                {mut.isPending ? 'Importando...' : `Confirmar inserção de ${parsedMembers.length} pessoas`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="mt-4 flex flex-col gap-2">
          {rosterQ.isLoading && <p className="text-muted-foreground text-sm">Carregando roster...</p>}
          {(rosterQ.data ?? []).length === 0 && !rosterQ.isLoading && (
            <div className="bg-accent/50 flex flex-col items-center justify-center rounded-lg border p-8 text-center">
              <Users className="text-muted-foreground mb-3 size-10" />
              <p className="text-sm font-medium">Nenhum membro aprovado no ciclo</p>
              <p className="text-muted-foreground mt-1 text-xs">Importe a lista para que a EJ possa utilizar o sistema.</p>
            </div>
          )}
          
          <div className="grid max-h-[400px] overflow-y-auto gap-1 text-sm">
            {(rosterQ.data ?? []).map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-md border p-2">
                <div className="flex flex-col">
                  <span className="font-medium">{m.nome}</span>
                  <span className="text-muted-foreground text-xs">{m.email}</span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div className="flex flex-col items-end">
                    <span className="text-xs">{ROLE_LABELS[m.role as RoleType]}</span>
                    <span className="text-muted-foreground text-xs">{m.subareas?.nome}</span>
                  </div>
                  {m.claimed ? (
                    <span title="Conta Ativada"><CheckCircle2 className="text-emerald-500 size-5" /></span>
                  ) : (
                    <div className="bg-muted size-5 rounded-full" title="Pendente" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
