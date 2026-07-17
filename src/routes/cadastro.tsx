/**
 * Cadastro individual (PRD Onda 0):
 * e-mail/senha validado contra approved_roster. Cargo e área são
 * preenchidos automaticamente a partir do roster — sem digitação
 * manual. E-mail fora da lista é rejeitado na hora (decisão
 * validada: sem fila de revisão).
 *
 * Duas camadas de validação:
 * 1. RPC check_roster_email antes do signUp (mensagem clara + prefill)
 * 2. Trigger em auth.users (enforcement real, não confia no cliente)
 */
import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { checkRosterEmail, ROLE_LABELS, type RosterCheck } from '@/lib/org'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/cadastro')({ component: CadastroPage })

type Etapa = 'email' | 'senha' | 'confirmar_email'

function CadastroPage() {
  const navigate = useNavigate()
  const [etapa, setEtapa] = useState<Etapa>('email')
  const [email, setEmail] = useState('')
  const [roster, setRoster] = useState<RosterCheck | null>(null)
  const [nomeExibicao, setNomeExibicao] = useState('')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function verificarEmail(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      const check = await checkRosterEmail(email)
      if (check.status === 'not_found') {
        setErro(
          'Este e-mail não está na lista aprovada de membros. Confira se digitou o e-mail cadastrado na EJ ou fale com Pessoas e Cultura.',
        )
      } else if (check.status === 'claimed') {
        setErro('Este e-mail já foi usado para criar uma conta. Se for você, use a tela de login.')
      } else {
        setRoster(check)
        setNomeExibicao(check.nome?.split(' ')[0] || '')
        setEtapa('senha')
      }
    } catch {
      setErro('Não foi possível verificar o e-mail. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  async function criarConta(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 8) {
      setErro('A senha precisa ter ao menos 8 caracteres.')
      return
    }
    if (senha !== senha2) {
      setErro('As senhas não conferem.')
      return
    }
    if (!nomeExibicao.trim()) {
      setErro('O nome de exibição é obrigatório.')
      return
    }
    setCarregando(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: {
        data: {
          nome: nomeExibicao.trim(),
        },
      },
    })
    setCarregando(false)
    if (error) {
      // O trigger no banco rejeita e-mails fora do roster mesmo que
      // alguém contorne a pré-checagem.
      setErro(
        error.message.includes('BEV_OS_EMAIL_NAO_APROVADO')
          ? 'Este e-mail não está na lista aprovada. Fale com Pessoas e Cultura.'
          : error.message.includes('BEV_OS_EMAIL_JA_UTILIZADO')
            ? 'Este e-mail já foi usado para criar uma conta.'
            : 'Não foi possível criar a conta. Tente novamente ou fale com Pessoas e Cultura.',
      )
      return
    }
    if (data.session) {
      navigate({ to: '/' })
    } else {
      setEtapa('confirmar_email')
    }
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <div className="bg-primary text-primary-foreground mb-4 flex size-10 items-center justify-center rounded-lg text-sm font-bold lg:hidden">
          B
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Criar conta</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Apenas membros na lista aprovada pela P&C conseguem se cadastrar.
        </p>
      </div>
      <div>
          {etapa === 'email' && (
            <form onSubmit={verificarEmail} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Seu e-mail cadastrado na EJ</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {erro && (
                <p role="alert" className="text-destructive text-sm">
                  {erro}
                </p>
              )}
              <Button type="submit" disabled={carregando}>
                {carregando && <Loader2 className="size-4 animate-spin" />}
                {carregando ? 'Verificando…' : 'Continuar'}
              </Button>
              <p className="text-muted-foreground text-center text-sm">
                Já tem conta?{' '}
                <Link
                  to="/login"
                  className="text-foreground font-medium underline underline-offset-4"
                >
                  Entrar
                </Link>
              </p>
            </form>
          )}

          {etapa === 'senha' && roster && (
            <form onSubmit={criarConta} className="flex flex-col gap-4">
              <div>
                <h3 className="mb-1 text-sm font-semibold">Tudo certo, {roster?.nome?.split(' ')[0]}!</h3>
                <p className="text-muted-foreground text-sm">
                  Encontramos seu cadastro como <Badge variant="secondary" className="mx-1">{ROLE_LABELS[roster?.cargo as keyof typeof ROLE_LABELS]}</Badge> 
                  em <span className="font-medium text-foreground">{roster?.area}</span>.
                </p>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nomeExibicao">Como você quer ser chamado?</Label>
                <Input
                  id="nomeExibicao"
                  value={nomeExibicao}
                  onChange={(e) => setNomeExibicao(e.target.value)}
                  placeholder="Nome de exibição (ex: Bru, Gui)"
                  required
                />
                <p className="text-muted-foreground text-xs">Este nome aparecerá na plataforma.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="senha">Crie uma senha</Label>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="senha2">Confirmar senha</Label>
                <Input
                  id="senha2"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={senha2}
                  onChange={(e) => setSenha2(e.target.value)}
                />
              </div>
              {erro && (
                <p role="alert" className="text-destructive text-sm">
                  {erro}
                </p>
              )}
              <Button type="submit" disabled={carregando}>
                {carregando && <Loader2 className="size-4 animate-spin" />}
                {carregando ? 'Criando conta…' : 'Criar conta'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEtapa('email')}>
                Usar outro e-mail
              </Button>
            </form>
          )}

          {etapa === 'confirmar_email' && (
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="text-status-success size-8" />
              <p className="text-sm font-medium">Conta criada!</p>
              <p className="text-muted-foreground text-sm">
                Enviamos um link de confirmação para <strong>{email}</strong>. Confirme o e-mail e
                depois entre pelo login.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/login">Ir para o login</Link>
              </Button>
            </div>
          )}
      </div>
    </AuthLayout>
  )
}
