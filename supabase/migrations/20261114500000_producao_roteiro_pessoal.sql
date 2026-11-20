-- PD6.11 (primeiro corte): o roteiro pessoal na folha da pessoa convidada.
--
-- fn_equipe_folha (a mesma assinatura e as mesmas regras de 20261104041711_producao_acesso_equipe.sql: só para quem está
-- escalado na data, conta confirmada, convite não revogado, produção em vigor ou só para leitura) passa a devolver também,
-- só do que cabe à pessoa:
--   deslocamentos: os da data em que ela vai (passageira) ou dirige (motorista), com tipo, origem, destino, saída, chegada,
--     veículo e placa, companhia, localizador e notas;
--   hospedagens: o hotel da temporada em que ela tem quarto e cuja entrada e saída cobrem a data (ou sem datas), com o
--     endereço, o localizador e o NOME do quarto. Não devolve os colegas de quarto nem os dados dos outros.
-- Nada de dinheiro, de saúde nem de documento. Quem só tem a folha antiga em cache continua vendo o que já via (a tela
-- trata a falta das duas chaves).
--
-- Expansão: nenhuma tabela; a função é trocada (create or replace, mesma assinatura e mesmas permissões). Aditiva e reaplicável;
-- sem DROP.

set local lock_timeout = '10s';

-- A folha de uma data: só para quem está escalado nela.
create or replace function public.fn_equipe_folha(p_data_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_escala public.producao_escalas%rowtype;
  v_org uuid;
  v_data record;
  v_grupos text[];
begin
  select e.* into v_escala
  from public.producao_acessos_equipe a
  join public.producao_pessoas p on p.id = a.pessoa_id and not p.arquivada
  join public.producao_escalas e on e.pessoa_id = p.id and e.data_id = p_data_id
  join public.organizations o on o.id = a.organization_id
  where a.user_id = auth.uid() and a.revogado_em is null
    and ('producao' = any (o.modulos_ativos) or 'producao' = any (o.modulos_leitura))
  limit 1;
  if not found then
    return null;
  end if;
  v_org := v_escala.organization_id;
  select d.id, d.temporada_id, d.data, d.data_fim, d.tipo, d.situacao, d.uf, d.fuso, t.titulo as temporada_titulo, o.nome as organizacao_nome
    into v_data
  from public.producao_datas d
  join public.producao_temporadas t on t.id = d.temporada_id
  join public.organizations o on o.id = d.organization_id
  where d.id = p_data_id and d.organization_id = v_org;
  -- Os grupos da pessoa na temporada (um bloco pode ser só de um grupo).
  select coalesce(array_agg(lower(btrim(v.grupo))) filter (where v.grupo is not null), '{}') into v_grupos
  from public.producao_vinculos v
  where v.pessoa_id = v_escala.pessoa_id and v.temporada_id = v_data.temporada_id and v.situacao <> 'cancelada';
  return jsonb_build_object(
    'data', jsonb_build_object('id', v_data.id, 'data', v_data.data, 'data_fim', v_data.data_fim, 'tipo', v_data.tipo, 'situacao', v_data.situacao,
      'uf', v_data.uf, 'fuso', v_data.fuso, 'temporada_titulo', v_data.temporada_titulo, 'organizacao_nome', v_data.organizacao_nome),
    'escala', jsonb_build_object('id', v_escala.id, 'funcao', v_escala.funcao, 'chamada', v_escala.chamada, 'saida', v_escala.saida, 'confirmacao', v_escala.confirmacao),
    'blocos', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'inicio', b.inicio, 'fim', b.fim, 'exibicao', b.exibicao, 'tipo', b.tipo, 'titulo', b.titulo, 'confirmado', b.confirmado)
                       order by b.inicio nulls last, b.ordem)
      from public.producao_blocos b
      where b.data_id = p_data_id and b.organization_id = v_org
        and (b.visivel_para is null or cardinality(b.visivel_para) = 0
             or exists (select 1 from unnest(b.visivel_para) as g where lower(btrim(g)) = any (v_grupos)))
    ), '[]'::jsonb),
    'cartoes', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', c.tipo, 'titulo', c.titulo, 'inicio', c.inicio, 'fim', c.fim, 'endereco', c.endereco, 'localizador', c.localizador, 'notas', c.notas)
                       order by c.tipo)
      from public.producao_cartoes_dia c
      where c.data_id = p_data_id and c.organization_id = v_org
    ), '[]'::jsonb),
    'deslocamentos', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'tipo', x.tipo, 'origem', x.origem, 'destino', x.destino, 'saida', x.saida, 'chegada', x.chegada,
                                          'veiculo', v.nome, 'placa', v.placa, 'companhia', x.companhia, 'localizador', x.localizador, 'notas', x.notas,
                                          'motorista', coalesce(x.motorista_id = v_escala.pessoa_id, false))
                       order by x.saida nulls last, x.created_at)
      from public.producao_deslocamentos x
      left join public.producao_veiculos v on v.id = x.veiculo_id and v.organization_id = v_org
      where x.data_id = p_data_id and x.organization_id = v_org
        and (x.motorista_id = v_escala.pessoa_id
             or exists (select 1 from public.producao_deslocamento_pessoas dp where dp.deslocamento_id = x.id and dp.pessoa_id = v_escala.pessoa_id))
    ), '[]'::jsonb),
    'hospedagens', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'hotel', h.hotel, 'endereco', h.endereco, 'entrada', h.entrada, 'saida', h.saida,
                                          'localizador', h.localizador, 'quarto', q.nome)
                       order by h.entrada nulls last, h.hotel)
      from public.producao_ocupantes o
      join public.producao_quartos q on q.id = o.quarto_id
      join public.producao_hospedagens h on h.id = o.hospedagem_id
      where o.pessoa_id = v_escala.pessoa_id and o.organization_id = v_org and h.organization_id = v_org and h.temporada_id = v_data.temporada_id
        and (h.entrada is null or (h.entrada <= coalesce(v_data.data_fim, v_data.data) and coalesce(h.saida, h.entrada) >= v_data.data))
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.fn_equipe_folha(uuid) from public, anon;
grant execute on function public.fn_equipe_folha(uuid) to authenticated;
