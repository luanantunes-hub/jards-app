-- P9.5: o descarte dos dados pessoais também limpa as verificações.
--
-- O motor guarda a mensagem de cada achado, e algumas trazem dado pessoal: o
-- nome do beneficiado repetido e o nome do arquivo da evidência. No descarte
-- (20261010240000), essas mensagens passam a sair também: a do beneficiado
-- repetido, as do dado de saúde e as das evidências que o descarte apagou
-- ficam com um texto neutro e sem os dados do achado. A decisão de quem
-- justificou ou dispensou fica. A próxima verificação resolve o que sumiu.
-- Igual à função da 20261010240000, com esse passo a mais e a contagem no
-- resultado. Idempotente.

create or replace function public.fn_prestacao_descartar_dados_pessoais(p_prestacao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  previa jsonb;
  v_apagadas uuid[];
  v_beneficiarios integer;
  v_envios integer;
  v_verificacoes integer;
  texto_neutro constant text := 'Texto retirado no descarte dos dados pessoais.';
  resultado jsonb;
begin
  previa := public.fn_prestacao_descarte_previa(p_prestacao_id);

  with apagadas as (
    delete from public.prestacao_evidencias
    where prestacao_id = p_prestacao_id and tipo in ('foto', 'video', 'lista_presenca')
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_apagadas from apagadas;

  with ordem as (
    select id, row_number() over (order by created_at, id) as n
    from public.prestacao_beneficiarios where prestacao_id = p_prestacao_id
  ), anonimizados as (
    update public.prestacao_beneficiarios b
    set nome = 'Pessoa ' || o.n, telefone = null, endereco = null, observacoes = null, idade = null
    from ordem o
    where b.id = o.id and (b.nome !~ '^Pessoa [0-9]+$' or b.telefone is not null or b.endereco is not null or b.observacoes is not null or b.idade is not null)
    returning 1
  )
  select count(*) into v_beneficiarios from anonimizados;

  perform set_config('jards.descarte_dados_pessoais', 'on', true);
  with anonimizados as (
    update public.prestacao_envios e
    set retrato = e.retrato
          || case when jsonb_typeof(e.retrato -> 'beneficiarios') = 'array' then jsonb_build_object('beneficiarios', coalesce((
               select jsonb_agg((b - 'nome' - 'telefone' - 'endereco' - 'observacoes' - 'idade') || jsonb_build_object('nome', 'Pessoa ' || x.n) order by x.n)
               from jsonb_array_elements(e.retrato -> 'beneficiarios') with ordinality as x(b, n)), '[]'::jsonb))
             else '{}'::jsonb end
          || case when jsonb_typeof(e.retrato -> 'evidencias') = 'array' then jsonb_build_object('evidencias', coalesce((
               select jsonb_agg(case when ev ->> 'tipo' in ('foto', 'video', 'lista_presenca')
                                     then jsonb_build_object('id', ev -> 'id', 'tipo', ev -> 'tipo', 'descartada', true)
                                     else ev end order by x.n)
               from jsonb_array_elements(e.retrato -> 'evidencias') with ordinality as x(ev, n)), '[]'::jsonb))
             else '{}'::jsonb end,
        retrato_anonimizado_em = now()
    where e.prestacao_id = p_prestacao_id
    returning 1
  )
  select count(*) into v_envios from anonimizados;
  perform set_config('jards.descarte_dados_pessoais', 'off', true);

  -- As mensagens que podem trazer nome ou dado de saúde.
  with limpas as (
    update public.prestacao_verificacoes v
    set mensagem = texto_neutro, dados = '{}'::jsonb
    where v.prestacao_id = p_prestacao_id
      and v.mensagem <> texto_neutro
      and (v.check_codigo in ('BENEFICIADO_REPETIDO', 'DADO_CLINICO_BENEFICIADO', 'DADO_CLINICO_EVIDENCIA')
           or (v.entidade_tipo = 'evidencia' and v.entidade_id = any(v_apagadas)))
    returning 1
  )
  select count(*) into v_verificacoes from limpas;

  resultado := jsonb_build_object(
    'guarda_ate', previa -> 'guarda_ate',
    'evidencias', cardinality(v_apagadas),
    'arquivos', jsonb_array_length(previa -> 'arquivos'),
    'beneficiarios', v_beneficiarios,
    'envios', v_envios,
    'verificacoes', v_verificacoes,
    'por', auth.uid(),
    'em', now()
  );
  update public.prestacoes_contas
  set dados_pessoais_descartados_em = now(),
      dados_pessoais_descarte = coalesce(dados_pessoais_descarte, '{}'::jsonb)
        || jsonb_build_object('ultimo', resultado,
                              'vezes', coalesce((dados_pessoais_descarte ->> 'vezes')::integer, 0) + 1)
  where id = p_prestacao_id;
  return resultado;
end;
$$;

revoke execute on function public.fn_prestacao_descartar_dados_pessoais(uuid) from public, anon;
grant execute on function public.fn_prestacao_descartar_dados_pessoais(uuid) to authenticated, service_role;
