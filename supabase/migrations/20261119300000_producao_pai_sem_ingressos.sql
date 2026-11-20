-- PD8.4: a lista de saltos do histórico sem as tabelas dos ingressos.
--
-- A `fn_producao_pai` (de qual espaço e de qual temporada é cada linha do histórico) nasceu listando cinco tabelas
-- que saíram da Produção junto com os ingressos (`producao_borderos`, `producao_convidados`, `producao_credenciais`,
-- `producao_setores`) e o site, que agora é da Ticketeria (`producao_sites`). A função já pulava tabela que não
-- existe, então nada quebrava; esta migration tira as cinco da lista, que é o que a T1 deixou pendente.
--
-- Nada muda de acesso, de dado ou de comportamento: o histórico das tabelas que ficaram segue igual.
-- Expansão: uma função substituída. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create or replace function public.fn_producao_pai(p_entidade text, p_linha jsonb)
returns table (espaco_id uuid, temporada_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  -- A ordem importa: a chave mais perto do pai primeiro.
  v_chaves text[] := array[
    'data_id', 'sala_id', 'sessao_id', 'pauta_id', 'acordo_id', 'orcamento_id', 'orcamento_linha_id', 'pedido_id',
    'fatura_id', 'adiantamento_id', 'lancamento_id', 'hospedagem_id', 'quarto_id', 'deslocamento_id',
    'abastecimento_id', 'acerto_id', 'vinculo_id',
    'planta_id', 'equipamento_id', 'rider_id', 'rider_item_id', 'turma_id', 'aula_id', 'matricula_id',
    'horario_id', 'licenca_id', 'documento_id'];
  v_tabela text := p_entidade;
  v_linha jsonb := p_linha;
  v_espaco uuid;
  v_temporada uuid;
  v_coluna text;
  v_chave uuid;
  v_voltas integer := 0;
begin
  while v_linha is not null and v_voltas < 8 loop
    v_voltas := v_voltas + 1;
    if v_tabela = 'producao_temporadas' then v_temporada := coalesce(v_temporada, nullif(v_linha ->> 'id', '')::uuid); end if;
    if v_tabela = 'producao_espacos' then v_espaco := coalesce(v_espaco, nullif(v_linha ->> 'id', '')::uuid); end if;
    v_temporada := coalesce(v_temporada, nullif(v_linha ->> 'temporada_id', '')::uuid);
    v_espaco := coalesce(v_espaco, nullif(v_linha ->> 'espaco_id', '')::uuid);
    exit when v_espaco is not null and v_temporada is not null;

    v_chave := null;
    foreach v_coluna in array v_chaves loop
      v_chave := nullif(v_linha ->> v_coluna, '')::uuid;
      exit when v_chave is not null;
    end loop;
    exit when v_chave is null;

    v_tabela := case v_coluna
      when 'data_id' then 'producao_datas'
      when 'sala_id' then 'producao_salas'
      when 'sessao_id' then 'producao_sessoes'
      when 'pauta_id' then 'producao_pautas'
      when 'acordo_id' then 'producao_acordos'
      when 'orcamento_id' then 'producao_orcamentos'
      when 'orcamento_linha_id' then 'producao_orcamento_linhas'
      when 'pedido_id' then 'producao_pedidos'
      when 'fatura_id' then 'producao_faturas'
      when 'adiantamento_id' then 'producao_adiantamentos'
      when 'lancamento_id' then 'producao_lancamentos'
      when 'hospedagem_id' then 'producao_hospedagens'
      when 'quarto_id' then 'producao_quartos'
      when 'deslocamento_id' then 'producao_deslocamentos'
      when 'abastecimento_id' then 'producao_abastecimentos'
      when 'acerto_id' then 'producao_acertos'
      when 'vinculo_id' then 'producao_vinculos'
      when 'planta_id' then 'producao_plantas'
      when 'equipamento_id' then 'producao_equipamentos'
      when 'rider_id' then 'producao_riders'
      when 'rider_item_id' then 'producao_rider_itens'
      when 'turma_id' then 'producao_turmas'
      when 'aula_id' then 'producao_turma_aulas'
      when 'matricula_id' then 'producao_matriculas'
      when 'horario_id' then 'producao_visitas_horarios'
      when 'licenca_id' then 'producao_licencas'
      when 'documento_id' then 'producao_documentos'
    end;
    exit when v_tabela is null;
    -- A tabela do salto pode não existir ainda (migration antiga rodando num banco novo).
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = v_tabela and c.relkind = 'r') then
      exit;
    end if;
    execute format('select to_jsonb(t) from public.%I t where t.id = $1', v_tabela) into v_linha using v_chave;
  end loop;
  return query select v_espaco, v_temporada;
end;
$$;

revoke all on function public.fn_producao_pai(text, jsonb) from public, anon, authenticated;

comment on function public.fn_producao_pai(text, jsonb) is
  'O espaço e a temporada de uma linha da produção, subindo pelas chaves dela (até 8 saltos). Interna: o gatilho do histórico e o preenchimento dele a chamam.';
