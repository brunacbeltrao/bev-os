-- ============================================================
-- Frequência: apenas as lideranças de Pessoas e Cultura
-- aprovam ou rejeitam justificativas de ausência.
-- ============================================================

create or replace function public.is_pc_lideranca(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select exists (
    select 1
    from public.occupations o
    join public.directorates d on d.id = o.directorate_id
    where o.person_id = uid
      and o.cycle_id = public.current_cycle_id()
      and d.slug = 'pessoas_cultura'
      and o.role in ('diretor', 'gerente', 'coordenador')
  );
$fn$;

drop policy if exists absence_select on public.absence_justifications;
create policy absence_select on public.absence_justifications
  for select to authenticated
  using (
    person_id = (select auth.uid())
    or public.is_pc_lideranca((select auth.uid()))
  );

drop policy if exists absence_update on public.absence_justifications;
create policy absence_update on public.absence_justifications
  for update to authenticated
  using (public.is_pc_lideranca((select auth.uid())))
  with check (public.is_pc_lideranca((select auth.uid())));
