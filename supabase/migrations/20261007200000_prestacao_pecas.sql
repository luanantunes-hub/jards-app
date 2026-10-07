-- P3.6: peças de divulgação, no lugar de prestacao_divulgacao.
--
-- A IN 29/2026 pede as marcas em todas as peças (art. 21, §§ 1º e 4º), a
-- aprovação prévia do material pelo MinC, que tem 5 dias úteis para avaliar
-- e cujo silêncio aprova (§§ 2º e 3º), e amostras ou registros das peças no
-- relatório final (art. 69, V). No defeso eleitoral (Lei 9.504/1997, art. 73,
-- VI, b), as peças usam a versão de período eleitoral das marcas, sem a do
-- Governo Federal; o período vem de calendario_regulatorio.
--
-- prestacao_pecas guarda a peça: tipo, título, onde e quando foi veiculada,
-- as marcas que aparecem nela, a aprovação prévia (situação, protocolo, data
-- do envio e da decisão), a amostra (arquivo na pasta pecas da prestação ou
-- link), a justificativa e observações. As marcas esperadas e o prazo do órgão
-- vêm do regime, no app.
--
-- prestacao_divulgacao estava vazia em produção (07/10/2026): sai aqui mesmo;
-- a guarda abaixo recusa se houver linhas. prestacao_verificacoes passa a
-- aceitar peça como entidade. Idempotente.

do $$
begin
  if to_regclass('public.prestacao_divulgacao') is not null
     and exists (select 1 from public.prestacao_divulgacao) then
    raise exception 'prestacao_divulgacao tem linhas: migre os dados antes de trocar pela prestacao_pecas';
  end if;
end
$$;

drop table if exists public.prestacao_divulgacao;

create table if not exists public.prestacao_pecas (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  tipo text not null check (tipo in ('cartaz', 'folder', 'banner', 'programa', 'convite', 'anuncio', 'rede_social', 'site', 'video', 'audio', 'placa', 'release', 'outro')),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  -- Onde foi veiculada: o perfil, o jornal, o local da placa.
  meio text check (meio is null or char_length(meio) <= 300),
  veiculacao_inicio date,
  veiculacao_fim date,
  -- Marcas que aparecem na peça, com os nomes do regime.
  marcas text[] not null default '{}' check (cardinality(marcas) <= 12),
  aprovacao_status text not null default 'nao_enviada'
    check (aprovacao_status in ('nao_enviada', 'enviada', 'aprovada', 'reprovada')),
  aprovacao_protocolo text check (aprovacao_protocolo is null or char_length(aprovacao_protocolo) <= 100),
  aprovacao_enviada_em date,
  aprovacao_decidida_em date,
  storage_path text,
  nome_arquivo text check (nome_arquivo is null or char_length(nome_arquivo) <= 300),
  mime_type text,
  url text check (url is null or url ~* '^https?://'),
  justificativa text check (justificativa is null or char_length(justificativa) <= 2000),
  observacoes text check (observacoes is null or char_length(observacoes) <= 1000),
  ordem integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prestacao_pecas_periodo
    check (veiculacao_fim is null or (veiculacao_inicio is not null and veiculacao_fim >= veiculacao_inicio)),
  -- Enviada, aprovada ou reprovada: com a data do envio.
  constraint prestacao_pecas_envio
    check (aprovacao_status = 'nao_enviada' or aprovacao_enviada_em is not null),
  -- Decisão expressa: com a data dela, que não vem antes do envio.
  constraint prestacao_pecas_decisao
    check ((aprovacao_status in ('aprovada', 'reprovada')) = (aprovacao_decidida_em is not null)
           and (aprovacao_decidida_em is null or aprovacao_decidida_em >= aprovacao_enviada_em))
);

create index if not exists prestacao_pecas_prestacao_idx on public.prestacao_pecas (prestacao_id, ordem, created_at);

-- A amostra fica na pasta pecas da própria prestação.
create or replace function public.fn_prestacao_peca_arquivo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.storage_path is not null and (
       split_part(new.storage_path, '/', 3) <> new.prestacao_id::text
       or split_part(new.storage_path, '/', 4) <> 'pecas'
       or split_part(new.storage_path, '/', 6) <> '') then
    raise exception 'caminho_invalido' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_pecas_arquivo'
                 and tgrelid = 'public.prestacao_pecas'::regclass) then
    create trigger prestacao_pecas_arquivo
      before insert or update of storage_path, prestacao_id on public.prestacao_pecas
      for each row execute function public.fn_prestacao_peca_arquivo();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_pecas_updated_at'
                 and tgrelid = 'public.prestacao_pecas'::regclass) then
    create trigger prestacao_pecas_updated_at
      before update on public.prestacao_pecas
      for each row execute function public.set_prestacao_updated_at();
  end if;
end
$$;

-- ─── Verificações: peça como entidade ───────────────────────────────────────

alter table public.prestacao_verificacoes drop constraint if exists prestacao_verificacoes_entidade_tipo_check;
alter table public.prestacao_verificacoes add constraint prestacao_verificacoes_entidade_tipo_check
  check (entidade_tipo in ('prestacao', 'despesa', 'pagamento', 'lancamento', 'meta', 'local', 'atividade', 'evidencia', 'distribuicao', 'bem', 'peca'));

-- ─── Acesso ─────────────────────────────────────────────────────────────────

alter table public.prestacao_pecas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_pecas'
                 and policyname = 'prestacao_pecas: acesso pela prestacao') then
    create policy "prestacao_pecas: acesso pela prestacao" on public.prestacao_pecas
      for all to authenticated
      using (public.can_access_prestacao(prestacao_id))
      with check (public.can_access_prestacao(prestacao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_pecas'
                 and policyname = 'prestacao_pecas: papel insere') then
    create policy "prestacao_pecas: papel insere" on public.prestacao_pecas
      as restrictive for insert to authenticated
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_pecas: papel edita" on public.prestacao_pecas
      as restrictive for update to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'))
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_pecas: papel apaga" on public.prestacao_pecas
      as restrictive for delete to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'));
  end if;
end
$$;

revoke all on public.prestacao_pecas from anon;
grant select, insert, update, delete on public.prestacao_pecas to authenticated;
grant all on public.prestacao_pecas to service_role;
