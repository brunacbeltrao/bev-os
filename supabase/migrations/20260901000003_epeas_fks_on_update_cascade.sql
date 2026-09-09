-- ============================================================
-- BEV OS · 01/09/2026 — APLICADA (reconstruída no repo em 09/09).
--
-- As 8 FKs do EPEAS para `people` nasceram sem ON UPDATE CASCADE. Como
-- `handle_new_user` troca `people.id` pelo uuid do auth.users no momento
-- do cadastro, QUALQUER criação de conta passou a falhar com 500:
--
--   update or delete on table "people" violates foreign key constraint
--   "epeas_lifecycle_gestao_responsavel_id_fkey"
--
-- Este arquivo não existia no repositório — só no banco. Foi reconstruído
-- a partir do catálogo para o repo voltar a descrever o sistema.
--
-- Verificação (deve retornar zero linhas):
--   select conname, conrelid::regclass from pg_constraint
--    where contype='f' and confrelid='public.people'::regclass
--      and confupdtype <> 'c';
-- ============================================================

do $$
declare fk record;
begin
  for fk in
    select c.conname,
           c.conrelid::regclass::text as tabela,
           a.attname::text            as coluna,
           case c.confdeltype when 'a' then 'no action' when 'r' then 'restrict'
                              when 'c' then 'cascade'   when 'n' then 'set null'
                              when 'd' then 'set default' end as on_delete
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'public.people'::regclass
       and c.confupdtype <> 'c'
       and array_length(c.conkey, 1) = 1
  loop
    execute format('alter table %s drop constraint %I', fk.tabela, fk.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references public.people(id) on update cascade on delete %s',
      fk.tabela, fk.conname, fk.coluna, fk.on_delete);
  end loop;
end $$;
