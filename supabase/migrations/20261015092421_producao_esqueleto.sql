-- PD0.8: o esqueleto da produção no banco (obra, temporada, data e bloco).
--
-- As quatro tabelas em que o resto do módulo se apoia: a obra (o que se produz:
-- espetáculo, show, exposição, filme, curso), a temporada (a sequência de datas:
-- turnê, edição, programação), a data (num lugar, com situação) e o bloco (um
-- item do dia: montagem, passagem de som, sessão). Cada uma carrega
-- organization_id; um gatilho impede que o filho esteja em organização diferente
-- da do pai; e as regras de acesso usam as funções da PD0.7a (auth_producao_*),
-- pela receita do cabeçalho de 20261015080447_producao_permissoes.sql.
--
-- Expansão: só cria tabelas, índices, funções, gatilhos e regras novos, e nada do
-- que existe para a captação e a prestação muda. (As chaves para organizations,
-- projetos_crm, empresas_crm e organization_members acrescentam, como todo Postgres
-- faz, gatilhos internos de integridade nessas tabelas: uma consulta por índice
-- ao apagar uma linha.) Aditiva, reaplicável e sem DROP. Nenhuma organização tem a
-- produção ainda (0 contratos e 0 vínculos em 15/10/2026) e o módulo segue
-- escondido no app: hoje ninguém passa a ver nem a escrever nada. Não há coluna
-- de dinheiro nestas tabelas; o dinheiro da produção nasce na fase 5.
--
-- ─── Acesso (receita da PD0.7a) ─────────────────────────────────────────────
--   ler        (auth_producao_pode(org, 'ler') ou auth_producao_le_sem_assinatura(org))
--              e o recorte do que a pessoa conhece (duas regras de leitura por
--              tabela: a normal e a "leitura sem assinatura", no molde da P5.6)
--   escrever   auth_producao_pode(org, 'editar') e o mesmo recorte; vale para
--              inserir, alterar e apagar. O leitor e o módulo só para leitura
--              não escrevem; captador, proponente, quem não tem o módulo, outra
--              organização e o visitante não leem nem escrevem.
-- O recorte é auth_producao_ve_temporada(org, temporada) na temporada e na data.
-- O bloco não guarda a temporada: ele só é visto e editado se a pessoa vê a data
-- (a regra consulta producao_datas, que já passa pelo recorte). A obra não é de
-- uma temporada só, e o padrão é o seguro: quem tem o recorte "só onde está
-- vinculado" vê apenas a obra de uma temporada ou de uma data que ela vê
-- (auth_producao_ve_obra, abaixo). Enquanto a PD1.9 não troca
-- auth_producao_ve_temporada, o recorte falha fechado e essa pessoa não vê obra
-- nenhuma. Nova obra, que ainda não é de temporada nenhuma, só quem não tem
-- recorte cria.
--
-- ─── O que é do banco e o que é do código ───────────────────────────────────
-- Fechados aqui, com CHECK e uma constante igual em lib/producao/estados.ts
-- (tests/producao-schema.test.ts compara): lado e situação da temporada, tipo e
-- situação da data, exibição da hora do bloco.
-- Abertos, do catálogo em lib/producao/vocabulario.ts: tipo da obra e da
-- temporada, formato da temporada e tipo do bloco. Aqui só se confere a forma
-- (não vazio e tamanho), para que um tipo novo exija só uma entrada no catálogo.
-- Os estados da temporada (planejada, em andamento, encerrada, cancelada) não vêm
-- do plano: são uma proposta, e mudá-los antes de aplicar é trocar a lista.
-- Data em opção guarda a ordem na fila (opcao_ordem) e o prazo (opcao_ate); nos
-- outros estados as duas colunas ficam vazias (CHECK), então quem confirma ou
-- cancela uma opção limpa as duas no mesmo update.
--
-- ─── Apagar ─────────────────────────────────────────────────────────────────
-- O que tem filho de verdade não se apaga por engano (a exclusão em cascata foi
-- um defeito apontado nas referências):
--   temporada com datas, e obra com temporadas ou datas: o banco recusa (23503;
--     as três chaves foram adiadas até o fim da transação por
--     20261015092845_producao_esqueleto_chaves_adiadas.sql, para o apagamento da
--     organização inteira, que apaga o pai antes do filho, passar). A obra se arquiva (arquivada); a temporada se esvazia
--     antes, ou as datas e a temporada saem no mesmo comando ou numa função;
--   data: apaga os blocos dela (o dia em blocos é o conteúdo da data);
--   projeto, empresa e responsável: só se desligam (set null), sem apagar a obra,
--     a temporada ou a data. Projeto e empresa precisam ser da mesma organização
--     (os projetos antigos sem organização, 3 de 138 em 15/10/2026, não se ligam).
-- A empresa é empresas_crm, o cadastro da organização (organization_id, lido por
-- toda a equipe interna, e a prestação já se liga a ele em
-- prestacao_links_patrocinador). empresas é o catálogo público de patrocinadoras,
-- sem organização, onde ninguém cadastra uma prefeitura ou um festival.
--
-- ─── O que a PD0.9 acrescenta (sem DROP) ────────────────────────────────────
-- espaco_id e sala_id das datas e sala_id dos blocos são uuid soltos, só com
-- índice, porque espaços e salas só ganham tabela na PD0.9; nada escreve neles
-- antes disso. Quando producao_espacos e producao_salas existirem, a PD0.9 liga:
--   alter table public.producao_datas add constraint producao_datas_espaco_id_fkey
--     foreign key (espaco_id) references public.producao_espacos (id) on delete set null;
--   alter table public.producao_datas add constraint producao_datas_sala_id_fkey
--     foreign key (sala_id) references public.producao_salas (id) on delete set null;
--   alter table public.producao_blocos add constraint producao_blocos_sala_id_fkey
--     foreign key (sala_id) references public.producao_salas (id) on delete set null;
-- e estende, com create or replace e a mesma assinatura, fn_producao_data_coerencia
-- e fn_producao_bloco_coerencia: mesma organização, e a sala é do espaço da data.
-- (Para o apagar, set null ou recusar fica com a PD0.9; o texto acima é só a
-- sugestão.) A data de rua não tem sala, e a que não está num espaço cadastrado
-- guarda só uf e municipio_ibge. A lona de circo, espaço móvel, é um espaço que
-- aparece em datas de cidades diferentes: por isso a data tem a uf e o município
-- próprios, e não os herda do espaço.
--
-- ─── O que a PD1.x decide depois ────────────────────────────────────────────
-- visivel_para (grupos que veem o bloco na folha do dia; nulo = todos) só passa a
-- ter valores com o grupo do vínculo (PD1.9). O dia do bloco dentro do período da
-- data, e mover os blocos quando a data muda, são regra da PD1.7: o banco não
-- confere, para não travar a mudança da data. O histórico (PD0.10) se liga a estas
-- tabelas por gatilho próprio.

set local lock_timeout = '10s';

-- ─── 1. Obras ───────────────────────────────────────────────────────────────

create table if not exists public.producao_obras (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- O projeto da captação em que a obra está ancorada. Apagar o projeto só desliga.
  projeto_id uuid references public.projetos_crm (id) on delete set null,
  -- Do catálogo (lib/producao/vocabulario.ts, TipoProducao): show, teatro, danca...
  tipo text not null,
  titulo text not null,
  descricao text,
  duracao_min integer,
  -- Classificação indicativa ou equivalente, como a pessoa a escreve ("L", "12").
  classificacao text,
  -- Nome do ícone e cor (#RRGGBB) com que a obra aparece nas visões.
  icone text,
  cor text,
  -- Obra de terceiros que o espaço ou o festival recebe: a companhia está no
  -- cadastro de empresas ou só tem o nome. Se há empresa, o nome vem dela.
  companhia_empresa_id uuid references public.empresas_crm (id) on delete set null,
  companhia_nome text,
  arquivada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_obras_tipo_check check (char_length(btrim(tipo)) between 1 and 40),
  constraint producao_obras_titulo_check check (char_length(btrim(titulo)) between 1 and 200),
  constraint producao_obras_duracao_check check (duracao_min is null or duracao_min > 0),
  constraint producao_obras_cor_check check (cor is null or cor ~ '^#[0-9A-Fa-f]{6}$')
);

-- ─── 2. Temporadas ──────────────────────────────────────────────────────────

create table if not exists public.producao_temporadas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  projeto_id uuid references public.projetos_crm (id) on delete set null,
  -- Opcional: festival e programação têm várias obras (cada data diz a dela).
  obra_id uuid references public.producao_obras (id),
  -- Do catálogo (FormatoTemporada): turne, circulacao, edicao... Dá o nome da temporada.
  formato text not null,
  lado text not null,
  -- Do catálogo (TipoProducao).
  tipo text not null,
  titulo text not null,
  inicio date,
  fim date,
  situacao text not null default 'planejada',
  -- Quem da equipe responde pela temporada: precisa ser membro da organização, e
  -- sair dela desliga o responsável sem apagar a temporada.
  responsavel_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_temporadas_responsavel_fkey foreign key (organization_id, responsavel_id)
    references public.organization_members (organization_id, user_id) on delete set null (responsavel_id),
  constraint producao_temporadas_formato_check check (char_length(btrim(formato)) between 1 and 40),
  constraint producao_temporadas_lado_check check (lado in ('circula', 'recebe')),
  constraint producao_temporadas_tipo_check check (char_length(btrim(tipo)) between 1 and 40),
  constraint producao_temporadas_titulo_check check (char_length(btrim(titulo)) between 1 and 200),
  constraint producao_temporadas_situacao_check check (situacao in ('planejada', 'em_andamento', 'encerrada', 'cancelada')),
  constraint producao_temporadas_periodo_check check (inicio is null or fim is null or fim >= inicio)
);

-- ─── 3. Datas ───────────────────────────────────────────────────────────────

create table if not exists public.producao_datas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  temporada_id uuid not null references public.producao_temporadas (id),
  -- Opcional: a data de viagem ou de folga não tem obra, e na temporada de várias
  -- obras cada data diz a sua.
  obra_id uuid references public.producao_obras (id),
  tipo text not null default 'apresentacao',
  data date not null,
  -- Última data de um período (exposição em cartaz, filmagem em diárias seguidas).
  data_fim date,
  situacao text not null default 'opcao',
  -- Só enquanto a data é opção: a vez na fila de opções e até quando vale.
  opcao_ordem smallint,
  opcao_ate date,
  -- Lugar: espaço e sala cadastrados (PD0.9; uuid solto até lá), ou só a UF e o
  -- município. A data de rua não tem sala. A lona viaja: a uf e o município são
  -- da data, não do espaço.
  espaco_id uuid,
  sala_id uuid,
  uf text,
  municipio_ibge text,
  -- Fuso do lugar (nome IANA, como "America/Sao_Paulo"): os blocos têm hora
  -- absoluta e a folha mostra a hora local da data.
  fuso text not null default 'America/Sao_Paulo',
  contratante_empresa_id uuid references public.empresas_crm (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_datas_tipo_check check (tipo in
    ('apresentacao', 'viagem', 'folga', 'ensaio', 'montagem', 'filmagem', 'aula', 'visitacao', 'outro')),
  constraint producao_datas_situacao_check check (situacao in ('opcao', 'confirmada', 'realizada', 'cancelada')),
  constraint producao_datas_periodo_check check (data_fim is null or data_fim >= data),
  constraint producao_datas_opcao_ordem_check check (opcao_ordem is null or opcao_ordem between 1 and 99),
  constraint producao_datas_opcao_check check (situacao = 'opcao' or (opcao_ordem is null and opcao_ate is null)),
  constraint producao_datas_uf_check check (uf is null or uf ~ '^[A-Z]{2}$'),
  constraint producao_datas_municipio_ibge_check check (municipio_ibge is null or (municipio_ibge ~ '^[0-9]{7}$' and uf is not null)),
  constraint producao_datas_fuso_check check (fuso ~ '^(UTC|[A-Za-z]+(/[A-Za-z0-9_+-]+)+)$')
);

-- ─── 4. Blocos do dia ───────────────────────────────────────────────────────

create table if not exists public.producao_blocos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  data_id uuid not null references public.producao_datas (id) on delete cascade,
  -- O dia da programação a que o bloco pertence; o que passa da meia-noite
  -- continua no dia em que começou, e o fim já cai no seguinte (timestamptz).
  dia date not null,
  inicio timestamptz,
  fim timestamptz,
  exibicao text not null default 'exata',
  -- Do catálogo (TipoBloco): montagem, passagem_som, sessao... A sessão é o bloco do tipo sessao.
  tipo text not null,
  titulo text,
  sala_id uuid,
  confirmado boolean not null default false,
  -- Grupos que veem o bloco na folha do dia; nulo = todos.
  visivel_para text[],
  capacidade integer,
  -- Desempata blocos de mesma hora e ordena os que estão a definir.
  ordem integer not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_blocos_exibicao_check check (exibicao in ('exata', 'aproximada', 'a_definir', 'oculta')),
  constraint producao_blocos_hora_check check (inicio is not null or exibicao = 'a_definir'),
  constraint producao_blocos_periodo_check check (fim is null or (inicio is not null and fim >= inicio)),
  constraint producao_blocos_tipo_check check (char_length(btrim(tipo)) between 1 and 40),
  constraint producao_blocos_titulo_check check (titulo is null or char_length(btrim(titulo)) between 1 and 200),
  constraint producao_blocos_visivel_para_check check (visivel_para is null or cardinality(visivel_para) between 1 and 20),
  constraint producao_blocos_capacidade_check check (capacidade is null or capacidade >= 0)
);

-- ─── 5. Índices (toda chave tem o seu) ──────────────────────────────────────

create index if not exists producao_obras_org_idx on public.producao_obras (organization_id);
create index if not exists producao_obras_projeto_idx on public.producao_obras (projeto_id) where projeto_id is not null;
create index if not exists producao_obras_companhia_idx on public.producao_obras (companhia_empresa_id) where companhia_empresa_id is not null;

create index if not exists producao_temporadas_org_idx on public.producao_temporadas (organization_id, inicio);
create index if not exists producao_temporadas_obra_idx on public.producao_temporadas (obra_id) where obra_id is not null;
create index if not exists producao_temporadas_projeto_idx on public.producao_temporadas (projeto_id) where projeto_id is not null;
create index if not exists producao_temporadas_responsavel_idx on public.producao_temporadas (organization_id, responsavel_id) where responsavel_id is not null;

create index if not exists producao_datas_org_idx on public.producao_datas (organization_id, data);
create index if not exists producao_datas_temporada_idx on public.producao_datas (temporada_id, data);
create index if not exists producao_datas_obra_idx on public.producao_datas (obra_id) where obra_id is not null;
create index if not exists producao_datas_contratante_idx on public.producao_datas (contratante_empresa_id) where contratante_empresa_id is not null;
create index if not exists producao_datas_espaco_idx on public.producao_datas (espaco_id) where espaco_id is not null;
create index if not exists producao_datas_sala_idx on public.producao_datas (sala_id) where sala_id is not null;

create index if not exists producao_blocos_org_idx on public.producao_blocos (organization_id);
create index if not exists producao_blocos_data_idx on public.producao_blocos (data_id, dia, inicio, ordem);
create index if not exists producao_blocos_sala_idx on public.producao_blocos (sala_id) where sala_id is not null;

-- ─── 6. Funções ─────────────────────────────────────────────────────────────

create or replace function public.fn_producao_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Coerência: o filho está na organização do pai e a organização não muda depois
-- (senão o filho ficaria com um pai de outra). Rodam com a permissão do dono para
-- enxergar o pai mesmo quando a regra de acesso da tabela dele não deixaria a
-- pessoa vê-lo; só dizem se existe na mesma organização, e a mesma recusa serve
-- para "não existe" e "é de outra", sem mostrar qual.
-- Erros (check_violation): organizacao_nao_muda, projeto_de_outra_organizacao,
-- empresa_de_outra_organizacao, obra_de_outra_organizacao,
-- temporada_de_outra_organizacao, data_de_outra_organizacao, fuso_invalido.

create or replace function public.fn_producao_obra_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if new.projeto_id is not null and not exists (
    select 1 from public.projetos_crm p where p.id = new.projeto_id and p.organization_id = new.organization_id
  ) then
    raise exception 'projeto_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.companhia_empresa_id is not null and not exists (
    select 1 from public.empresas_crm e where e.id = new.companhia_empresa_id and e.organization_id = new.organization_id
  ) then
    raise exception 'empresa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.fn_producao_temporada_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if new.projeto_id is not null and not exists (
    select 1 from public.projetos_crm p where p.id = new.projeto_id and p.organization_id = new.organization_id
  ) then
    raise exception 'projeto_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.obra_id is not null and not exists (
    select 1 from public.producao_obras o where o.id = new.obra_id and o.organization_id = new.organization_id
  ) then
    raise exception 'obra_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.fn_producao_data_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if new.temporada_id is not null and not exists (
    select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id
  ) then
    raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.obra_id is not null and not exists (
    select 1 from public.producao_obras o where o.id = new.obra_id and o.organization_id = new.organization_id
  ) then
    raise exception 'obra_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.contratante_empresa_id is not null and not exists (
    select 1 from public.empresas_crm e where e.id = new.contratante_empresa_id and e.organization_id = new.organization_id
  ) then
    raise exception 'empresa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  -- O nome do fuso tem de existir no banco (a forma já foi conferida pela tabela).
  -- Perguntar a hora naquele fuso é barato; listar pg_timezone_names leva um segundo.
  if tg_op = 'INSERT' or new.fuso is distinct from old.fuso then
    begin
      perform now() at time zone new.fuso;
    exception when invalid_parameter_value then
      raise exception 'fuso_invalido' using errcode = 'check_violation';
    end;
  end if;
  return new;
end;
$$;

create or replace function public.fn_producao_bloco_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if new.data_id is not null and not exists (
    select 1 from public.producao_datas d where d.id = new.data_id and d.organization_id = new.organization_id
  ) then
    raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Quem vê a obra: quem não tem recorte (auth_producao_ve_temporada com temporada
-- nula, o que a PD0.7a testa) e, com o recorte por vínculo, quem vê alguma
-- temporada ou data que usa a obra. Não confere o estado do módulo nem a ação: a
-- regra da tabela junta esta com pode/le_sem_assinatura. Como depende só de
-- auth_producao_ve_temporada, a PD1.9 não precisa mexer aqui.

create or replace function public.auth_producao_ve_obra(p_org uuid, p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.auth_producao_ve_temporada(p_org, null)
    or exists (
      select 1 from public.producao_temporadas t
      where t.organization_id = p_org and t.obra_id = p_obra_id
        and public.auth_producao_ve_temporada(p_org, t.id)
    )
    or exists (
      select 1 from public.producao_datas d
      where d.organization_id = p_org and d.obra_id = p_obra_id
        and public.auth_producao_ve_temporada(p_org, d.temporada_id)
    );
$$;

-- ─── 7. Gatilhos ────────────────────────────────────────────────────────────

create or replace trigger producao_obras_coerencia
  before insert or update of organization_id, projeto_id, companhia_empresa_id on public.producao_obras
  for each row execute function public.fn_producao_obra_coerencia();
create or replace trigger producao_temporadas_coerencia
  before insert or update of organization_id, projeto_id, obra_id on public.producao_temporadas
  for each row execute function public.fn_producao_temporada_coerencia();
create or replace trigger producao_datas_coerencia
  before insert or update of organization_id, temporada_id, obra_id, contratante_empresa_id, fuso on public.producao_datas
  for each row execute function public.fn_producao_data_coerencia();
create or replace trigger producao_blocos_coerencia
  before insert or update of organization_id, data_id on public.producao_blocos
  for each row execute function public.fn_producao_bloco_coerencia();

create or replace trigger producao_obras_updated_at
  before update on public.producao_obras
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_temporadas_updated_at
  before update on public.producao_temporadas
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_datas_updated_at
  before update on public.producao_datas
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_blocos_updated_at
  before update on public.producao_blocos
  for each row execute function public.fn_producao_updated_at();

-- ─── 8. Regras de acesso ────────────────────────────────────────────────────

alter table public.producao_obras enable row level security;
alter table public.producao_temporadas enable row level security;
alter table public.producao_datas enable row level security;
alter table public.producao_blocos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_obras'
                 and policyname = 'producao_obras: le') then
    create policy "producao_obras: le" on public.producao_obras for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_obra(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_obras'
                 and policyname = 'producao_obras: leitura sem assinatura') then
    create policy "producao_obras: leitura sem assinatura" on public.producao_obras for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_obra(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_obras'
                 and policyname = 'producao_obras: insere') then
    create policy "producao_obras: insere" on public.producao_obras for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_obra(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_obras'
                 and policyname = 'producao_obras: edita') then
    create policy "producao_obras: edita" on public.producao_obras for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_obra(organization_id, id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_obra(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_obras'
                 and policyname = 'producao_obras: apaga') then
    create policy "producao_obras: apaga" on public.producao_obras for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_obra(organization_id, id));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_temporadas'
                 and policyname = 'producao_temporadas: le') then
    create policy "producao_temporadas: le" on public.producao_temporadas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_temporada(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_temporadas'
                 and policyname = 'producao_temporadas: leitura sem assinatura') then
    create policy "producao_temporadas: leitura sem assinatura" on public.producao_temporadas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_temporada(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_temporadas'
                 and policyname = 'producao_temporadas: insere') then
    create policy "producao_temporadas: insere" on public.producao_temporadas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_temporadas'
                 and policyname = 'producao_temporadas: edita') then
    create policy "producao_temporadas: edita" on public.producao_temporadas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_temporadas'
                 and policyname = 'producao_temporadas: apaga') then
    create policy "producao_temporadas: apaga" on public.producao_temporadas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, id));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_datas'
                 and policyname = 'producao_datas: le') then
    create policy "producao_datas: le" on public.producao_datas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_temporada(organization_id, temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_datas'
                 and policyname = 'producao_datas: leitura sem assinatura') then
    create policy "producao_datas: leitura sem assinatura" on public.producao_datas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_temporada(organization_id, temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_datas'
                 and policyname = 'producao_datas: insere') then
    create policy "producao_datas: insere" on public.producao_datas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_datas'
                 and policyname = 'producao_datas: edita') then
    create policy "producao_datas: edita" on public.producao_datas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, temporada_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_datas'
                 and policyname = 'producao_datas: apaga') then
    create policy "producao_datas: apaga" on public.producao_datas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, temporada_id));
  end if;
end
$$;

-- O bloco herda o recorte da data: a subconsulta passa pelas regras de
-- producao_datas, da pessoa que consulta.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_blocos'
                 and policyname = 'producao_blocos: le') then
    create policy "producao_blocos: le" on public.producao_blocos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_datas d where d.id = producao_blocos.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_blocos'
                 and policyname = 'producao_blocos: leitura sem assinatura') then
    create policy "producao_blocos: leitura sem assinatura" on public.producao_blocos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_datas d where d.id = producao_blocos.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_blocos'
                 and policyname = 'producao_blocos: insere') then
    create policy "producao_blocos: insere" on public.producao_blocos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_blocos.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_blocos'
                 and policyname = 'producao_blocos: edita') then
    create policy "producao_blocos: edita" on public.producao_blocos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_blocos.data_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_blocos.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_blocos'
                 and policyname = 'producao_blocos: apaga') then
    create policy "producao_blocos: apaga" on public.producao_blocos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_blocos.data_id));
  end if;
end
$$;

-- ─── 9. Quem executa e quem acessa ──────────────────────────────────────────
-- Os gatilhos rodam sem que a pessoa precise de execute, então ninguém de fora
-- do banco chama as funções deles. A que as regras chamam (auth_producao_ve_obra)
-- é executada por quem está logado, como as outras auth_producao_*.

revoke execute on function public.fn_producao_updated_at() from public, anon, authenticated;
revoke execute on function public.fn_producao_obra_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_temporada_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_data_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_bloco_coerencia() from public, anon, authenticated;
revoke execute on function public.auth_producao_ve_obra(uuid, uuid) from public, anon;
grant execute on function public.auth_producao_ve_obra(uuid, uuid) to authenticated;

-- O visitante não toca nas tabelas; quem está logado só passa pelas regras.
revoke all on public.producao_obras, public.producao_temporadas, public.producao_datas, public.producao_blocos
  from anon, authenticated;
grant select, insert, update, delete
  on public.producao_obras, public.producao_temporadas, public.producao_datas, public.producao_blocos
  to authenticated;

comment on table public.producao_obras is
  'O que se produz: espetáculo, show, exposição, filme, curso. Do catálogo de tipos de lib/producao/vocabulario.ts. Arquivar, não apagar.';
comment on table public.producao_temporadas is
  'A sequência de datas de uma obra ou de uma programação: turnê, circulação, edição de festival, programação anual. lado = quem se desloca (circula) ou quem recebe (recebe).';
comment on table public.producao_datas is
  'Uma data num lugar: apresentação, viagem, folga, ensaio, montagem, filmagem, aula ou visitação. Situação: opção, confirmada, realizada, cancelada.';
comment on table public.producao_blocos is
  'Um item do dia de uma data: montagem, passagem de som, sessão. A sessão é o bloco do tipo sessao. A hora é timestamptz; exibicao diz como ela aparece.';
comment on function public.auth_producao_ve_obra(uuid, uuid) is
  'O recorte da pessoa deixa ver a obra? Quem não tem recorte vê; com o recorte por vínculo, só a obra de uma temporada ou data que ela vê.';
