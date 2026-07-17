import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings, Users, CheckCircle2, AlertTriangle, PlayCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  createDirectorate,
  updateDirectorate,
  createSubarea,
  updateSubarea,
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
        <OrgStructureManager />
      )}

      {activeTab === 'regras' && (
        <SettingsManager />
      )}
    </div>
  )
}

function OrgStructureManager() {
  const queryClient = useQueryClient()
  const [openDirForm, setOpenDirForm] = useState(false)
  const [openSubForm, setOpenSubForm] = useState(false)
  const [editingDir, setEditingDir] = useState<any>(null)
  const [editingSub, setEditingSub] = useState<any>(null)
  
  const [formData, setFormData] = useState({ nome: '', slug: '', parentId: '' })

  const dirsQ = useQuery({ queryKey: ['directorates-all'], queryFn: getAllDirectorates })
  const areasQ = useQuery({ queryKey: ['subareas-all'], queryFn: getAllSubareas })

  const handleOpenDir = (dir?: any) => {
    if (dir) {
      setEditingDir(dir)
      setFormData({ nome: dir.nome, slug: dir.slug, parentId: '' })
    } else {
      setEditingDir(null)
      setFormData({ nome: '', slug: '', parentId: '' })
    }
    setOpenDirForm(true)
  }

  const handleOpenSub = (dirId: string, sub?: any) => {
    if (sub) {
      setEditingSub(sub)
      setFormData({ nome: sub.nome, slug: sub.slug, parentId: dirId })
    } else {
      setEditingSub(null)
      setFormData({ nome: '', slug: '', parentId: dirId })
    }
    setOpenSubForm(true)
  }

  const dirMut = useMutation({
    mutationFn: async () => {
      if (editingDir) {
        await updateDirectorate(editingDir.id, formData.nome, formData.slug)
      } else {
        await createDirectorate(formData.nome, formData.slug)
      }
    },
    onSuccess: () => {
      toast.success(editingDir ? 'Diretoria atualizada!' : 'Diretoria criada!')
      queryClient.invalidateQueries({ queryKey: ['directorates-all'] })
      setOpenDirForm(false)
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao salvar diretoria.')
  })

  const subMut = useMutation({
    mutationFn: async () => {
      if (editingSub) {
        await updateSubarea(editingSub.id, formData.nome, formData.slug)
      } else {
        await createSubarea(formData.parentId, formData.nome, formData.slug)
      }
    },
    onSuccess: () => {
      toast.success(editingSub ? 'Área atualizada!' : 'Área criada!')
      queryClient.invalidateQueries({ queryKey: ['subareas-all'] })
      setOpenSubForm(false)
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao salvar área.')
  })

  if (dirsQ.isLoading || areasQ.isLoading) {
    return <p className="text-muted-foreground text-sm">Carregando estrutura...</p>
  }

  return (
    <Card className="border-muted shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Estrutura de Diretorias e Áreas</CardTitle>
          <CardDescription>
            Gerencie como a empresa está dividida. As áreas cadastradas aqui aparecerão no cadastro dos novos membros.
          </CardDescription>
        </div>
        <Button onClick={() => handleOpenDir()} size="sm">Adicionar Diretoria</Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {dirsQ.data?.map((dir) => {
          const subs = areasQ.data?.filter(a => a.directorate_id === dir.id) || []
          
          return (
            <details key={dir.id} className="group border rounded-lg bg-card overflow-hidden">
              <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{dir.nome}</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">{dir.slug}</Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">{subs.length} áreas</span>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={(e) => { e.preventDefault(); handleOpenDir(dir) }}>
                    Editar
                  </Button>
                  <svg className="size-4 text-muted-foreground transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>
              <div className="p-4 pt-0 border-t bg-muted/10">
                <div className="flex flex-col gap-2 mt-4">
                  {subs.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between p-2 pl-4 border-l-2 border-primary/20 hover:border-primary transition-colors rounded-r-md hover:bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{sub.nome}</span>
                        <span className="text-xs text-muted-foreground font-mono">({sub.slug})</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleOpenSub(dir.id, sub)}>
                        Editar Área
                      </Button>
                    </div>
                  ))}
                  {subs.length === 0 && <p className="text-xs text-muted-foreground pl-4">Nenhuma área cadastrada.</p>}
                  
                  <div className="pl-4 mt-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleOpenSub(dir.id)}>
                      + Nova Área
                    </Button>
                  </div>
                </div>
              </div>
            </details>
          )
        })}

        {/* Modal de Diretoria */}
        <Dialog open={openDirForm} onOpenChange={setOpenDirForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDir ? 'Editar Diretoria' : 'Nova Diretoria'}</DialogTitle>
              <DialogDescription>Uma diretoria é o nível mais alto de agrupamento da empresa.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); dirMut.mutate() }} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-2">
                <Label>Nome da Diretoria</Label>
                <Input value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} required placeholder="Ex: Negócios" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Slug (identificador URL)</Label>
                <Input value={formData.slug} onChange={(e) => setFormData({...formData, slug: e.target.value})} required placeholder="Ex: negocios" pattern="[a-z0-9_]+" title="Apenas letras minúsculas, números e underline" />
                <span className="text-[10px] text-muted-foreground">Usado internamente pelo sistema. Ex: "pessoas_cultura". Sem espaços.</span>
              </div>
              <Button type="submit" disabled={dirMut.isPending} className="mt-2">
                {dirMut.isPending ? 'Salvando...' : 'Salvar Diretoria'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal de Subárea */}
        <Dialog open={openSubForm} onOpenChange={setOpenSubForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSub ? 'Editar Área' : 'Nova Área'}</DialogTitle>
              <DialogDescription>As áreas pertencem a uma diretoria específica.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); subMut.mutate() }} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-2">
                <Label>Nome da Área</Label>
                <Input value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} required placeholder="Ex: Comercial" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Slug (identificador URL)</Label>
                <Input value={formData.slug} onChange={(e) => setFormData({...formData, slug: e.target.value})} required placeholder="Ex: comercial" pattern="[a-z0-9_]+" title="Apenas letras minúsculas, números e underline" />
                <span className="text-[10px] text-muted-foreground">Ex: "marketing". Sem espaços ou caracteres especiais.</span>
              </div>
              <Button type="submit" disabled={subMut.isPending} className="mt-2">
                {subMut.isPending ? 'Salvando...' : 'Salvar Área'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
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
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState<RoleType>('assessor')
  const [areaId, setAreaId] = useState('')

  const areasQ = useQuery({ queryKey: ['subareas-all'], queryFn: getAllSubareas })
  const rosterQ = useQuery({ queryKey: ['roster', cycleId], queryFn: () => getRoster(cycleId) })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!areaId) {
      toast.error('Selecione uma área.')
      return
    }
    const area = areasQ.data?.find((a) => a.id === areaId)
    if (!area) return

    const newMember: RosterEntry = {
      email,
      nome,
      role: cargo,
      directorate_id: area.directorate_id,
      subarea_id: area.id,
    }
    mut.mutate([newMember])
  }

  const mut = useMutation({
    mutationFn: async (members: RosterEntry[]) => addRosterMembers(cycleId, members),
    onSuccess: () => {
      toast.success(`Membro adicionado com sucesso!`)
      queryClient.invalidateQueries({ queryKey: ['roster', cycleId] })
      setOpen(false)
      setNome('')
      setEmail('')
      setCargo('assessor')
      setAreaId('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao adicionar membro.')
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
              <Users className="mr-2 size-4" /> Adicionar Membro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Membro</DialogTitle>
              <DialogDescription>
                Insira os dados do membro para permitir o acesso dele no ciclo vigente.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="mt-2 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Nome Completo</Label>
                <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João Silva" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>E-mail (Bevilaqua)</Label>
                <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@bevilaqua.org.br" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Cargo</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value as RoleType)}
                    required
                  >
                    {Object.entries(ROLE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Área/Subárea</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={areaId}
                    onChange={(e) => setAreaId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Selecione...</option>
                    {areasQ.data?.map((a) => (
                      <option key={a.id} value={a.id}>{a.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button type="submit" disabled={mut.isPending} className="mt-2">
                {mut.isPending ? 'Adicionando...' : 'Confirmar'}
              </Button>
            </form>
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
