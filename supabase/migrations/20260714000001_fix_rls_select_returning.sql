-- ============================================================
-- BEV OS — Correção: policies de SELECT quebravam INSERT ... RETURNING
--
-- Sintoma: ações de criar (ex.: "Abrir meu PDI", "Novo compromisso",
-- "Reunião de Área") falhavam com o erro genérico
-- "Não foi possível concluir a ação", que mascarava um
-- 403 / 42501 "new row violates row-level security policy".
--
-- Causa raiz: as policies de SELECT chamavam funções STABLE
-- SECURITY DEFINER (can_see_pdi / can_see_event / can_see_demand) que
-- reconsultam a PRÓPRIA tabela pelo id. Como o app cria os registros
-- com `POST .../<tabela>?select=...` (ou seja, INSERT ... RETURNING),
-- o Postgres exige que a linha recém-criada também passe na policy de
-- SELECT. A função STABLE usa o snapshot do início do INSERT — quando a
-- linha ainda não existe — e retorna falso, bloqueando o RETURNING.
--
-- Correção: nas policies de SELECT, checar as colunas da PRÓPRIA linha
-- (que já estão disponíveis no RETURNING), preservando a mesma lógica
-- de visibilidade. Nada de re-consultar a tabela pelo id.
-- ============================================================

begin;

-- ---------- pdi_plans ----------
-- Mesma lógica de can_see_pdi, porém referenciando as colunas da linha.
alter policy pdi_plans_select on public.pdi_plans using (
  person_id = (select auth.uid())
  or avaliador_id = (select auth.uid())
  or pc_responsavel_id = (select auth.uid())
  or public.is_leader_of((select auth.uid()), public.pc_subarea_id())
  or exists (
    select 1 from public.occupations o
    where o.person_id = pdi_plans.person_id
      and o.cycle_id = public.current_cycle_id()
      and public.is_leader_of((select auth.uid()), o.subarea_id)
  )
);

-- ---------- events ----------
-- O criador precisa enxergar a linha que acabou de criar (RETURNING).
-- `criado_por` é coluna da própria linha (não re-consulta a tabela);
-- can_see_event continua cobrindo os demais casos (linhas já existentes).
alter policy events_select on public.events using (
  criado_por = (select auth.uid())
  or public.can_see_event((select auth.uid()), id)
);

-- ---------- demands ----------
-- can_see_demand = belongs_to_subarea(uid, subarea_id) OR is_direx(uid).
-- Ambos operam sobre occupations/pessoa (não sobre demands), então dá
-- para inline usando a coluna subarea_id da própria linha.
alter policy demands_select on public.demands using (
  public.belongs_to_subarea((select auth.uid()), subarea_id)
  or public.is_direx((select auth.uid()))
);

commit;
