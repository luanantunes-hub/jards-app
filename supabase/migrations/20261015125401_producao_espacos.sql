-- PD0.9: espaços e salas da produção no banco.
--
-- O lugar onde a produção acontece: o espaço (teatro, centro cultural, galeria,
-- praça, a lona do circo) e as salas dele. Cada tabela carrega organization_id;
-- um gatilho impede que o filho esteja em organização diferente da do pai; e as
-- regras de acesso usam as funções da PD0.7a (auth_producao_*), pela receita do
-- cabeçalho de 20261015080447_producao_permissoes.sql, com a leitura sem
-- assinatura como nas tabelas da PD0.8 (20261015092421_producao_esqueleto.sql).
--
-- Expansão: cria duas tabelas, índices, funções, gatilhos e regras novos, liga às
-- tabelas novas as três colunas que a PD0.8 deixou soltas (producao_datas.espaco_id,
-- producao_datas.sala_id e producao_blocos.sala_id) e estende, com create or replace
-- e a mesma assinatura, as duas funções de coerência da PD0.8 (e a lista de colunas
-- dos gatilhos delas, que passam a olhar o espaço e a sala). O que as funções já
-- conferiam segue igual, linha por linha. Nada mais do que existe muda. Aditiva,
-- reaplicável e sem DROP. As tabelas da produção têm 0 linhas em 15/10/2026 (nenhuma
-- organização tem a produção), então as chaves novas entram sem conferir dado nenhum,
-- e o módulo segue escondido no app. Nenhum dado pessoal nestas tabelas: o endereço é
-- o de um local, não de uma pessoa.
--
-- ─── Acesso (receita da PD0.7a) ─────────────────────────────────────────────
--   ler        (auth_producao_pode(org, 'ler') ou auth_producao_le_sem_assinatura(org))
--              e o recorte do espaço, auth_producao_ve_espaco(org, espaço)
--   escrever   auth_producao_pode(org, 'editar') e o mesmo recorte; vale para
--              inserir, alterar e apagar. O leitor e o módulo só para leitura
--              não escrevem; captador, proponente, quem não tem o módulo, outra
--              organização e o visitante não leem nem escrevem.
-- A sala não tem recorte próprio: segue o do espaço dela (a regra chama
-- auth_producao_ve_espaco com o espaco_id da sala). Hoje o recorte "só onde está
-- vinculado" falha fechado, então quem o tem não vê espaço nem sala, e também não
-- cria espaço novo (ainda não é de ninguém, a mesma ideia da obra nova). A PD1.9 troca
-- auth_producao_ve_espaco, sem mexer nestas regras, e decide se ela libera também o
-- espaço de uma data que a pessoa já vê (como auth_producao_ve_obra faz com a obra):
-- sem isso, quem vê a data de uma temporada sua vê o id do espaço e não o espaço.
--
-- ─── O que é do banco e o que é do código ───────────────────────────────────
-- Nenhuma lista fechada aqui: o plano não fecha nenhuma para o espaço. O tipo do
-- espaço (teatro, casa de show, galeria, praça...) é do catálogo e é aberto: o banco só
-- confere a forma (não vazio, até 40 letras), para que um tipo novo exija só uma entrada
-- no catálogo. O catálogo de tipos de espaço ainda não existe em lib/producao/vocabulario.ts
-- e entra com a tela de espaços.
--
-- ─── Espaço móvel e o lugar da data ─────────────────────────────────────────
-- A lona do circo viaja como item e recebe como espaço (movel = true): é o espaço de datas
-- em cidades diferentes. Por isso a UF e o município são da DATA (producao_datas.uf e
-- municipio_ibge), e não os herda do espaço. O banco não compara a UF da data com a do
-- espaço: a tela a copia do espaço fixo, e corrigir um cadastro errado não fica travado.
-- A data de rua não tem sala, nem espaço: guarda só a UF e o município. A sala é sempre de
-- um espaço, e o gatilho de coerência confere: a data só tem sala se tem espaço e a sala é a
-- dele; o bloco só tem sala do espaço da data.
--
-- ─── Apagar ─────────────────────────────────────────────────────────────────
-- Mesma regra do módulo: o que tem filho de verdade não se apaga por engano.
--   espaço com datas, e sala com datas ou blocos: o banco recusa (23503). Desligar com set
--     null apagaria, sem ninguém perceber, o lugar de datas que já aconteceram; o espaço e a
--     sala se arquivam (arquivado, arquivada). As três chaves são conferidas no fim da
--     transação (deferrable initially deferred), como as do esqueleto
--     (20261015092845_producao_esqueleto_chaves_adiadas.sql): apagar uma organização inteira
--     apaga o pai antes do filho, e uma chave imediata travaria o apagamento. O erro volta no
--     commit; uma função que apague as datas e o espaço na mesma transação passa, em qualquer ordem;
--   sala: sai com o espaço (on delete cascade), se nada a usa. Ela nunca muda de espaço (o
--     gatilho recusa), então as datas e os blocos que a usam continuam coerentes;
--   empresa: só se desliga (set null), sem apagar o espaço. A empresa é empresas_crm, a mesma
--     escolha da PD0.8, e precisa ser da mesma organização (empresa_de_outra_organizacao).
--
-- ─── As duas funções estendidas ─────────────────────────────────────────────
-- fn_producao_data_coerencia ganha, depois do que já conferia: o espaço é da mesma organização
-- (espaco_de_outra_organizacao); a sala também (sala_de_outra_organizacao); a sala é do espaço da
-- data (sala_de_outro_espaco); e a data que muda de espaço não deixa bloco em sala do espaço de
-- antes (bloco_em_sala_de_outro_espaco). fn_producao_bloco_coerencia ganha as duas da sala. Quem
-- troca o espaço de uma data tira antes a sala dos blocos dela. Como antes, a mesma recusa serve para
-- "não existe" e "é de outra", sem mostrar qual.
--
-- ─── O que as entregas seguintes decidem ────────────────────────────────────
-- A pauta (reserva de uma sala por período, PD1.5) e o vínculo da pessoa com o espaço (PD1.9)
-- ligam-se a estas tabelas; o histórico (PD0.10) entra por gatilho próprio.

set local lock_timeout = '10s';

-- ─── 1. Espaços e salas ─────────────────────────────────────────────────────

create table if not exists public.producao_espacos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null,
  -- Do catálogo (teatro, casa de show, galeria...), aberto: só se confere a forma.
  tipo text not null,
  -- Espaço da própria organização (a sede, o teatro que ela administra), não o de terceiros.
  proprio boolean not null default false,
  -- A lona do circo e afins: viaja como item e recebe como espaço, em cidades diferentes.
  movel boolean not null default false,
  -- Quem opera o espaço, no cadastro de empresas da organização. Apagar a empresa só desliga.
  empresa_id uuid references public.empresas_crm (id) on delete set null,
  endereco text,
  uf text,
  municipio_ibge text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  capacidade integer,
  -- Fora de uso: o espaço com datas não se apaga, arquiva-se.
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_espacos_nome_check check (char_length(btrim(nome)) between 1 and 200),
  constraint producao_espacos_tipo_check check (char_length(btrim(tipo)) between 1 and 40),
  constraint producao_espacos_endereco_check check (endereco is null or char_length(btrim(endereco)) between 1 and 300),
  constraint producao_espacos_uf_check check (uf is null or uf ~ '^[A-Z]{2}$'),
  constraint producao_espacos_municipio_ibge_check check (municipio_ibge is null or (municipio_ibge ~ '^[0-9]{7}$' and uf is not null)),
  constraint producao_espacos_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint producao_espacos_longitude_check check (longitude is null or longitude between -180 and 180),
  constraint producao_espacos_coordenadas_check check ((latitude is null) = (longitude is null)),
  constraint producao_espacos_capacidade_check check (capacidade is null or capacidade >= 0)
);

create table if not exists public.producao_salas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- A sala é parte do espaço: sai com ele, se nada a usa (ver "Apagar" no cabeçalho).
  espaco_id uuid not null references public.producao_espacos (id) on delete cascade,
  nome text not null,
  capacidade integer,
  arquivada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_salas_nome_check check (char_length(btrim(nome)) between 1 and 200),
  constraint producao_salas_capacidade_check check (capacidade is null or capacidade >= 0)
);

-- ─── 2. Índices (toda chave tem o seu) ──────────────────────────────────────

create index if not exists producao_espacos_org_idx on public.producao_espacos (organization_id, nome);
create index if not exists producao_espacos_empresa_idx on public.producao_espacos (empresa_id) where empresa_id is not null;
create index if not exists producao_salas_org_idx on public.producao_salas (organization_id);
create index if not exists producao_salas_espaco_idx on public.producao_salas (espaco_id, nome);

-- ─── 3. Funções de coerência ────────────────────────────────────────────────
-- Rodam com a permissão do dono, como as da PD0.8, para enxergar o pai mesmo quando a
-- regra de acesso da tabela dele não deixaria a pessoa vê-lo. Erros (check_violation):
-- organizacao_nao_muda, empresa_de_outra_organizacao, espaco_da_sala_nao_muda,
-- espaco_de_outra_organizacao (e, nas duas funções estendidas, os da sala).

create or replace function public.fn_producao_espaco_coerencia()
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
  if new.empresa_id is not null and not exists (
    select 1 from public.empresas_crm e where e.id = new.empresa_id and e.organization_id = new.organization_id
  ) then
    raise exception 'empresa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.fn_producao_sala_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.espaco_id is distinct from old.espaco_id then
    raise exception 'espaco_da_sala_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if new.espaco_id is not null and not exists (
    select 1 from public.producao_espacos e where e.id = new.espaco_id and e.organization_id = new.organization_id
  ) then
    raise exception 'espaco_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Estendida (PD0.8 + espaço e sala). Tudo até a empresa é o texto da PD0.8, sem mudança.
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
  -- PD0.9: o lugar. O espaço e a sala são da organização, a sala é do espaço da data (data sem
  -- espaço não tem sala), e a data que muda de espaço não deixa bloco em sala do espaço de antes.
  if new.espaco_id is not null and not exists (
    select 1 from public.producao_espacos e where e.id = new.espaco_id and e.organization_id = new.organization_id
  ) then
    raise exception 'espaco_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.sala_id is not null then
    if not exists (
      select 1 from public.producao_salas s where s.id = new.sala_id and s.organization_id = new.organization_id
    ) then
      raise exception 'sala_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if not exists (
      select 1 from public.producao_salas s where s.id = new.sala_id and s.espaco_id = new.espaco_id
    ) then
      raise exception 'sala_de_outro_espaco' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.espaco_id is distinct from old.espaco_id and exists (
    select 1 from public.producao_blocos b join public.producao_salas s on s.id = b.sala_id
    where b.data_id = new.id and s.espaco_id is distinct from new.espaco_id
  ) then
    raise exception 'bloco_em_sala_de_outro_espaco' using errcode = 'check_violation';
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

-- Estendida (PD0.8 + sala). O texto da PD0.8 vem primeiro, sem mudança.
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
  -- PD0.9: a sala é da organização e do espaço da data do bloco.
  if new.sala_id is not null then
    if not exists (
      select 1 from public.producao_salas s where s.id = new.sala_id and s.organization_id = new.organization_id
    ) then
      raise exception 'sala_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if not exists (
      select 1 from public.producao_salas s join public.producao_datas d on d.id = new.data_id
      where s.id = new.sala_id and s.espaco_id = d.espaco_id
    ) then
      raise exception 'sala_de_outro_espaco' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- ─── 4. Gatilhos ────────────────────────────────────────────────────────────

create or replace trigger producao_espacos_coerencia
  before insert or update of organization_id, empresa_id on public.producao_espacos
  for each row execute function public.fn_producao_espaco_coerencia();
create or replace trigger producao_salas_coerencia
  before insert or update of organization_id, espaco_id on public.producao_salas
  for each row execute function public.fn_producao_sala_coerencia();

-- Os dois gatilhos da PD0.8 passam a olhar as colunas novas (o resto fica como estava).
create or replace trigger producao_datas_coerencia
  before insert or update of organization_id, temporada_id, obra_id, contratante_empresa_id, fuso, espaco_id, sala_id on public.producao_datas
  for each row execute function public.fn_producao_data_coerencia();
create or replace trigger producao_blocos_coerencia
  before insert or update of organization_id, data_id, sala_id on public.producao_blocos
  for each row execute function public.fn_producao_bloco_coerencia();

create or replace trigger producao_espacos_updated_at
  before update on public.producao_espacos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_salas_updated_at
  before update on public.producao_salas
  for each row execute function public.fn_producao_updated_at();

-- ─── 5. As colunas soltas da PD0.8 passam a ter chave ───────────────────────
-- Sem on delete: recusar apagar o que as datas e os blocos usam, conferido no fim da transação.

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.producao_datas'::regclass
                 and conname = 'producao_datas_espaco_id_fkey') then
    alter table public.producao_datas add constraint producao_datas_espaco_id_fkey
      foreign key (espaco_id) references public.producao_espacos (id) deferrable initially deferred;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.producao_datas'::regclass
                 and conname = 'producao_datas_sala_id_fkey') then
    alter table public.producao_datas add constraint producao_datas_sala_id_fkey
      foreign key (sala_id) references public.producao_salas (id) deferrable initially deferred;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.producao_blocos'::regclass
                 and conname = 'producao_blocos_sala_id_fkey') then
    alter table public.producao_blocos add constraint producao_blocos_sala_id_fkey
      foreign key (sala_id) references public.producao_salas (id) deferrable initially deferred;
  end if;
end
$$;

-- ─── 6. Regras de acesso ────────────────────────────────────────────────────

alter table public.producao_espacos enable row level security;
alter table public.producao_salas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_espacos'
                 and policyname = 'producao_espacos: le') then
    create policy "producao_espacos: le" on public.producao_espacos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_espaco(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_espacos'
                 and policyname = 'producao_espacos: leitura sem assinatura') then
    create policy "producao_espacos: leitura sem assinatura" on public.producao_espacos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_espaco(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_espacos'
                 and policyname = 'producao_espacos: insere') then
    create policy "producao_espacos: insere" on public.producao_espacos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_espacos'
                 and policyname = 'producao_espacos: edita') then
    create policy "producao_espacos: edita" on public.producao_espacos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_espacos'
                 and policyname = 'producao_espacos: apaga') then
    create policy "producao_espacos: apaga" on public.producao_espacos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, id));
  end if;
end
$$;

-- A sala herda o recorte do espaço dela, pela função, com o espaco_id da própria linha.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_salas'
                 and policyname = 'producao_salas: le') then
    create policy "producao_salas: le" on public.producao_salas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_salas'
                 and policyname = 'producao_salas: leitura sem assinatura') then
    create policy "producao_salas: leitura sem assinatura" on public.producao_salas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_salas'
                 and policyname = 'producao_salas: insere') then
    create policy "producao_salas: insere" on public.producao_salas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_salas'
                 and policyname = 'producao_salas: edita') then
    create policy "producao_salas: edita" on public.producao_salas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, espaco_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_salas'
                 and policyname = 'producao_salas: apaga') then
    create policy "producao_salas: apaga" on public.producao_salas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
end
$$;

-- ─── 7. Quem executa e quem acessa ──────────────────────────────────────────
-- Os gatilhos rodam sem que a pessoa precise de execute: ninguém de fora do banco chama as
-- funções deles. Repetido para as duas estendidas, que mantêm o que a PD0.8 revogou.

revoke execute on function public.fn_producao_espaco_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_sala_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_data_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_bloco_coerencia() from public, anon, authenticated;

-- O visitante não toca nas tabelas; quem está logado só passa pelas regras.
revoke all on public.producao_espacos, public.producao_salas from anon, authenticated;
grant select, insert, update, delete on public.producao_espacos, public.producao_salas to authenticated;

comment on table public.producao_espacos is
  'Onde a produção acontece: teatro, centro cultural, galeria, praça, a lona do circo (movel). A UF e o município da data são dela, não do espaço. Arquivar, não apagar.';
comment on table public.producao_salas is
  'Uma sala de um espaço. A data e o bloco só aceitam sala do espaço da data. Sai com o espaço, se nada a usa; arquivar, não apagar.';
