# BEV OS — análise de produto e código

**14/08/2026** · commit `2742db3` · 31 rotas, 24 módulos de dados, 75 tabelas

Análise feita lendo o código e consultando o banco, não navegando a interface. Ordenada por impacto, não por esforço.

---

## 1. O problema mais grave: o sistema falha em silêncio

São **116 chamadas de `useQuery` no projeto. Nenhuma trata o estado de erro.** Zero. Nenhuma desestrutura `isError` ou `error`.

Não há **error boundary** em lugar nenhum — nem no `__root.tsx`, nem no `_app.tsx`, nem no router.

O efeito prático: quando qualquer consulta falha — RLS negando, rede caindo, join quebrado — a tela não avisa. Ela fica vazia, ou presa no skeleton para sempre. Para quem está usando, "vazio" e "quebrado" são a mesma imagem.

Isso é especialmente ruim num sistema com RLS forte como o de vocês, porque **negação de permissão é o caso comum, não a exceção**. Um assessor que abre Financeiro não vai ver "você não tem acesso a isto" — vai ver uma tela em branco e concluir que o BEV OS está com bug. Vocês vão receber esse report como se fosse defeito.

É o mesmo padrão que apareceu na auditoria das views: o sistema prefere mostrar um vazio plausível a admitir que algo deu errado.

**O que fazer**, em ordem:

1. Um `errorComponent` no `__root.tsx` — impede a tela branca total.
2. Um wrapper próprio sobre `useQuery` que já devolva os três estados tratados, para não depender de disciplina em 116 lugares.
3. Distinguir três coisas que hoje se parecem: **carregando**, **vazio de verdade** (`EmptyState`, que já existe e é usado em 9 arquivos) e **sem permissão**. O terceiro é o que mais falta.

Esse é o item que eu faria primeiro se fosse escolher um só.

---

## 2. O menu não respeita a hierarquia que vocês construíram

A sidebar tem **15 itens** e apenas **dois** são filtrados por cargo (`onlyLeaders`): Dashboards e Meus Liderados.

Então um assessor recém-chegado vê, no mesmo nível: Planejamento Estratégico, Financeiro, Warnings, Frequência, Pessoas, Memória Institucional. Ele pode clicar em todos. O RLS vai barrar a maioria — e, pelo item 1, o resultado é uma sequência de telas vazias.

Vocês modelaram uma hierarquia rica (Diretor → Gerente → Coordenador → Analista de Área → Assessor, cinco diretorias, híbridos) e ela está toda no banco, mas **não chegou na navegação**. O menu trata todo mundo igual e delega a diferenciação pro RLS, que não tem como conversar com o usuário.

**Ideia:** o `permissions.ts` já tem `isLideranca`, `isDirex`, `isPc`, `canLaunchBevCoins`. Dá pra estender o `onlyLeaders` para um campo mais expressivo — `visivelPara: (occ) => boolean` — e esconder o que a pessoa não pode usar. Um assessor com 6 ou 7 itens tem um sistema que parece feito pra ele; com 15, tem um sistema que parece de outra pessoa.

Isso também resolve metade do problema do item 1 sem escrever tratamento de erro nenhum.

---

## 3. Lacunas de CRUD (continuação da auditoria)

Já corrigido: `fid.ts` e `warnings.ts` (camada de dados).

Ainda sem `delete` na camada de dados: `comercial`, `demandas`, `pdi`, `direx`, `frequencia`, `gerente`, `admin`, `dashboards`.

E `warnings.tsx` ainda não tem os botões ligados — as funções `revokeWarning` e `updateWarning` existem mas nenhuma tela as chama. **Essa é a pendência mais urgente da lista**, porque advertência é dado disciplinar que alimenta agravos, probation e o Banco de Talentos.

---

## 4. Confirmações usam `confirm()` nativo — 14 ocorrências

Em BevSkills, Agenda, Dashboards, Bev News, Benchs, Financeiro (2), Comunicados, Planejamento, Memória e FID.

Três problemas: rompe a identidade visual (vocês têm `Dialog` do shadcn e não usam nele), não dá pra diferenciar uma ação destrutiva de uma trivial, e alguns navegadores móveis suprimem esse diálogo — nesse caso a exclusão **acontece sem confirmação nenhuma**.

Um `<ConfirmDialog>` reutilizável, com variante destrutiva e o nome do item no texto, resolve os 14 de uma vez. É provavelmente a melhor relação impacto/esforço da lista inteira.

> Assumo a autoria de um deles: o `confirm()` do FID fui eu que escrevi, seguindo o padrão que já existia no código. Deveria ter proposto o componente ali.

---

## 5. Performance: 89 chaves estrangeiras sem índice

Levantei no banco: 89 FKs de coluna única sem índice. Entre elas as mais quentes — `bevcoins_transactions.person_id`, `demands.criado_por`, `pdi_goals.pdi_plan_id`, `warnings.cycle_id`, `events.meeting_type_id`.

Hoje isso é invisível: são 13 eventos e 2 transações. **Vai deixar de ser quando o semestre começar** e a base tiver o quadro inteiro com histórico. Cada join vira varredura de tabela.

É barato resolver agora e chato resolver depois. Uma migration com `create index` nas ~20 FKs mais usadas já cobre o essencial.

---

## 6. Tipagem: 54 usos de `any`

Concentrados em joins do Supabase, onde o tipo gerado não bate com o shape do `select` aninhado. O `fid.tsx` tinha `(tx.people as any).nome` — que quebra silenciosamente se a pessoa for removida.

O Supabase gera tipos a partir do schema (`generate_typescript_types`). Adotar isso elimina a maior parte dos `any` e faz o `tsc` pegar erro de join antes do deploy — hoje ele passa limpo justamente porque o `any` desliga a verificação.

---

## 7. Acessibilidade e responsividade — sem alarme

Levantei e está melhor do que eu esperava: 29 botões só de ícone contra 37 `aria-label`, nenhum `<img>` sem `alt`, nenhum `onClick` em `div` ou `span`. 16 das 31 rotas usam breakpoints e há `overflow-x-auto` em 10 tabelas.

Não é área de prioridade. Vale só uma passada nos botões de ícone que ficaram sem rótulo.

---

## Ideias de produto

Coisas que o código sugere, mas que são decisão de vocês:

**Notificações.** Existe `announcement_reads`, ou seja, vocês já rastreiam leitura. Mas não há nada que avise a pessoa de que tem algo pra ler. Um badge de não-lidos na sidebar aproveita estrutura que já existe.

**O `.env` do FID.** O cálculo de BevCoins (valor do contrato × % de participação) está embutido no `fid.tsx`. Quando a regra mudar — e regra de gamificação sempre muda — vai precisar de deploy. Uma linha em `system_settings`, tabela que já existe e já é usada para `require_subarea_for_ra` e `only_leaders_can_complete_demands`, resolveria.

**Onboarding.** O cadastro valida contra o `approved_roster` e preenche cargo e área. Mas depois disso a pessoa cai num sistema de 15 módulos sem nenhuma orientação. Como toda EJ troca boa parte do quadro a cada semestre, um primeiro acesso guiado tem retorno recorrente.

**Trilha do assessor.** BevSkills, PDI e Perfil do Assessor são três módulos que contam a mesma história — o desenvolvimento da pessoa — em três lugares. Não sugiro fundir, mas uma visão que costure os três daria ao assessor a resposta que ele mais quer: "como eu estou indo?".

---

## Se eu tivesse que escolher cinco

1. **Error boundary + tratamento de erro nas queries** — hoje todo problema vira tela em branco.
2. **Filtrar a sidebar por cargo** — resolve metade do item 1 e faz o sistema parecer feito pra cada pessoa.
3. **Ligar os botões de revogar advertência** — dado disciplinar sem correção é risco real.
4. **`<ConfirmDialog>` no lugar dos 14 `confirm()`** — melhor custo-benefício da lista.
5. **Índices nas FKs** — barato agora, caro depois.

Os dois primeiros são a mesma doença vista de ângulos diferentes: **o sistema sabe mais do que conta pra quem está usando.**
