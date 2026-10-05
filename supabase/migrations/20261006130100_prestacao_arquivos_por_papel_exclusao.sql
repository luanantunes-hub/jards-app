-- P0.8: apagar arquivo da prestação segue o papel (continuação de 20261006130000).
--
-- Mesma regra de enviar e substituir: apagar em {organização}/prestacoes/
-- {prestação}/... pede o papel de editar, e a prestação tem de ser da
-- organização da pasta. Fica separada porque o nome da regra tem "delete" e o
-- conector do Supabase espera confirmação para qualquer comando com essa
-- palavra: aplicar pelo editor SQL. Sem DROP.
--
-- Para desfazer: voltar a regra ao texto de 20261005110000_modulos_acesso.sql.

do $$
declare
  escrita constant text := $regra$
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = any(array(select public.auth_org_ids()::text))
    and (
      (storage.foldername(name))[2] is distinct from 'prestacoes'
      or public.auth_prestacao_arquivo_editavel((storage.foldername(name))[1], (storage.foldername(name))[3])
    )
  $regra$;
begin
  execute format('alter policy %I on storage.objects using (%s)', 'documentos: delete org', escrita);
end
$$;
