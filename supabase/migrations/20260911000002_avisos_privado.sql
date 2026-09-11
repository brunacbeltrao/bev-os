-- ===========================================================================
-- `avisos` deixa de ser público — o último dos buckets sensíveis.
--
-- Os outros quatro foram tratados na auditoria de 03/09. Este ficou de fora
-- por um motivo concreto: diferente de `financeiro` e `epeas`, que montam a
-- URL na leitura, `announcement_attachments` GUARDA a URL pública pronta.
-- Fechar o bucket sem mexer na coluna quebraria todo anexo já publicado, e
-- deixaria a tabela cheia de links que não abrem mais.
--
-- `avatares` e `bevskills` seguem públicos por decisão registrada na
-- auditoria (§3.3): foto de perfil e material de curso.
--
-- As policies de storage do `avisos` já estavam certas desde 03/09 — leitura
-- para autenticado, escrita e remoção só para a Diretoria. Aqui só falta
-- fechar o bucket, trocar URL por caminho e pôr os limites que faltavam.
--
-- Leitura bucket-inteiro é proposital neste caso: o mural é institucional e
-- toda a EJ lê todo aviso. Não é o caso de `financeiro`/`epeas`, onde a
-- policy precisa recortar por pasta.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Caminho no lugar da URL pronta
-- ---------------------------------------------------------------------------
alter table announcement_attachments add column path text;

update announcement_attachments
set path = regexp_replace(url, '^.*/storage/v1/object/public/avisos/', '')
where path is null;

-- ---------------------------------------------------------------------------
-- 2. Guarda antes de soltar a coluna
--
-- Só derruba `url` depois de provar que todo anexo tem caminho E que esse
-- caminho corresponde a um objeto que existe de fato no bucket. Sem isto, um
-- formato de URL inesperado viraria anexo órfão — e a coluna original já não
-- estaria lá para consertar.
-- ---------------------------------------------------------------------------
do $$
declare
  sem_caminho integer;
  sem_objeto  integer;
begin
  select count(*) into sem_caminho
  from announcement_attachments
  where path is null or btrim(path) = '' or path like '%://%';

  if sem_caminho > 0 then
    raise exception
      'ABORTADO: % anexo(s) sem caminho extraivel da URL. A coluna url NAO foi removida.',
      sem_caminho;
  end if;

  select count(*) into sem_objeto
  from announcement_attachments a
  where not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'avisos' and o.name = a.path
  );

  if sem_objeto > 0 then
    raise exception
      'ABORTADO: % anexo(s) apontam para objeto inexistente no bucket. A coluna url NAO foi removida.',
      sem_objeto;
  end if;
end $$;

alter table announcement_attachments alter column path set not null;

-- A URL pública deixa de existir como dado: com o bucket fechado ela só
-- devolveria erro, e guardá-la seria manter um endereço que convida a tentar.
alter table announcement_attachments drop column url;

comment on column announcement_attachments.path is
  'Caminho do objeto dentro do bucket privado `avisos`. A URL e assinada na '
  'leitura e vale poucos minutos -- nao se guarda endereco de arquivo.';

-- ---------------------------------------------------------------------------
-- 3. O bucket fecha, e ganha os limites que nunca teve
--
-- Sem teto de tamanho e sem lista de MIME, qualquer pessoa da Diretoria podia
-- subir um executável de 2 GB pelo mural.
-- ---------------------------------------------------------------------------
update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/png', 'image/jpeg', 'image/webp', 'image/heic',
      'application/pdf', 'text/plain', 'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
where id = 'avisos';
