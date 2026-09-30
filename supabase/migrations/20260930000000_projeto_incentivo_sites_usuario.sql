-- Sites de projetos de incentivo adicionados pelos próprios usuários.
-- O dado compartilhado (projetos_incentivo.site_url) continua só-leitura para o app;
-- o site que o usuário informa fica por organização, nesta tabela.

-- Bloqueio de sites pornográficos/adultos: vale no banco (CHECK) e também no app
-- (lib/sites-bloqueados.ts — manter as duas listas em sincronia).
create or replace function public.url_site_permitida(p_url text)
returns boolean
language sql
immutable
as $$
  select
    p_url is not null
    and length(p_url) between 8 and 500
    and p_url ~* '^https?://[^\s/?#]+'
    and lower(substring(p_url from '^https?://(?:[^@/?#]*@)?([^/?#:]+)')) ~ '^[a-z0-9.-]+\.[a-z]{2,}$'
    and lower(substring(p_url from '^https?://(?:[^@/?#]*@)?([^/?#:]+)')) !~
      '(porn|xxx|xvideo|xnxx|xhamster|redtube|youporn|pornhub|spankbang|tnaflix|tube8|brazzers|onlyfans|fansly|chaturbate|bongacams|camsoda|stripchat|livejasmin|myfreecams|erome|fapello|rule34|hentai|nsfw|motherless|efukt|thothub|camgirl|camwhore|sexcam|sexshop|sexchat|putaria|punheta|buceta|safadinha|novinhas|redwap|beeg|eporner|xtube|xvideos|gostosas)'
$$;

create table if not exists public.projeto_incentivo_sites_usuario (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  projeto_id      uuid not null references public.projetos_incentivo(id) on delete cascade,
  url             text not null check (public.url_site_permitida(url)),
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, projeto_id)
);

create index if not exists idx_projeto_sites_usuario_org on public.projeto_incentivo_sites_usuario(organization_id);

alter table public.projeto_incentivo_sites_usuario enable row level security;

create policy "projeto_incentivo_sites_usuario: membro le" on public.projeto_incentivo_sites_usuario
  for select to authenticated using (
    exists (select 1 from public.organization_members m where m.organization_id = projeto_incentivo_sites_usuario.organization_id and m.user_id = auth.uid())
  );
create policy "projeto_incentivo_sites_usuario: membro insere" on public.projeto_incentivo_sites_usuario
  for insert to authenticated with check (
    exists (select 1 from public.organization_members m where m.organization_id = projeto_incentivo_sites_usuario.organization_id and m.user_id = auth.uid())
  );
create policy "projeto_incentivo_sites_usuario: membro atualiza" on public.projeto_incentivo_sites_usuario
  for update to authenticated using (
    exists (select 1 from public.organization_members m where m.organization_id = projeto_incentivo_sites_usuario.organization_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.organization_members m where m.organization_id = projeto_incentivo_sites_usuario.organization_id and m.user_id = auth.uid())
  );
create policy "projeto_incentivo_sites_usuario: membro remove" on public.projeto_incentivo_sites_usuario
  for delete to authenticated using (
    exists (select 1 from public.organization_members m where m.organization_id = projeto_incentivo_sites_usuario.organization_id and m.user_id = auth.uid())
  );

grant select, insert, update, delete on public.projeto_incentivo_sites_usuario to authenticated;

comment on table public.projeto_incentivo_sites_usuario is 'Site de um projeto de incentivo informado pelo usuário (por organização), usado quando projetos_incentivo.site_url está vazio.';
