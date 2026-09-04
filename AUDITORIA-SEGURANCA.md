# BEV OS — auditoria de segurança

**Data:** 03/09/2026 · **Escopo:** repo `brunacbeltrao/bev-os` + projeto Supabase `qsldssvblnwcqdetylrl`
**Branch:** `claude/bev-os-security-audit-k37emt` · **Base:** `HANDOFF-SEGURANCA.md` (recebido por prompt; não está no repo)

Tudo que está marcado como **verificado** foi reproduzido no banco de produção, sempre
dentro de transação revertida (`raise exception` no fim do bloco). Nenhum dado de
produção foi alterado por esta auditoria — conferido ao final de cada teste.

---

## Resumo

| # | Achado | Sev. | Estado |
|---|---|---|---|
| 1 | 30 funções `SECURITY DEFINER` respondiam sem login | **Crítico** | **corrigido e no ar** |
| 2 | Policies de storage não recortam por permissão | **Crítico** | **corrigido e no ar** |
| 3 | Buckets `financeiro` e `epeas` públicos | **Alto** | **fechados e no ar**; `avisos` segue público (§3.3) |
| 4 | `resumo_exclusao_cadastro` checava 7 de 28 impedimentos | **Alto** | **corrigido e no ar** |
| 5 | `is_gestao` sem filtro de cargo | **Alto** | **resolvido** — permissão por fase (§2.3) |
| 6 | `excluir_cadastro` travava o recadastro | **Médio** | **corrigido e no ar** |
| 7 | Exclusão de conta sem trilha | **Médio** | **corrigido e no ar** |
| 8 | `epeas_contract_exceptions` editável por quem só vê | **Médio** | **corrigido e no ar** |
| 9 | `check_roster_email` devolve nome, cargo, área e diretoria | **Médio** | **decisão sua** (§3.4) |
| 10 | Buckets sem teto de tamanho nem lista de tipos | **Médio** | **corrigido e no ar** |
| 11 | Migrations sem DDL — banco é a única fonte de verdade | **Alto (processo)** | §5 |

Merge feito e publicado em 04/09. Estado do banco depois de tudo aplicado:

| | |
|---|---|
| funções que respondem sem login | **1** — só `check_roster_email`, que o cadastro precisa |
| buckets sensíveis públicos | **0** |
| FKs para `people` sem `ON UPDATE CASCADE` | **0** |
| tabelas sem RLS | **0** |

Tudo que está como "aplicado" foi aplicado no banco de produção e verificado
depois, com o teste de que o vazamento fechou **e** o teste de que quem está
logado não perdeu acesso.

Cinco suspeitas do handoff **não se confirmaram**. Estão em §4, com o teste que
mostra por quê — vale ler, porque duas delas eu ia jurar que eram falhas.

---

## 1. Achados críticos

### 1.1 `anon` executa 30 funções `SECURITY DEFINER` — dado real sem login

O handoff sinaliza `check_roster_email` como a única RPC exposta a `anon`. São **31**.
O advisor do Supabase lista todas como `anon_security_definer_function_executable`.

`SECURITY DEFINER` ignora RLS por construção, e o PostgREST publica toda função do
schema `public` em `/rest/v1/rpc/<nome>`. A anon key é pública — vai no bundle do
front. Então basta o `uuid` de uma pessoa para ler, sem sessão:

```
get_total_earned_bevcoins(<uuid>, <ciclo>)  ->  418.13
perfil_bandeira(<uuid>, <ciclo>)            ->  {"cor":"branca","advertencias":0,"agravos":0}
talento_elegibilidade(<uuid>, <ciclo>)      ->  critérios de promoção, um a um
perfil_demandas(<uuid>, <ciclo>)            ->  entregas da pessoa
```

**Verificado** com `set_config('role','anon')` no banco: os valores acima são reais —
418,13 é o saldo da Sofia, o mesmo número citado na migration da deduplicação.
Bandeira disciplinar (advertências e agravos) e elegibilidade para promoção saem para
quem não está logado.

Não consegui fechar o teste por HTTP: a saída de rede desta sessão para
`*.supabase.co` é bloqueada pelo proxy do ambiente. A verificação foi no banco, com o
mesmo papel `anon` que o PostgREST assume. Para confirmar de fora:

```bash
curl -s -X POST 'https://qsldssvblnwcqdetylrl.supabase.co/rest/v1/rpc/perfil_bandeira' \
  -H "apikey: <anon key>" -H 'Content-Type: application/json' \
  -d '{"p_person":"<uuid>","p_cycle":"<uuid>"}'
```

**Atenuante:** não há policy de tabela para `anon` (conferido: zero linhas em
`pg_policies` com `anon` nos roles), então não dá para listar `people` e colher os
uuids pela API. O atacante precisa obter o uuid por outro caminho. Isso reduz a
facilidade, não a exposição — uuid de pessoa aparece em URL de perfil, em payload de
tela e em qualquer print compartilhado.

**Corrigido e aplicado** — mas a primeira tentativa não funcionou, e o motivo
importa:

`revoke execute ... from anon` **não teve efeito nenhum**. `anon` nunca teve
permissão própria nessas funções: ele herda de `PUBLIC`, o papel que todo mundo
integra. No ACL a diferença aparece assim:

```
perfil_bandeira  {=X/postgres, postgres=X, authenticated=X, service_role=X}
                  ^^ grantee vazio = PUBLIC — é daqui que anon herda
is_direx         {postgres=X, authenticated=X, service_role=X}
                  (sem a entrada: por isso já estava fechada)
```

As funções que já estavam protegidas — `is_direx`, `excluir_cadastro`,
`current_cycle_id` — são justamente as que tiveram `PUBLIC` revogado quando
foram criadas. As 30 nunca tiveram. A correção que fecha de verdade é
`revoke ... from public` (`20260903000005`).

Verificado depois de aplicar: `anon` recebe `insufficient_privilege` nas quatro
funções que vazavam, `check_roster_email` continua respondendo, e um usuário
logado segue lendo BevCoins, bandeira, talento, EPEAS e as tabelas sob RLS que
dependem dessas funções. O cadastro de novo membro também foi testado ponta a
ponta (insert em `auth.users` → `people` + `occupations` + roster marcado) e
funciona.

### 1.2 Policies de storage valem o bucket inteiro

Este é o achado que **fechar o bucket não resolve**, e por isso ele é mais grave que a
Prioridade 1 do handoff.

```sql
financeiro_read      using (bucket_id = 'financeiro')   -- sem mais nada
epeas_anexo_leitura  using (bucket_id = 'epeas')        -- sem mais nada
financeiro_write     with check (bucket_id = 'financeiro')
epeas_anexo_envio    with check (bucket_id = 'epeas')
```

Qualquer uma das 26 contas lê **todo** comprovante de reembolso (dado bancário, às
vezes CPF) e **todo** anexo de contrato — comprovante de pagamento, GRU, print de
conversa com cliente — inclusive de núcleo que não é o dela. E escreve em qualquer
caminho, inclusive na pasta de outra pessoa.

O caminho que o handoff propõe — trocar `getPublicUrl()` por `createSignedUrl()` —
sozinho só troca *"qualquer um com o link"* por *"qualquer um com login"*. A URL
assinada é emitida a quem passa na policy; se a policy é o bucket inteiro, ela assina
para todo mundo.

**Corrigido** em `20260903000002_storage_privado_e_rls.sql`:

- `financeiro`: lê a própria pasta (`<person_id>/…`) ou `is_gestao_lideranca` — quem avalia o pedido;
- `epeas`: `epeas_pode_ver(<contrato_id da pasta>)`, o mesmo teste do RLS das tabelas;
- helper `storage_pasta_uuid()` para o path fora do padrão não quebrar a policy com `invalid input syntax for uuid`.

---

## 2. Achados altos

### 2.1 Buckets públicos

Confirmado: os 5 com `public = true`. `financeiro` e `epeas` passam a privados na
`20260903000002`, com URL assinada de 60s no front (`urlAnexo`, `urlComprovante`).

Os dois estão com **0 arquivos** — não há URL em circulação para quebrar nem dado
gravado para migrar. É de fato a melhor janela, como o handoff previu.

### 2.2 `resumo_exclusao_cadastro` só conhece 7 dos 28 impedimentos

A função promete à Diretoria a lista do que trava a exclusão, e a tela decide o botão
a partir dela. A lista era escrita à mão e cobria 7 colunas; existem **28** FKs
`RESTRICT`/`NO ACTION` apontando para `people`.

Faltavam, entre outras: `leads.assessor_responsavel_id`, `pdi_checkins.lider_id`,
`pdi_plans.avaliador_id`, `meeting_minutes.criado_por`, `finance_entries`,
`announcements.autor_id`, `entregas_avulsas.autor_id` e
`epeas_contract_exceptions.aberto_por_id` — esta última criada na mesma sessão que a
função.

Efeito: para quem só tem registro numa das 21 não cobertas, a tela dizia "pode
excluir", a diretora digitava o nome para confirmar, e a transação morria com o erro
cru da FK. **Nada era perdido** — função é transação, tudo volta atrás — mas a
operação mais perigosa do sistema respondia 500 em vez da mensagem que ela mesma sabe
dar.

**Verificado:** rodando a lógica nova contra o seu próprio cadastro, aparecem
`announcements (autor_id)`, `entregas_avulsas (autor_id)` e `pdi_plans (avaliador_id)`
— três impedimentos que a lista antiga não via.

**Corrigido e aplicado** (`20260903000003`). Em vez de estender a
lista fixa — que é a mesma armadilha do `ON UPDATE CASCADE` — a função agora lê
`pg_constraint` e conta as linhas de cada FK bloqueante. **FK nova entra sozinha.**

### 2.3 `is_gestao` não filtra cargo — decisão sua

```sql
is_gestao(uid)             -- diretoria = 'gestao'    (qualquer cargo)
is_lideranca_projetos(uid) -- diretoria = 'projetos'  AND role in (diretor,gerente,coordenador)
```

`epeas_pode_ver` e `epeas_pode_editar` chamam as duas. Resultado: **Bárbara, César e
Leticia — assessoras de Gestão — veem e editam o ciclo de vida dos 31 contratos**,
enquanto uma assessora de Projetos só alcança os contratos em que foi nominalmente
alocada. Verificado.

Isso responde a pergunta do handoff ("um assessor consegue ver contrato de outro
núcleo?"): **em Projetos, não. Em Gestão, sim — todos.**

**Resolvido em 04/09**, e a decisão foi nivelar por cima em vez de por baixo: em vez
de restringir Gestão à liderança, as três diretorias passaram a valer igual, mas
**amarradas à fase do contrato**.

O contrato está numa etapa; a etapa pertence a uma diretoria (`comercial_*` →
Negócios, `gestao_*` → Gestão, `projetos_*` → Projetos); quem é daquela diretoria
edita, em qualquer cargo. Quando a bola passa, a caneta passa junto. Ver continua
aberto às três — quem não pode editar ainda precisa acompanhar.

É mais permissivo que antes para Negócios e Projetos, e mais restrito para Gestão,
que deixa de editar contrato em fase que não é dela. Verificado contando linhas
afetadas (um `UPDATE` que o RLS filtra não levanta erro, apenas afeta zero linhas —
o teste que checa exceção dá falso positivo aqui):

| | etapa comercial | etapa projetos |
|---|---|---|
| assessora de Negócios | 1 linha | 0 linhas |
| assessora de Projetos | 0 linhas | 1 linha |

Migration `20260904000001`.

---

## 3. Achados médios

### 3.1 `excluir_cadastro` travava o recadastro — corrigido

```sql
-- o roster libera o e-mail para um novo cadastro no futuro
delete from public.approved_roster where lower(email) = lower(v_email);
```

O comentário dizia o contrário do que o código fazia. `handle_new_user` **recusa**
e-mail que não está no roster (`BEV_OS_EMAIL_NAO_APROVADO`), então apagar a linha
não liberava o recadastro — **impedia para sempre**.

**Corrigido e aplicado**: agora marca `claimed = false` em vez de apagar. É o que o
comentário sempre prometeu, e destrói menos — a pessoa continua no roster do ciclo
e pode voltar. Testado ponta a ponta em transação revertida: conta e cadastro somem,
linha do roster fica, `claimed` volta para falso.

Se a intenção era o oposto — que excluir signifique sumir do roster também — é uma
linha para reverter, e eu reverto.

### 3.2 Exclusão de conta sem trilha — corrigido

`excluir_cadastro` apagava de `people` e de `auth.users` sem registrar nada: depois
do fato não havia como saber quem excluiu quem, nem quando.

**Corrigido e aplicado**: tabela `deletion_log` (quem, quem, quando, e o resumo que
foi mostrado na hora), gravada dentro da própria função. Sem FK para `people`, senão
o registro morreria junto com a pessoa. Só a Diretoria lê; ninguém edita nem apaga
pela API, porque não existe policy de escrita — só a função grava.

### 3.3 `avisos` continua público

`avisos` guarda a **URL pública gravada** em `announcements.anexo_url` (2 arquivos
hoje), diferente de `financeiro`/`epeas`, que montam a URL na leitura. Fechar o bucket
sem antes trocar a coluna para caminho quebraria os anexos existentes. Deixei público
de propósito e separado — é uma migration de dados pequena, mas é outra mudança.

`avatares` e `bevskills` seguem públicos por decisão: foto de perfil e material de curso.

### 3.4 `check_roster_email` devolve mais do que precisa

Para `anon`, com um e-mail, ela devolve `nome`, `cargo`, `área` e `diretoria`. O
handoff considera aceitável por revelar "se o e-mail está no roster" — mas ela revela
**o organograma**, não só a existência.

`/recuperar-senha` usa só `status`. Quem precisa do resto é o prefill de `/cadastro`.
Um meio-termo: devolver só `status` para `anon` e manter o prefill preenchido depois
do `signUp`. Custa uma ida a mais no cadastro e fecha a enumeração. Não mudei porque
mexe no fluxo de cadastro.

### 3.5 `epeas_contract_exceptions`: quem só via, editava — corrigido

O UPDATE usava `epeas_pode_ver` enquanto o resto do EPEAS usa `epeas_pode_editar`, e
o `with_check` não fixava `aberto_por_id` — dava para reescrever a exceção e a
autoria dela.

**Corrigido e aplicado**, com um tropeço no caminho que vale registrar: a primeira
tentativa de fixar `aberto_por_id` foi por `with_check` com subconsulta, e estava
errada — dentro dela, `id` resolve para a coluna da própria tabela, então `e.id = id`
era sempre verdadeiro e não fixava nada. RLS não compara linha velha com linha nova:
`USING` vê a antiga, `WITH CHECK` vê a nova, e as duas não se encontram. Para travar
coluna o instrumento é trigger (`20260903000007`).

Testado: trocar autoria e mover de contrato bloqueados; editar a descrição continua
funcionando.

### 3.6 Buckets sem limite de tamanho nem de tipo

Nenhum dos 5 tinha `file_size_limit` ou `allowed_mime_types`. Somado ao bucket
público, era hospedagem de arquivo arbitrário na origem do Supabase. Corrigido para
`financeiro` e `epeas` (10 MB, imagem e PDF) na `20260903000002`.

### 3.7 Nome de exibição vem do cliente — **não é falha, retirado**

`handle_new_user` usa `coalesce(new.raw_user_meta_data->>'nome', roster_row.nome)`, e
`raw_user_meta_data` vem do cliente. Eu ia recomendar forçar o nome do roster.

**Fui conferir a tela antes e estava errado:** `/cadastro` pergunta "Como você quer
ser chamado?", com o primeiro nome preenchido e editável. É funcionalidade
deliberada, não descuido. Forçar o nome do roster quebraria a tela para as 12 pessoas
que ainda vão se cadastrar.

O vínculo com o roster é pelo e-mail, então não há escalada de permissão — no máximo
alguém escolhe um nome de exibição parecido com o de outra pessoa, numa EJ de 45
pessoas que se conhecem. Não mexi.

---

## 4. O que investiguei e **não** é vulnerabilidade

Vale registrar, porque três destas são perguntas diretas do handoff.

**Injeção via `corpo` do `epeas_comments` — não existe.** `conversa.tsx` renderiza
`{c.corpo}` em JSX; React escapa. Não há `dangerouslySetInnerHTML` em lugar nenhum do
`src/` (conferido). O `href` do anexo passa por `getPublicUrl`/`createSignedUrl`, que
prefixam a base do storage — não dá para injetar `javascript:`.

**Mover comentário para outro contrato — bloqueado.** A policy de UPDATE só exige
`autor_id = auth.uid()` e não fixa `contrato_id`, o que parece permitir inserir num
contrato visível e depois mover para um invisível. **Testei: o Postgres recusa.** A
linha nova também é checada contra a visibilidade:

```
A (editar corpo, mesmo contrato)      = PERMITIDO
B (mover p/ contrato que ela vê)      = PERMITIDO
C (mover p/ contrato que ela não vê)  = BLOQUEADO
```

Ainda assim, a proteção era efeito do motor, não do texto da policy — funcionava, mas
não estava escrita. **Corrigido e aplicado**: `epeas_comments_update` agora repete
`epeas_pode_ver(contrato_id)` no `with check`, como o insert sempre fez.

**Forjar `mencoes` — possível e inerte.** `mencoes uuid[]` não é validado: dá para
citar qualquer uuid. Mas a caixa de pendências (`epeas.ts:560`) lê `epeas_comments`
sob RLS e só depois filtra por menção — quem não enxerga o contrato não o recebe na
caixa. Serve para incomodar quem já tem acesso, não para vazar.

**`ON UPDATE CASCADE` — a regressão está fechada.** A query de verificação do handoff
retorna **zero linhas**: todas as FKs para `people` estão com `CASCADE` no update.

**Segredos no histórico do git — nenhum.** Varri as 45 revisões atrás de JWT,
`service_role` e chaves. Só referências a variável de ambiente
(`Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`) e `grant ... to service_role` em SQL.
Confirma a leitura do handoff.

**As 4 views `SECURITY DEFINER`** (`bevcoins_ranking`, `dashboard_entrega`,
`dashboard_warnings`, `liderados_view`) continuam sinalizadas pelo advisor. Não
reinvestiguei: o handoff diz que cada uma tem filtro explícito no `WHERE` e `COMMENT`
no banco explicando. Mantida a recomendação de **não** converter sem ler o comentário.

---

## 5. Dívida de processo: migration sem DDL

Este é o achado que mais me atrapalhou, e por isso está aqui.

Quatro migrations recentes são **documentação, não DDL**:

| Arquivo | Conteúdo |
|---|---|
| `20260824000003_epeas_onda_a.sql` | "Consulte o projeto Supabase para o DDL vigente." |
| `20260831000001_epeas_conversa_checklist.sql` | idem |
| `20260901000001_excluir_cadastro.sql` | idem |
| `20260901000003_*` (correção do CASCADE) | **não está no repo** |

Consequência prática: o esquema do EPEAS, o RLS dele e as duas funções que apagam de
`auth.users` **não existem em lugar nenhum sob controle de versão**. Não dá para
revisar em PR, não dá para reproduzir o banco do zero, não dá para saber o que mudou
entre duas datas. Toda esta auditoria teve que ler o catálogo do Postgres em produção,
porque o repositório não descreve o sistema.

Isso também explica a regressão do `ON UPDATE CASCADE`: sem o DDL no repo, não havia
diff onde a FK sem `CASCADE` pudesse ser vista.

O caminho é `supabase db pull` para materializar o esquema atual como migration de
baseline, e daí em diante `supabase db diff` gerando o DDL de verdade. As migrations
desta branch trazem o DDL completo.

---

## 6. O que está nesta branch

**Já aplicado em produção e verificado:**

| Migration | O que faz |
|---|---|
| `…0001` + `…0005` | fecha as 30 funções que respondiam sem login (a 0001 sozinha não bastava — §1.1) |
| `…0003` | impedimentos da exclusão lidos de `pg_constraint` |
| `…0006` | policies do EPEAS, `deletion_log`, exclusão devolve o e-mail ao roster |
| `…0007` | corrige o pin de autoria da 0006, que estava errado |

**Pronto, esperando o deploy:**

| Migration / arquivo | O que faz |
|---|---|
| `…0002` | buckets `financeiro` e `epeas` privados, policies por permissão, teto de 10 MB |
| `…0004` | `comprovante_url` → `comprovante_path` |
| `src/lib/epeas.ts`, `src/lib/financeiro.ts` | URL assinada de 60s em vez de link público |
| `conversa.tsx`, `financeiro.tsx` | anexo vira botão que assina no clique |

`npm run typecheck` e `npm run build` passam. A coluna foi renomeada de propósito:
com `comprovante_url` guardando um caminho, um `href` esquecido quebraria calado;
com o nome novo, o TypeScript aponta.

---

## 7. O que ficou de fora, e uma armadilha que vale lembrar

Publicado em 04/09: merge em `main`, deploy da Vercel concluído, e só então as
migrations de storage e a renomeação da coluna — nessa ordem, porque as duas partes
precisavam virar juntas.

**Verificado depois de aplicar**, com arquivos de teste criados e revertidos:

| quem | vê dos 2 comprovantes |
|---|---|
| dona do primeiro | 1 |
| dona do segundo | 1 |
| liderança de Gestão (avalia o reembolso) | 2 |

E no EPEAS, o anexo só aparece para quem já enxerga o contrato.

### A armadilha: função nova nasce aberta

Ao criar `pertence_diretoria` eu escrevi `revoke ... from public` — e ela **continuou
respondendo sem login**. O Supabase mantém `ALTER DEFAULT PRIVILEGES` concedendo
EXECUTE a `anon` em toda função nova do schema `public`, e esse grant é **explícito**
(`anon=X` no ACL), não herdado de PUBLIC. Revogar de um não alcança o outro, e os dois
falham em silêncio.

Foi o mesmo erro da §1.1, cometido de novo no mesmo dia, em código meu. Só apareceu
porque a contagem de funções abertas saiu de 1 para 2 na conferência final.

**Regra daqui para frente:** toda função nova em `public` precisa de
`revoke execute ... from anon, public;` — os dois, sempre. E a checagem que pega isso é:

```sql
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE');
-- deve devolver apenas check_roster_email
```

### Continua pendente

- **`avisos` segue público** (§3.3). Diferente dos outros, ele guarda a URL pública
  gravada em `announcements.anexo_url`, então fechar exige trocar a coluna por caminho
  antes. São 2 arquivos, anexo de comunicado interno.
- **`check_roster_email`** (§3.4) — decisão sua: fechar custa o preenchimento
  automático do `/cadastro`.
- **`auth_leaked_password_protection` desativado** — Authentication → Policies.
- **SMTP e Redirect URLs** — confirmar `https://bev-os.vercel.app/nova-senha` nas
  Redirect URLs, e trocar o SMTP padrão do Supabase pelo Google Workspace.
