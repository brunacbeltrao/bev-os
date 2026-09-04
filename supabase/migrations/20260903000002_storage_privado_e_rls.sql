-- ============================================================
-- BEV OS · 03/09/2026 — Auditoria de segurança.
--
-- Dois problemas independentes nos buckets sensíveis:
--
-- 1. `public = true` — leitura sem autenticação para quem tiver a URL.
--
-- 2. As policies de storage eram do bucket inteiro, sem recortar por
--    permissão:
--
--      financeiro_read   -> using (bucket_id = 'financeiro')
--      epeas_anexo_leitura -> using (bucket_id = 'epeas')
--
--    Isto é o achado que fechar o bucket NÃO resolve: qualquer pessoa
--    logada (26 contas hoje) lê todo comprovante de reembolso e todo
--    anexo de contrato, inclusive de núcleo que não é o dela. Trocar
--    getPublicUrl por createSignedUrl sem corrigir a policy só troca
--    "qualquer um com o link" por "qualquer um com login".
--
-- Os dois buckets estão com 0 arquivos, então não há URL gravada em
-- banco para migrar nem link em circulação para quebrar.
--
-- `avatares` e `bevskills` seguem públicos de propósito (foto de perfil
-- e material de curso). `avisos` fica público nesta migration porque a
-- URL pública está gravada em announcements.anexo_url — ver
-- AUDITORIA-SEGURANCA.md §3.1.
-- ============================================================

update storage.buckets set public = false where id in ('financeiro', 'epeas');

-- Limites que não existiam em bucket nenhum: sem teto de tamanho e sem
-- lista de tipos, o bucket aceita qualquer coisa de qualquer tamanho.
--
-- As duas listas são diferentes de propósito. Comprovante de reembolso é
-- foto ou PDF, e só. Já o bucket do EPEAS recebe também o anexo da
-- conversa, que hoje aceita qualquer arquivo: restringir a imagem e PDF
-- quebraria quem manda a minuta em .docx ou a planilha do cliente.
update storage.buckets
   set file_size_limit = 10485760, -- 10 MB
       allowed_mime_types = array[
         'image/png','image/jpeg','image/webp','image/heic',
         'application/pdf'
       ]
 where id = 'financeiro';

update storage.buckets
   set file_size_limit = 10485760, -- 10 MB
       allowed_mime_types = array[
         'image/png','image/jpeg','image/webp','image/heic',
         'application/pdf','text/plain','text/csv',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation'
       ]
 where id = 'epeas';

-- ------------------------------------------------------------------
-- Helper: primeira pasta do path como uuid, ou null se não for uuid.
-- Sem isto a policy do EPEAS quebra com `invalid input syntax for uuid`
-- em qualquer objeto de path fora do padrão.
-- ------------------------------------------------------------------
create or replace function public.storage_pasta_uuid(p_name text)
returns uuid
language plpgsql
immutable
set search_path to 'public'
as $$
declare v text;
begin
  v := (storage.foldername(p_name))[1];
  if v is null then return null; end if;
  return v::uuid;
exception when others then
  return null;
end $$;

-- ------------------------------------------------------------------
-- financeiro — comprovante de reembolso (dado bancário, possivelmente CPF)
-- Path: <person_id>/<arquivo>
-- Lê: a própria pessoa e a liderança de Gestão (quem avalia o pedido).
-- ------------------------------------------------------------------
drop policy if exists financeiro_read   on storage.objects;
drop policy if exists financeiro_write  on storage.objects;
drop policy if exists financeiro_delete on storage.objects;

create policy financeiro_read on storage.objects for select to authenticated
using (
  bucket_id = 'financeiro'
  and (
    public.storage_pasta_uuid(name) = (select auth.uid())
    or public.is_gestao_lideranca((select auth.uid()))
  )
);

create policy financeiro_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'financeiro'
  and public.storage_pasta_uuid(name) = (select auth.uid())
);

create policy financeiro_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'financeiro'
  and (
    public.storage_pasta_uuid(name) = (select auth.uid())
    or public.is_gestao_lideranca((select auth.uid()))
  )
);

-- ------------------------------------------------------------------
-- epeas — comprovante de pagamento, GRU, print de conversa com cliente
-- Path: <contrato_id>/<arquivo>
-- Espelha o RLS das tabelas: quem vê o contrato vê o anexo.
-- ------------------------------------------------------------------
drop policy if exists epeas_anexo_leitura on storage.objects;
drop policy if exists epeas_anexo_envio   on storage.objects;
drop policy if exists epeas_anexo_delete  on storage.objects;

create policy epeas_anexo_leitura on storage.objects for select to authenticated
using (
  bucket_id = 'epeas'
  and public.epeas_pode_ver(public.storage_pasta_uuid(name))
);

create policy epeas_anexo_envio on storage.objects for insert to authenticated
with check (
  bucket_id = 'epeas'
  and public.epeas_pode_ver(public.storage_pasta_uuid(name))
);

create policy epeas_anexo_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'epeas'
  and owner = (select auth.uid())
);
