# BEV OS — Ondas 0, 1 e 2

## O que a Onda 2 entrega

- **Comercial** (Kanban): funil herdado do Bevilaqua Connect — Qualificação → Prospecção → Reunião → Proposta → Negociação → Fechado/Perdido — **sem** a camada de gamificação (cadência/SLA/pontuação, decisão de escopo do PRD). Lead com cliente, assessor responsável, segmento (PME/EJ/Atlética/Outro), valor fechado, serviços vendidos, motivo de perda. Trilha de etapas (`lead_stage_history`) registrada automaticamente por trigger. Regras no banco: Fechado exige valor; Perdido exige motivo.
- **Projetos**: lead Fechado gera Projeto automaticamente (trigger), **sem núcleo** — decisão da Bruna (10/07/2026): alocação de Capiba/Suassuna é manual pela liderança de Projetos, que também define prazo, monta equipe e conclui. Sem financeiro por projeto (caixa único).
- Inbox da liderança de Projetos com fila "Novos projetos — alocar núcleo"; busca global cobre leads e projetos; Comercial visível nos contextos de Negócios/Comercial e Projetos no contexto de Projetos (Blueprint §3).

Sistema operacional interno do Bevilaqua — Escritório Modelo Empresarial.
Fonte de verdade: `PRD_BEV_OS.md`, `ADD_BEV_OS.md`, `BLUEPRINT_BEV_OS.md`.

## O que a Onda 1 entrega

- **Demandas** (Lista + Detalhe): múltiplos responsáveis, comentários, fluxo A Fazer → Em Andamento → Em Revisão → Concluído. Regras aplicadas por trigger no banco (não só na UI): Em Revisão exige link de entregável; Concluído só pela liderança da subárea — via barra de aprovação transversal.
- **Agenda** (Calendário): os 4 tipos oficiais (RG/RD/RL/RA) com cores próprias; quórum/visibilidade resolvidos por RLS lendo occupations (RG todos; RD diretores; RL lideranças; RA membros da subárea). Pauta e ata por evento; decisões de ata geram Demandas (fluxo Reunião → Ata → Ação).
- **Comunicados** (Lista + Detalhe): só liderança publica (RLS de INSERT), todos leem, histórico buscável, marcação de leitura ao abrir.
- **Bev News**: feed aberto de cultura (premiação/vivência/aniversário), reações, sem hierarquia de aprovação.
- **Direx**: Atas de RD e Decisões Macro 100% restritas a Diretores; Resumo/Dashboard via `direx_summary_view` acessível também a Gerentes — **somente agregados** (contagens e datas), sem conteúdo de ata nem decisões completas.
- Home com Inbox real (minhas demandas, aprovações pendentes, próximas reuniões) e busca global cobrindo demandas e comunicados.

**Decisão registrada (Onda 1):** o conteúdo exato do `direx_summary_view` não é especificado no ADD — implementado com agregados apenas (nº de atas, nº de decisões, últimas datas), errando para o lado da privacidade. Fácil de ampliar se a Direx quiser expor títulos de decisões aos Gerentes.

## O que a Onda 0 entrega

- **Cadastro individual** (e-mail/senha) validado contra `approved_roster` — cargo e área preenchidos automaticamente a partir do roster; e-mail fora da lista é **rejeitado na hora** (validação dupla: RPC no cliente + trigger no banco).
- **Tabelas core:** `cycles`, `directorates`, `subareas`, `project_nucleos`, `approved_roster`, `people`, `occupations` (vínculo híbrido = segunda linha em `occupations` com `is_hibrido = true`).
- **Helpers de RLS:** `is_direx`, `has_role`, `is_leader_of`, `belongs_to_subarea`, `current_cycle_id` (SECURITY DEFINER, EXECUTE só para `authenticated`).
- **Home:** Inbox pessoal (adaptada por papel) + Painel institucional na mesma tela.
- **Busca global:** Cmd/Ctrl+K na Topbar (pessoas, áreas, diretorias).
- **Layout base:** Topbar fixa com Seletor de Contexto + Sidebar contextual, com sidebars próprias para Direx e Visão Geral BEV. Módulos das Ondas 1–4 aparecem desabilitados com a onda indicada.
- **Modo escuro** desde já — tudo via tokens de cor (`src/styles.css`), toggle na Topbar.

## Stack

TanStack Start + React 19 + Vite 7 + Tailwind v4 + shadcn/ui + TanStack Query · Supabase (Postgres + Auth + RLS).

## Produção

- **URL:** https://bev-os.vercel.app (projeto `bev-os` no time Vercel `direxbevilaqua`)
- Build em **modo SPA** (`tanstackStart({ spa: { enabled: true } })` no `vite.config.ts`): app 100% client-side falando com o Supabase, publicado como site estático com rewrite `/* → /index.html` (`vercel.json` gerado no deploy).
- Para republicar após mudanças: `npm run build` e envie o conteúdo de `dist/client` (+ `vercel.json` com o rewrite) para o projeto `bev-os` na Vercel.
- Supabase Auth: confirmação de e-mail **desligada** (a segurança do cadastro é o roster pré-aprovado) e Site URL = https://bev-os.vercel.app.

## Como rodar

1. `cp .env.example .env` e preencha com URL e anon key do projeto Supabase.
2. Aplique as migrations de `supabase/migrations/` (em ordem) — via SQL Editor do dashboard ou `supabase db push`.
3. `npm install && npm run dev` → http://localhost:3000

## Decisões registradas (validar com os documentos)

- **Vínculo híbrido:** o ADD descreve tanto colunas (`is_hibrido`, `hibrido_subarea_id`) quanto "mais de uma linha ativa (principal + híbrido)". Implementado o modelo de **duas linhas** (prosa do ADD §2): o vínculo híbrido é uma segunda linha em `occupations` com `is_hibrido = true` e a própria `subarea_id`. Índice parcial garante um único vínculo principal por pessoa/ciclo; constraint garante que só Assessor pode ser híbrido.
- **Cadastro rejeitado na hora** quando o e-mail não está no roster (decisão da Bru em 09/07/2026) — sem fila de revisão manual.
- **Autenticação por e-mail/senha + roster** (ADD §1), não OAuth de domínio — a nota de OAuth no PRD §8 é herança do documento antigo.
- **Roster de exemplo** no seed (`20260709000003_seed.sql`): a linha da Bruna usa o e-mail real; as demais são placeholders `@exemplo.com` para testar papéis. Substituir pela lista real da P&C antes de abrir o cadastro.
- **Escrita nas tabelas core** (cycles, directorates, subareas, occupations, roster) é só via `service_role`/trigger na Onda 0 — a carga do roster real é feita pela P&C direto no dashboard (ou por script), até existir UI administrativa.

## Próximas ondas (não iniciar sem validação da Onda 0)

1. **Onda 1:** Demandas, Agenda/Reuniões, Comunicados, Bev News, Direx (conteúdo).
2. **Onda 2:** Comercial (herdado do Bevilaqua Connect) e Projetos.
3. **Onda 3:** PDI, Warnings, Frequência, Benchs.
4. **Onda 4:** Financeiro, Dashboards, Memória Institucional.
