-- ============================================================
-- BEV OS — Perfil do Assessor — parte 3/5
-- Aba 1: entregas avulsas + faróis de competência (gerente x auto).
-- Reaproveita a tabela `competencies`, já parametrizável pela P&C.
-- ============================================================

create table if not exists public.entregas_avulsas (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.people (id) on delete cascade,
  cycle_id   uuid not null references public.cycles (id) default public.current_cycle_id(),
  autor_id   uuid not null references public.people (id),
  titulo     text not null check (char_length(titulo) <= 120),
  data       date not null default current_date,
  qualidade  text not null check (qualidade in ('verde', 'amarelo', 'vermelho')),
  observacao text check (char_length(observacao) <= 280),
  created_at timestamptz not null default now()
);
create index if not exists entregas_avulsas_person_cycle_idx
  on public.entregas_avulsas (person_id, cycle_id, data desc);

alter table public.entregas_avulsas enable row level security;
revoke all on public.entregas_avulsas from anon;
grant select, insert, update, delete on public.entregas_avulsas to authenticated;
grant all on public.entregas_avulsas to service_role;

drop policy if exists entregas_avulsas_select on public.entregas_avulsas;
create policy entregas_avulsas_select on public.entregas_avulsas
  for select to authenticated
  using (public.ve_perfil((select auth.uid()), person_id));

drop policy if exists entregas_avulsas_write on public.entregas_avulsas;
create policy entregas_avulsas_write on public.entregas_avulsas
  for all to authenticated
  using (public.lidera_pessoa((select auth.uid()), person_id))
  with check (public.lidera_pessoa((select auth.uid()), person_id));

create table if not exists public.competency_faroles (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.people (id) on delete cascade,
  cycle_id      uuid not null references public.cycles (id) default public.current_cycle_id(),
  competency_id uuid not null references public.competencies (id) on delete cascade,
  mes           int not null check (mes between 1 and 12),
  ano           int not null,
  farol_lider   text check (farol_lider in ('verde', 'amarelo', 'vermelho')),
  farol_auto    text check (farol_auto in ('verde', 'amarelo', 'vermelho')),
  updated_at    timestamptz not null default now(),
  unique (person_id, cycle_id, competency_id, mes, ano)
);

drop trigger if exists competency_faroles_updated_at on public.competency_faroles;
create trigger competency_faroles_updated_at before update on public.competency_faroles
  for each row execute function public.set_updated_at();

alter table public.competency_faroles enable row level security;
revoke all on public.competency_faroles from anon;
grant select, insert, update, delete on public.competency_faroles to authenticated;
grant all on public.competency_faroles to service_role;

drop policy if exists competency_faroles_select on public.competency_faroles;
create policy competency_faroles_select on public.competency_faroles
  for select to authenticated
  using (public.ve_perfil((select auth.uid()), person_id));

drop policy if exists competency_faroles_insert on public.competency_faroles;
create policy competency_faroles_insert on public.competency_faroles
  for insert to authenticated
  with check (public.ve_perfil((select auth.uid()), person_id));

drop policy if exists competency_faroles_update on public.competency_faroles;
create policy competency_faroles_update on public.competency_faroles
  for update to authenticated
  using (public.ve_perfil((select auth.uid()), person_id))
  with check (public.ve_perfil((select auth.uid()), person_id));

-- O assessor só mexe na própria autoavaliação; o farol da liderança
-- fica intacto mesmo que a requisição tente alterá-lo.
create or replace function public.enforce_farol_autoria()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.lidera_pessoa(auth.uid(), new.person_id) then
    new.farol_lider := case when tg_op = 'UPDATE' then old.farol_lider else null end;
  end if;
  return new;
end;
$$;

drop trigger if exists competency_faroles_autoria on public.competency_faroles;
create trigger competency_faroles_autoria before insert or update on public.competency_faroles
  for each row execute function public.enforce_farol_autoria();
