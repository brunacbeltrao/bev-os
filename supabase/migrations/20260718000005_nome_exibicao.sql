-- ============================================================
-- Permitir nome de exibição escolhido no cadastro
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
    raise exception 'BEV_OS_EMAIL_JA_UTILIZADO: este e-mail já foi usado para criar uma conta.';
  end if;
  
  -- Se o usuário enviou um "nome" customizado na metadata do Supabase Auth, usamos ele. 
  -- Caso contrário, recaímos pro nome original do roster.
  display_name := coalesce(new.raw_user_meta_data->>'nome', roster_row.nome);

  insert into public.people (id, nome, email)
  values (new.id, display_name, lower(new.email));

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
