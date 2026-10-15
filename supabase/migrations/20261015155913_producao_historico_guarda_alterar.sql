-- PD0.10b: o histórico também não grava ao ALTERAR uma linha no meio do apagamento da organização.
--
-- O gatilho do histórico (fn_producao_historico, PD0.10) já deixa de gravar ao APAGAR uma linha
-- quando a organização dela já não existe: a linha nova do histórico não teria organização (a
-- chave a recusaria) e o apagamento da organização inteira travaria. Esta migration estende a
-- mesma guarda ao ALTERAR.
--
-- Por quê: uma chave com `on delete set null` (hoje, producao_temporadas.responsavel_id, que aponta
-- para o vínculo de membro) altera a linha de quem a aponta quando o apontado é apagado. Se isso
-- acontecer DEPOIS de a organização ter sido apagada, num apagamento em cascata, o gatilho tentaria
-- gravar uma linha de histórico para uma organização que já não existe. Hoje não acontece: o banco
-- apaga as tabelas filhas na ordem dos gatilhos das chaves (pelo nome, que sai do número do objeto)
-- e as da produção (obras, temporadas, datas, blocos, espaços, salas e o histórico) vêm antes dos
-- vínculos de membro, então a temporada já foi apagada quando o vínculo cai. Mas essa ordem não é
-- uma garantia do desenho, e uma tabela nova da produção pode cair do outro lado dela. Com a
-- guarda nos dois comandos o resultado deixa de depender da ordem.
--
-- É só o texto da função da PD0.10 (20261015125431_producao_historico.sql) com a guarda no ramo de
-- alterar; nada mais muda (mesmos atributos, mesmos privilégios, mesmos gatilhos). Alterar uma linha
-- que existe, numa organização que existe, grava o histórico igual a antes. Aditiva e reaplicável;
-- nenhuma organização tem a produção ainda.

set local lock_timeout = '10s';

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
begin
  if tg_table_name = 'producao_historico' then
    return null; -- nunca o histórico do próprio histórico
  end if;
  -- Quem grava: a conta logada, se ainda existir (quem apaga a própria conta apaga as funções dela
  -- na mesma gravação, e a chave do autor recusaria a linha). Sem usuário, nulo.
  v_quem := (select u.id from auth.users u where u.id = auth.uid());

  if tg_op = 'UPDATE' then
    -- Uma ação de chave (set null) no meio do apagamento da organização: não há onde gravar.
    if not exists (select 1 from public.organizations org where org.id = new.organization_id) then
      return null;
    end if;
    insert into public.producao_historico (organization_id, entidade, entidade_id, acao, campo, antes, depois, quem)
    select new.organization_id, tg_table_name, new.id, 'alterou', n.key,
           left(o.value #>> '{}', 500), left(n.value #>> '{}', 500), v_quem
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

  insert into public.producao_historico (organization_id, entidade, entidade_id, acao, antes, depois, quem)
  values (v_org, tg_table_name, v_id,
          case tg_op when 'INSERT' then 'criou' else 'apagou' end,
          case when tg_op = 'DELETE' then v_rotulo end,
          case when tg_op = 'INSERT' then v_rotulo end,
          v_quem);
  return null;
end;
$$;

revoke execute on function public.fn_producao_historico() from public, anon, authenticated;

comment on function public.fn_producao_historico() is
  'Gatilho do histórico. Argumentos: campos fora do histórico (separados por vírgula) e colunas do rótulo. Nunca grava o histórico do próprio histórico, nem quando a organização já foi apagada (apagar ou alterar no meio do apagamento dela).';
