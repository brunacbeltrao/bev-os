/**
 * Recuperação de senha — pedir o link.
 *
 * Não existia nenhum caminho de volta para quem esquecia a senha: sem
 * este fluxo, a única saída era alguém com acesso ao Supabase resetar
 * manualmente.
 */
import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Loader2, MailCheck, UserPlus } from 'lucide-react'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/recuperar-senha')({ component: RecuperarSenhaPage })

function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [semConta, setSemConta] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setSemConta(null)
    setCarregando(true)

    const alvo = email.trim().toLowerCase()

    /*
     * Quem está no roster mas ainda não criou conta cairia num beco sem
     * saída: o Supabase responde 200 e não envia nada (proteção contra
     * enumeração), e a pessoa fica esperando um e-mail que nunca chega.
     * O roster já é consultável no cadastro, então checar aqui não expõe
     * nada novo — e troca a espera por uma instrução concreta.
     */
    const { data: roster } = await supabase.rpc('check_roster_email', { p_email: alvo })
    const status = (roster as { status?: string; nome?: string } | null)?.status

    if (status === 'ok') {
      setCarregando(false)
      setSemConta((roster as { nome?: string }).nome ?? null)
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(alvo, {
      redirectTo: `${window.location.origin}/nova-senha`,
    })

    setCarregando(false)

    if (error) {
      setErro(
        error.message.toLowerCase().includes('rate')
          ? 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'
          : 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.',
      )
      return
    }
    // Confirmação genérica de propósito: dizer "esse e-mail não existe"
    // revelaria quem tem conta no sistema para qualquer pessoa.
    setEnviado(true)
  }

  if (semConta !== null) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-4">
          <div className="bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-lg">
            <UserPlus className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {semConta ? `${semConta.split(' ')[0]}, ` : ''}você ainda não tem conta
            </h2>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Seu e-mail está no quadro do ciclo, mas a conta ainda não foi criada — por isso não há
              senha para recuperar. Crie a sua agora: leva menos de um minuto e seu cargo e área já
              vêm preenchidos.
            </p>
          </div>
          <Button asChild>
            <Link to="/cadastro">Criar minha conta</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/login">Voltar para o login</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (enviado) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-4">
          <div className="bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-lg">
            <MailCheck className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Verifique seu e-mail</h2>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Se houver uma conta com <span className="text-foreground font-medium">{email}</span>,
              enviamos um link para criar uma senha nova. O link vale por 1 hora.
            </p>
          </div>
          <p className="text-muted-foreground text-sm">
            Não chegou? Olhe no spam. Se ainda assim não vier, fale com a Diretoria de Gestão.
          </p>
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
        <h2 className="text-2xl font-bold tracking-tight">Esqueceu a senha?</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Informe seu e-mail e enviamos um link para criar uma senha nova.
        </p>
      </div>

      <form onSubmit={enviar} className="flex flex-col gap-4">
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
        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}
        <Button type="submit" disabled={carregando}>
          {carregando && <Loader2 className="size-4 animate-spin" />}
          {carregando ? 'Enviando…' : 'Enviar link'}
        </Button>
        <Link
          to="/login"
          className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-3.5" />
          Voltar para o login
        </Link>
      </form>
    </AuthLayout>
  )
}
