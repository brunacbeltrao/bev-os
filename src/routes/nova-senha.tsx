/**
 * Recuperação de senha — definir a nova.
 *
 * O Supabase devolve a sessão de recuperação pelo link do e-mail. Aqui a
 * pessoa só chega com essa sessão válida; sem ela, a tela avisa em vez de
 * mostrar um formulário que falharia no envio.
 */
import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/nova-senha')({ component: NovaSenhaPage })

const MINIMO = 8

function NovaSenhaPage() {
  const navigate = useNavigate()
  const [pronto, setPronto] = useState(false)
  const [temSessao, setTemSessao] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    // O link do e-mail chega com o token no fragmento da URL; o cliente do
    // Supabase o troca por uma sessão e dispara PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'PASSWORD_RECOVERY' || sessao) {
        setTemSessao(true)
        setPronto(true)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setTemSessao(true)
      setPronto(true)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (senha.length < MINIMO) {
      setErro(`A senha precisa ter pelo menos ${MINIMO} caracteres.`)
      return
    }
    if (senha !== confirmacao) {
      setErro('As duas senhas não são iguais.')
      return
    }

    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)

    if (error) {
      setErro(
        error.message.toLowerCase().includes('should be different')
          ? 'A senha nova precisa ser diferente da anterior.'
          : error.message.toLowerCase().includes('weak') || error.message.toLowerCase().includes('pwned')
            ? 'Essa senha é fácil de adivinhar. Escolha outra.'
            : 'Não foi possível salvar a senha. Peça um link novo e tente de novo.',
      )
      return
    }

    toast.success('Senha alterada. Bem-vinda de volta!')
    navigate({ to: '/' })
  }

  if (!pronto) {
    return (
      <AuthLayout>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Validando o link…
        </div>
      </AuthLayout>
    )
  }

  if (!temSessao) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Link expirado ou inválido</h2>
            <p className="text-muted-foreground mt-1.5 text-sm">
              O link de recuperação vale por 1 hora e só pode ser usado uma vez. Peça um novo.
            </p>
          </div>
          <Button asChild>
            <Link to="/recuperar-senha">Pedir novo link</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/login">Voltar para o login</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Criar senha nova</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Escolha uma senha com pelo menos {MINIMO} caracteres.
        </p>
      </div>

      <form onSubmit={salvar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="senha">Nova senha</Label>
          <div className="relative">
            <Input
              id="senha"
              type={mostrar ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              required
              minLength={MINIMO}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
              onClick={() => setMostrar((v) => !v)}
              className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
            >
              {mostrar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmacao">Repita a senha</Label>
          <Input
            id="confirmacao"
            type={mostrar ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </div>

        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}

        <Button type="submit" disabled={salvando}>
          {salvando && <Loader2 className="size-4 animate-spin" />}
          {salvando ? 'Salvando…' : 'Salvar e entrar'}
        </Button>
      </form>
    </AuthLayout>
  )
}
