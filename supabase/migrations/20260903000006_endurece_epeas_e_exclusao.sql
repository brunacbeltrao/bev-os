-- ============================================================
-- BEV OS · 03/09/2026 — Auditoria de segurança. APLICADA.
-- (no banco: 20260903034357_endurece_epeas_e_exclusao)
-- ============================================================

-- 1. epeas_comments: o with_check do UPDATE não repetia a visibilidade.
-- Na prática o Postgres já barrava mover um comentário para contrato que
-- a pessoa não vê — testado — porque a linha nova também é checada. Mas
-- a proteção ficava por conta do motor, não do texto da policy.
drop policy if exists epeas_comments_update on public.epeas_comments;
create policy epeas_comments_update on public.epeas_comments
  for update to authenticated
  using      (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()) and public.epeas_pode_ver(contrato_id));

-- 2. epeas_contract_exceptions: quem só podia VER, editava. O UPDATE
-- usava epeas_pode_ver enquanto o resto do EPEAS usa epeas_pode_editar.
-- (O pin de aberto_por_id que estava aqui saiu errado; ver 000007.)
drop policy if exists epeas_excecoes_update on public.epeas_contract_exceptions;
create policy epeas_excecoes_update on public.epeas_contract_exceptions
  for update to authenticated
  using      (public.epeas_pode_editar(contrato_id))
  with check (public.epeas_pode_editar(contrato_id));

-- 3. Trilha de auditoria da exclusão de cadastro. Sem FK para people de
-- propósito: o registro precisa sobreviver à exclusão.
create table if not exists public.deletion_log (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null,
  nome         text not null,
  email        text not null,
  excluido_por uuid not null,
  excluido_em  timestamptz not null default now(),
  resumo       jsonb
);

comment on table public.deletion_log is
  'Quem excluiu qual cadastro, quando, e o resumo mostrado na hora. Sem FK para people: precisa sobreviver à exclusão.';

alter table public.deletion_log enable row level security;

drop policy if exists deletion_log_select on public.deletion_log;
create policy deletion_log_select on public.deletion_log
  for select to authenticated
  using (public.is_direx((select auth.uid())));
-- Sem policy de escrita: só a função SECURITY DEFINER grava, e ninguém
-- edita nem apaga a trilha pela API.

-- 4. excluir_cadastro para de apagar a linha do roster.
-- O comentário antigo dizia "o roster libera o e-mail para um novo
-- cadastro no futuro", mas o código fazia o oposto: handle_new_user
-- recusa e-mail fora do roster, então apagar a linha impedia o
-- recadastro para sempre. Marcar como não-reivindicada é o que o
-- comentário promete, e destrói menos.
create or replace function public.excluir_cadastro(p_person_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_resumo jsonb;
  v_email text;
  v_autor uuid := (select auth.uid());
begin
  if not public.is_direx(v_autor) then
    raise exception 'BEV_OS_SEM_PERMISSAO: apenas a Diretoria pode excluir cadastros.';
  end if;

  if p_person_id = v_autor then
    raise exception 'BEV_OS_AUTOEXCLUSAO: você não pode excluir o próprio cadastro.';
  end if;

  v_resumo := public.resumo_exclusao_cadastro(p_person_id);

  if v_resumo->>'status' <> 'ok' then
    raise exception 'BEV_OS_NAO_ENCONTRADO: cadastro não encontrado.';
  end if;

  if jsonb_array_length(v_resumo->'bloqueios') > 0 then
    raise exception 'BEV_OS_TEM_HISTORICO: esta pessoa tem registros que outras áreas usam. Remova-a do roster em vez de excluir.';
  end if;

  v_email := v_resumo->>'email';

  insert into public.deletion_log (person_id, nome, email, excluido_por, resumo)
  values (p_person_id, v_resumo->>'nome', v_email, v_autor, v_resumo);

  update public.approved_roster
     set claimed = false, claimed_at = null
   where lower(email) = lower(v_email);

  delete from public.people where id = p_person_id;
  delete from auth.users where id = p_person_id;

  return jsonb_build_object('status','excluido','nome', v_resumo->>'nome', 'email', v_email);
end $function$;

comment on function public.excluir_cadastro(uuid) is
  'Exclui cadastro e conta de acesso (só Diretoria). Registra em deletion_log e devolve o e-mail ao roster como não-reivindicado, para a pessoa poder se recadastrar.';
