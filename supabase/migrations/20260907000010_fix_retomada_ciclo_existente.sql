-- Corrige a detecção de uma retomada já programada nas duas RPCs.
-- Em instalações novas, a migration anterior já contém a versão corrigida.

do $$
declare
  v_signature regprocedure;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.fn_renovar_captacao(uuid,timestamptz,integer,text)'::regprocedure,
    'public.fn_renovar_inscricao(uuid,timestamptz,integer,text)'::regprocedure
  ]
  loop
    v_definition := pg_get_functiondef(v_signature);

    if position('v_tem_ciclo boolean' in v_definition) = 0 then
      v_definition := replace(
        v_definition,
        '  v_projeto_nome text;',
        E'  v_projeto_nome text;\n  v_tem_ciclo boolean;'
      );
      v_definition := replace(
        v_definition,
        E'  for update;\n\n  select nome into v_projeto_nome',
        E'  for update;\n  v_tem_ciclo := found;\n\n  select nome into v_projeto_nome'
      );
      v_definition := replace(
        v_definition,
        E'\n  if found then\n',
        E'\n  if v_tem_ciclo then\n'
      );
      execute v_definition;
    end if;
  end loop;
end;
$$;

