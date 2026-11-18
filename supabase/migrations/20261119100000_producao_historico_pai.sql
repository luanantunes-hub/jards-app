-- PD8.4: de qual espaço e de qual temporada é cada linha do histórico.
--
-- A linha do tempo filtrava por área, período e pessoa, mas não por espaço nem por temporada: o histórico só guarda
-- a entidade e o id dela. Agora cada linha também guarda o **pai**: `espaco_id` e `temporada_id` (os dois anuláveis,
-- sem chave, como `entidade_id` — o histórico sobrevive ao registro apagado).
--
-- Quem descobre o pai é `fn_producao_pai`, uma função interna que sobe a árvore pelas chaves da própria linha
-- (temporada_id e espaco_id direto; depois data, sala, sessão, pauta e os filhos mais fundos, um salto por vez, até
-- 8 saltos). Nada é configurado por tabela: tabela nova entra sozinha, se ligar a alguma dessas chaves.
--
-- Acesso: nenhuma regra muda (as colunas são do mesmo histórico, que já é só de leitura para o navegador).
-- Expansão: duas colunas anuláveis, dois índices, uma função nova interna, o gatilho do histórico substituído e um
-- preenchimento único das linhas que já existem. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.producao_historico add column if not exists espaco_id uuid;
alter table public.producao_historico add column if not exists temporada_id uuid;

create index if not exists producao_historico_espaco_idx on public.producao_historico (organization_id, espaco_id, quando desc, id desc) where espaco_id is not null;
create index if not exists producao_historico_temporada_idx on public.producao_historico (organization_id, temporada_id, quando desc, id desc) where temporada_id is not null;

comment on column public.producao_historico.espaco_id is 'O espaço de que a linha fala, quando se chega a um subindo pelas chaves da entidade (fn_producao_pai). Sem chave: o histórico sobrevive ao espaço apagado.';
comment on column public.producao_historico.temporada_id is 'A temporada de que a linha fala, quando se chega a uma subindo pelas chaves da entidade (fn_producao_pai). Sem chave: o histórico sobrevive à temporada apagada.';

-- ─── O espaço e a temporada de uma linha qualquer ────────────────────────────
-- Recebe a entidade (o nome da tabela) e a linha em jsonb; devolve o par (espaço, temporada), cada um nulo quando
-- não se chega a ele. Interna: só o gatilho e o preenchimento a chamam.

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
    'abastecimento_id', 'bordero_id', 'acerto_id', 'vinculo_id', 'convidado_id', 'credencial_id', 'setor_id',
    'planta_id', 'site_id', 'equipamento_id', 'rider_id', 'rider_item_id', 'turma_id', 'aula_id', 'matricula_id',
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
      when 'bordero_id' then 'producao_borderos'
      when 'acerto_id' then 'producao_acertos'
      when 'vinculo_id' then 'producao_vinculos'
      when 'convidado_id' then 'producao_convidados'
      when 'credencial_id' then 'producao_credenciais'
      when 'setor_id' then 'producao_setores'
      when 'planta_id' then 'producao_plantas'
      when 'site_id' then 'producao_sites'
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

-- ─── O gatilho, agora gravando o pai ────────────────────────────────────────
-- O mesmo gatilho da PD0.10, com duas colunas a mais. O pai é descoberto uma vez por gravação.

create or replace function public.fn_producao_historico()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set timezone = 'UTC'
as $$
declare
  v_fora text[] := array['id', 'organization_id', 'created_at', 'updated_at'] || string_to_array(coalesce(tg_argv[0], ''), ',');
  v_rotulos text[] := string_to_array(coalesce(tg_argv[1], ''), ',');
  v_linha jsonb;
  v_org uuid;
  v_id uuid;
  v_rotulo text;
  v_quem uuid;
  v_pai record;
begin
  if tg_table_name = 'producao_historico' then
    return null; -- nunca o histórico do próprio histórico
  end if;
  -- Quem grava: a conta logada, se ainda existir (quem apaga a própria conta apaga as funções dela
  -- na mesma gravação, e a chave do autor recusaria a linha). Sem usuário, nulo.
  v_quem := (select u.id from auth.users u where u.id = auth.uid());
  -- De qual espaço e de qual temporada é esta linha (PD8.4): uma vez por gravação, para todas as linhas dela.
  select * into v_pai from public.fn_producao_pai(tg_table_name, to_jsonb(case when tg_op = 'DELETE' then old else new end));

  if tg_op = 'UPDATE' then
    insert into public.producao_historico (organization_id, entidade, entidade_id, acao, campo, antes, depois, quem, espaco_id, temporada_id)
    select new.organization_id, tg_table_name, new.id, 'alterou', n.key,
           left(o.value #>> '{}', 500), left(n.value #>> '{}', 500), v_quem, v_pai.espaco_id, v_pai.temporada_id
    from jsonb_each(to_jsonb(new) - v_fora) n
    join jsonb_each(to_jsonb(old) - v_fora) o on o.key = n.key
    where n.value is distinct from o.value
    order by n.key;
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_linha := to_jsonb(new);
    v_org := new.organization_id;
    v_id := new.id;
  else
    v_linha := to_jsonb(old);
    v_org := old.organization_id;
    v_id := old.id;
    -- Apagar a organização inteira leva o histórico junto: não há onde gravar.
    if not exists (select 1 from public.organizations org where org.id = v_org) then
      return null;
    end if;
  end if;

  select left(btrim(v_linha ->> r.coluna), 200) into v_rotulo
  from unnest(v_rotulos) with ordinality as r(coluna, ordem)
  where nullif(btrim(v_linha ->> r.coluna), '') is not null
  order by r.ordem
  limit 1;

  insert into public.producao_historico (organization_id, entidade, entidade_id, acao, antes, depois, quem, espaco_id, temporada_id)
  values (v_org, tg_table_name, v_id,
          case tg_op when 'INSERT' then 'criou' else 'apagou' end,
          case when tg_op = 'DELETE' then v_rotulo end,
          case when tg_op = 'INSERT' then v_rotulo end,
          v_quem, v_pai.espaco_id, v_pai.temporada_id);
  return null;
end;
$$;

-- ─── As linhas que já existem ───────────────────────────────────────────────
-- Preenchimento único, uma tabela por vez: a linha cujo registro ainda existe ganha o pai; a do registro apagado
-- fica sem (não há mais de onde tirar). Reaplicável: só mexe em quem está sem os dois.

do $preencher$
declare
  v_entidade text;
begin
  for v_entidade in
    select distinct h.entidade from public.producao_historico h
    where h.espaco_id is null and h.temporada_id is null
      and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relname = h.entidade and c.relkind = 'r')
  loop
    execute format($sql$
      update public.producao_historico h
      set espaco_id = p.espaco_id, temporada_id = p.temporada_id
      from public.%I t, public.fn_producao_pai(%L, to_jsonb(t)) p
      where t.id = h.entidade_id and h.entidade = %L
        and h.espaco_id is null and h.temporada_id is null
        and (p.espaco_id is not null or p.temporada_id is not null)
    $sql$, v_entidade, v_entidade, v_entidade);
  end loop;
end $preencher$;
