-- ============================================================
-- BEV OS · 03/09/2026 — Auditoria de segurança.
--
-- `resumo_exclusao_cadastro` promete à Diretoria a lista do que impede
-- a exclusão, e a tela decide o botão a partir dela. Mas a lista era
-- escrita à mão e cobria 7 das 28 FKs bloqueantes (RESTRICT/NO ACTION)
-- que apontam para `people`:
--
--   cobertas    contratos(criado_por, responsavel_id), demands.criado_por,
--               events.criado_por, warnings.aplicado_por,
--               epeas_comments.autor_id, news_posts.autor_id
--   faltando    announcements, bev_courses, colab_faturamentos(x2),
--               cycle_endorsements, demand_comments, entregas_avulsas,
--               epeas_contract_exceptions, finance_entries(x2),
--               finance_requests, lead_stage_history, leadership_entries,
--               leads(x2), meeting_minutes, memory_docs, pdi_checkins,
--               pdi_competency_scores, pdi_plans(x2)
--
-- Efeito: para quem só tem registro numa das 21 não cobertas — um
-- lead atribuído, um check-in de PDI como líder — a tela dizia "pode
-- excluir", a pessoa digitava o nome para confirmar, e a transação
-- morria com o erro cru da FK. Nada era perdido (função = transação,
-- tudo volta atrás), mas a operação mais perigosa do sistema
-- respondia 500 em vez da mensagem que ela mesma sabe dar.
--
-- A lista fixa é a mesma armadilha da regressão de ON UPDATE CASCADE:
-- toda FK nova para `people` teria que ser lembrada aqui. Então em vez
-- de estender a lista, a função agora lê pg_constraint e conta as
-- linhas de cada FK bloqueante. FK nova entra sozinha.
-- ============================================================

create or replace function public.resumo_exclusao_cadastro(p_person_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_nome text;
  v_email text;
  v_bloqueios jsonb := '[]'::jsonb;
  fk record;
  n bigint;
begin
  if not public.is_direx((select auth.uid())) then
    raise exception 'BEV_OS_SEM_PERMISSAO: apenas a Diretoria pode consultar isto.';
  end if;

  select nome, email into v_nome, v_email from public.people where id = p_person_id;
  if v_nome is null then
    return jsonb_build_object('status', 'nao_encontrado');
  end if;

  -- Toda FK para `people` que trava o delete (RESTRICT / NO ACTION),
  -- descoberta no catálogo em vez de mantida à mão.
  for fk in
    select c.conrelid::regclass::text as tabela,
           a.attname::text            as coluna,
           obj_description(c.conrelid) as rotulo
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'public.people'::regclass
       and c.confdeltype in ('a','r')   -- NO ACTION, RESTRICT
       and array_length(c.conkey, 1) = 1
     order by 1, 2
  loop
    execute format('select count(*) from %s where %I = $1', fk.tabela, fk.coluna)
      into n using p_person_id;

    if n > 0 then
      v_bloqueios := v_bloqueios || jsonb_build_object(
        'o_que',  coalesce(fk.rotulo, replace(fk.tabela, 'public.', '')) || ' (' || fk.coluna || ')',
        'quantos', n
      );
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'ok',
    'nome',  v_nome,
    'email', v_email,
    'tem_conta', exists (select 1 from auth.users u where u.id = p_person_id),
    'apaga_junto', jsonb_build_object(
      'bevcoins',       (select count(*) from public.bevcoins_transactions where person_id = p_person_id),
      'bevcoins_saldo', (select coalesce(sum(amount),0) from public.bevcoins_transactions
                          where person_id = p_person_id and type='credit' and status='approved'),
      'advertencias',   (select count(*) from public.warnings where person_id = p_person_id),
      'agravos',        (select count(*) from public.agravos where person_id = p_person_id),
      'pdi',            (select count(*) from public.pdi_plans where person_id = p_person_id),
      'ocupacoes',      (select count(*) from public.occupations where person_id = p_person_id)
    ),
    'bloqueios', v_bloqueios
  );
end $function$;

comment on function public.resumo_exclusao_cadastro(uuid) is
  'O que a exclusão do cadastro apaga junto e o que a impede. A lista de '
  'impedimentos vem de pg_constraint (toda FK RESTRICT/NO ACTION para people), '
  'não de uma lista fixa — FK nova passa a ser checada sem alterar esta função.';

-- Rótulo legível para as tabelas que mais aparecem como impedimento.
comment on table public.contratos      is 'contratos';
comment on table public.demands        is 'demandas';
comment on table public.events         is 'eventos';
comment on table public.warnings       is 'advertências';
comment on table public.epeas_comments is 'mensagens no EPEAS';
comment on table public.news_posts     is 'publicações no Bev News';
comment on table public.leads          is 'leads do comercial';
comment on table public.pdi_checkins   is 'check-ins de PDI';
comment on table public.meeting_minutes is 'atas de reunião';
comment on table public.finance_entries is 'lançamentos financeiros';
