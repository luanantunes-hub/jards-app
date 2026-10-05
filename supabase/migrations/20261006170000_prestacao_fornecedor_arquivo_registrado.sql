-- P2.3b: arquivo registrado como comprovante do fornecedor não muda no bucket.
--
-- Em 20261006160000 quem edita podia substituir ou apagar qualquer arquivo
-- da pasta {organização}/fornecedores/. Com isso dava para trocar a certidão
-- do TCU guardada pela consulta, que o navegador não pode apagar da tabela.
-- Agora, nessa pasta, substituir e apagar só valem para arquivo que nenhuma
-- linha de prestacao_fornecedor_documentos aponta. Para tirar um comprovante
-- anexado, apaga-se a linha e depois o arquivo; os da consulta saem quando o
-- fornecedor é excluído (a linha vai junto e o arquivo fica livre).
-- Enviar arquivo novo continua igual.
-- Idempotente; sem DROP.

-- Um arquivo, um registro.
create unique index if not exists prestacao_fornecedor_documentos_storage_path_key
  on public.prestacao_fornecedor_documentos (storage_path);

-- Definer: a regra do bucket precisa enxergar o registro mesmo de quem não lê a tabela.
create or replace function public.auth_prestacao_fornecedor_arquivo_livre(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.prestacao_fornecedor_documentos d where d.storage_path = p_nome
  );
$$;

revoke execute on function public.auth_prestacao_fornecedor_arquivo_livre(text) from public, anon;
grant execute on function public.auth_prestacao_fornecedor_arquivo_livre(text) to authenticated;

-- Para desfazer: voltar troca e exclusão ao texto de escrita de 20261006160000.
do $$
declare
  troca constant text := $regra$
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = any(array(select public.auth_org_ids()::text))
    and case (storage.foldername(name))[2]
      when 'prestacoes' then public.auth_prestacao_arquivo_editavel((storage.foldername(name))[1], (storage.foldername(name))[3])
      when 'fornecedores' then public.auth_prestacao_pasta_org_pode((storage.foldername(name))[1], 'editar')
        and public.auth_prestacao_fornecedor_arquivo_livre(name)
      else true
    end
  $regra$;
begin
  execute format('alter policy %I on storage.objects using (%s) with check (%s)', 'documentos: update org', troca, troca);
  execute format('alter policy %I on storage.objects using (%s)', 'documentos: delete org', troca);
end
$$;
