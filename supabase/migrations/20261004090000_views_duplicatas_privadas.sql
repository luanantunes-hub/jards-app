-- As views de detecção de empresas duplicadas rodavam com as permissões do
-- dono (postgres), ignorando o RLS de empresas, e estavam liberadas para anon:
-- qualquer pessoa com a chave pública do site lia nomes, domínios, sites, leis
-- e valores investidos. São ferramentas internas de limpeza de dados, sem uso
-- no app; continuam disponíveis pelo SQL Editor.
-- Esta migration é idempotente e ignora views que não existam.

do $$
declare
  v regclass;
begin
  foreach v in array array[
    to_regclass('public.v_empresas_duplicatas_dominio'),
    to_regclass('public.v_empresas_duplicatas_nome')
  ]
  loop
    continue when v is null;
    execute format('alter view %s set (security_invoker = true)', v);
    execute format('revoke all on %s from anon, authenticated', v);
  end loop;
end $$;
