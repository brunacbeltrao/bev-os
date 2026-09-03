-- ============================================================
-- BEV OS · 03/09/2026 — Auditoria de segurança.
--
-- Com o bucket `financeiro` privado, não existe mais URL estável para
-- gravar: o link passa a ser assinado na hora da leitura e expira. A
-- coluna guarda agora o caminho do objeto (<person_id>/<arquivo>), que
-- é também o que a policy de storage usa para decidir quem lê.
--
-- Renomear em vez de reaproveitar `comprovante_url` para guardar um
-- path é de propósito: o nome antigo faria um path ser tratado como URL
-- em qualquer href que passasse despercebido, e o link quebraria calado.
-- Com o nome novo, o TypeScript aponta cada ponto de uso.
--
-- As duas colunas estão com 0 linhas preenchidas — nada para migrar.
-- ============================================================

alter table public.finance_entries  rename column comprovante_url to comprovante_path;
alter table public.finance_requests rename column comprovante_url to comprovante_path;

comment on column public.finance_entries.comprovante_path is
  'Caminho do objeto no bucket privado `financeiro` (<person_id>/<arquivo>). '
  'Não é URL: assine com createSignedUrl na leitura.';
comment on column public.finance_requests.comprovante_path is
  'Caminho do objeto no bucket privado `financeiro` (<person_id>/<arquivo>). '
  'Não é URL: assine com createSignedUrl na leitura.';
