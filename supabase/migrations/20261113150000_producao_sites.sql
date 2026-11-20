-- PD12.1 e PD12.1b: o site público do espaço, no domínio da própria pessoa.
--
-- producao_sites: o site de um espaço (nome, título e cor, e a situação rascunho ou publicado). producao_site_paginas: as
-- páginas do site, cada uma com blocos fixos em JSON (título, texto, imagem, botão, programação, contato; sem HTML livre),
-- o rascunho (`blocos`) separado do publicado (`blocos_publicados`, que só muda ao publicar). producao_site_dominios: os
-- domínios da pessoa ligados ao site (o site abre SÓ nele, nunca em subdomínio do Jards), com a situação da conferência.
--
-- Segurança do domínio: a tabela de domínios é só leitura para o navegador. Quem escreve nela é o servidor (chave de serviço),
-- depois de conferir (1) que o domínio foi cadastrado no projeto da Vercel, (2) que o DNS aponta para ela e (3) que a pessoa
-- controla o DNS: um registro TXT com o código `token_verificacao` em `_jards-verificacao.<domínio>`. Sem a conferência, o
-- domínio não vira ativo, então ninguém publica um site no domínio de outra pessoa só por cadastrá-lo primeiro.
--
-- Acesso: o site é o do espaço (quem lê o espaço lê o site; quem edita e vê o espaço escreve), e as páginas e os domínios são
-- os do site. Histórico: do site e das páginas (o JSON dos blocos fica de fora). A publicação de uma página é a função
-- `fn_producao_site_publicar_pagina` (security invoker: as regras de quem chama valem).
--
-- Expansão: três tabelas novas e vazias, funções novas e a função do histórico trocada (create or replace, mesma assinatura,
-- os ramos de antes mais dois no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  espaco_id uuid not null references public.producao_espacos (id) on delete cascade,
  nome text not null,
  titulo text,
  cor text not null default '#282525',
  situacao text not null default 'rascunho',
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_sites_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint producao_sites_titulo_check check (titulo is null or char_length(btrim(titulo)) between 1 and 120),
  constraint producao_sites_cor_check check (cor ~ '^#[0-9a-fA-F]{6}$'),
  constraint producao_sites_situacao_check check (situacao in ('rascunho', 'publicado'))
);

create index if not exists producao_sites_org_idx on public.producao_sites (organization_id);
create index if not exists producao_sites_espaco_idx on public.producao_sites (espaco_id);
create index if not exists producao_sites_criado_por_idx on public.producao_sites (criado_por) where criado_por is not null;

create table if not exists public.producao_site_paginas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.producao_sites (id) on delete cascade,
  slug text not null,
  titulo text not null,
  ordem integer not null default 0,
  blocos jsonb not null default '[]'::jsonb,
  blocos_publicados jsonb,
  publicada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_site_paginas_slug_key unique (site_id, slug),
  constraint producao_site_paginas_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40),
  constraint producao_site_paginas_titulo_check check (char_length(btrim(titulo)) between 1 and 120),
  constraint producao_site_paginas_ordem_check check (ordem between 0 and 1000),
  constraint producao_site_paginas_blocos_check check (jsonb_typeof(blocos) = 'array' and jsonb_array_length(blocos) <= 60),
  constraint producao_site_paginas_blocos_publicados_check check (blocos_publicados is null or (jsonb_typeof(blocos_publicados) = 'array' and jsonb_array_length(blocos_publicados) <= 60))
);

create index if not exists producao_site_paginas_org_idx on public.producao_site_paginas (organization_id);
create index if not exists producao_site_paginas_site_idx on public.producao_site_paginas (site_id, ordem);

create table if not exists public.producao_site_dominios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.producao_sites (id) on delete cascade,
  dominio text not null,
  situacao text not null default 'aguardando',
  token_verificacao text not null,
  erro text,
  verificado_em timestamptz,
  conferido_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_site_dominios_dominio_key unique (dominio),
  constraint producao_site_dominios_dominio_check check (dominio = lower(dominio) and char_length(dominio) between 4 and 253 and dominio ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$'),
  constraint producao_site_dominios_situacao_check check (situacao in ('aguardando', 'verificando', 'ativo', 'erro')),
  constraint producao_site_dominios_token_check check (token_verificacao ~ '^[0-9a-f]{32}$'),
  constraint producao_site_dominios_erro_check check (erro is null or char_length(erro) <= 500)
);

create index if not exists producao_site_dominios_org_idx on public.producao_site_dominios (organization_id);
create index if not exists producao_site_dominios_site_idx on public.producao_site_dominios (site_id);
create index if not exists producao_site_dominios_criado_por_idx on public.producao_site_dominios (criado_por) where criado_por is not null;

-- Coerência do site: a organização e o espaço não mudam; o espaço é da organização. Erros (check_violation):
-- organizacao_nao_muda, espaco_nao_muda, espaco_de_outra_organizacao.
create or replace function public.fn_producao_site_coerencia()
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
    raise exception 'espaco_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_espacos e where e.id = new.espaco_id and e.organization_id = new.organization_id) then
    raise exception 'espaco_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência da página e do domínio: a organização e o site não mudam; o site é da organização. Erros (check_violation):
-- organizacao_nao_muda, site_nao_muda, site_de_outra_organizacao.
create or replace function public.fn_producao_site_filho_coerencia()
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
  if not exists (select 1 from public.producao_sites s where s.id = new.site_id and s.organization_id = new.organization_id) then
    raise exception 'site_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_sites_coerencia
  before insert or update of organization_id, espaco_id on public.producao_sites
  for each row execute function public.fn_producao_site_coerencia();
create or replace trigger producao_sites_updated_at
  before update on public.producao_sites
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_sites_historico
  after insert or update or delete on public.producao_sites
  for each row execute function public.fn_producao_historico('', 'nome');

create or replace trigger producao_site_paginas_coerencia
  before insert or update of organization_id, site_id on public.producao_site_paginas
  for each row execute function public.fn_producao_site_filho_coerencia();
create or replace trigger producao_site_paginas_updated_at
  before update on public.producao_site_paginas
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_site_paginas_historico
  after insert or update or delete on public.producao_site_paginas
  for each row execute function public.fn_producao_historico('blocos,blocos_publicados', 'titulo');

create or replace trigger producao_site_dominios_coerencia
  before insert or update of organization_id, site_id on public.producao_site_dominios
  for each row execute function public.fn_producao_site_filho_coerencia();
create or replace trigger producao_site_dominios_updated_at
  before update on public.producao_site_dominios
  for each row execute function public.fn_producao_updated_at();

-- Quem vê o histórico: o texto de 20261112150000_producao_sessoes.sql com dois ramos novos no fim.
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
    when 'producao_arquivos' then exists (select 1 from public.producao_arquivos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_pessoas' then exists (select 1 from public.producao_pessoas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_vinculos' then exists (select 1 from public.producao_vinculos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_escalas' then exists (select 1 from public.producao_escalas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_cartoes_dia' then exists (select 1 from public.producao_cartoes_dia x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_tarefas' then exists (select 1 from public.producao_tarefas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_notas' then exists (select 1 from public.producao_notas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_modelos_dia' then exists (select 1 from public.producao_modelos_dia x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_pautas' then exists (select 1 from public.producao_pautas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_itens' then exists (select 1 from public.producao_itens x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_plantas' then exists (select 1 from public.producao_plantas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_riders' then exists (select 1 from public.producao_riders x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_equipamentos' then exists (select 1 from public.producao_equipamentos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_turnos' then exists (select 1 from public.producao_turnos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_licencas' then exists (select 1 from public.producao_licencas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_modelos_acerto' then exists (select 1 from public.producao_modelos_acerto x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_acertos' then exists (select 1 from public.producao_acertos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_sessoes' then exists (select 1 from public.producao_sessoes x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_sites' then exists (select 1 from public.producao_sites x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_site_paginas' then exists (select 1 from public.producao_site_paginas x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

alter table public.producao_sites enable row level security;
alter table public.producao_site_paginas enable row level security;
alter table public.producao_site_dominios enable row level security;

do $$
begin
  -- Sites: os do espaço.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sites' and policyname = 'producao_sites: le') then
    create policy "producao_sites: le" on public.producao_sites for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_espacos e where e.id = producao_sites.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sites' and policyname = 'producao_sites: leitura sem assinatura') then
    create policy "producao_sites: leitura sem assinatura" on public.producao_sites for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_espacos e where e.id = producao_sites.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sites' and policyname = 'producao_sites: insere') then
    create policy "producao_sites: insere" on public.producao_sites for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_espacos e where e.id = producao_sites.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sites' and policyname = 'producao_sites: edita') then
    create policy "producao_sites: edita" on public.producao_sites for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_espacos e where e.id = producao_sites.espaco_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_espacos e where e.id = producao_sites.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sites' and policyname = 'producao_sites: apaga') then
    create policy "producao_sites: apaga" on public.producao_sites for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_espacos e where e.id = producao_sites.espaco_id));
  end if;

  -- Páginas: as do site à vista.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_site_paginas' and policyname = 'producao_site_paginas: le') then
    create policy "producao_site_paginas: le" on public.producao_site_paginas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_sites s where s.id = producao_site_paginas.site_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_site_paginas' and policyname = 'producao_site_paginas: leitura sem assinatura') then
    create policy "producao_site_paginas: leitura sem assinatura" on public.producao_site_paginas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_sites s where s.id = producao_site_paginas.site_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_site_paginas' and policyname = 'producao_site_paginas: insere') then
    create policy "producao_site_paginas: insere" on public.producao_site_paginas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sites s where s.id = producao_site_paginas.site_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_site_paginas' and policyname = 'producao_site_paginas: edita') then
    create policy "producao_site_paginas: edita" on public.producao_site_paginas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sites s where s.id = producao_site_paginas.site_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sites s where s.id = producao_site_paginas.site_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_site_paginas' and policyname = 'producao_site_paginas: apaga') then
    create policy "producao_site_paginas: apaga" on public.producao_site_paginas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sites s where s.id = producao_site_paginas.site_id));
  end if;

  -- Domínios: leitura pelo site à vista; escrita só pelo servidor (chave de serviço), que confere o DNS e a posse do domínio.
  -- As cinco regras existem (a escrita de quem está logado fica sem privilégio de tabela), para o teste de acesso ver o conjunto.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_site_dominios' and policyname = 'producao_site_dominios: le') then
    create policy "producao_site_dominios: le" on public.producao_site_dominios for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_sites s where s.id = producao_site_dominios.site_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_site_dominios' and policyname = 'producao_site_dominios: leitura sem assinatura') then
    create policy "producao_site_dominios: leitura sem assinatura" on public.producao_site_dominios for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_sites s where s.id = producao_site_dominios.site_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_site_dominios' and policyname = 'producao_site_dominios: insere') then
    create policy "producao_site_dominios: insere" on public.producao_site_dominios for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sites s where s.id = producao_site_dominios.site_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_site_dominios' and policyname = 'producao_site_dominios: edita') then
    create policy "producao_site_dominios: edita" on public.producao_site_dominios for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sites s where s.id = producao_site_dominios.site_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sites s where s.id = producao_site_dominios.site_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_site_dominios' and policyname = 'producao_site_dominios: apaga') then
    create policy "producao_site_dominios: apaga" on public.producao_site_dominios for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sites s where s.id = producao_site_dominios.site_id));
  end if;
end
$$;

-- Publica uma página: o rascunho vira o publicado e a hora fica registrada. As regras de quem chama valem (security invoker):
-- quem não edita o site não publica. Erros: P0002 pagina_nao_encontrada.
create or replace function public.fn_producao_site_publicar_pagina(p_pagina uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_quando timestamptz := now();
  v_id uuid;
begin
  update public.producao_site_paginas
  set blocos_publicados = blocos, publicada_em = v_quando
  where id = p_pagina
  returning id into v_id;
  if v_id is null then
    raise exception 'pagina_nao_encontrada' using errcode = 'P0002';
  end if;
  return v_quando;
end;
$$;

revoke execute on function public.fn_producao_site_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_site_filho_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_site_publicar_pagina(uuid) from public, anon;
grant execute on function public.fn_producao_site_publicar_pagina(uuid) to authenticated;
revoke all on public.producao_sites, public.producao_site_paginas, public.producao_site_dominios from anon, authenticated;
grant select, insert, update, delete on public.producao_sites to authenticated;
grant select, insert, update, delete on public.producao_site_paginas to authenticated;
-- O navegador só lê os domínios: o servidor cadastra, confere e remove.
grant select on public.producao_site_dominios to authenticated;

comment on table public.producao_sites is 'Site público de um espaço, que abre só no domínio da própria pessoa. Rascunho ou publicado.';
comment on table public.producao_site_paginas is 'Página de um site: blocos fixos em JSON, com o rascunho separado do publicado.';
comment on table public.producao_site_dominios is 'Domínio da pessoa ligado a um site. Só o servidor escreve, depois de conferir o DNS e a posse do domínio (TXT com o token).';
