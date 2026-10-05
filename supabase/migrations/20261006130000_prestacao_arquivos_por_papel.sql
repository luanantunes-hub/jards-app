-- P0.8: arquivo da prestação segue o papel, como as tabelas.
--
-- Os testes de acesso (supabase/tests/prestacao_rls.test.sql) acharam que o
-- leitor envia e substitui arquivos da prestação: as regras do bucket
-- documentos olhavam só a organização e o módulo. Agora enviar, substituir e
-- apagar em {organização}/prestacoes/{prestação}/... pede o mesmo que as
-- tabelas pedem para editar (auth_prestacao_pode 'editar'), e a prestação tem
-- de ser da organização da pasta. Ler continua como estava: membro da
-- organização com o módulo. Fora de prestacoes/ nada muda.
-- Sem DROP: as regras mudam com ALTER POLICY.
--
-- Esta migration muda enviar e substituir; a regra de apagar fica em
-- 20261006130100, porque o nome dela tem a palavra que o conector do Supabase
-- trata como comando destrutivo, e ele para à espera de confirmação.
--
-- Para desfazer: voltar as duas regras ao texto de
-- 20261005110000_modulos_acesso.sql.

create or replace function public.auth_prestacao_arquivo_editavel(p_org text, p_prestacao text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- O case garante que o texto só vira uuid depois de conferido.
  select case
    when p_org ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and p_prestacao ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (
        select 1 from public.prestacoes_contas p
        where p.id = p_prestacao::uuid and p.organization_id = p_org::uuid
      )
      and public.auth_prestacao_pode(p_prestacao::uuid, 'editar')
    else false
  end;
$$;

revoke execute on function public.auth_prestacao_arquivo_editavel(text, text) from public, anon;
grant execute on function public.auth_prestacao_arquivo_editavel(text, text) to authenticated;

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
  execute format('alter policy %I on storage.objects with check (%s)', 'documentos: upload org', escrita);
  execute format('alter policy %I on storage.objects using (%s) with check (%s)', 'documentos: update org', escrita, escrita);
end
$$;
