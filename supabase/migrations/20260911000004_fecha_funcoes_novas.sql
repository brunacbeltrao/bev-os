-- ===========================================================================
-- Fecha as funções que nasceram abertas desde a auditoria, e põe search_path
-- nas três que ficaram sem.
--
-- Esta é a TERCEIRA vez que o mesmo erro aparece neste projeto, e desta vez
-- duas das funções são minhas (`domingo_de_pascoa` e `semear_feriados`, da
-- migration de feriados). A regra, repetida aqui porque continua sendo
-- esquecida:
--
--   Toda função nova em `public` nasce executável sem login, por DOIS
--   caminhos independentes. É preciso revogar dos DOIS:
--
--     1. `=X/postgres` no ACL  -> grant a PUBLIC, e `anon` herda de PUBLIC
--     2. `anon=X/postgres`     -> grant EXPLÍCITO que o ALTER DEFAULT
--                                 PRIVILEGES do Supabase aplica sozinho
--
--   `revoke ... from public` sozinho NÃO resolve (o grant explícito fica).
--   `revoke ... from anon` sozinho NÃO resolve (a herança de PUBLIC fica).
--   Sempre `revoke ... from public, anon`.
--
-- ESCOPO: aqui NÃO houve vazamento de dado. Testado como `anon` em transação
-- revertida: `bev_catalogo` devolve BLOQUEADO e `semear_feriados` devolve
-- BLOQUEADO — nenhuma é SECURITY DEFINER, então o RLS segurou. Só
-- `domingo_de_pascoa` executava, e ela é aritmética pura (calcula a Páscoa,
-- não lê tabela). Diferente do achado de 03/09, onde 30 funções SECURITY
-- DEFINER devolviam dado real sem login.
--
-- Ainda assim fecha: superfície alcançável sem login sem motivo é superfície
-- que alguém vai encontrar antes de nós.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Revoga dos dois caminhos
--
-- `epeas_carimba_etapa` e `set_updated_at` são funções de GATILHO. Revogar
-- EXECUTE não as impede de disparar: o Postgres checa privilégio de função
-- de gatilho no CREATE TRIGGER, não a cada disparo. O teste de regressão
-- logo abaixo desta migration confirma isso no banco.
-- ---------------------------------------------------------------------------
revoke execute on function public.bev_catalogo()                    from public, anon;
revoke execute on function public.domingo_de_pascoa(integer)        from public, anon;
revoke execute on function public.semear_feriados(integer)          from public, anon;
revoke execute on function public.epeas_carimba_etapa()             from public, anon;
revoke execute on function public.set_updated_at()                  from public, anon;

-- ---------------------------------------------------------------------------
-- 2. search_path fixo
--
-- Sem isto, quem controla o search_path da sessão escolhe qual `people` ou
-- qual `feriados` a função enxerga. Vale menos em função que não é SECURITY
-- DEFINER — mas `epeas_diretoria_da_etapa` é chamada de dentro de policy de
-- RLS, e ali o contexto vem de fora.
-- ---------------------------------------------------------------------------
alter function public.epeas_diretoria_da_etapa(epeas_etapa_macro) set search_path = public;
alter function public.domingo_de_pascoa(integer)                  set search_path = public;
alter function public.semear_feriados(integer)                    set search_path = public;

-- ---------------------------------------------------------------------------
-- 3. O que fica aberto de propósito
--
-- `check_roster_email(text)` continua executável por `anon`: é ela que diz
-- à tela de cadastro se o e-mail está na lista aprovada, e isso acontece
-- antes de existir login. Segue como a decisão de negócio em aberto da
-- auditoria (§3.4): ela devolve nome, papel, área e diretoria para quem
-- acertar um e-mail, o que permite confirmar se alguém é da EJ. Reduzir o
-- retorno a um booleano é decisão da Diretoria, não minha.
-- ---------------------------------------------------------------------------
