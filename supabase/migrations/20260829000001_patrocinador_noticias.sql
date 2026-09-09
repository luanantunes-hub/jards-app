-- Notícias contextualizadas por patrocinador.
-- O conteúdo completo nunca é armazenado: apenas metadados e link para a fonte.

create table if not exists empresa_news_queries (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  aliases text[] not null default '{}',
  termos_excluidos text[] not null default '{}',
  ultima_busca_em timestamptz,
  proxima_busca_em timestamptz,
  ultima_busca_status text not null default 'never'
    check (ultima_busca_status in ('never', 'success', 'empty', 'quota_exceeded', 'provider_error')),
  ultima_busca_erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  titulo text not null,
  resumo text,
  url_original text not null,
  url_canonica text not null,
  nome_veiculo text,
  imagem_url text,
  publicado_em timestamptz,
  capturado_em timestamptz not null default now(),
  expira_em timestamptz,
  relevancia smallint not null default 0 check (relevancia between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, url_canonica)
);

create index if not exists idx_news_items_empresa_date
  on news_items (empresa_id, publicado_em desc nulls last);
create index if not exists idx_news_items_expira
  on news_items (expira_em);

create table if not exists news_api_usage (
  provider text not null,
  periodo date not null,
  buscas_realizadas integer not null default 0 check (buscas_realizadas >= 0),
  limite integer not null default 100 check (limite > 0),
  updated_at timestamptz not null default now(),
  primary key (provider, periodo)
);

alter table empresa_news_queries enable row level security;
alter table news_items enable row level security;
alter table news_api_usage enable row level security;

drop policy if exists "news queries: leitura autenticada" on empresa_news_queries;
create policy "news queries: leitura autenticada" on empresa_news_queries
  for select to authenticated using (true);

drop policy if exists "news items: leitura autenticada" on news_items;
create policy "news items: leitura autenticada" on news_items
  for select to authenticated using (true);

-- A tabela de cota só é acessada pelo backend com service role.

create or replace function reserve_news_api_search(
  p_provider text,
  p_periodo date,
  p_limite integer default 100
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into news_api_usage (provider, periodo, buscas_realizadas, limite)
  values (p_provider, p_periodo, 1, p_limite)
  on conflict (provider, periodo) do update
    set buscas_realizadas = news_api_usage.buscas_realizadas + 1,
        limite = greatest(news_api_usage.limite, excluded.limite),
        updated_at = now()
    where news_api_usage.buscas_realizadas < news_api_usage.limite;

  return found;
end;
$$;

revoke all on function reserve_news_api_search(text, date, integer) from public;
grant execute on function reserve_news_api_search(text, date, integer) to service_role;
