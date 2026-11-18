-- T1 da Ticketeria (1 de 2): a loja do produtor e o site público, que se MUDA da Produção para cá.
--
-- Decisões do dono (18/11/2026): um só site por produtor, e ele é da Ticketeria (não mais de um espaço da Produção); a Produção
-- fica sem nenhuma forma de ticketeria. Plano: docs/acoes-futuras/estudos/plano-modulo-ticketeria.md (seção 4, passo 5).
--
-- ticketeria_lojas: a loja do produtor (uma por organização). É a dona do site; nas próximas fases, também da taxa e da subconta
-- no provedor de pagamento. ticketeria_sites: o site da loja (um por loja), com nome, título, cor e a situação rascunho ou publicado.
-- ticketeria_site_paginas e ticketeria_site_dominios: as páginas e os domínios, com o mesmo desenho que tinham na Produção
-- (20261113150000_producao_sites.sql e 20261113200000_producao_site_seo.sql): blocos fixos em JSON, rascunho separado do publicado,
-- e o domínio da pessoa, que só o servidor escreve depois de conferir a Vercel, o DNS e o TXT de posse.
--
-- O bloco "programacao" de uma página passa a dizer de qual espaço da Produção é a programação (`espaco_id` dentro do JSON):
-- o site deixou de ter espaço. A cópia abaixo grava o espaço do site antigo nos blocos de programação que já existiam.
--
-- Acesso: `auth_ticketeria_pode(org, 'ler' | 'editar')`: quem usa a ticketeria na organização (auth_tem_modulo) e não é captador
-- nem proponente externo; editar exige papel diferente de leitor. O super admin passa. A loja não se apaga pelo navegador.
-- Histórico: nenhum nesta fase (o da Produção não serve: só quem tem a Produção o lê). O histórico da Ticketeria vem depois.
--
-- Cópia: o site da organização de teste (o único que existia em 18/11/2026, em rascunho) vem para cá com os mesmos ids, e a
-- organização ganha uma loja. As tabelas antigas saem na migration seguinte (*_producao_sem_ingressos.sql).
--
-- Expansão: tabelas novas, funções novas e a cópia. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

-- ─── Acesso ─────────────────────────────────────────────────────────────────

-- Quem usa a ticketeria na organização: 'ler' para quem tem o módulo e não é captador nem proponente; 'editar' também exige papel
-- diferente de leitor. O super admin pode tudo (auth_tem_modulo já o deixa passar).
create or replace function public.auth_ticketeria_pode(p_org uuid, p_acao text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(p_acao in ('ler', 'editar'), false)
    and (
      public.is_jards_super_admin()
      or (
        public.auth_tem_modulo(p_org, 'ticketeria')
        and exists (
          select 1 from public.organization_members m
          where m.organization_id = p_org
            and m.user_id = auth.uid()
            and m.papel not in ('captador', 'proponente')
            and (p_acao = 'ler' or m.papel <> 'leitor')
        )
      )
    );
$$;

-- updated_at da ticketeria (a da Produção fica com a Produção).
create or replace function public.fn_ticketeria_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── Tabelas ────────────────────────────────────────────────────────────────

create table if not exists public.ticketeria_lojas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_lojas_organizacao_key unique (organization_id),
  constraint ticketeria_lojas_nome_check check (char_length(btrim(nome)) between 1 and 120)
);

create index if not exists ticketeria_lojas_criado_por_idx on public.ticketeria_lojas (criado_por) where criado_por is not null;

create table if not exists public.ticketeria_sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  nome text not null,
  titulo text,
  cor text not null default '#282525',
  situacao text not null default 'rascunho',
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_sites_loja_key unique (loja_id),
  constraint ticketeria_sites_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint ticketeria_sites_titulo_check check (titulo is null or char_length(btrim(titulo)) between 1 and 120),
  constraint ticketeria_sites_cor_check check (cor ~ '^#[0-9a-fA-F]{6}$'),
  constraint ticketeria_sites_situacao_check check (situacao in ('rascunho', 'publicado'))
);

create index if not exists ticketeria_sites_org_idx on public.ticketeria_sites (organization_id);
create index if not exists ticketeria_sites_criado_por_idx on public.ticketeria_sites (criado_por) where criado_por is not null;

create table if not exists public.ticketeria_site_paginas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.ticketeria_sites (id) on delete cascade,
  slug text not null,
  titulo text not null,
  ordem integer not null default 0,
  blocos jsonb not null default '[]'::jsonb,
  blocos_publicados jsonb,
  publicada_em timestamptz,
  descricao text,
  imagem_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_site_paginas_slug_key unique (site_id, slug),
  constraint ticketeria_site_paginas_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40),
  constraint ticketeria_site_paginas_titulo_check check (char_length(btrim(titulo)) between 1 and 120),
  constraint ticketeria_site_paginas_ordem_check check (ordem between 0 and 1000),
  constraint ticketeria_site_paginas_blocos_check check (jsonb_typeof(blocos) = 'array' and jsonb_array_length(blocos) <= 60),
  constraint ticketeria_site_paginas_blocos_publicados_check check (blocos_publicados is null or (jsonb_typeof(blocos_publicados) = 'array' and jsonb_array_length(blocos_publicados) <= 60)),
  constraint ticketeria_site_paginas_descricao_check check (descricao is null or char_length(btrim(descricao)) between 1 and 300),
  constraint ticketeria_site_paginas_imagem_url_check check (imagem_url is null or (char_length(imagem_url) <= 500 and imagem_url ~ '^https://[^[:space:]]+$'))
);

create index if not exists ticketeria_site_paginas_org_idx on public.ticketeria_site_paginas (organization_id);
create index if not exists ticketeria_site_paginas_site_idx on public.ticketeria_site_paginas (site_id, ordem);

create table if not exists public.ticketeria_site_dominios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.ticketeria_sites (id) on delete cascade,
  dominio text not null,
  situacao text not null default 'aguardando',
  token_verificacao text not null,
  erro text,
  verificado_em timestamptz,
  conferido_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_site_dominios_dominio_key unique (dominio),
  constraint ticketeria_site_dominios_dominio_check check (dominio = lower(dominio) and char_length(dominio) between 4 and 253 and dominio ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$'),
  constraint ticketeria_site_dominios_situacao_check check (situacao in ('aguardando', 'verificando', 'ativo', 'erro')),
  constraint ticketeria_site_dominios_token_check check (token_verificacao ~ '^[0-9a-f]{32}$'),
  constraint ticketeria_site_dominios_erro_check check (erro is null or char_length(erro) <= 500)
);

create index if not exists ticketeria_site_dominios_org_idx on public.ticketeria_site_dominios (organization_id);
create index if not exists ticketeria_site_dominios_site_idx on public.ticketeria_site_dominios (site_id);
create index if not exists ticketeria_site_dominios_criado_por_idx on public.ticketeria_site_dominios (criado_por) where criado_por is not null;

-- ─── Coerência ──────────────────────────────────────────────────────────────

-- A loja não troca de organização. Erro (check_violation): organizacao_nao_muda.
create or replace function public.fn_ticketeria_loja_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- O site: a organização e a loja não mudam; a loja é da organização. Erros (check_violation): organizacao_nao_muda,
-- loja_nao_muda, loja_de_outra_organizacao.
create or replace function public.fn_ticketeria_site_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.loja_id is distinct from old.loja_id then
    raise exception 'loja_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.ticketeria_lojas l where l.id = new.loja_id and l.organization_id = new.organization_id) then
    raise exception 'loja_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- A página e o domínio: a organização e o site não mudam; o site é da organização. Erros (check_violation):
-- organizacao_nao_muda, site_nao_muda, site_de_outra_organizacao.
create or replace function public.fn_ticketeria_site_filho_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.site_id is distinct from old.site_id then
    raise exception 'site_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new;
  end if;
  if not exists (select 1 from public.ticketeria_sites s where s.id = new.site_id and s.organization_id = new.organization_id) then
    raise exception 'site_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger ticketeria_lojas_coerencia
  before update of organization_id on public.ticketeria_lojas
  for each row execute function public.fn_ticketeria_loja_coerencia();
create or replace trigger ticketeria_lojas_updated_at
  before update on public.ticketeria_lojas
  for each row execute function public.fn_ticketeria_updated_at();

create or replace trigger ticketeria_sites_coerencia
  before insert or update of organization_id, loja_id on public.ticketeria_sites
  for each row execute function public.fn_ticketeria_site_coerencia();
create or replace trigger ticketeria_sites_updated_at
  before update on public.ticketeria_sites
  for each row execute function public.fn_ticketeria_updated_at();

create or replace trigger ticketeria_site_paginas_coerencia
  before insert or update of organization_id, site_id on public.ticketeria_site_paginas
  for each row execute function public.fn_ticketeria_site_filho_coerencia();
create or replace trigger ticketeria_site_paginas_updated_at
  before update on public.ticketeria_site_paginas
  for each row execute function public.fn_ticketeria_updated_at();

create or replace trigger ticketeria_site_dominios_coerencia
  before insert or update of organization_id, site_id on public.ticketeria_site_dominios
  for each row execute function public.fn_ticketeria_site_filho_coerencia();
create or replace trigger ticketeria_site_dominios_updated_at
  before update on public.ticketeria_site_dominios
  for each row execute function public.fn_ticketeria_updated_at();

-- ─── Regras de acesso ───────────────────────────────────────────────────────

alter table public.ticketeria_lojas enable row level security;
alter table public.ticketeria_sites enable row level security;
alter table public.ticketeria_site_paginas enable row level security;
alter table public.ticketeria_site_dominios enable row level security;

do $$
begin
  -- Lojas: lê quem usa a ticketeria; cria e edita quem edita. Não se apaga pelo navegador (sem regra nem privilégio de delete).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_lojas' and policyname = 'ticketeria_lojas: le') then
    create policy "ticketeria_lojas: le" on public.ticketeria_lojas for select to authenticated
      using (public.auth_ticketeria_pode(organization_id, 'ler'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_lojas' and policyname = 'ticketeria_lojas: insere') then
    create policy "ticketeria_lojas: insere" on public.ticketeria_lojas for insert to authenticated
      with check (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_lojas' and policyname = 'ticketeria_lojas: edita') then
    create policy "ticketeria_lojas: edita" on public.ticketeria_lojas for update to authenticated
      using (public.auth_ticketeria_pode(organization_id, 'editar'))
      with check (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;

  -- Sites e páginas: os da organização, para quem usa a ticketeria.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_sites' and policyname = 'ticketeria_sites: le') then
    create policy "ticketeria_sites: le" on public.ticketeria_sites for select to authenticated
      using (public.auth_ticketeria_pode(organization_id, 'ler'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_sites' and policyname = 'ticketeria_sites: insere') then
    create policy "ticketeria_sites: insere" on public.ticketeria_sites for insert to authenticated
      with check (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_sites' and policyname = 'ticketeria_sites: edita') then
    create policy "ticketeria_sites: edita" on public.ticketeria_sites for update to authenticated
      using (public.auth_ticketeria_pode(organization_id, 'editar'))
      with check (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_sites' and policyname = 'ticketeria_sites: apaga') then
    create policy "ticketeria_sites: apaga" on public.ticketeria_sites for delete to authenticated
      using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_site_paginas' and policyname = 'ticketeria_site_paginas: le') then
    create policy "ticketeria_site_paginas: le" on public.ticketeria_site_paginas for select to authenticated
      using (public.auth_ticketeria_pode(organization_id, 'ler'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_site_paginas' and policyname = 'ticketeria_site_paginas: insere') then
    create policy "ticketeria_site_paginas: insere" on public.ticketeria_site_paginas for insert to authenticated
      with check (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_site_paginas' and policyname = 'ticketeria_site_paginas: edita') then
    create policy "ticketeria_site_paginas: edita" on public.ticketeria_site_paginas for update to authenticated
      using (public.auth_ticketeria_pode(organization_id, 'editar'))
      with check (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_site_paginas' and policyname = 'ticketeria_site_paginas: apaga') then
    create policy "ticketeria_site_paginas: apaga" on public.ticketeria_site_paginas for delete to authenticated
      using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;

  -- Domínios: o navegador só lê; quem cadastra, confere e remove é o servidor (chave de serviço).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_site_dominios' and policyname = 'ticketeria_site_dominios: le') then
    create policy "ticketeria_site_dominios: le" on public.ticketeria_site_dominios for select to authenticated
      using (public.auth_ticketeria_pode(organization_id, 'ler'));
  end if;
end
$$;

-- Publica uma página: o rascunho vira o publicado e a hora fica registrada. As regras de quem chama valem (security invoker):
-- quem não edita o site não publica. Erro: P0002 pagina_nao_encontrada.
create or replace function public.fn_ticketeria_site_publicar_pagina(p_pagina uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_quando timestamptz := now();
  v_id uuid;
begin
  update public.ticketeria_site_paginas
  set blocos_publicados = blocos, publicada_em = v_quando
  where id = p_pagina
  returning id into v_id;
  if v_id is null then
    raise exception 'pagina_nao_encontrada' using errcode = 'P0002';
  end if;
  return v_quando;
end;
$$;

revoke execute on function public.auth_ticketeria_pode(uuid, text) from public, anon;
grant execute on function public.auth_ticketeria_pode(uuid, text) to authenticated;
revoke execute on function public.fn_ticketeria_updated_at() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_loja_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_site_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_site_filho_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_site_publicar_pagina(uuid) from public, anon;
grant execute on function public.fn_ticketeria_site_publicar_pagina(uuid) to authenticated;

revoke all on public.ticketeria_lojas, public.ticketeria_sites, public.ticketeria_site_paginas, public.ticketeria_site_dominios from anon, authenticated;
grant select, insert, update on public.ticketeria_lojas to authenticated;
grant select, insert, update, delete on public.ticketeria_sites to authenticated;
grant select, insert, update, delete on public.ticketeria_site_paginas to authenticated;
grant select on public.ticketeria_site_dominios to authenticated;

comment on table public.ticketeria_lojas is 'Loja do produtor na Ticketeria (uma por organização): dona do site e, nas próximas fases, da taxa e da subconta.';
comment on table public.ticketeria_sites is 'Site público da loja (um por loja), que abre só no domínio da própria pessoa. Rascunho ou publicado.';
comment on table public.ticketeria_site_paginas is 'Página do site: blocos fixos em JSON, com o rascunho separado do publicado.';
comment on table public.ticketeria_site_dominios is 'Domínio da pessoa ligado ao site. Só o servidor escreve, depois de conferir o DNS e a posse do domínio (TXT com o token).';
comment on function public.auth_ticketeria_pode(uuid, text) is 'ler: usa a ticketeria na organização (sem ser captador nem proponente). editar: idem, sem ser leitor. O super admin passa.';

-- ─── A cópia do site da Produção ────────────────────────────────────────────
-- Só enquanto as tabelas antigas existem (a migration seguinte as apaga; num banco novo, esta parte não faz nada).
-- Um site por loja: se alguma organização tiver mais de um site na Produção, a cópia para (nada se perde em silêncio).
do $$
begin
  if to_regclass('public.producao_sites') is null then
    return;
  end if;

  if exists (select 1 from public.producao_sites group by organization_id having count(*) > 1) then
    raise exception 'organizacao_com_mais_de_um_site: escolha qual site fica antes de copiar' using errcode = 'check_violation';
  end if;

  insert into public.ticketeria_lojas (organization_id, nome, criado_por)
  select s.organization_id, s.nome, s.criado_por
  from public.producao_sites s
  on conflict (organization_id) do nothing;

  insert into public.ticketeria_sites (id, organization_id, loja_id, nome, titulo, cor, situacao, criado_por, created_at)
  select s.id, s.organization_id, l.id, s.nome, s.titulo, s.cor, s.situacao, s.criado_por, s.created_at
  from public.producao_sites s
  join public.ticketeria_lojas l on l.organization_id = s.organization_id
  on conflict (id) do nothing;

  -- O bloco de programação ganha o espaço do site antigo.
  insert into public.ticketeria_site_paginas (id, organization_id, site_id, slug, titulo, ordem, blocos, blocos_publicados, publicada_em, descricao, imagem_url, created_at)
  select p.id, p.organization_id, p.site_id, p.slug, p.titulo, p.ordem,
         (select coalesce(jsonb_agg(case when b ->> 'tipo' = 'programacao' then b || jsonb_build_object('espaco_id', s.espaco_id) else b end order by n), '[]'::jsonb)
          from jsonb_array_elements(p.blocos) with ordinality as x(b, n)),
         case when p.blocos_publicados is null then null else
           (select coalesce(jsonb_agg(case when b ->> 'tipo' = 'programacao' then b || jsonb_build_object('espaco_id', s.espaco_id) else b end order by n), '[]'::jsonb)
            from jsonb_array_elements(p.blocos_publicados) with ordinality as x(b, n)) end,
         p.publicada_em, p.descricao, p.imagem_url, p.created_at
  from public.producao_site_paginas p
  join public.producao_sites s on s.id = p.site_id
  on conflict (id) do nothing;

  insert into public.ticketeria_site_dominios (id, organization_id, site_id, dominio, situacao, token_verificacao, erro, verificado_em, conferido_em, criado_por, created_at)
  select d.id, d.organization_id, d.site_id, d.dominio, d.situacao, d.token_verificacao, d.erro, d.verificado_em, d.conferido_em, d.criado_por, d.created_at
  from public.producao_site_dominios d
  on conflict (id) do nothing;
end
$$;
