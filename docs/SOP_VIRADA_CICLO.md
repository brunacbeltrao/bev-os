# SOP: Procedimento Operacional Padrão - Virada de Ciclo

Este documento orienta a área de **Pessoas e Cultura (P&C)** e a **Direx** sobre os passos a serem executados na virada de um ciclo (semestre) no sistema BEV OS.

## O que significa a Virada de Ciclo?
No final de cada semestre civil, o ciclo atual é "congelado". O BEV OS baseia toda a sua camada de segurança (RLS) no conceito de `is_current = true`. Quando um novo ciclo é aberto:
- Ninguém conseguirá adicionar eventos, demandas ou avisos utilizando os vínculos antigos.
- O histórico continua disponível para leitura (se assim configurado na página), mas operações de escrita requerem um vínculo ativo no ciclo novo.

## Passo a Passo

1. **Acessar a Gestão Institucional**
   Faça login no BEV OS com uma conta que pertença à Direx ou à liderança (Gerência/Coordenação) de Pessoas e Cultura e clique em `Gestão Institucional` no menu (ou navegue para `/admin-pc`).

2. **Revisar a Estrutura Organizacional (Aba "Estrutura Org")**
   Antes de iniciar o novo ciclo, verifique se houve alteração na estrutura das diretorias ou subáreas da EJ. Se uma nova área foi criada, crie-a agora. Se alguma foi renomeada, renomeie.

3. **Iniciar o Novo Ciclo (Aba "Ciclos e Membros")**
   - Na caixa "Ciclo vigente", clique no botão vermelho **"Encerrar e iniciar novo"**.
   - Preencha o nome do novo ciclo (Ex: `2027.1`).
   - Defina as datas de início e fim.
   - **Mantenha a caixa de seleção "Importar automaticamente..." MARCADAA.**
     - *Nota:* Isso fará o **Rollover** do Roster (copiando todos os membros atuais para o novo ciclo). Isso economizará muito trabalho manual.
   - Clique em confirmar. O sistema será recarregado.

4. **Gerir Desligamentos e Novas Entradas**
   Como você fez o Rollover, todos os assessores, gerentes e diretores do semestre passado agora estão no novo semestre.
   - **Exclusões:** Se houver membros que saíram da EJ, clique em "Excluir" (se houver botão na UI) ou desative-os no banco de dados. 
   - **Novos Ingressantes:** Para os trainees ou pessoas aprovadas no Processo Seletivo, use o botão "Adicionar Membro" para colocar os dados, e-mail da Bevilaqua e a área.

5. **Pronto!**
   O novo ciclo está no ar. Membros antigos que continuam na EJ poderão logar normalmente. Membros recém-cadastrados poderão se inscrever utilizando o e-mail previamente liberado.
