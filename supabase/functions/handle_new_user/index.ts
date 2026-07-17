import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
  try {
    // Apenas POST é permitido (Auth Hooks)
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const payload = await req.json()
    const { user } = payload

    if (!user || !user.email) {
      return new Response(
        JSON.stringify({ error: { message: "O e-mail é obrigatório para cadastro." } }),
        { headers: { "Content-Type": "application/json" }, status: 200 } // Retorna 200 pro Auth Hook rejeitar civilizadamente
      )
    }

    const email = user.email.toLowerCase()

    // 1. Validar se o e-mail está na lista de Roster
    const { data: rosterData, error: rosterError } = await supabase
      .from('approved_roster')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (rosterError) {
      throw rosterError
    }

    if (!rosterData) {
      // Rejeita o cadastro (o Supabase Auth Hook entende isso e bloqueia)
      return new Response(
        JSON.stringify({ 
          error: { message: "Acesso negado: Este e-mail não foi encontrado na lista de membros aprovados pela P&C." } 
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    }

    // 2. O usuário é válido. Vamos criar a entrada dele na tabela 'people'
    // Como é um Hook Before Create, o usuário AINDA NÃO EXISTE em public.people
    // Porém a inserção precisa acontecer DEPOIS que ele for criado. 
    // Em Auth Hooks, o mais indicado seria um hook "after_user_created" ou webhook, 
    // mas se quisermos inserir logo aqui (ou se for chamado pós-criação):
    
    // NOTA: Se este hook for do tipo 'before_user_created', não podemos inserir na tabela public.people 
    // relacionando ao ID do usuário porque o ID ainda não está validamente commitado em auth.users.
    // Assim, se o seu webhook for disparado AFTER INSERT, mantemos a lógica de criação abaixo:
    const nomeExibicao = user.user_metadata?.nome_exibicao || email

    const { error: insertError } = await supabase
      .from('people')
      .insert({
        id: user.id,
        nome: nomeExibicao,
        email: email,
        roster_id: rosterData.id
      })

    // Caso já exista (ex: webhook re-disparado), podemos ignorar o erro ou falhar
    if (insertError && !insertError.message.includes('duplicate')) {
      console.error("Erro ao inserir em public.people:", insertError)
      // Pode opcionalmente disparar slack webhook aqui
    }

    return new Response(
      JSON.stringify(payload), // Retorna o mesmo payload confirmando ok
      { headers: { "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error: any) {
    console.error("Erro interno no Edge Function:", error)
    return new Response(
      JSON.stringify({ error: { message: "Erro interno ao processar cadastro." } }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    )
  }
})
