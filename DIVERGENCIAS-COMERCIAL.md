# Comercial 2026 — divergências entre o Portal BJ e o BEV OS

**14/08/2026** · fonte: `Bev_Comercial_2026.xlsx` (Portal BJ) vs. tabela `contratos`

Você pediu para ver as divergências antes de eu escrever no banco. Aqui estão, contrato a contrato.

**Já feito** (não dependia de decisão): importei os 5 contratos de agosto que faltavam e criei o modelo de múltiplos serviços por contrato. O sistema agora tem **24 contratos e R$ 46.019**, exatamente igual ao Portal.

---

## Grupo A — a planilha perde informação (4 contratos)

Aqui o BEV OS **já sabe** o serviço e a planilha diz "não identificado". Se a planilha virasse fonte única, essa classificação seria perdida.

| Contrato | Valor | BEV OS | Planilha |
|---|---|---|---|
| NC Serviços Educacionais | 1.400 | Registro de Marca | não identificado |
| Multipla Serviços Participações | 2.390 | Registro de Marca | não identificado |
| Vitor Caiaffo Brito *(no BEV OS: "Anatocast")* | 1.500 | Registro de Marca | não identificado |
| Renato Hayashi Correia de Oliveira | 1.300 | Registro de Marca | não identificado |

**Minha recomendação: manter o BEV OS.** A planilha diz "não consta na pasta do Drive" — é ausência de documento, não afirmação de que o serviço é outro.

> Repare no caso do Vitor Caiaffo: a planilha usa o nome da pessoa física e o BEV OS usa o nome da marca ("Anatocast"). Mesmo contrato, mesma data, mesmo valor. Vale padronizar para não virar contrato duplicado depois.

---

## Grupo B — classificação conflitante (4 contratos)

Aqui os dois lados afirmam serviços diferentes. **Preciso da sua decisão em cada um.**

| Contrato | Valor | BEV OS | Planilha |
|---|---|---|---|
| Projetos Jr. Consultoria | 1.400 | Revisão do Estatuto Social | Assessoria Jurídica |
| MOVES / Move's Tec. Turismo | 900 | Termos de Uso e Política de Privacidade | Assessoria Jurídica |
| MicroRED LTDA | 2.600 | Termos de Uso e Política de Privacidade | Assessoria Jurídica |
| Virtù Consultoria Política | 500 | Revisão do Estatuto Social | Assessoria Jurídica |
| Andressa Maria Batista | 1.080 | Abertura de CNPJ | Assessoria Jurídica |

Há um padrão: a planilha classifica os quatro como "Assessoria Jurídica", que é o rótulo mais genérico. Pode ser que o Portal registre a categoria comercial e o BEV OS registre a entrega concreta — nesse caso **os dois estão certos**, e é justamente aí que o modelo de múltiplos serviços ajuda: o contrato pode ter "Assessoria Jurídica" como guarda-chuva e o entregável específico junto.

---

## Grupo C — datas divergentes (1 contrato)

| Contrato | BEV OS | Planilha |
|---|---|---|
| Diceplay ADTECH | 29/04 | 20/05 |

Muda o mês de competência: R$ 1.300 sai de abril e vai para maio. A planilha vem do Portal, que registra a data de assinatura — provavelmente é a correta, mas confirme.

---

## Grupo D — sem serviço nenhum (3 contratos)

Importei de agosto sem classificação, porque nem a planilha nem o Drive tinham:

- SWAPY TECNOLOGIA — R$ 900
- JVVGP Consultoria em Educação — R$ 4.500
- Rafael Andrade Lima Sá De Melo — R$ 1.400

São **R$ 6.800 sem serviço atribuído**, 15% do faturamento do ano. O JVVGP sozinho é o terceiro maior contrato de 2026. Vale a pena descobrir o que foi vendido.

---

## Por que o ranking de serviços não fecha com o Portal

| | Portal BJ | BEV OS hoje |
|---|---|---|
| Registro de Marca | 12 ações · R$ 20.809 | 10 contratos · R$ 16.010 |
| Assessoria Jurídica | 4 ações · R$ 10.580 | 3 contratos · R$ 13.079 |
| Abertura de CNPJ | 5 ações · R$ 4.530 | 4 contratos · R$ 4.730 |
| **Total de ações** | **31** | **21** |

A diferença de 31 para 21 é a soma de três coisas: os 3 contratos sem serviço (Grupo D), os 4 do Grupo A que o Portal não classificou, e os contratos que no Portal têm mais de um serviço e aqui ainda têm um só.

**A tabela `contrato_servicos` já existe e resolve isso estruturalmente** — falta preencher os serviços adicionais de cada contrato, e essa informação só existe no Portal BJ, contrato a contrato.

---

## Sobre a Agrocells

Você confirmou que **não foi distratada** e vale R$ 2.520. Então a nota na aba "Faturamento Mensal" da planilha está errada — ela afirma que maio já reflete um ajuste que não existe. Vale corrigir o texto na planilha antes que alguém tome R$ 43.499 como número oficial.

---

## O que eu preciso de você

1. **Grupo B** — qual serviço vale em cada um dos 5 contratos? Ou aplico "os dois", agora que o modelo permite?
2. **Grupo C** — a data da Diceplay é 29/04 ou 20/05?
3. **Grupo D** — dá para descobrir o serviço dos 3 contratos de agosto no Portal?
4. **Serviços adicionais** — se você exportar do Portal a lista de ações colaborativas por contrato, eu preencho a `contrato_servicos` e o ranking passa a bater exatamente.

O Grupo A eu deixo como está, salvo se você discordar.
