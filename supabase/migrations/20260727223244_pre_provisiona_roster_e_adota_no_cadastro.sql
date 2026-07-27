-- ============================================================
-- Pré-provisionamento de membros do approved_roster
-- Nomes ficam disponíveis em seletores (créditos, contratos,
-- responsáveis) mesmo antes de a pessoa criar conta. No cadastro,
-- o registro existente é adotado (id passa a ser o uid do auth),
-- preservando tudo que já foi lançado para ela.
-- ============================================================

-- 1) people deixa de exigir um auth.user correspondente.
alter table public.people drop constraint if exists people_id_fkey;

-- mantém a limpeza quando o usuário do auth é excluído
create or replace function public.handle_deleted_user()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  delete from public.people where id = old.id;
  return old;
end;
$fn$;
drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_deleted_user();

-- 2) FKs que apontam para people(id) passam a ON UPDATE CASCADE.
do $$
declare r record;
begin
  for r in
    select con.conname,
           con.conrelid::regclass::text as tbl,
           pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    where con.contype = 'f'
      and con.confrelid = 'public.people'::regclass
      and con.confupdtype = 'a'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s on update cascade',
                   r.tbl, r.conname, r.def);
  end loop;
end $$;

-- 3) Cria a pessoa para todo mundo do roster que ainda não tem registro.
insert into public.people (id, nome, email)
select gen_random_uuid(), r.nome, lower(r.email)
from public.approved_roster r
where not exists (select 1 from public.people p where p.email = lower(r.email));

-- 4) Cria o vínculo principal correspondente.
insert into public.occupations (person_id, cycle_id, directorate_id, subarea_id, role, is_hibrido)
select p.id, r.cycle_id, r.directorate_id, r.subarea_id, r.role, false
from public.approved_roster r
join public.people p on p.email = lower(r.email)
where not exists (
  select 1 from public.occupations o
  where o.person_id = p.id and o.cycle_id = r.cycle_id and o.is_hibrido = false
);

-- 5) Cadastro adota a pessoa pré-provisionada.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  roster_row public.approved_roster%rowtype;
  existing_id uuid;
  display_name text;
begin
  select * into roster_row
  from public.approved_roster
  where email = lower(new.email);

  if not found then
    raise exception 'BEV_OS_EMAIL_NAO_APROVADO: e-mail não está na lista aprovada. Fale com Pessoas e Cultura.';
  end if;

  if roster_row.claimed then
    return new;
  end if;

  display_name := coalesce(new.raw_user_meta_data->>'nome', roster_row.nome);

  select id into existing_id from public.people where email = lower(new.email);

  if existing_id is not null then
    if existing_id <> new.id then
      update public.people set id = new.id where id = existing_id;
    end if;
    update public.people set nome = display_name where id = new.id;
  else
    insert into public.people (id, nome, email)
    values (new.id, display_name, lower(new.email))
    on conflict (id) do nothing;
  end if;

  insert into public.occupations
    (person_id, cycle_id, directorate_id, subarea_id, role, is_hibrido)
  select new.id, roster_row.cycle_id, roster_row.directorate_id,
         roster_row.subarea_id, roster_row.role, false
  where not exists (
    select 1 from public.occupations o
    where o.person_id = new.id
      and o.cycle_id = roster_row.cycle_id
      and o.is_hibrido = false
  );

  update public.approved_roster
  set claimed = true, claimed_at = now()
  where email = roster_row.email;

  return new;
end;
$function$;
