-- Três funções do workspace do captador ganharam uma versão nova com parâmetros opcionais (anexo, projeto) e
-- ficaram no banco ao lado da antiga. Com as duas, o PostgREST não escolhe entre elas quando o app chama só
-- com os parâmetros antigos ("Could not choose the best candidate function", PGRST203) e a ação falha.
-- A versão nova faz o mesmo com os parâmetros novos em branco, então a antiga sai.
-- Só remove a antiga quando a nova existe: um banco montado só com as migrations anteriores continua com a antiga.
do $$
declare
  alvo record;
begin
  for alvo in
    select * from (values
      ('fn_workspace_responder_acao',         'uuid, text',                                5),
      ('fn_workspace_criar_acao',             'uuid, text, text, date',                    7),
      ('fn_captador_consultar_oportunidade',  'uuid, text, text, text, uuid, text, text',  8)
    ) as t(funcao, assinatura_antiga, argumentos_da_nova)
  loop
    if exists (
      select 1 from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.proname = alvo.funcao and p.pronargs = alvo.argumentos_da_nova
    ) then
      execute format('drop function if exists public.%I(%s)', alvo.funcao, alvo.assinatura_antiga);
    end if;
  end loop;
end $$;
