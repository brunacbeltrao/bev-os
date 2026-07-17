# BRIEFING — BEV OS (para o agente que continuar o projeto)

Data: 10/07/2026. Autora do projeto: Bruna Beltrão (Diretora de Negócios do Bevilaqua). Fonte de verdade: `PRD_BEV_OS.md`, `ADD_BEV_OS.md`, `BLUEPRINT_BEV_OS.md` (fornecidos por ela — leia os três antes de qualquer código). Regra de ouro combinada: construir em ondas, na ordem do ADD §6, e NÃO avançar de onda sem a Bruna validar a anterior. Se algo estiver ambíguo nos documentos, perguntar antes de assumir.

## Estado atual: Ondas 0–4 + refinamentos + Calendário 2.0 — TUDO EM PRODUÇÃO

Produção: **https://bev-os.vercel.app** (projeto `bev-os` no time Vercel `direxbevilaqua`, conta da Bruna). Backend: Supabase projeto **bev-os**, ref `qsldssvblnwcqdetylrl`, região sa-east-1, org da Bruna (brunacbeltrao@gmail.com). Atenção: existe outro projeto Supabase `direx-os` na mesma org — é a Central da Direx EM PRODUÇÃO, não tocar.

Stack: TanStack Start (SPA mode) + React 19 + Vite 7 + Tailwind v4 + shadcn/ui vendorizado + TanStack Query + sonner (toasts) no frontend; Supabase (Postgres + Auth e-mail/senha + RLS + Storage) no backend.

### ⚠️ COMECE AQUI (contexto para a próxima conversa)
- **Código-fonte (fonte de verdade agora):** `~/Downloads/bev os briefing/bev-os/` — mande a nova conversa MONTAR essa pasta. (No sandbox bash ela aparece em `/sessions/.../mnt/bev os briefing/bev-os`.) A pasta protegida original em app-support NÃO é montável.
- **Migrations aplicadas em produção:** `supabase/migrations/` 0001→0013 (0012 foi neutralizada/obsoleta — ignorar). Toda nova mudança de banco = novo arquivo de migration + aplicar no Supabase.
- **Como aplicar migration:** SQL Editor do dashboard Supabase via Claude in Chrome — injetar com `window.monaco.editor.getEditors()[0].setValue(sql)` e clicar **Run** (se tiver DROP, aparece modal "Potential issue" → clicar **Run query**). O dashboard às vezes fica lento/carrega em branco — insistir/recarregar/abrir aba nova; o banco em si fica operacional.
- **Como fazer deploy (sem CLI/token):** `npm run build` numa cópia em `/tmp` (o mount é lento p/ node_modules); `cp dist/client/_shell.html dist/client/index.html`; criar `dist/client/vercel.json` com rewrite `/(.*)`→`/index.html`; `tar czf deploy.tar.gz` do conteúdo de `dist/client`; no Chrome logado da Bruna em vercel.com criar `<input type=file id=bev-upload>`, subir o tar.gz com file_upload, e um script JS gunzipa (DecompressionStream) + parseia tar + POSTa em `/api/v13/deployments?teamId=team_xpM6PzeSJmysDC7wcDJMaUmC&skipAutoDetectionConfirmation=1` com `{name:'bev-os', target:'production', projectSettings:{framework:null}, files:[{file,data(base64),encoding:'base64'}]}`. Poll até READY. **Sempre `npm run build` + `npx tsc --noEmit` antes de publicar.**
- **Regra de deploy:** nunca publicar o frontend sem aplicar antes a migration correspondente (o front novo espera o schema novo).

### O que cada onda entregou

**Onda 0 (núcleo):** tabelas `cycles` (2026.2 vigente), `directorates` (5), `subareas` (6; só Negócios tem 2: comercial+marketing), `project_nucleos` (Capiba/Suassuna), `approved_roster`, `people`, `occupations` (RBAC; vínculo híbrido = segunda linha com `is_hibrido=true`, único vínculo principal por ciclo via índice parcial). Cadastro e-mail/senha validado contra o roster em duas camadas: RPC `check_roster_email` (pré-check com prefill de cargo/área) + trigger `handle_new_user` em `auth.users` que cria people+occupations e marca `claimed` — e-mail fora do roster é REJEITADO na hora (decisão da Bruna). Helpers RLS SECURITY DEFINER: `current_cycle_id`, `is_direx`, `has_role`, `is_leader_of`, `belongs_to_subarea` (+ depois `is_lideranca`, `pc_subarea_id`, `can_*`). Layout: Topbar fixa (logo, Seletor de Contexto, busca ⌘K/Ctrl K, toggle de tema, avatar) + Sidebar contextual com módulos na ordem do Blueprint §3; sidebars especiais para Direx e Visão Geral BEV. Home = Inbox pessoal por papel + Painel institucional. Modo claro/escuro 100% por tokens CSS.

**Onda 1:** Demandas (lista+detalhe, múltiplos responsáveis, comentários; triggers: `em_revisao` exige `entregavel_url`, `concluido` só liderança da subárea; aprovação via ApprovalBar transversal), Calendário (ex-Agenda; RG/RD/RL/RA com quórum via RLS lendo occupations + categorias extras Capacitação/Evento MEJ/Coworking/Outro com título livre e escopo área-ou-BEV-todo; pauta/ata por evento; decisões de ata geram Demandas), Avisos (ex-Comunicados; SÓ Direx publica — RLS; link + imagens + arquivos via bucket Storage público `avisos` com upload restrito à Direx; leitura marcada ao abrir), Bev News (feed aberto com reações), Direx (Resumo/Dashboard via `direx_summary_view` acessível a gerente — SÓ AGREGADOS, decisão conservadora minha; Atas de RD e Decisões Macro restritas a diretor).

**Onda 2:** Comercial (Kanban do funil Qualificação→…→Fechado/Perdido herdado do Bevilaqua Connect SEM gamificação; `lead_stage_history` automática; fechado exige valor, perdido exige motivo — triggers), Projetos (lead fechado → trigger cria projeto SEM núcleo; alocação de Capiba/Suassuna é MANUAL pela liderança de Projetos — decisão da Bruna; equipe, prazo, conclusão; fila "aguardando núcleo" na Inbox da liderança).

**Onda 3:** PDI (`pdi_plans`/`pdi_goals`; leitura: avaliado+avaliador+liderança direta; aba "Meus Assessores" via `liderados_view` com `risco` calculado: sem PDI, PDI parado 30+ dias ou agravo recente), Warnings (`warning_flags` seed branca 1/amarela 3/vermelha 5/preta 10 — PESOS SÃO SUPOSIÇÃO MINHA, Regimento não foi anexado, validar com a Bruna; cadeia trigger: 10 pontos→agravo, 3 agravos→probatório; visível só titular+P&C), Frequência (`absence_justifications` por evento; liderança do evento aprova/rejeita), Benchs (agendamento + insights obrigatórios pós-execução), Direx→Meus Liderados (diretores veem todos por risco).

Extras feitos a pedido dela: cores institucionais (#a9cf44 primary, #212021, #f3f3f3) nos tokens; "Minha Área" no seletor do diretor; diretores exibidos pela DIRETORIA (não subárea nominal — ela é Diretora de Negócios com vínculo nominal em comercial); toasts globais via MutationCache (erros `BEV_OS_*` dos triggers são traduzidos); favicon; 404; edição de nome no Perfil; confirm() antes de exclusões.

### Dados em produção
Roster real 26.2 carregado: 38 pessoas (5 diretores, 6 gerentes, 27 assessores) — script em `supabase/roster_26_2.sql`. Bruna = brunabeltrao@bevilaqua.org.br, Diretora de Negócios. Gerente de Institucional = guilhermebarros@ (pessoa distinta do Diretor de Gestão guilherme@ — confirmado por ela). Marketing sem gerente eleito (adicionar via INSERT no roster quando eleger). Nomes de líderes derivados dos e-mails (ela pode mandar nomes completos). Auth: confirmação de e-mail DESLIGADA (segurança = roster), Site URL = https://bev-os.vercel.app.

### Como operar (workflow que funcionou)
- **Migrations**: arquivos versionados em `supabase/migrations/` (0001 core, 0002 RLS, 0003 seed, 0004 onda1, 0005 onda2, 0006 correções, 0007 onda3 — TODAS aplicadas em produção). Testar antes em PGlite no sandbox (harness em /tmp/pgtest: stub de roles + schema auth com auth.uid() substituível + schema storage). Aplicar em produção via SQL Editor do dashboard Supabase usando Claude in Chrome: injetar via `window.monaco.editor.getEditors()[0].setValue(sql)` (CUIDADO: usar getEditors()[0], não getModels().at(-1) — a aba restaura conteúdo antigo) e clicar Run. O dashboard Supabase às vezes demora/falha para carregar — insistir/recarregar.
- **Deploy**: build SPA (`npm run build`; `spa:{enabled:true}` no vite.config), `cp dist/client/_shell.html index.html`, empacotar dist/client + `vercel.json` (rewrite /* → /index.html) num `deploy.tar.gz`; no Chrome logado da Bruna em vercel.com: criar `<input type=file id=bev-upload>` via javascript_tool, subir o tar.gz com file_upload, e um script JS na página gunzipa (DecompressionStream), parseia o tar e POSTa em `/api/v13/deployments?teamId=team_xpM6PzeSJmysDC7wcDJMaUmC&skipAutoDetectionConfirmation=1` com files base64, `name:'bev-os'`, `target:'production'`. Poll até READY. (Sem CLI/token — sessão do navegador dela autentica; processos em segundo plano do sandbox morrem entre comandos, então vercel login não funciona.)
- Build de verificação em /tmp/build-check (cópia local; o mount de outputs é lento para node_modules). `npm run build` + `npx tsc --noEmit` sempre antes de publicar.

### Onda 3.1 (Opus, 10/07) — Meus Liderados refinado — EM PRODUÇÃO
Migration `20260711000008_liderados.sql` aplicada (Supabase) + deploy do frontend (Vercel), ambos validados na Bruna (Negócios).
- **Meus Liderados** virou página única `/_app/liderados.tsx`, exclusiva de lideranças (diretor/gerente/coordenador), no sidebar de área (gerente agora vê). `/direx/liderados` redireciona pra ela. Assessor não vê (Lock).
- `liderados_view` reescrita: baseada no **approved_roster** (mostra todos os 38 do ciclo, mesmo sem conta — coluna `ativo`; `person_id` nulo p/ quem não ativou) e **escopo por diretoria** (diretor via `is_leader_of`, não mais org inteira). Divisão por papel: diretor vê GERENTES + ASSESSORES da própria diretoria; gerente vê só ASSESSORES da subárea. Colunas novas: `email`, `ativo`.
- Bug corrigido: Lucas (gerente) saiu de "Meus Assessores" (PDI filtra assessor/analista + ativo) e aparece em GERENTES.
- Painel por pessoa (ativos): desempenho (demandas concluídas/total + taxa de entrega, metas PDI, nº de 1:1), demandas atuais, PDI (visão+metas) e histórico de 1:1.
- Nova tabela `pdi_checkins` (1:1 do PDI: data+notas) com RLS reusando `can_see_pdi`/`can_manage_pdi`.
- Fonte: `src/routes/_app/liderados.tsx`, `src/lib/pdi.ts` (getCheckins/addCheckin), `src/lib/demandas.ts` (getDemandsByPerson), `src/components/layout/sidebar.tsx`.

### Onda 3.2 (Opus, 10/07) — Reuniões de Área — EM PRODUÇÃO
Migration `20260711000009_reunioes_area.sql` aplicada + deploy, validado ao vivo (criação, presença 1/6, roster-leader policy).
- Novo módulo `/_app/reunioes.tsx` (sidebar de área, visível a todos; RA = segundas 22h). Roda sobre os eventos RA (`events`, meeting_type 'ra') — aparece também no Calendário e usa o RLS existente (can_see_event/can_manage_event).
- Duas tabelas novas: `ra_details` (tipo enum brainstorming/alinhamento/repasse/capacitacao, insights, observacoes, transcricao, repasses, acoes; pautas ficam em events.pauta) e `ra_attendance` (event_id + **email** do roster + presente — chaveado por e-mail p/ marcar quem não ativou). Presentes/total = linhas de ra_attendance (assessor lê; não precisa do roster).
- Policy extra: `approved_roster_select_lider` (liderança lê o roster da própria subárea, p/ montar a chamada).
- Liderança: editor completo + controle de presença. Assessor: SummaryPanel read-only (pautas/insights/repasses/ações + contagem). Divisão via `leadsSubarea(subarea_id)`.
- Integração: "Presença em reuniões de área: X/Y" no painel de Meus Liderados (getPersonRaPresence). Fonte: `src/lib/reunioes.ts`, `src/routes/_app/reunioes.tsx`.
- Assunção: reunião criada manualmente (sem cron), data default = próxima segunda 22h; tipo single-select. Existe 1 reunião de teste (Comercial 13/07) sem presença — pode manter ou excluir.

### Onda 4 (Opus, 10/07) — Maturidade Institucional — EM PRODUÇÃO
Migration `20260711000010_onda4.sql` aplicada + deploy, verificado ao vivo (Dashboards/Financeiro/Memória renderizam, RLS ok).
- **Financeiro** (`finance_entries`, caixa único): TODOS leem (saldo, entradas/saídas com descrição); Gestão+Direx lançam (`can_manage_finance` = is_direx OR is_leader_of(gestao)). Rota `/financeiro`. Bruna vai mandar os números atuais p/ popular (seed pendente).
- **Memória Institucional** (`memory_docs`, tipos pop/ata/template/contrato): todos leem; só P&C+Direx publicam (`can_manage_memory`). Busca ilike título/conteúdo + filtro por tipo. Rota `/memoria`.
- **Dashboards** (`/dashboards`, liderança) + **Visão Geral BEV enriquecida**: componente `DashboardsPanel` com pessoas por diretoria, taxa de entrega (view `dashboard_entrega`, liderança vê tudo), financeiro (caixa), warnings (view `dashboard_warnings`, só Direx+P&C). 
- Sidebar: Financeiro e Memória habilitados p/ todos; Dashboards p/ liderança (onlyLeaders).
- Fontes: `src/lib/{financeiro,memoria,dashboards}.ts`, `src/routes/_app/{financeiro,memoria,dashboards}.tsx`, `src/components/dashboards-panel.tsx`, `src/routes/_app/visao-geral.tsx`.
- **Onda 4 = última onda do ADD §6.** Pós-v1 restante: Central da Direx, virada de ciclo 2027.1, FID/BevCoins. Seed financeiro real quando a Bruna enviar.

### Onda 4.1 (Opus, 10/07) — ajuste financeiro + Planejamento Estratégico — EM PRODUÇÃO
Migration `20260711000011_planejamento_e_fin.sql` aplicada + deploy, verificado ao vivo.
- **Correção Financeiro**: `can_manage_finance` agora = `belongs_to_subarea(gestao)` — só a ÁREA de Gestão (assessor/gerente/diretor de Gestão) edita, NÃO a Direx toda. Frontend `financeiro.tsx` canManage = occupations em 'gestao'. (Confirmado: Bruna/Negócios não vê mais o form de lançar.)
- **Seed do caixa** (semana 01–07/06): saldo inicial 48.765,45 + entrada 222,28 + 4 saídas → **saldo atual R$ 48.576,78** (confirmado pela Bruna como saldo depois dos lançamentos). Descrições foram semeadas sem acento (injeção via SQL) — pode dar um UPDATE pra reacentuar se quiser.
- **Planejamento Estratégico** (novo módulo `/planejamento`, no topo do sidebar, todos leem / **só Direx edita**): box de foco+propósito por ciclo (`strategic_plan`) + Objetivos Estratégicos (`strategic_objectives`) com **OKRs** (`objective_okrs`), **KPIs** (`objective_kpis`: nome/meta/atual) e **diretorias responsáveis** (`objective_directorates`, N:N com as 5). Helper `can_edit_objective`. Fontes: `src/lib/planejamento.ts`, `src/routes/_app/planejamento.tsx`.
- Armadilha registrada: função SQL que referencia tabela precisa ser criada DEPOIS da tabela (o `can_edit_objective` quebrou na 1ª tentativa por vir antes de `strategic_objectives`; reordenado).

### Ajustes recentes (Opus, 10/07) — EM PRODUÇÃO
- **Gerentes de Gestão** adicionados ao roster: `rafaelvieira@` (Rafael Vieira) e `sofiaerdt@` (Sofia Erdt), role gerente, subárea gestao. Já podem criar conta. Nomes derivados dos e-mails (confirmar).
- **Bug Avisos corrigido:** a query de `announcements` dava HTTP 300 (relação ambígua) porque `announcement_reads` (tabela de junção) cria 2 caminhos até `people`. Fix em `comunicados.ts`: `autor:people!announcements_autor_id_fkey(...)`. (Padrão: sempre fixar a FK ao embutir `people`.)
- **Comercial e Projetos removidos do menu** (áreas vão ter CRM/dashboards próprios). Rotas/libs ainda existem, só saíram da navegação. **Demandas** também saiu do menu (cada área usa Notion) — Home ainda tem seções de demandas (deixadas de propósito por ora).
- **Menu agrupado em seções** (`sidebar.tsx`, const `GROUPS`): Início · Dia a dia (Calendário, Reuniões de Área, Avisos) · Comunicação & Cultura (Bev News) · Estratégia (Planejamento, Dashboards, Financeiro) · Pessoas & Desenvolvimento (PDI, Meus Liderados, Warnings, Frequência, Benchs, Pessoas) · Conhecimento (Memória).

### Calendário 2.0 (Opus, 10/07) — migration 0013 — EM PRODUÇÃO
`20260711000013_calendario.sql`. Filosofia: o Calendário virou o hub de compromissos institucionais.
- **Público-alvo (audiência) separado da presença obrigatória.** Novas colunas em `events`: `audiencia` (enum `event_audience`: bev/diretores/diretores_gerentes/areas), `link_reuniao`, `obrig_diretores/gerentes/assessores`. Tabela `event_target_directorates` (quando audiencia='areas', multi-diretoria). Ex.: evento pra TODO o BEV mas obrigatório só p/ assessores.
- **Visibilidade agora é por AUDIÊNCIA** (não mais pelo slug do tipo): `can_see_event` reescrita. `can_manage_event` = criador / diretor / liderança de diretoria-alvo. `events_insert` = qualquer `is_lideranca` (gerentes criam eventos). `events_select` usa `can_see_event`. Eventos antigos tiveram audiência backfillada a partir do meeting_type.
- **RSVP** (`event_rsvp`, enum `rsvp_status` confirmado/recusado) + **docs** (`event_docs`; ata continua em `meeting_minutes`).
- **RSVP na Home** (`index.tsx`): "Confirme sua presença" lista compromissos futuros obrigatórios p/ o papel do usuário sem RSVP; "Não poderei" abre motivo e cria `absence_justification` → alimenta a **Frequência** (sem preencher 2x). Helper `getMyPendingConfirmations`.
- **Painel do Calendário** (`agenda.tsx`) refeito: criar compromisso (categoria + público-alvo + obrigatoriedade + link + pauta); painel direito contextual (sem seleção = próximos compromissos; com evento = indicadores confirmados/justificaram, link, respostas, pauta, docs, ata + RSVP do usuário). RA continua sendo criada/documentada no módulo **Reuniões de Área** (agora `createRaMeeting` seta audiencia='areas' + target directorate).
- Fontes: `src/lib/agenda.ts`, `src/routes/_app/agenda.tsx`, `src/routes/_app/index.tsx`, `src/components/layout/sidebar.tsx`, `src/lib/reunioes.ts`.

### Em aberto / próximos passos combinados com a Bruna
- **Aprimorar cada aba** (roadmap dela): Calendário feito; próximas abas a pedido dela.
- **PDI:** ela vai levar o arquivo `~/Downloads/bev os briefing/PROMPT_PDI_PeC.md` pro ChatGPT de P&C; quando voltar o compilado, transformar em aba de PDI funcional (permissões: assessor vê o próprio; liderança da área + P&C designada alimentam; gerente também tem PDI).
- **Financeiro:** semear os números reais que a Bruna for enviando semanalmente (só Gestão+Direx lançam).
- Notas: descrições do seed financeiro foram gravadas sem acento (pode reacentuar por UPDATE).

### O que FALTA
1. **Validação da Bruna** das Ondas 2 e 3 em uso real (ela validou parcialmente; pesos das bandeiras pendentes de confirmação).
2. **Onda 4 (ADD §6 item 5)**: `finance_entries` (caixa único, subarea_id só como dimensão de relatório — Diretoria de Gestão), `memory_docs` (POPs/atas/templates com busca), Dashboards consolidados (views agregadas: pessoas, taxa de entrega, financeiro, warnings) e a "Visão Geral BEV" enriquecida.
3. **Pós-v1 (planejado, não bloqueia)**: Central da Direx migrada do sistema atual (aba dentro de Direx, 100% diretores); virada de ciclo 2027.1 (arquivamento: RLS já bloqueia escrita em ciclo não vigente, mas falta fluxo de criação de novo ciclo + novo roster); notificações por e-mail, exportações PDF/CSV, testes automatizados e mobile ficaram explicitamente fora da v1.
4. **FID/BevCoins**: ela pediu para IGNORAR por enquanto (há regulamento em rascunho e mockup; seria módulo pós-Onda 4; feedback jurídico/técnico já dado a ela).
5. Pendências menores: upload de foto de perfil (people.foto_url existe, sem UI); busca global não cobre módulos da Onda 3; event_participants existe sem UI; nomes completos dos líderes no roster.

### Armadilhas conhecidas
Não usar `getModels().at(-1)` no monaco (ver acima). O classificador de segurança pode exigir confirmação explícita da Bruna para publicar/alterar contas — pergunte via AskUserQuestion antes. Sessões do Chrome: há dois navegadores conectados (macOS = principal; Windows). RLS: toda tabela nova segue o padrão do ADD §4 (RLS on, revoke anon, grants explícitos, updated_at trigger, escrita bloqueada fora do ciclo vigente). Erros de negócio nos triggers usam prefixo `BEV_OS_...` — o frontend traduz e o toast global exibe.
