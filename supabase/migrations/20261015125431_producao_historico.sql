-- PD0.10: histórico das alterações da produção.
--
-- Quem mudou o quê e quando nas tabelas da produção. Um gatilho só (fn_producao_historico),
-- ligado a cada tabela, grava uma linha por campo alterado em producao_historico, e uma
-- linha só ao criar e ao apagar o registro. É o histórico que a página da data mostra
-- ("quem mudou o horário da passagem de som", PD1.6). Liga hoje em obra, temporada, data,
-- bloco, espaço, sala e producao_funcoes (quem deu a alguém o acesso ao dinheiro). Tela,
-- cliente tipado e arquivos são de outras entregas.
--
-- Expansão: cria uma tabela, duas funções, sete gatilhos, duas regras de leitura e os índices.
-- Nada do que existe muda: os gatilhos novos só gravam em tabela nova, depois de cada
-- gravação (AFTER), e rodam com a permissão do dono. Aditiva, reaplicável e sem DROP. Vem
-- depois da migration producao_espacos, da PD0.9 (liga também em espaço e sala). Nenhuma
-- organização tem a produção ainda (0 linhas em 15/10/2026), então nasce vazia.
--
-- ─── O que fica numa linha ──────────────────────────────────────────────────
--   entidade, entidade_id   a tabela de origem (producao_blocos...) e o id do registro nela.
--                           Sem chave: o histórico sobrevive ao registro apagado
--   acao                    criou, alterou ou apagou
--   campo, antes, depois    em 'alterou', o campo e os dois valores, como texto de até 500
--                           letras (o resto se corta; o texto longo, como notas, não incha a
--                           linha). Em 'criou' e 'apagou' o campo é nulo e fica um rótulo curto
--                           do registro em depois (criou) ou antes (apagou): o título, o nome
--                           ou a data, para dar para ler sem o registro. A hora sai em UTC,
--                           com o deslocamento, e não depende do fuso de quem gravou
--   quem                    auth.uid() de quem gravou. Nulo é um valor válido: a chave de
--                           serviço e as rotinas do banco não têm usuário (e a conta que já
--                           não existe também não vira autor). Se a conta for apagada depois,
--                           quem vira nulo e a linha fica
--   quando                  o início da transação (now()): as linhas de uma mesma gravação
--                           têm o mesmo quando e o mesmo quem; a ordem entre elas é o id
-- Não entram: id, organization_id, created_at e updated_at (updated_at muda a cada gravação e
-- não é história), os campos da lista de exclusão da tabela, e o histórico do próprio histórico.
-- Gravar sem mudar nada, ou só um campo excluído, não deixa linha.
--
-- ─── A lista de exclusão (campos sensíveis) ─────────────────────────────────
-- Cada gatilho leva a lista da tabela no primeiro argumento (nomes separados por vírgula, sem
-- espaço) e, no segundo, as colunas do rótulo, em ordem de preferência. É o único lugar onde a
-- lista de uma tabela mora. Hoje nenhuma coluna das tabelas é sensível (o dinheiro e os dados
-- pessoais da produção ainda não existem); só definido_por, de producao_funcoes, fica de fora
-- porque repete o quem. Quando entrarem cachê, documentos, dados bancários e saúde, a coluna
-- entra na lista do gatilho da tabela dela (create or replace trigger) na mesma migration que
-- a cria, e o teste de texto barra coluna com cara de sensível que não esteja na lista. O
-- dado pessoal mora em tabela separada (PD1.9), sem gatilho de histórico.
--
-- ─── Quem lê ────────────────────────────────────────────────────────────────
-- A regra do histórico acompanha a da origem: quem lê o registro lê o histórico dele.
--   ler  (auth_producao_pode(org, 'ler') ou auth_producao_le_sem_assinatura(org))
--        e auth_producao_ve_historico(org, entidade, id), que pergunta à tabela de origem, com as
--        regras de quem consulta (recorte por vínculo, dinheiro e o que mais ela exigir). A
--        entidade que não existe mais deixa de ser legível pelo navegador, também para o
--        suporte (o suporte passa pelas mesmas funções auth_producao_*); o histórico dela
--        segue guardado e se lê pelo banco. Entidade que a função não conhece nega.
-- Quem escreve: ninguém pelo navegador. Não há regra de escrita e os privilégios de escrita
-- de anon e authenticated são revogados; só o gatilho (security definer) grava.
-- Nova tabela da produção com histórico = um gatilho e um ramo em auth_producao_ve_historico
-- (create or replace, mesma assinatura), sem tocar na regra da tabela.
--
-- ─── Apagar ─────────────────────────────────────────────────────────────────
-- Apagar a organização apaga o histórico dela (on delete cascade). Como o banco apaga as
-- tabelas filhas na ordem dos gatilhos das chaves, o gatilho de apagar não grava nada quando a
-- organização já não existe: a linha nova não teria organização (a chave recusaria) e o apagamento
-- travaria. Apagar a conta de quem gravou só zera o quem.
--
-- ─── Tamanho e guarda ───────────────────────────────────────────────────────
-- Uma linha por campo mudado, texto curto, três índices. Não há expurgo: por quanto tempo
-- guardar o histórico, e o que fazer com o quem de quem pediu para sair, é decisão do dono
-- (política de dados pessoais). Até lá, o histórico só sai com a organização.

set local lock_timeout = '10s';

-- ─── 1. A tabela ────────────────────────────────────────────────────────────

create table if not exists public.producao_historico (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entidade text not null,
  entidade_id uuid not null,
  acao text not null,
  campo text,
  antes text,
  depois text,
  quem uuid references auth.users (id) on delete set null,
  quando timestamptz not null default now(),
  constraint producao_historico_entidade_check check (entidade ~ '^producao_[a-z0-9_]{1,50}$' and entidade <> 'producao_historico'),
  constraint producao_historico_acao_check check (acao in ('criou', 'alterou', 'apagou')),
  constraint producao_historico_campo_check check ((acao = 'alterou') = (campo is not null) and (campo is null or char_length(campo) between 1 and 63)),
  constraint producao_historico_valores_check check (char_length(antes) <= 500 and char_length(depois) <= 500),
  constraint producao_historico_forma_check check ((acao <> 'criou' or antes is null) and (acao <> 'apagou' or depois is null))
);

create index if not exists producao_historico_entidade_idx on public.producao_historico (entidade, entidade_id, quando desc, id desc);
create index if not exists producao_historico_org_idx on public.producao_historico (organization_id, quando desc, id desc);
create index if not exists producao_historico_quem_idx on public.producao_historico (quem) where quem is not null;

-- ─── 2. O gatilho ───────────────────────────────────────────────────────────
-- Depois de inserir, alterar ou apagar, uma linha por vez (se a gravação falha, o histórico
-- dela também). Argumentos: 1) campos fora do histórico, 2) colunas do rótulo.

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

-- ─── 3. Quem vê o histórico de um registro ──────────────────────────────────
-- Roda com a permissão de quem consulta (não é security definer): a consulta à tabela de origem
-- passa pelas regras dela. Não confere o estado do módulo nem a ação: a regra do histórico junta
-- esta com pode/le_sem_assinatura. Para a entidade nova, um ramo a mais.

create or replace function public.auth_producao_ve_historico(p_org uuid, p_entidade text, p_entidade_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(case p_entidade
    when 'producao_obras' then exists (select 1 from public.producao_obras x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_temporadas' then exists (select 1 from public.producao_temporadas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_datas' then exists (select 1 from public.producao_datas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_blocos' then exists (select 1 from public.producao_blocos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_espacos' then exists (select 1 from public.producao_espacos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_salas' then exists (select 1 from public.producao_salas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_funcoes' then exists (select 1 from public.producao_funcoes x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

-- ─── 4. Os gatilhos ─────────────────────────────────────────────────────────

create or replace trigger producao_obras_historico
  after insert or update or delete on public.producao_obras
  for each row execute function public.fn_producao_historico('', 'titulo');
create or replace trigger producao_temporadas_historico
  after insert or update or delete on public.producao_temporadas
  for each row execute function public.fn_producao_historico('', 'titulo');
create or replace trigger producao_datas_historico
  after insert or update or delete on public.producao_datas
  for each row execute function public.fn_producao_historico('', 'data');
create or replace trigger producao_blocos_historico
  after insert or update or delete on public.producao_blocos
  for each row execute function public.fn_producao_historico('', 'titulo,tipo');
create or replace trigger producao_espacos_historico
  after insert or update or delete on public.producao_espacos
  for each row execute function public.fn_producao_historico('', 'nome');
create or replace trigger producao_salas_historico
  after insert or update or delete on public.producao_salas
  for each row execute function public.fn_producao_historico('', 'nome');
create or replace trigger producao_funcoes_historico
  after insert or update or delete on public.producao_funcoes
  for each row execute function public.fn_producao_historico('definido_por', 'user_id');

-- ─── 5. Regras de leitura (e nenhuma de escrita) ────────────────────────────

alter table public.producao_historico enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_historico'
                 and policyname = 'producao_historico: le') then
    create policy "producao_historico: le" on public.producao_historico for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_historico(organization_id, entidade, entidade_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_historico'
                 and policyname = 'producao_historico: leitura sem assinatura') then
    create policy "producao_historico: leitura sem assinatura" on public.producao_historico for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_historico(organization_id, entidade, entidade_id));
  end if;
end
$$;

-- ─── 6. Quem executa e quem acessa ──────────────────────────────────────────
-- O gatilho roda sem que a pessoa precise de execute: ninguém de fora do banco chama a função
-- dele. A que a regra chama é executada por quem está logado. O navegador só lê o histórico.

revoke execute on function public.fn_producao_historico() from public, anon, authenticated;
revoke execute on function public.auth_producao_ve_historico(uuid, text, uuid) from public, anon;
grant execute on function public.auth_producao_ve_historico(uuid, text, uuid) to authenticated;

revoke all on public.producao_historico from anon, authenticated;
grant select on public.producao_historico to authenticated;

comment on table public.producao_historico is
  'Quem mudou o quê e quando nas tabelas da produção: uma linha por campo alterado, e uma ao criar ou apagar. Escrita só pelo gatilho fn_producao_historico; a leitura acompanha a da tabela de origem. Os campos sensíveis ficam na lista de exclusão do gatilho da tabela.';
comment on function public.fn_producao_historico() is
  'Gatilho do histórico. Argumentos: campos fora do histórico (separados por vírgula) e colunas do rótulo. Nunca grava o histórico do próprio histórico.';
comment on function public.auth_producao_ve_historico(uuid, text, uuid) is
  'A pessoa logada lê o registro de origem? Então lê o histórico dele. Entidade que não existe mais ou desconhecida nega.';
