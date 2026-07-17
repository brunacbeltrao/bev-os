# Dashboard por Diretoria — Design

**Data:** 2026-07-17
**Contexto:** BEV OS (`bev-os`) — reformulação da aba **Dashboards** (`/dashboards`).
**Fonte de verdade das metas:** propostas de diretoria 2026.2 (Negócios/Bruna, Projetos/Rayssa, Gestão/João e Guilherme, P&C/Eduarda, Institucional/Teodoro) + CSV de faturamento da Brasil Júnior.

---

## 1. Objetivo

Transformar a aba Dashboards de 4 cards genéricos em um **painel consolidado organizado por diretoria**, com os indicadores-chave de cada uma. Cada diretoria mantém (edita) os próprios números; todos os membros visualizam o painel completo.

## 2. Princípios e decisões

- **Fonte dos dados:** editável no app (não hardcode). O que já é calculável dos dados existentes vem automático; o resto é editado pela liderança da diretoria.
- **Acesso — leitura:** todos os membros autenticados veem o dashboard completo (hoje a aba é restrita a lideranças; essa restrição é removida).
- **Acesso — escrita:** a liderança de cada diretoria (diretor/gerente/coordenador daquela diretoria) edita só a sua seção; a Direx pode editar qualquer seção e a faixa geral.
- **Estilo:** seguir o padrão visual atual (cards, barras de progresso). Gráfico do Brasil Júnior em **SVG inline** — sem adicionar biblioteca de gráficos.
- **Ciclo vs ano:** o faturamento Brasil Júnior é por **ano-calendário**; os demais indicadores são do **ciclo atual**.

## 3. Layout da página

Ordem vertical:

1. **Faixa "Indicadores gerais BEV (Portal BJ)"** — CSAT e Projeto de Impacto. Editável só pela Direx.
2. **Negócios**
3. **Projetos**
4. **Gestão**
5. **Pessoas e Cultura**
6. **Institucional**

Cada bloco é um `Card` com título, os indicadores e um botão "Editar" (ícone lápis) visível apenas para quem tem permissão de escrita naquela seção. O "Editar" abre um `Dialog` com os campos daquela seção (mesmo padrão do editar-evento do calendário).

---

## 4. Seções e indicadores

### 4.0 Indicadores gerais BEV (Portal BJ) — Direx
- **CSAT** (número editável, ex.: 0–100 ou 0–10).
- **Projeto de Impacto** (status/percentual editável — ex.: "em andamento" / concluído, ou um número).
- Fonte: tabela `bev_indicadores` (por ciclo). Editável por `is_direx`.

### 4.1 Negócios — Faturamento vs Meta (Brasil Júnior) + funil
- **Faturamento vs Meta (BJ):** gráfico de linha **Meta × Realizado** acumulado, Jan–Dez. Número-título: realizado acumulado ÷ meta anual (**R$ 84.036,50**) = %. Também mostra o gap vs a meta do mês atual.
  - Fonte: tabela `faturamento_mensal` (por ano/mês). Meta fixa (seed do CSV); `realizado` editável mês a mês pela liderança de Negócios.
- **Ticket médio:** valor real (calculado dos leads fechados no Comercial) vs **meta R$ 2.800** (editável).
- **Conversão do funil:** taxa real (calculada dos leads) vs **meta ≥ 40%** (editável).
  - Metas em `negocios_indicadores` (por ciclo). Reais via view `dashboard_negocios`.

### 4.2 Projetos — em andamento por serviço e por núcleo
- **Total em andamento** + distribuição **por serviço** e **por núcleo** (barras).
- Serviços (catálogo de 14): Adequação à LGPD; Elaboração de Regimento Interno; Revisão e Elaboração do Estatuto Social; Parecer Jurídico; MoU; NDA; Elaboração de Termos; Termos de Uso e Política de Privacidade; Revisão e Elaboração de Contratos; Assessoria Jurídica; Registro de Marca; Revisão e Elaboração de Atas; Consultoria Jurídica; Abertura de CNPJ.
- Núcleos: Capiba, Nabuco, Suassuna (garantir os três seedados).
- Fonte: campo novo `projects.servico_id` (referência a `project_services`) + `projects.nucleo_id` (já existe). A liderança de Projetos define o serviço junto com o núcleo, na tela de projeto já existente. Contagens via view `dashboard_projetos`.

### 4.3 Gestão — caixa e saúde financeira
- **Caixa atual:** saldo do caixa único (entradas − saídas). Calculado.
- **Saúde financeira:** entradas × saídas do ciclo + **status** (Saudável/Atenção) comparando o saldo com uma **reserva/meta de caixa** editável.
  - Saldo/entradas/saídas via view `dashboard_financeiro` (agregado, legível por todos — não expõe lançamentos individuais). Reserva em `financeiro_meta` (por ciclo), editável pela liderança de Gestão.

### 4.4 Pessoas e Cultura — PDIs + Clima
- **PDIs:** abertos, concluídos e em risco no ciclo. Calculado dos PDIs (`pdi_plans`) via view `dashboard_pdi`.
  - Definições: aberto = existe registro no ciclo; concluído = `lider_submetido = true`; em risco = `quadrante` de risco (a confirmar o valor exato de `quadrante` no plano).
- **Clima (eNPS):** número editável, resultado da pesquisa de clima que a área roda por fora.
  - Fonte: `pc_indicadores` (por ciclo), editável pela liderança de P&C.

### 4.5 Institucional — colaborativo + engajamento MEJ
- **Faturamento colaborativo:** barra de progresso `realizado ÷ meta` (**meta R$ 21.475,95**, realizado hoje 0), com nota dos critérios: terceirizações com IES, Mercado Sênior e Governo.
- **Colaboração com outra EJ:** contador **0/1**.
- **Colaborações com agentes diferentes:** contador **0/2**.
- **Superávit vs ano anterior:** valor editável (hoje **−R$ 18.199,96**) com seta de tendência.
- **Engajamento MEJ:** % de participação em eventos MEJ (editável; baseline ~78%).
  - Fonte: `institucional_indicadores` (por ciclo), editável pela liderança de Institucional.

---

## 5. Modelo de dados (migrations)

Uma migration nova cria o que segue. Todas as tabelas com RLS: **SELECT para `authenticated`**; **INSERT/UPDATE conforme a diretoria** (ver §6).

**Referência e projetos**
- `project_services (id uuid pk default gen_random_uuid(), slug text unique, nome text not null, ordem int not null default 0)` — seed dos 14 serviços.
- `alter table projects add column servico_id uuid references project_services(id)` — nullable.
- Garantir seed do núcleo **Nabuco** (Capiba/Suassuna já existem em `project_nucleos`).

**Séries e KPIs editáveis** (uma linha por chave temporal)
- `faturamento_mensal (id uuid pk, ano int not null, mes int not null check (mes between 1 and 12), meta numeric not null, realizado numeric, unique(ano, mes))` — seed 2026 do CSV (valores acumulados).
- `negocios_indicadores (cycle_id uuid pk references cycles, ticket_medio_meta numeric not null default 2800, conversao_meta numeric not null default 0.40)`.
- `financeiro_meta (cycle_id uuid pk references cycles, reserva_minima numeric not null default 0)`.
- `pc_indicadores (cycle_id uuid pk references cycles, enps numeric)`.
- `institucional_indicadores (cycle_id uuid pk references cycles, colab_realizado numeric not null default 0, colab_meta numeric not null default 21475.95, colab_ej int not null default 0, colab_ej_meta int not null default 1, colab_agentes int not null default 0, colab_agentes_meta int not null default 2, superavit numeric not null default -18199.96, engajamento_mej numeric)`.
- `bev_indicadores (cycle_id uuid pk references cycles, csat numeric, projeto_impacto text)`.

**Views agregadas** (SELECT para `authenticated`; expõem só agregados)
- `dashboard_projetos` — contagens de projetos `em_andamento` do ciclo, por `servico_id` e por `nucleo_id`.
- `dashboard_financeiro` — saldo, entradas e saídas do ciclo.
- `dashboard_pdi` — abertos, concluídos, em risco no ciclo.
- `dashboard_negocios` — ticket médio e taxa de conversão calculados dos leads do ciclo.

> As linhas dos KPIs editáveis por ciclo são criadas sob demanda (upsert por `cycle_id`) quando a liderança edita pela primeira vez; a leitura trata "sem linha" como valores padrão.

## 6. Segurança (RLS)

- **Leitura:** todas as tabelas e views acima liberadas para `authenticated`.
- **Escrita por diretoria:** helper `can_edit_directorate_metrics(uid, dir_slug)` = `is_direx(uid)` **OU** ocupação de liderança (diretor/gerente/coordenador) naquela diretoria no ciclo atual. Políticas de INSERT/UPDATE de cada tabela usam o slug fixo da diretoria:
  - `faturamento_mensal`, `negocios_indicadores` → `negocios`
  - `financeiro_meta` → `gestao`
  - `pc_indicadores` → `pessoas-cultura`
  - `institucional_indicadores` → `institucional`
  - `bev_indicadores` → só `is_direx`
- `projects.servico_id`: editável por quem já pode editar projetos (liderança de Projetos), sem nova policy.
- `project_services`: seed estático; leitura para todos. (Gerir a lista fica fora de escopo por ora.)

## 7. Frontend

- Remover o gate `isLeader` da rota `/dashboards` (todos os membros veem).
- Reescrever `dashboards-panel.tsx` para renderizar a faixa geral + 5 seções por diretoria.
- Novo componente de **gráfico de linha SVG** (`components/mini-line-chart.tsx`) para o BJ — sem dependência externa.
- Cada seção: componente próprio com sua query (`@tanstack/react-query`) e, quando o usuário tiver permissão, um `Dialog` de edição (upsert na tabela da seção). Padrão de permissão/edição igual ao editar-evento.
- Novas funções em `src/lib/dashboards.ts` (ou libs específicas) para ler as views e as tabelas de KPI e para os upserts de edição.
- O editor do BJ (Negócios) permite atualizar o `realizado` de cada mês do ano corrente.
- Reaproveitar `fmtBRL` (financeiro) para moeda.

## 8. Fora de escopo (por ora)

- Sistema de orçamento/bonificação por área e setorização de caixa (propostas de Gestão) — só o caixa atual + saúde/reserva entram agora.
- Coleta automática de CSAT, eNPS e engajamento MEJ — entram como números editáveis.
- Tela de administração do catálogo de serviços (seed estático inicialmente).
- Ticket médio/conversão: usar cálculo direto dos leads; refinar a definição de "conversão" no plano se necessário.

## 9. Pontos a confirmar no plano

- Valor exato de `quadrante` que marca PDI "em risco".
- Definição precisa de "conversão do funil" (leads fechados ÷ total, ou avanço por etapa) e do cálculo de ticket médio (base: leads fechados do ciclo).
- Escala do CSAT e do eNPS (0–10 vs 0–100) para exibição.
- Confirmar os `slug` reais em `directorates` (ex.: `negocios`, `projetos`, `gestao`, `pessoas-cultura`, `institucional`) usados no helper de RLS — devem corresponder exatamente aos valores no banco.
