# PRD — Perfil do Assessor (Módulo PDI / Meus Assessores)
### BEV OS · Bevilaqua Escritório Modelo Empresarial

**Versão:** 1.0  
**Data:** Julho 2026  
**Autora:** Bru  
**Status:** Planejamento — pronto para implementação

---

## 1. Contexto e Problema

### 1.1 Onde isso mora no BEV OS

O BEV OS já tem planejado o módulo **PDI (Desenvolvimento)** com uma aba **"Meus Assessores"** para Gerentes. O Perfil do Assessor é a tela que abre quando o Gerente clica em qualquer assessor dessa aba — o coração do acompanhamento humano de cada membro.

Hoje, esse acompanhamento não existe de forma estruturada. O gerente depende de memória, conversas informais no grupo de WhatsApp e planilhas pessoais para lembrar quem entregou o quê, quem recebeu feedback e qual o status de desenvolvimento de cada assessor. Quando um gerente sai, esse histórico desaparece com ele.

### 1.2 Problema que estamos resolvendo

- **Fragmentação:** Entregas (Demandas), advertências (Warnings), reuniões (Agenda) e histórico de desenvolvimento (PDI) existem como módulos separados. Não há uma visão unificada por pessoa.
- **Invisibilidade:** A Direx não tem como enxergar o estado de engajamento dos assessores sem perguntar diretamente ao Gerente.
- **Perda de memória:** A transição de gestão apaga o histórico qualitativo de cada membro. O novo gerente começa do zero.
- **Sobrecarga do 1:1:** Hoje o gerente precisa "abrir várias abas" para se preparar para uma reunião 1:1 — demandas aqui, PDI ali, advertências em outro lugar.

### 1.3 O que mudará com este PRD

Uma tela única e estruturada por pessoa — **o Perfil do Assessor** — que condensa toda a informação relevante sobre um membro em 1 Header Fixo + 3 Abas Funcionais, desenhada para o Gerente usar em 30 segundos de prep antes de qualquer 1:1 ou reunião de área.

---

## 2. Escopo e Público

### 2.1 Quem usa esta tela

| Papel | Acesso | O que pode fazer |
|---|---|---|
| **Gerente / Coordenador** | Completo (assessores da própria área) | Leitura e escrita total |
| **Diretor de Pessoas e Cultura** | Completo (todos os assessores do BEV) | Leitura total, sem escrita |
| **Diretor (outros)** | Somente assessores da própria diretoria | Leitura |
| **Próprio Assessor** | Visão pessoal (sem campos privados do gerente) | Somente leitura |
| **Analista de Área / outro Assessor** | Nenhum | Sem acesso |

### 2.2 Contexto de uso

O Gerente acessa o Perfil do Assessor principalmente em três momentos:
1. **Antes do 1:1:** revisar histórico, entregas e plano combinado na última reunião.
2. **Após o 1:1:** registrar o que foi discutido e o novo plano de ação.
3. **Fechamento de ciclo:** escrever o Parecer Final e confirmar a elegibilidade para o Banco de Talentos.

A Direx acessa para monitoramento macro, no contexto da aba "Meus Liderados".

---

## 3. Estrutura da Tela: 1 Header + 3 Abas

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  👤  Nome do Assessor            Área: Projetos · Núcleo Capiba              │
│  📅  Cargo: Assessor · 2º ciclo no BEV (1 ano 2 meses)                      │
│  📌  PDI: Direito Societário · Busca estágio neste ciclo: SIM                │
│  🟢  ELEGÍVEL PARA BANCO DE TALENTOS                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│  [ Aba 1: Entregas e Competências ]  [ Aba 2: Diário de Liderança ]  [ Aba 3: Encerramento de Ciclo ]
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Header Fixo — Raio-X Instantâneo

**Sempre visível**, independente da aba ativa. Responde à pergunta do Gerente em 3 segundos: *"Quem é essa pessoa e como ela está no geral?"*

### 4.1 Campos do Header

| Campo | Fonte de dados | Observação |
|---|---|---|
| **Nome completo** | `people.name` | — |
| **Foto de perfil** | `people.avatar_url` | Opcional; fallback = inicial do nome |
| **Área e Subárea/Núcleo** | `subareas.name` | Ex.: "Projetos · Núcleo Suassuna" |
| **Cargo atual** | `occupations.title` | Ex.: "Assessora de Projetos" |
| **Tempo de BEV** | Calculado: `people.ingresso_date` → ciclos completos | Exibido como "2 ciclos (1 ano 2 meses)" |
| **Foco de PDI** | `pdi_plans.foco_area` (campo livre) | Ex.: "Direito Societário, Trabalhista" |
| **Busca estágio neste ciclo** | `pdi_plans.busca_estagio` (boolean) | Badge "Sim" ou não exibido |
| **Status do Banco de Talentos** | Calculado — ver seção 7.1 | Badge verde/vermelho |

### 4.2 Badge de Elegibilidade (Banco de Talentos)

O badge é calculado automaticamente pelo sistema com base em critérios objetivos. O gerente **não** define isso manualmente.

**🟢 Elegível** quando TODOS os critérios abaixo forem verdadeiros:
- Está no 2º ciclo ou mais (`people.ingresso_date`)
- Bandeira atual: Branca ou Amarela (`warnings.flag_color ≠ 'vermelha' AND ≠ 'preta'`)
- Sem advertências em aberto no ciclo atual
- Pelo menos 1 Parecer Final registrado (de ciclo anterior ou atual)
- Taxa de entrega ≥ 70% das demandas do ciclo (`demands.status = 'concluido'`)

**🔴 Inelegível** se qualquer critério não for atendido.

O badge ao ser clicado exibe tooltip com o motivo detalhado (ex.: "Bandeira Amarela ativa desde 03/06").

---

## 5. Aba 1 — Entregas e Competências

**Propósito:** tudo relacionado à execução e desempenho técnico do assessor neste ciclo.

### 5.1 Card de Resumo de Entregas (topo da aba)

Calculado automaticamente a partir do módulo **Demandas** (tabela `demands`):

```
Ciclo 2026.1  ·  12 demandas atribuídas
🟢 Concluídas no prazo:  8  (67%)
🟡 Concluídas com atraso: 2  (17%)
🔴 Em aberto / atrasadas: 2  (16%)
```

Clicando no número de cada categoria, abre um painel lateral com a lista das demandas correspondentes (nome, projeto, data e status), sem sair do Perfil do Assessor.

### 5.2 Botão "+ Registrar Entrega Avulsa"

Para entregas que não estão no módulo Demandas (ex.: colaboração informal, apresentação interna, contribuição a outro projeto). Campos:

- **Título** (obrigatório, até 120 chars)
- **Data** (obrigatório)
- **Qualidade** (obrigatório): Farol 🟢 Excelente / 🟡 Boa / 🔴 Requer revisão
- **Observação** (opcional, até 280 chars — 1 linha de contexto)

Essas entregas avulsas aparecem no mesmo card de resumo, somadas às demandas do módulo.

### 5.3 Tabela de Competências + Divergência de Percepção (360°)

Uma tabela compacta com as **6 competências-chave do BEV**, atualizadas mensalmente pelo Gerente:

| Competência | Status Gerente | Autoavaliação | Alerta |
|---|---|---|---|
| Proatividade | 🟢 | 🟢 | — |
| Organização | 🟡 | 🟢 | ⚠️ Divergência |
| Qualidade Técnica | 🟢 | 🟡 | ⚠️ Divergência |
| Comunicação | 🟢 | 🟢 | — |
| Cumprimento de Prazos | 🔴 | 🟡 | ⚠️ Divergência |
| Trabalho em Equipe | 🟢 | 🟢 | — |

**Como funciona:**
- O Gerente define o farol do mês para cada competência.
- O Assessor preenche a própria autoavaliação (quando habilitado no ciclo pela P&C).
- O sistema compara automaticamente. Se houver diferença, exibe o ícone ⚠️ com tooltip: *"Você avaliou Organização como 🟡, mas o membro se avaliou como 🟢 — considere explorar isso no próximo 1:1."*
- **Nenhum bloco separado** para 360°. A divergência é um sinal contextual embutido na mesma tabela.

**Competências configuráveis:** a lista acima é a padrão BEV, definida pela P&C no início de cada ciclo em uma tela de administração (fora deste escopo, mas a tabela de competências deve ser parametrizável, não hard-coded).

### 5.4 Integração com módulo Demandas

A Aba 1 puxa dados em tempo real de `demands` via query:

```sql
SELECT d.title, d.status, d.deadline, d.created_at
FROM demands d
JOIN demand_assignees da ON da.demand_id = d.id
WHERE da.person_id = :assessor_id
  AND d.cycle_id = :current_cycle_id
ORDER BY d.deadline DESC
```

Nenhuma duplicação de dados. O Perfil do Assessor é uma **view**, não um módulo paralelo.

---

## 6. Aba 2 — Diário de Liderança

**Propósito:** tudo que envolve interação humana — conversas, reconhecimentos, alertas formais. É a memória qualitativa do gerente sobre o assessor.

### 6.1 Feed Cronológico (Timeline)

A aba exibe uma **linha do tempo única**, do mais recente ao mais antigo, com todos os registros de interação misturados por data. Cada entrada tem:

- Ícone do tipo (📋 Reunião 1:1 / ⭐ Reconhecimento / ⚠️ Acompanhamento)
- Data do registro
- Autor (nome do Gerente que registrou)
- Conteúdo expandível (clique para ver)

O feed é **persistente entre ciclos**: o gerente vê o histórico de todas as interações passadas, organizadas por ciclo com um separador visual ("Ciclo 2025.2 · 4 registros").

### 6.2 Botão Único "+ Nova Interação"

Um único botão que abre um modal com seleção de tipo:

---

#### Tipo 1: 📋 Reunião 1:1

Campos do modal:

| Campo | Tipo | Obrigatório |
|---|---|---|
| Data da reunião | Date picker | Sim |
| Pontos fortes observados | Texto livre (até 500 chars) | Sim |
| Pontos de atenção | Texto livre (até 500 chars) | Sim |
| Plano de ação combinado | Texto livre (até 500 chars) | Sim |
| Próxima 1:1 agendada | Date picker | Não |

Ao salvar, o sistema verifica se existe um evento no módulo **Agenda** com aquela data para esse assessor — se sim, vincula automaticamente (campo `event_id` na tabela `leadership_entries`).

---

#### Tipo 2: ⭐ Reconhecimento

Campos do modal:

| Campo | Tipo | Obrigatório |
|---|---|---|
| Data | Date picker | Sim |
| Tipo de reconhecimento | Select | Sim |
| Descrição | Texto livre (até 300 chars) | Sim |

**Opções do select (configuráveis pela P&C):**
- 🏆 Destaque do Ciclo
- 🚀 Liderou iniciativa
- 💼 Feedback positivo de cliente
- 🤝 Colaboração exemplar
- ✍️ Qualidade técnica excepcional

Os reconhecimentos ficam visíveis para o próprio assessor em sua visão pessoal do perfil, e alimentam o **Banco de Talentos** (Aba 3).

---

#### Tipo 3: ⚠️ Acompanhamento Formal

Usado para registrar alinhamentos sérios, planos de melhoria, ou conversas que antecederam uma advertência formal.

Campos do modal:

| Campo | Tipo | Obrigatório |
|---|---|---|
| Data | Date picker | Sim |
| Motivo | Select + texto livre | Sim |
| O que foi combinado | Texto livre (até 500 chars) | Sim |
| Prazo de verificação | Date picker | Sim |
| Gerou advertência formal | Checkbox | Não |

Se "Gerou advertência formal" for marcado, o sistema exibe um link direto para o módulo **Warnings** para que o Gerente registre a advertência no sistema correto (não duplica — só vincula).

**Este tipo é invisível para o assessor** na visão pessoal.

### 6.3 Integração com módulo Agenda

Ao abrir uma nova Reunião 1:1, o campo "Próxima 1:1 agendada" pode criar um evento diretamente no módulo Agenda com tipo RA (Reunião de Área) — ou apenas registrar a data como referência sem criar evento, dependendo da preferência do gerente.

### 6.4 Integração com módulo Warnings

A Aba 2 exibe, no topo do feed, um **banner de status de advertências** puxado do módulo Warnings:

```
⚠️ Bandeira Amarela ativa  ·  1 advertência este ciclo  ·  [Ver detalhes ↗]
```

O banner linka para o módulo Warnings, não duplica os dados. Se bandeira for Branca e sem advertências, o banner não aparece.

---

## 7. Aba 3 — Encerramento de Ciclo

**Propósito:** espaço para o Gerente e o Diretor formalizarem o encerramento do ciclo para aquele assessor — o Parecer Final e o status no Banco de Talentos.

Esta aba fica **em modo de leitura durante o ciclo ativo**, com um aviso: *"Esta aba é preenchida no encerramento do ciclo. Dados do ciclo atual estão sendo gerados nas abas 1 e 2."*

### 7.1 Parecer Final da Liderança

**Campos:**

| Campo | Tipo | Responsável |
|---|---|---|
| Síntese do ciclo (trajetória e evolução) | Texto rico (até 1.500 chars) | Gerente |
| Pontos de destaque | Texto rico (até 800 chars) | Gerente |
| Pontos a desenvolver no próximo ciclo | Texto rico (até 800 chars) | Gerente |
| Endosso do Diretor de P&C | Texto livre (até 500 chars) | Diretor P&C |
| Data de assinatura | Auto-preenchida ao salvar | Sistema |

**Fluxo de submissão:**
1. Gerente preenche e clica em "Enviar para revisão do Diretor P&C".
2. Diretor P&C recebe notificação no BEV OS.
3. Diretor P&C lê, complementa com o endosso e clica em "Assinar e Finalizar".
4. O parecer fica **bloqueado para edição** após assinatura.
5. O badge do Header é atualizado automaticamente.

### 7.2 Reconhecimentos do Ciclo (Auto-gerado)

Logo abaixo do parecer, o sistema exibe um card resumo dos reconhecimentos registrados na Aba 2, para referência:

```
⭐ Reconhecimentos neste ciclo: 2
  → Feedback positivo de cliente · 15/04/2026
  → Destaque do Ciclo · 10/06/2026
```

### 7.3 Status no Banco de Talentos

Após o Parecer ser assinado pelo Diretor P&C, o sistema calcula o badge de elegibilidade final (ver seção 4.2) e exibe:

- **🟢 Elegível — Incluído no Banco de Talentos do Ciclo 2026.1**
- **🔴 Inelegível — Motivos: [lista de critérios não atendidos]**

O Diretor P&C pode **sobrescrever manualmente** o status (com campo de justificativa obrigatória), para casos excepcionais.

### 7.4 O que vai para o Banco de Talentos

O registro no Banco de Talentos agrega automaticamente:
- Nome completo, área e cargo
- Tempo de BEV (ciclos completos)
- Foco de PDI (área jurídica de interesse)
- Busca estágio: Sim/Não
- Lista de reconhecimentos do ciclo
- Síntese do ciclo (o campo de texto do Parecer, versão resumida para uso externo)
- Data de encerramento do ciclo

---

## 8. Visão do Próprio Assessor

O assessor acessa **seu próprio perfil** por uma rota específica dentro do BEV OS (ex: `/perfil` ou dentro do módulo PDI em `/desenvolvimento/meu-perfil`).

**O que o assessor vê:**

| Campo/Aba | Visível? |
|---|---|
| Header completo | ✅ Sim |
| Card de resumo de entregas | ✅ Sim |
| Tabela de competências (visão do gerente) | ✅ Sim |
| Autoavaliação (seu próprio preenchimento) | ✅ Sim |
| Feed da Aba 2 — Reuniões 1:1 (pontos combinados) | ✅ Sim (somente leitura) |
| Feed da Aba 2 — Reconhecimentos | ✅ Sim |
| Feed da Aba 2 — Acompanhamentos Formais | ❌ Não visível |
| Banner de Warnings | ✅ Sim (sua própria situação) |
| Parecer Final (após assinado) | ✅ Sim |
| Botões de ação (registrar, editar) | ❌ Nenhum |

---

## 9. Modelagem de Dados

### 9.1 Tabela principal: `member_profiles`

View calculada — não é uma tabela com dados duplicados. Combina `people`, `pdi_plans`, `demands`, `warnings` e `leadership_entries`.

### 9.2 Nova tabela: `leadership_entries`

```sql
CREATE TABLE leadership_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       uuid NOT NULL REFERENCES people(id),
  author_id       uuid NOT NULL REFERENCES people(id),  -- gerente que registrou
  cycle_id        uuid NOT NULL REFERENCES cycles(id),
  entry_type      text NOT NULL CHECK (entry_type IN ('one_on_one','recognition','follow_up')),
  
  -- Campos de Reunião 1:1
  strengths       text,           -- pontos fortes
  attention       text,           -- pontos de atenção
  action_plan     text,           -- plano de ação combinado
  next_meeting    date,           -- próxima 1:1 agendada
  
  -- Campo de Reconhecimento
  recognition_type text,          -- tipo do selo
  
  -- Campo de Acompanhamento
  follow_up_reason text,          -- motivo
  follow_up_commitment text,      -- o que foi combinado
  follow_up_deadline date,        -- prazo de verificação
  generated_warning boolean DEFAULT false,
  
  -- Campo compartilhado
  description     text,           -- texto livre geral
  event_id        uuid REFERENCES events(id),  -- vínculo com Agenda (opcional)
  warning_id      uuid REFERENCES warnings(id), -- vínculo com Warnings (opcional)
  
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### 9.3 Nova tabela: `cycle_endorsements`

```sql
CREATE TABLE cycle_endorsements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       uuid NOT NULL REFERENCES people(id),
  cycle_id        uuid NOT NULL REFERENCES cycles(id),
  
  -- Parecer Final
  summary         text,           -- síntese do ciclo
  highlights      text,           -- pontos de destaque
  development     text,           -- pontos a desenvolver
  director_note   text,           -- endosso do Diretor P&C
  
  -- Status
  status          text DEFAULT 'draft' CHECK (status IN ('draft','pending_director','signed')),
  signed_at       timestamptz,
  signed_by       uuid REFERENCES people(id),
  
  -- Banco de Talentos
  talent_eligible  boolean,
  talent_override  boolean DEFAULT false,
  talent_override_reason text,
  
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  
  UNIQUE(person_id, cycle_id)
);
```

### 9.4 Extensão da tabela `pdi_plans`

Adicionar campos ao `pdi_plans` já existente:

```sql
ALTER TABLE pdi_plans
  ADD COLUMN foco_area text,          -- área jurídica de interesse (PDI)
  ADD COLUMN busca_estagio boolean DEFAULT false;
```

### 9.5 Nova tabela: `competency_assessments`

```sql
CREATE TABLE competency_assessments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       uuid NOT NULL REFERENCES people(id),
  cycle_id        uuid NOT NULL REFERENCES cycles(id),
  month           int NOT NULL,       -- 1-12
  year            int NOT NULL,
  competency_key  text NOT NULL,      -- slug da competência
  leader_rating   text CHECK (leader_rating IN ('green','yellow','red')),
  self_rating     text CHECK (self_rating IN ('green','yellow','red')),
  author_id       uuid REFERENCES people(id),  -- quem registrou
  
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  
  UNIQUE(person_id, cycle_id, month, year, competency_key)
);
```

### 9.6 Nova tabela: `competency_definitions`

Para tornar as competências configuráveis pela P&C:

```sql
CREATE TABLE competency_definitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        uuid NOT NULL REFERENCES cycles(id),
  key             text NOT NULL,     -- slug (ex: 'proatividade')
  label           text NOT NULL,     -- nome exibido
  sort_order      int DEFAULT 0,
  
  UNIQUE(cycle_id, key)
);
```

### 9.7 RLS (Row Level Security)

```sql
-- leadership_entries: gerente/coord da área do assessor + Direx + P&C
CREATE POLICY "leadership_entries_access" ON leadership_entries
  USING (
    is_leader_of(person_id)          -- gerente/coord da área
    OR is_direx()                    -- qualquer diretor
    OR has_role('pc_director')       -- Diretor P&C especificamente
    OR person_id = auth.uid()        -- o próprio assessor (somente leitura dos campos públicos)
  );

-- cycle_endorsements: similar, mas sem o assessor no UPDATE
CREATE POLICY "endorsements_read" ON cycle_endorsements
  FOR SELECT USING (
    is_leader_of(person_id) OR is_direx() OR person_id = auth.uid()
  );
CREATE POLICY "endorsements_write" ON cycle_endorsements
  FOR ALL USING (
    is_leader_of(person_id) OR is_direx()
  );

-- competency_assessments: líder escreve, assessor lê somente a própria
CREATE POLICY "competency_read" ON competency_assessments
  FOR SELECT USING (
    is_leader_of(person_id) OR is_direx() OR person_id = auth.uid()
  );
CREATE POLICY "competency_write" ON competency_assessments
  FOR INSERT OR UPDATE USING (
    is_leader_of(person_id) OR is_direx()
  );
```

---

## 10. Integrações com Módulos do BEV OS

### 10.1 Módulo Demandas (`/demandas`)

| Tipo | Detalhes |
|---|---|
| **Dados consumidos** | `demands`, `demand_assignees`, `demand_reviews` |
| **Como** | Query direta no Supabase — view calculada |
| **Direto para** | Card de resumo de entregas (Aba 1) |
| **Sem escrita** | O Perfil não cria nem edita demandas. Apenas lê. |

### 10.2 Módulo Warnings (`/warnings`)

| Tipo | Detalhes |
|---|---|
| **Dados consumidos** | `warnings.flag_color`, `warnings.status`, `warnings` count by cycle |
| **Como** | Query direta — sem duplicação |
| **Direto para** | Banner na Aba 2 + critério de elegibilidade no Header |
| **Link bidirecional** | Acompanhamento Formal (Aba 2) pode linkar para um Warning específico (`warning_id`) |

### 10.3 Módulo Agenda (`/agenda`)

| Tipo | Detalhes |
|---|---|
| **Dados consumidos** | `events` com participante = assessor e tipo RA |
| **Como** | Query direta |
| **Direto para** | Ao registrar Reunião 1:1, o sistema consulta eventos existentes para sugerir vínculo |
| **Pode criar** | Nova entrada em `events` se gerente optar por criar o próximo 1:1 direto do modal |

### 10.4 Módulo PDI (`/desenvolvimento`)

| Tipo | Detalhes |
|---|---|
| **Dados consumidos** | `pdi_plans`, `pdi_goals` |
| **Como** | O Perfil do Assessor É a tela interna do PDI, não um módulo separado |
| **Navegação** | PDI → aba "Meus Assessores" → clique em um assessor → abre Perfil |
| **Dados escritos** | `pdi_plans.foco_area`, `pdi_plans.busca_estagio` (novos campos) |

### 10.5 Módulo Direx (`/direx`)

| Tipo | Detalhes |
|---|---|
| **Dados consumidos** | Nenhum (fluxo reverso) |
| **Direto para** | A aba "Meus Liderados" na Direx usa o mesmo componente de Perfil do Assessor em modo read-only |
| **Permissão** | Diretores acessam qualquer Perfil via Direx |

---

## 11. Rotas e Navegação

```
/desenvolvimento
  └── /meus-assessores                     → lista de cards dos assessores (Gerente)
        └── /assessor/:person_id           → Perfil completo (1 Header + 3 Abas)
              ├── ?tab=entregas            → Aba 1 (default)
              ├── ?tab=lideranca           → Aba 2
              └── ?tab=encerramento        → Aba 3

/perfil                                    → visão pessoal do assessor (somente leitura)

/direx
  └── /meus-liderados
        └── /membro/:person_id             → Perfil do Assessor em modo Direx (read-only)
```

---

## 12. Estados e Edge Cases

| Cenário | Comportamento |
|---|---|
| Assessor sem PDI preenchido no ciclo | Header exibe "PDI não iniciado" com CTA para o gerente criar |
| Assessor sem nenhuma demanda no ciclo | Aba 1 exibe "Nenhuma demanda atribuída neste ciclo" |
| Aba 3 acessada no meio do ciclo | Banner informativo + campos bloqueados |
| Parecer assinado — gerente tenta editar | Campos bloqueados + texto "Assinado em [data]" |
| Assessor híbrido | Header exibe área principal + badge "Híbrido: [área secundária]" |
| Gerente novo (troca de gestão) | Vê histórico completo de ciclos anteriores com nome do gerente que registrou cada entrada |
| Assessor no Conselho Consultivo (futuro) | Fora do escopo — perfil arquivado, sem edição |

---

## 13. Indicadores de Sucesso (Métricas)

| Métrica | Meta | Como medir |
|---|---|---|
| % de Gerentes que registram pelo menos 1 entrada/mês por assessor | ≥ 80% no 1º mês de uso | `leadership_entries` count por autor |
| Tempo médio de prep do 1:1 (estimativa subjetiva) | Redução percebida vs. hoje | Feedback qualitativo dos Gerentes |
| % de ciclos com Parecer Final assinado | 100% até 30 dias após encerramento | `cycle_endorsements.status = 'signed'` |
| % de assessores elegíveis ao Banco de Talentos com Parecer registrado | 100% | Cross entre `talent_eligible` e `cycle_endorsements` |
| Número de membros que consultam o próprio perfil | — | `analytics_events` (fase futura) |

---

## 14. Fora de Escopo (Este PRD)

- **Notificações por e-mail ou WhatsApp** — futuro
- **Comparação entre assessores** (ranking) — futuro, e deve ser discutido com P&C antes
- **Exportação do perfil em PDF** — futuro (Banco de Talentos em PDF)
- **Configuração de competências pela P&C** — tela de admin separada, não bloqueia lançamento
- **Aprovação do 1:1 pelo assessor** — não previsto. O assessor lê, mas não assina
- **Integração com Google Docs ou Notion** — fora do escopo do BEV OS
- **Assessores de áreas não-Projetos** — o modelo se aplica a todas as áreas, mas as referências a Núcleo (Capiba/Suassuna) são específicas de Projetos. Nas outras áreas, o campo "Subárea/Núcleo" não aparece no header.

---

## 15. Onda de Implementação

Este módulo está planejado para a **Onda 5 (Maturidade)** do BEV OS, junto com Desenvolvimento/PDI e Dashboards.

**Pré-requisitos técnicos (devem estar prontos antes):**
- ✅ Módulo Demandas (Onda 2)
- ✅ Módulo Warnings (Onda 3)
- ✅ Módulo Agenda (Onda 1)
- ✅ Módulo PDI base com `pdi_plans` e `pdi_goals` (Onda 5, primeira entrega)

**Ordem de entrega dentro desta feature:**
1. Modelagem das novas tabelas (`leadership_entries`, `cycle_endorsements`, `competency_assessments`, `competency_definitions`) + migrations
2. Header Fixo + dados puxados de tabelas existentes
3. Aba 1 (Entregas + Competências)
4. Aba 2 (Diário de Liderança — Feed + Modais)
5. Aba 3 (Encerramento de Ciclo)
6. Visão do Assessor (`/perfil`)
7. Integração com "Meus Liderados" na Direx

---

## Apêndice A — Prompt Completo para o Fable/Builder

Use o texto abaixo na sessão de construção desta feature, após o BEV OS já ter sido iniciado com o PRD, ADD e Blueprint base:

---

**PROMPT PARA O BUILDER:**

```
Você está implementando o módulo "Perfil do Assessor" dentro do BEV OS (Bevilaqua OS),
uma feature que vive dentro do módulo PDI (/desenvolvimento).

Esta feature é acessada quando um Gerente clica em um assessor na aba "Meus Assessores".
Ela é uma tela com 1 Header Fixo e 3 Abas.

Leia o PRD_PERFIL_ASSESSOR_BEV_OS.md antes de qualquer código.

STACK: TanStack Start + React 19, Vite 7, Tailwind v4, shadcn/ui, TanStack Query, Supabase (RLS).

ANTES DE ESCREVER CÓDIGO, execute na ordem:
1. Criar as migrations SQL para as 4 novas tabelas (seção 9 do PRD):
   - leadership_entries
   - cycle_endorsements
   - competency_assessments
   - competency_definitions
   
2. Adicionar colunas foco_area e busca_estagio na pdi_plans existente.

3. Criar as políticas RLS (seção 9.7).

4. Construir a rota /desenvolvimento/assessor/:person_id.

5. Implementar o Header Fixo como componente separado (AssessorProfileHeader.tsx),
   pois ele é reutilizado na rota /direx/meus-liderados/:person_id.

6. Implementar as 3 abas como componentes separados:
   - AssessorTab1Entregas.tsx
   - AssessorTab2Lideranca.tsx
   - AssessorTab3Encerramento.tsx

REGRAS DE NEGÓCIO CRÍTICAS:
- O badge de elegibilidade do Banco de Talentos é CALCULADO, nunca input manual.
  Critérios: ≥ 2 ciclos, bandeira não vermelha/preta, sem advertências em aberto,
  taxa de entrega ≥ 70%, pelo menos 1 Parecer Final registrado.
  
- Acompanhamentos Formais (entry_type = 'follow_up') são INVISÍVEIS para o assessor
  na rota /perfil. Use RLS para garantir isso.
  
- A Aba 3 deve ser read-only enquanto cycle_endorsements.status != 'signed'
  E a data atual estiver dentro do ciclo ativo.
  
- Ao criar Reunião 1:1, consulte events onde o assessor é participante e a data
  é próxima (+/- 3 dias) para sugerir vinculação automática.

COMPONENTES SHADCN/UI PRIORITÁRIOS:
Badge (header), Tabs (navegação das abas), Card (resumo de entregas), 
Dialog (modais de nova interação), Separator (divisor de ciclos no feed),
Tooltip (divergência de percepção, motivo do badge).

NÃO IMPLEMENTE ainda:
- Notificações por e-mail
- Exportação PDF
- Tela de configuração de competências (crie as competencies_definitions manualmente
  com dados seed para o ciclo atual)
- Aprovação do 1:1 pelo assessor
```

---

*Fim do PRD — Perfil do Assessor v1.0*
