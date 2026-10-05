-- P2.3: fornecedores da organização, com os dados públicos do CNPJ e das
-- sanções.
--
-- O cadastro é da organização (um fornecedor serve a todas as prestações) e
-- segue a regra da prestação: quem usa o módulo lê; o papel que edita
-- prestação cria, altera e apaga (auth_prestacao_org_pode).
-- Os dados da Receita (BrasilAPI) e das sanções (consulta consolidada do TCU:
-- inidôneos do TCU, CNIA do CNJ, CEIS e CNEP da CGU) só são gravados pela
-- função consultar-fornecedor, com a chave de serviço: o navegador não tem
-- insert nem update nessas colunas. Trocar o documento apaga a consulta
-- anterior, que era de outro documento.
-- Idempotente; sem DROP.

create or replace function public.auth_prestacao_org_pode(p_org uuid, p_acao text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_jards_super_admin() or exists (
    select 1
    from public.organization_members membro
    where membro.organization_id = p_org
      and membro.user_id = auth.uid()
      and public.auth_tem_modulo(p_org, 'prestacao')
      and public.auth_prestacao_papel_permite(membro.papel, membro.prestacao_funcao, p_acao)
  );
$$;

revoke execute on function public.auth_prestacao_org_pode(uuid, text) from public, anon;
grant execute on function public.auth_prestacao_org_pode(uuid, text) to authenticated;

create table if not exists public.prestacao_fornecedores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tipo_pessoa text not null default 'pj' check (tipo_pessoa in ('pj', 'mei', 'pf', 'estrangeiro')),
  -- Só letras e algarismos, em maiúsculas (o CNPJ alfanumérico vale desde julho de 2026).
  documento text check (documento ~ '^[0-9A-Z]+$'),
  nome text,
  parte_relacionada boolean not null default false,
  tipo_relacao text check (tipo_relacao in ('proponente', 'conjuge', 'coligada', 'socio_em_comum', 'dirigente', 'parente')),
  grupo_economico text,
  observacoes text,

  -- Consulta pública: só a função consultar-fornecedor grava.
  razao_social text,
  nome_fantasia text,
  situacao_cadastral text,
  data_situacao date,
  data_abertura date,
  cnae_principal text,
  cnae_descricao text,
  cnaes_secundarios jsonb,
  natureza_juridica text,
  porte text,
  opcao_mei boolean,
  uf text,
  municipio text,
  socios jsonb,
  cnpj_consultado_em timestamptz,
  cnpj_erro text,
  sancoes jsonb,
  sancoes_situacao text check (sancoes_situacao in ('nada_consta', 'consta', 'a_conferir', 'indisponivel')),
  sancoes_consultadas_em timestamptz,

  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (documento is not null or nome is not null),
  check (tipo_pessoa not in ('pj', 'mei') or documento is null or documento ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  check (tipo_pessoa <> 'pf' or documento is null or documento ~ '^[0-9]{11}$'),
  check (tipo_relacao is null or parte_relacionada)
);

create index if not exists prestacao_fornecedores_organizacao_idx
  on public.prestacao_fornecedores (organization_id);
create unique index if not exists prestacao_fornecedores_documento_idx
  on public.prestacao_fornecedores (organization_id, documento) where documento is not null;

-- Trocar o documento (ou o tipo de pessoa) invalida a consulta anterior.
create or replace function public.prestacao_fornecedor_limpa_consulta()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.documento is distinct from old.documento or new.tipo_pessoa is distinct from old.tipo_pessoa then
    new.razao_social := null;
    new.nome_fantasia := null;
    new.situacao_cadastral := null;
    new.data_situacao := null;
    new.data_abertura := null;
    new.cnae_principal := null;
    new.cnae_descricao := null;
    new.cnaes_secundarios := null;
    new.natureza_juridica := null;
    new.porte := null;
    new.opcao_mei := null;
    new.uf := null;
    new.municipio := null;
    new.socios := null;
    new.cnpj_consultado_em := null;
    new.cnpj_erro := null;
    new.sancoes := null;
    new.sancoes_situacao := null;
    new.sancoes_consultadas_em := null;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_fornecedores_updated_at'
                 and tgrelid = 'public.prestacao_fornecedores'::regclass) then
    create trigger prestacao_fornecedores_updated_at
      before update on public.prestacao_fornecedores
      for each row execute function public.set_prestacao_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_fornecedores_limpa_consulta'
                 and tgrelid = 'public.prestacao_fornecedores'::regclass) then
    create trigger prestacao_fornecedores_limpa_consulta
      before update on public.prestacao_fornecedores
      for each row execute function public.prestacao_fornecedor_limpa_consulta();
  end if;
end
$$;

-- ─── Acesso ─────────────────────────────────────────────────────────────────

alter table public.prestacao_fornecedores enable row level security;

-- O navegador escreve só as colunas da pessoa; as da consulta pública ficam com a função.
revoke insert, update on public.prestacao_fornecedores from authenticated, anon;
grant insert (organization_id, tipo_pessoa, documento, nome, parte_relacionada, tipo_relacao, grupo_economico, observacoes)
  on public.prestacao_fornecedores to authenticated;
grant update (tipo_pessoa, documento, nome, parte_relacionada, tipo_relacao, grupo_economico, observacoes)
  on public.prestacao_fornecedores to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_fornecedores'
                 and policyname = 'prestacao_fornecedores: acesso pela organizacao') then
    create policy "prestacao_fornecedores: acesso pela organizacao" on public.prestacao_fornecedores
      for all to authenticated
      using (organization_id = any(array(select public.auth_org_ids())) and public.auth_tem_modulo(organization_id, 'prestacao'))
      with check (organization_id = any(array(select public.auth_org_ids())) and public.auth_tem_modulo(organization_id, 'prestacao'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_fornecedores'
                 and policyname = 'prestacao_fornecedores: papel insere') then
    create policy "prestacao_fornecedores: papel insere" on public.prestacao_fornecedores
      as restrictive for insert to authenticated
      with check (public.auth_prestacao_org_pode(organization_id, 'editar'));
    create policy "prestacao_fornecedores: papel edita" on public.prestacao_fornecedores
      as restrictive for update to authenticated
      using (public.auth_prestacao_org_pode(organization_id, 'editar'))
      with check (public.auth_prestacao_org_pode(organization_id, 'editar'));
    create policy "prestacao_fornecedores: papel apaga" on public.prestacao_fornecedores
      as restrictive for delete to authenticated
      using (public.auth_prestacao_org_pode(organization_id, 'editar'));
  end if;
end
$$;
