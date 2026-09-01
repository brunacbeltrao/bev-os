import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    })
    setCarregando(false)
    if (error) {
      setErro(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message === 'Email not confirmed'
            ? 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).'
            : 'Não foi possível entrar. Tente novamente.',
      )
      return
    }
    navigate({ to: '/' })
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <div className="bg-primary text-primary-foreground mb-4 flex size-10 items-center justify-center rounded-lg text-sm font-bold lg:hidden">
          B
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Entre com seu e-mail institucional para acessar o BEV OS.
        </p>
      </div>

      <form onSubmit={entrar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@bevilaqua.org.br"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="senha">Senha</Label>
            <Link
              to="/recuperar-senha"
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
            >
              Esqueci minha senha
            </Link>
          </div>
          <Input
            id="senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}
        <Button type="submit" disabled={carregando}>
          {carregando && <Loader2 className="size-4 animate-spin" />}
          {carregando ? 'Entrando…' : 'Entrar'}
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          Primeira vez aqui?{' '}
          <Link to="/cadastro" className="text-foreground font-medium underline underline-offset-4">
            Criar conta
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
