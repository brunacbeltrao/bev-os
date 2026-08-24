import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Coins, Trophy, ShieldCheck, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, XCircle, Trash2, Pencil, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useConfirm } from '@/components/ui/confirm-dialog'
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
  getMyWallet,
  getRanking,
  getPendingRequests,
  requestRedemption,
  evaluateRequest,
  creditBevCoins,
  getEligibleMembers,
  getCycleLedger,
  buildBalances,
  deleteCredit,
  updateCredit,
  CARGO_LABELS,
} from '@/lib/fid'
import type { LedgerTx } from '@/lib/fid'
import {
  canLaunchBevCoins,
  isDiretorGestao,
  isEligibleForBevCoins,
} from '@/lib/permissions'

export const Route = createFileRoute('/_app/fid')({
  component: FidPage,
})

function FidPage() {
  const { cycle, occupations } = useApp()

  // Lançar crédito: lideranças da Diretoria de Negócios.
  // Atestar / reprovar resgate: apenas o Diretor de Gestão.
  const canCredit = canLaunchBevCoins(occupations)
  const canApprove = isDiretorGestao(occupations)
  const canAdmin = canCredit || canApprove
  const isEligible = isEligibleForBevCoins(occupations)

  const [activeTab, setActiveTab] = useState<'carteira' | 'ranking' | 'admin'>(isEligible ? 'carteira' : 'admin')

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Fundo Individual de Desenvolvimento</h1>
        <p className="text-muted-foreground">
          Acumule BevCoins em contratos fechados e invista no seu desenvolvimento!
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {isEligible && (
          <Button
            variant={activeTab === 'carteira' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('carteira')}
            className="gap-2"
          >
            <Coins className="size-4" />
            Minha Carteira
          </Button>
        )}
        <Button
          variant={activeTab === 'ranking' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('ranking')}
          className="gap-2"
        >
          <Trophy className="size-4" />
          Ranking
        </Button>
        {canAdmin && (
          <Button
            variant={activeTab === 'admin' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('admin')}
            className="gap-2"
          >
            <ShieldCheck className="size-4" />
            Administração
          </Button>
        )}
      </div>

      <div className="mt-4">
        {activeTab === 'carteira' && isEligible && <WalletTab cycleId={cycle.id} />}
        {activeTab === 'ranking' && <RankingTab cycleId={cycle.id} />}
        {activeTab === 'admin' && canAdmin && <AdminTab cycleId={cycle.id} canCredit={canCredit} canApprove={canApprove} />}
      </div>
    </div>
  )
}

function WalletTab({ cycleId }: { cycleId: string }) {
  // ... (WalletTab remains largely the same)
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['my_wallet', cycleId],
    queryFn: () => getMyWallet(cycleId),
  })

  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')

  const mut = useMutation({
    mutationFn: () => requestRedemption(cycleId, Number(amount), desc),
    onSuccess: () => {
      toast.success('Solicitação de resgate enviada! Aguarde a aprovação.')
      setOpen(false)
      setAmount('')
      setDesc('')
      qc.invalidateQueries({ queryKey: ['my_wallet'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao solicitar resgate.')
    },
  })

  if (isLoading) return <div>Carregando carteira...</div>
  if (!data) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium uppercase tracking-wider">
              Saldo Disponível
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-primary flex items-baseline gap-2 text-4xl font-bold">
              <Coins className="size-8" />
              {Number(data.available_balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium uppercase tracking-wider">
              Total Acumulado no Ciclo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 text-4xl font-bold">
              <ArrowDownToLine className="size-8 text-green-500" />
              {Number(data.total_earned).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Extrato</CardTitle>
            <CardDescription>Histórico de créditos e débitos</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Solicitar Resgate</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Solicitar Resgate de BevCoins</DialogTitle>
                <DialogDescription>
                  Preencha os dados do investimento (ex: Inscrição ENEJ, Livro X, etc). O valor
                  ficará retido até a aprovação da Diretoria.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  mut.mutate()
                }}
                className="mt-4 flex flex-col gap-4"
              >
                <div className="flex flex-col gap-2">
                  <Label>Descrição / Link do Investimento</Label>
                  <Input
                    required
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Ex: Inscrição EPEEJ"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Valor em BevCoins</Label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={data.available_balance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="150.00"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={
                    mut.isPending ||
                    Number(amount) <= 0 ||
                    Number(amount) > data.available_balance
                  }
                >
                  Confirmar Solicitação
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {data.transactions.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
              Nenhuma transação encontrada neste ciclo.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {data.transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-full p-2 ${
                        tx.type === 'credit'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {tx.type === 'credit' ? (
                        <ArrowDownToLine className="size-4" />
                      ) : (
                        <ArrowUpFromLine className="size-4" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{tx.description}</span>
                      <span className="text-muted-foreground text-xs">
                        {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-bold ${tx.type === 'credit' ? 'text-green-600' : ''}`}
                    >
                      {tx.type === 'credit' ? '+' : '-'}{' '}
                      {Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <Badge
                      variant={
                        tx.status === 'approved'
                          ? 'success'
                          : tx.status === 'rejected'
                            ? 'danger'
                            : 'secondary'
                      }
                      className="mt-1 text-[10px]"
                    >
                      {tx.status === 'approved'
                        ? 'Aprovado'
                        : tx.status === 'rejected'
                          ? 'Rejeitado'
                          : 'Pendente'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RankingTab({ cycleId }: { cycleId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['fid_ranking', cycleId],
    queryFn: () => getRanking(cycleId),
  })

  if (isLoading) return <div>Carregando ranking...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranking Institucional</CardTitle>
        <CardDescription>Membros que mais acumularam BevCoins neste ciclo.</CardDescription>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
            Ainda não há ganhos registrados neste ciclo.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.map((m, index) => (
              <div
                key={m.person_id}
                className="bg-card hover:bg-accent/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex size-8 items-center justify-center rounded-full font-bold ${
                      index === 0
                        ? 'bg-yellow-100 text-yellow-700'
                        : index === 1
                          ? 'bg-slate-200 text-slate-700'
                          : index === 2
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {index + 1}º
                  </div>
                  <Avatar>
                    <AvatarImage src={m.foto_url || undefined} />
                    <AvatarFallback>{m.nome.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold">{m.nome}</span>
                </div>
                <div className="text-primary flex items-center gap-1 font-bold">
                  {Number(m.total_earned).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{' '}
                  <Coins className="size-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AdminTab({ cycleId, canCredit, canApprove }: { cycleId: string, canCredit: boolean, canApprove: boolean }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['fid_pending', cycleId],
    queryFn: () => getPendingRequests(cycleId),
    enabled: canApprove,
  })

  const [openCredit, setOpenCredit] = useState(false)
  const [personId, setPersonId] = useState('')
  const [contractValue, setContractValue] = useState('')
  const [desc, setDesc] = useState('')
  const [participation, setParticipation] = useState('100')

  // O sistema calcula sozinho: Valor * (Participação/100) * 0.0625
  const calculatedBevCoins = (Number(contractValue) * (Number(participation)/100)) * 0.0625

  const mutCredit = useMutation({
    mutationFn: () => creditBevCoins(cycleId, personId, calculatedBevCoins, desc),
    onSuccess: () => {
      toast.success('Crédito lançado com sucesso!')
      setOpenCredit(false)
      setPersonId('')
      setContractValue('')
      setParticipation('100')
      setDesc('')
      qc.invalidateQueries({ queryKey: ['fid_ranking'] })
      qc.invalidateQueries({ queryKey: ['my_wallet'] })
      qc.invalidateQueries({ queryKey: ['fid_ledger'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao lançar crédito.')
    },
  })

  const mutEval = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      evaluateRequest(id, status),
    onSuccess: () => {
      toast.success('Solicitação avaliada.')
      qc.invalidateQueries({ queryKey: ['fid_pending'] })
    },
  })

  // Todo mundo do roster é pré-provisionado no banco, então os nomes
  // aparecem aqui mesmo antes de a pessoa criar a conta.
  const { data: members, isPending: membersPending } = useQuery({
    queryKey: ['bevcoins-elegiveis', cycleId],
    queryFn: () => getEligibleMembers(cycleId),
    enabled: canCredit,
  })

  return (
    <div className="flex flex-col gap-6">
      {canCredit && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle>Painel de Negócios</CardTitle>
              <CardDescription>
                Lançamento de créditos por contrato fechado — só a Diretoria de Negócios lança
                (6,25% de conversão calculada automaticamente). A aprovação dos resgates é do
                Diretor de Gestão.
              </CardDescription>
            </div>
            <Dialog open={openCredit} onOpenChange={setOpenCredit}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Coins className="size-4" /> Lançar Crédito
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Lançar Crédito Comercial</DialogTitle>
                  <DialogDescription>
                    Selecione o membro elegível (Assessor, Gerente ou Diretor) e digite o valor do contrato fechado. O sistema fará a conversão automática.
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    mutCredit.mutate()
                  }}
                  className="mt-4 flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <Label>Membro Elegível</Label>
                    <select
                      required
                      className="border-input ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={personId}
                      onChange={(e) => setPersonId(e.target.value)}
                    >
                      <option value="" disabled>
                        {membersPending ? 'Carregando membros…' : 'Selecione um membro...'}
                      </option>
                      {members?.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome} — {CARGO_LABELS[m.cargo]} · {m.area}
                        </option>
                      ))}
                    </select>
                    {!membersPending && members && members.length === 0 && (
                      <p className="text-muted-foreground text-xs">
                        Nenhum membro elegível encontrado neste ciclo.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Nome do Contrato / Cliente</Label>
                    <Input
                      required
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      placeholder="Ex: Consultoria ABC"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Valor do Contrato (R$)</Label>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={contractValue}
                        onChange={(e) => setContractValue(e.target.value)}
                        placeholder="1000.00"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>% Participação no Venda</Label>
                      <Input
                        required
                        type="number"
                        step="1"
                        min="1"
                        max="100"
                        value={participation}
                        onChange={(e) => setParticipation(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted rounded-md border text-sm flex justify-between items-center mt-2">
                    <span className="font-medium text-muted-foreground">Crédito Estimado:</span>
                    <span className="font-bold text-primary flex items-center gap-1">
                      {calculatedBevCoins > 0 ? calculatedBevCoins.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} <Coins className="size-3" />
                    </span>
                  </div>

                  <Button type="submit" disabled={mutCredit.isPending || calculatedBevCoins <= 0}>
                    Confirmar Lançamento
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
        </Card>
      )}

      <SaldosCard cycleId={cycleId} canCredit={canCredit} />

      {canApprove && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Painel de Gestão: Solicitações Pendentes</CardTitle>
              <CardDescription>Resgates solicitados pelos membros</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div>Carregando...</div>
            ) : !data || data.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
                Nenhuma solicitação pendente.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {data.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={(tx.people as any).foto_url || undefined} />
                        <AvatarFallback>
                          {(tx.people as any).nome.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-semibold">{(tx.people as any).nome}</span>
                        <span className="text-muted-foreground text-sm">{tx.description}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-red-600">
                        - {Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="text-green-600 hover:bg-green-50 hover:text-green-700"
                          onClick={() => mutEval.mutate({ id: tx.id, status: 'approved' })}
                          disabled={mutEval.isPending}
                        >
                          <CheckCircle2 className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => mutEval.mutate({ id: tx.id, status: 'rejected' })}
                          disabled={mutEval.isPending}
                        >
                          <XCircle className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Saldos por membro — total acumulado, com histórico por pessoa
// ---------------------------------------------------------------------------

const brl = (n: number) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando aval',
  approved: 'Aprovado',
  rejected: 'Reprovado',
}

function SaldosCard({ cycleId, canCredit }: { cycleId: string; canCredit: boolean }) {
  const qc = useQueryClient()
  const confirmar = useConfirm()

  const { data, isLoading } = useQuery({
    queryKey: ['fid_ledger', cycleId],
    queryFn: () => getCycleLedger(cycleId),
  })

  const [aberto, setAberto] = useState<string | null>(null)
  const [editando, setEditando] = useState<LedgerTx | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['fid_ledger', cycleId] })
    qc.invalidateQueries({ queryKey: ['fid_ranking'] })
    qc.invalidateQueries({ queryKey: ['my_wallet'] })
  }

  const mutDelete = useMutation({
    mutationFn: (id: string) => deleteCredit(id),
    onSuccess: () => {
      toast.success('Crédito estornado.')
      invalidar()
    },
  })

  const mutUpdate = useMutation({
    mutationFn: () => updateCredit(editando!.id, Number(editAmount), editDesc),
    onSuccess: () => {
      toast.success('Crédito atualizado.')
      setEditando(null)
      invalidar()
    },
  })

  const saldos = buildBalances(data ?? [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldos por membro</CardTitle>
        <CardDescription>
          Total acumulado no ciclo. Clique em alguém para ver os lançamentos e as solicitações de
          uso.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Carregando…</div>
        ) : saldos.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
            Nenhum BevCoin lançado neste ciclo.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {saldos.map((m) => {
              const expandido = aberto === m.person_id
              return (
                <div key={m.person_id} className="rounded-lg border">
                  <button
                    type="button"
                    aria-expanded={expandido}
                    onClick={() => setAberto(expandido ? null : m.person_id)}
                    className="hover:bg-accent/50 flex w-full items-center justify-between gap-4 rounded-lg p-4 text-left transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar>
                        <AvatarImage src={m.foto_url || undefined} />
                        <AvatarFallback>{m.nome.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">{m.nome}</span>
                        <span className="text-muted-foreground text-xs">
                          {m.creditos.length} lançamento{m.creditos.length === 1 ? '' : 's'}
                          {m.resgates.length > 0 &&
                            ` · ${m.resgates.length} solicitaç${m.resgates.length === 1 ? 'ão' : 'ões'}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      <div className="text-right">
                        <div className="text-primary flex items-center justify-end gap-1 text-lg font-bold">
                          {brl(m.available)}
                          <Coins className="size-4" />
                        </div>
                        <div className="text-muted-foreground text-xs">
                          acumulado {brl(m.earned)}
                          {m.pending > 0 && ` · ${brl(m.pending)} retido`}
                        </div>
                      </div>
                      <ChevronDown
                        className={`text-muted-foreground size-4 shrink-0 transition-transform ${expandido ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </div>
                  </button>

                  {expandido && (
                    <div className="flex flex-col gap-4 border-t p-4">
                      <div>
                        <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                          Lançamentos
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {m.creditos.map((tx) => (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                            >
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate">{tx.description}</span>
                                <span className="text-muted-foreground text-xs">
                                  {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="font-semibold text-green-600">
                                  + {brl(Number(tx.amount))}
                                </span>
                                {canCredit && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-7"
                                      aria-label="Editar crédito"
                                      onClick={() => {
                                        setEditando(tx)
                                        setEditAmount(String(tx.amount))
                                        setEditDesc(tx.description)
                                      }}
                                    >
                                      <Pencil className="size-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="text-muted-foreground hover:text-destructive size-7"
                                      aria-label="Estornar crédito"
                                      disabled={mutDelete.isPending}
                                      onClick={async () => {
                                        if (
                                          await confirmar({
                                            titulo: `Estornar ${brl(Number(tx.amount))} BevCoins?`,
                                            descricao: `O crédito de ${m.nome} sai do saldo e do ranking. Esta ação não pode ser desfeita.`,
                                            confirmar: 'Estornar',
                                            destrutivo: true,
                                          })
                                        )
                                          mutDelete.mutate(tx.id)
                                      }}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                          Solicitações de uso
                        </p>
                        {m.resgates.length === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            Nenhuma solicitação até agora.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {m.resgates.map((tx) => (
                              <div
                                key={tx.id}
                                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                              >
                                <div className="flex min-w-0 flex-col">
                                  <span className="truncate">{tx.description}</span>
                                  <span className="text-muted-foreground text-xs">
                                    {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <Badge
                                    variant={
                                      tx.status === 'approved'
                                        ? 'success'
                                        : tx.status === 'rejected'
                                          ? 'danger'
                                          : 'warning'
                                    }
                                  >
                                    {STATUS_LABEL[tx.status]}
                                  </Badge>
                                  <span
                                    className={
                                      tx.status === 'rejected'
                                        ? 'text-muted-foreground font-semibold line-through'
                                        : 'font-semibold text-red-600'
                                    }
                                  >
                                    − {brl(Number(tx.amount))}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <Dialog open={editando !== null} onOpenChange={(o) => !o && setEditando(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Corrigir crédito</DialogTitle>
              <DialogDescription>Ajuste o valor ou a descrição do lançamento.</DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                mutUpdate.mutate()
              }}
            >
              <div className="flex flex-col gap-2">
                <Label>Descrição</Label>
                <Input required value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Valor (BevCoins)</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={mutUpdate.isPending}>
                Salvar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
