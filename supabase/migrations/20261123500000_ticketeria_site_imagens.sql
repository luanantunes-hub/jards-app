-- Ticketeria: a biblioteca de imagens do site (construtor de sites, passo 5; plano em docs/acoes-futuras/estudos/plano-ticketeria-cms-e-integracoes.md).
--
-- O produtor envia imagens (JPG, PNG ou WebP) pelo editor e as escolhe nos blocos, em vez de colar um link. A tela reduz a imagem (até 2000 pixels de largura), converte para WebP e tira os
-- dados da foto antes de enviar; o banco confere o que a tela mandou.
--
-- Armazenamento: espaço público `ticketeria-site` (o site é público), até 3 MB por arquivo e só image/webp, image/jpeg e image/png (nada de SVG, que pode levar código). O arquivo mora em
-- `<id da organização>/<id da imagem>.<webp|jpg|png>`; só quem edita a Ticketeria dessa organização envia e apaga (regras do storage.objects). O bloco do site continua guardando só o
-- endereço da imagem, então nenhum bloco existente muda.
-- ticketeria_site_imagens: um registro por imagem (nome, tipo, tamanho em bytes, largura e altura), até 200 por organização. Quem edita lê, cria e apaga.
--
-- Expansão: espaço de arquivos, tabela e regras novos. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticketeria-site', 'ticketeria-site', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create table if not exists public.ticketeria_site_imagens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  caminho text not null,
  nome text not null,
  tipo text not null,
  bytes integer not null,
  largura integer not null,
  altura integer not null,
  criado_por uuid,
  created_at timestamptz not null default now(),
  constraint ticketeria_site_imagens_caminho_key unique (caminho),
  constraint ticketeria_site_imagens_caminho_check check (caminho ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$'),
  constraint ticketeria_site_imagens_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint ticketeria_site_imagens_tipo_check check (tipo in ('image/webp', 'image/jpeg', 'image/png')),
  constraint ticketeria_site_imagens_bytes_check check (bytes between 1 and 3145728),
  constraint ticketeria_site_imagens_medidas_check check (largura between 1 and 4000 and altura between 1 and 4000)
);

create index if not exists ticketeria_site_imagens_org_idx on public.ticketeria_site_imagens (organization_id, created_at desc);

alter table public.ticketeria_site_imagens enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_site_imagens' and policyname = 'ticketeria_site_imagens: le') then
    create policy "ticketeria_site_imagens: le" on public.ticketeria_site_imagens for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_site_imagens' and policyname = 'ticketeria_site_imagens: cria') then
    -- Quem edita cria, o caminho tem de ser da própria organização, e cada organização guarda até 200 imagens.
    create policy "ticketeria_site_imagens: cria" on public.ticketeria_site_imagens for insert to authenticated
      with check (
        public.auth_ticketeria_pode(organization_id, 'editar')
        and caminho like organization_id::text || '/%'
        and (select count(*) from public.ticketeria_site_imagens i where i.organization_id = ticketeria_site_imagens.organization_id) < 200
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_site_imagens' and policyname = 'ticketeria_site_imagens: apaga') then
    create policy "ticketeria_site_imagens: apaga" on public.ticketeria_site_imagens for delete to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke all on public.ticketeria_site_imagens from anon, authenticated;
grant select, insert, delete on public.ticketeria_site_imagens to authenticated;

-- Os arquivos: só quem edita a Ticketeria da organização da primeira pasta do caminho envia e apaga (ler não precisa de regra: o espaço é público).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'ticketeria site: envia') then
    create policy "ticketeria site: envia" on storage.objects for insert to authenticated
      with check (
        bucket_id = 'ticketeria-site'
        and coalesce(public.auth_ticketeria_pode(case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (storage.foldername(name))[1]::uuid end, 'editar'), false)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'ticketeria site: apaga') then
    create policy "ticketeria site: apaga" on storage.objects for delete to authenticated
      using (
        bucket_id = 'ticketeria-site'
        and coalesce(public.auth_ticketeria_pode(case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (storage.foldername(name))[1]::uuid end, 'editar'), false)
      );
  end if;
end
$$;
