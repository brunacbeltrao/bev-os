-- ============================================================
-- Restaura a criação automática de vínculo no cadastro.
--
-- Contexto do bug: a migration 20260718000006_drop_old_trigger.sql
-- removeu o trigger `on_auth_user_created` e a função
-- `handle_new_user()`, delegando o cadastro a uma Edge Function
-- (supabase/functions/handle_new_user). Essa Edge Function, porém,
-- (a) NÃO cria a linha em `occupations` e (b) tenta inserir numa
-- coluna `roster_id` que não existe em `public.people` — então
-- todo cadastro feito após ~20/07/2026 ficou sem `people` e sem
-- `occupations`, resultando em "Nenhum vínculo ativo neste ciclo"
-- na tela (src/lib/app-context.tsx).
--
-- Correção: restaurar o mecanismo no banco (self-contained, não
-- depende de config de Auth Hook), que era o que funcionava antes.
-- Idempotente: se o e-mail já foi reivindicado, não recria nada.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  roster_row public.approved_roster%rowtype;
  display_name text;
begin
  select * into roster_row
  from public.approved_roster
  where email = lower(new.email);

  if not found then
    raise exception 'BEV_OS_EMAIL_NAO_APROVADO: e-mail não está na lista aprovada. Fale com Pessoas e Cultura.';
  end if;

  if roster_row.claimed then
    -- já reivindicado: idempotente, não recria vínculo
    return new;
  end if;

  display_name := coalesce(new.raw_user_meta_data->>'nome', roster_row.nome);

  insert into public.people (id, nome, email)
  values (new.id, display_name, lower(new.email))
  on conflict (id) do nothing;

  insert into public.occupations
    (person_id, cycle_id, directorate_id, subarea_id, role, is_hibrido)
  values
    (new.id, roster_row.cycle_id, roster_row.directorate_id,
     roster_row.subarea_id, roster_row.role, false);

  update public.approved_roster
  set claimed = true, claimed_at = now()
  where email = roster_row.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Backfill dos usuários que já se cadastraram sem vínculo.
-- ------------------------------------------------------------
insert into public.people (id, nome, email)
select u.id,
       coalesce(u.raw_user_meta_data->>'nome', r.nome),
       lower(u.email)
from auth.users u
join public.approved_roster r on r.email = lower(u.email)
left join public.people p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

insert into public.occupations
  (person_id, cycle_id, directorate_id, subarea_id, role, is_hibrido)
select p.id, r.cycle_id, r.directorate_id, r.subarea_id, r.role, false
from public.people p
join public.approved_roster r on r.email = p.email
where not exists (
  select 1 from public.occupations o
  where o.person_id = p.id and o.cycle_id = r.cycle_id and o.is_hibrido = false
);

update public.approved_roster r
set claimed = true, claimed_at = coalesce(r.claimed_at, now())
from public.people p
where p.email = r.email and r.claimed = false;
