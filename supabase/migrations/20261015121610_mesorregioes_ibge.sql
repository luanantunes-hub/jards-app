-- Patrocinadores: filtro por mesorregião.
--
-- Guarda as mesorregiões e os municípios do IBGE e grava, em cada empresa da base pública, o município e a mesorregião
-- da cidade sede (cruzando o nome da cidade com a UF). Com isso o filtro da tela vira um simples
-- `mesorregiao_id in (...)`, igual ao filtro de estado, e continua certo quando entra empresa nova ou muda a cidade
-- de uma.
--
-- Aditiva: duas tabelas e três funções novas, duas colunas nulas em `empresas` e um gatilho que só preenche essas
-- duas colunas. Nada que já existe muda de significado. As tabelas nascem vazias: quem as preenche é
-- scripts/importar-mesorregioes-ibge.ts, que baixa os dados direto da API do IBGE e, no fim, chama
-- fn_empresas_recalcular_mesorregiao().

-- ─── 1. Mesorregiões e municípios do IBGE ───────────────────────────────────

create table if not exists public.mesorregioes_ibge (
  id integer primary key,
  nome text not null,
  uf char(2) not null
);

comment on table public.mesorregioes_ibge is
  'Mesorregiões do IBGE (137). O IBGE aposentou a divisão em 2017, mas ainda publica o dado. Carga: scripts/importar-mesorregioes-ibge.ts.';
comment on column public.mesorregioes_ibge.id is 'Código da mesorregião no IBGE (4 dígitos).';

create table if not exists public.municipios_ibge (
  id integer primary key,
  nome text not null,
  uf char(2) not null,
  mesorregiao_id integer not null references public.mesorregioes_ibge (id),
  chave text not null
);

comment on table public.municipios_ibge is
  'Municípios do IBGE com a mesorregião de cada um. Carga: scripts/importar-mesorregioes-ibge.ts.';
comment on column public.municipios_ibge.id is 'Código do município no IBGE (7 dígitos).';
comment on column public.municipios_ibge.chave is
  'Nome sem acento, em minúsculas, sem pontuação e com as abreviações expandidas (fn_chave_municipio). Preenchida por gatilho.';

-- Dentro de um estado, uma chave só pode ser de um município: é o que garante que o cruzamento com a cidade da empresa
-- nunca escolhe entre dois.
create unique index if not exists municipios_ibge_uf_chave_key on public.municipios_ibge (uf, chave);
create index if not exists municipios_ibge_mesorregiao_idx on public.municipios_ibge (mesorregiao_id);

alter table public.mesorregioes_ibge enable row level security;
alter table public.municipios_ibge enable row level security;

drop policy if exists "mesorregioes_ibge: leitura autenticada" on public.mesorregioes_ibge;
create policy "mesorregioes_ibge: leitura autenticada" on public.mesorregioes_ibge
  for select to authenticated using (true);

drop policy if exists "municipios_ibge: leitura autenticada" on public.municipios_ibge;
create policy "municipios_ibge: leitura autenticada" on public.municipios_ibge
  for select to authenticated using (true);

-- Só leitura para quem está logado; a carga é do service role.
revoke all on table public.mesorregioes_ibge from anon, authenticated;
revoke all on table public.municipios_ibge from anon, authenticated;
grant select on table public.mesorregioes_ibge to authenticated;
grant select on table public.municipios_ibge to authenticated;

-- ─── 2. Chave do nome do município ──────────────────────────────────────────
-- "Mal. Cândido Rondon", "Marechal Cândido Rondon" e "MARECHAL CANDIDO RONDON" dão a mesma chave. Sem acento, em
-- minúsculas, pontuação vira espaço e as abreviações de título viram a palavra inteira (Cel., Pres., Mal., Sen., Gov.,
-- Dep., Eng., Sta., Sto.). Um só lugar para a regra: o gatilho dos municípios e o das empresas usam esta função.

create or replace function public.fn_chave_municipio(p_nome text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(string_agg(coalesce(a.longa, t.palavra), ' ' order by t.posicao), '')
  from regexp_split_to_table(
         btrim(regexp_replace(lower(public.unaccent(coalesce(p_nome, ''))), '[^a-z0-9]+', ' ', 'g')),
         ' '
       ) with ordinality as t(palavra, posicao)
  left join (values
    ('cel', 'coronel'), ('pres', 'presidente'), ('mal', 'marechal'), ('sen', 'senador'), ('gov', 'governador'),
    ('dep', 'deputado'), ('eng', 'engenheiro'), ('sta', 'santa'), ('sto', 'santo')
  ) as a(curta, longa) on a.curta = t.palavra
  where t.palavra <> ''
$$;

create or replace function public.fn_municipios_ibge_chave()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.chave := public.fn_chave_municipio(new.nome);
  return new;
end;
$$;

drop trigger if exists trg_municipios_ibge_chave on public.municipios_ibge;
create trigger trg_municipios_ibge_chave
  before insert or update of nome on public.municipios_ibge
  for each row execute function public.fn_municipios_ibge_chave();

-- ─── 3. Município e mesorregião da cidade sede de cada empresa ──────────────
-- Colunas calculadas: ninguém as edita à mão. Ficam nulas quando a cidade não casa com nenhum município (grafia suja
-- ou empresa sem cidade); essas empresas só deixam de aparecer quando uma mesorregião está escolhida.

alter table public.empresas
  add column if not exists municipio_ibge_id integer references public.municipios_ibge (id) on delete set null,
  add column if not exists mesorregiao_id integer references public.mesorregioes_ibge (id) on delete set null;

comment on column public.empresas.municipio_ibge_id is 'Município do IBGE da cidade sede (cidade + estado). Calculado por gatilho.';
comment on column public.empresas.mesorregiao_id is 'Mesorregião do IBGE da cidade sede. Calculada por gatilho.';

create index if not exists empresas_mesorregiao_id_idx on public.empresas (mesorregiao_id);

create or replace function public.fn_empresas_mesorregiao()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_municipio integer;
  v_mesorregiao integer;
begin
  select m.id, m.mesorregiao_id
    into v_municipio, v_mesorregiao
  from public.municipios_ibge m
  where m.uf = upper(btrim(coalesce(new.estado::text, '')))
    and m.chave = public.fn_chave_municipio(new.cidade);

  new.municipio_ibge_id := v_municipio;
  new.mesorregiao_id := v_mesorregiao;
  return new;
end;
$$;

drop trigger if exists trg_empresas_mesorregiao on public.empresas;
create trigger trg_empresas_mesorregiao
  before insert or update of cidade, estado on public.empresas
  for each row execute function public.fn_empresas_mesorregiao();

-- Refaz o preenchimento de todas as empresas: depois da carga do IBGE, ou se o IBGE atualizar o dado. Só toca em quem
-- muda. Não conta como edição da empresa: o gatilho de updated_at fica desligado só durante a rodada (e volta junto com
-- a transação, se algo falhar).
create or replace function public.fn_empresas_recalcular_mesorregiao()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linhas integer;
begin
  alter table public.empresas disable trigger trg_empresas_updated_at;

  with alvo as (
    select e.id as empresa_id, m.id as municipio_id, m.mesorregiao_id
    from public.empresas e
    left join public.municipios_ibge m
      on m.uf = upper(btrim(coalesce(e.estado::text, '')))
     and m.chave = public.fn_chave_municipio(e.cidade)
  )
  update public.empresas e
     set municipio_ibge_id = a.municipio_id,
         mesorregiao_id = a.mesorregiao_id
    from alvo a
   where a.empresa_id = e.id
     and (e.municipio_ibge_id is distinct from a.municipio_id
          or e.mesorregiao_id is distinct from a.mesorregiao_id);
  get diagnostics v_linhas = row_count;

  alter table public.empresas enable trigger trg_empresas_updated_at;
  return v_linhas;
end;
$$;

revoke all on function public.fn_empresas_recalcular_mesorregiao() from public, anon, authenticated;
grant execute on function public.fn_empresas_recalcular_mesorregiao() to service_role;

-- ─── 4. Lista do seletor ────────────────────────────────────────────────────
-- Todas as mesorregiões com o número de empresas de cada uma. Com `p_lei` ('cultura', 'esporte', 'ancine' ou 'saude'),
-- conta só as empresas que a aba daquela lei lista: as que têm investimento naquela lei no ano (a mesma regra do filtro
-- da tela). Sem `p_lei`, conta todas as empresas da base. Roda com as permissões de quem chama (o RLS de `empresas` e
-- de `investimentos_por_lei` vale).

create or replace function public.fn_mesorregioes_com_empresas(p_lei text default null, p_ano integer default 2025)
returns table (mesorregiao_id integer, nome text, uf text, empresas bigint)
language sql
stable
set search_path = public
as $$
  select m.id, m.nome, m.uf::text, count(e.id)
  from public.mesorregioes_ibge m
  left join public.empresas e
    on e.mesorregiao_id = m.id
   and (p_lei is null
        or exists (
             select 1
             from public.investimentos_por_lei i
             where i.empresa_id = e.id and i.lei = p_lei and i.ano = p_ano))
  group by m.id, m.nome, m.uf
  order by m.uf, m.nome
$$;

revoke all on function public.fn_mesorregioes_com_empresas(text, integer) from public, anon;
grant execute on function public.fn_mesorregioes_com_empresas(text, integer) to authenticated, service_role;
