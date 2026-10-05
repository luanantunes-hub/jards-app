-- P2.4: despesa v2 e CNAEs aceitos pelo orçamento.
--
-- 1. prestacao_orcamento_nos.cnaes_aceitos: as atividades (CNAE) que o item
--    aceita, em algarismos (divisão 2, grupo 3, classe 5 ou subclasse 7). O
--    agrupador pode definir para os itens abaixo dele; o item que define os
--    seus não herda (lib/prestacao/cnae.ts). Copiar a versão leva junto.
-- 2. prestacao_comprovantes vira a despesa (o nome da tabela fica até a
--    P2.11): fornecedor da mesma organização da prestação, número, série e
--    chave de acesso do documento, retenções (ISS, INSS, IRRF e outras),
--    valor líquido calculado, identificação do projeto no documento e a
--    justificativa de quem segue apesar dos alertas. valor_extraido continua
--    sendo o valor bruto do documento, que entra no realizado.
-- 3. Tipos de documento novos: NFS-e, cupom (NFC-e), RPCI, fatura, apólice e
--    nota de débito.
--
-- O fornecedor ligado a uma despesa não pode ser excluído (on delete
-- restrict); a mesma chave de acesso não entra duas vezes na prestação.
-- Idempotente; sem DROP.

-- ─── Tipos de documento ─────────────────────────────────────────────────────

alter type public.tipo_comprovante add value if not exists 'nfse';
alter type public.tipo_comprovante add value if not exists 'cupom';
alter type public.tipo_comprovante add value if not exists 'rpci';
alter type public.tipo_comprovante add value if not exists 'fatura';
alter type public.tipo_comprovante add value if not exists 'apolice';
alter type public.tipo_comprovante add value if not exists 'nota_debito';

-- ─── CNAEs aceitos no orçamento ─────────────────────────────────────────────

create or replace function public.fn_cnaes_validos(p_cnaes text[])
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_cnaes is null or not exists (
    select 1 from unnest(p_cnaes) c where c is null or c !~ '^([0-9]{2}|[0-9]{3}|[0-9]{5}|[0-9]{7})$'
  );
$$;

alter table public.prestacao_orcamento_nos add column if not exists cnaes_aceitos text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prestacao_orcamento_nos_cnaes_aceitos_check'
                 and conrelid = 'public.prestacao_orcamento_nos'::regclass) then
    alter table public.prestacao_orcamento_nos
      add constraint prestacao_orcamento_nos_cnaes_aceitos_check check (public.fn_cnaes_validos(cnaes_aceitos));
  end if;
end
$$;

-- Mesmo texto de 20261005180000, com cnaes_aceitos na cópia.
create or replace function public.fn_prestacao_orcamento_copiar_versao(p_versao_id uuid, p_tipo text, p_nome text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  origem public.prestacao_orcamento_versoes%rowtype;
  nova uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = 'insufficient_privilege';
  end if;
  select * into origem from public.prestacao_orcamento_versoes where id = p_versao_id;
  if origem.id is null or not public.can_access_prestacao(origem.prestacao_id) then
    raise exception 'prestacao_inexistente' using errcode = 'no_data_found';
  end if;
  if not public.auth_prestacao_pode(origem.prestacao_id, 'editar') then
    raise exception 'sem_permissao' using errcode = 'insufficient_privilege';
  end if;

  insert into public.prestacao_orcamento_versoes (prestacao_id, tipo, nome, origem, copiada_de, criado_por)
  values (origem.prestacao_id, p_tipo, nullif(btrim(coalesce(p_nome, '')), ''), 'copia', origem.id, auth.uid())
  returning id into nova;

  insert into public.prestacao_orcamento_nos
    (versao_id, prestacao_id, origem_no_id, tipo, codigo, nome, descricao, uf, municipio, grupo_custo,
     unidade, quantidade, ocorrencias, valor_unitario, valor_total, fonte, ordem, cnaes_aceitos)
  select nova, n.prestacao_id, n.id, n.tipo, n.codigo, n.nome, n.descricao, n.uf, n.municipio, n.grupo_custo,
         n.unidade, n.quantidade, n.ocorrencias,
         case when n.valor_remanejado = 0 then n.valor_unitario end,
         n.valor_total + n.valor_remanejado, n.fonte, n.ordem, n.cnaes_aceitos
  from public.prestacao_orcamento_nos n
  where n.versao_id = origem.id;

  update public.prestacao_orcamento_nos copia
  set parent_id = pai_copia.id
  from public.prestacao_orcamento_nos original, public.prestacao_orcamento_nos pai_copia
  where copia.versao_id = nova
    and original.id = copia.origem_no_id
    and original.parent_id is not null
    and pai_copia.versao_id = nova
    and pai_copia.origem_no_id = original.parent_id;

  return nova;
end;
$$;

-- ─── Despesa no comprovante ─────────────────────────────────────────────────

alter table public.prestacao_comprovantes
  add column if not exists fornecedor_id uuid references public.prestacao_fornecedores(id) on delete restrict,
  add column if not exists numero_documento text,
  add column if not exists serie text,
  add column if not exists chave_acesso text,
  add column if not exists iss numeric(14, 2) not null default 0,
  add column if not exists inss numeric(14, 2) not null default 0,
  add column if not exists irrf numeric(14, 2) not null default 0,
  add column if not exists outras_retencoes numeric(14, 2) not null default 0,
  add column if not exists identificacao_projeto text,
  add column if not exists justificativa text;

alter table public.prestacao_comprovantes
  add column if not exists valor_liquido numeric
  generated always as (valor_extraido - iss - inss - irrf - outras_retencoes) stored;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prestacao_comprovantes_retencoes_check'
                 and conrelid = 'public.prestacao_comprovantes'::regclass) then
    alter table public.prestacao_comprovantes add constraint prestacao_comprovantes_retencoes_check check (
      iss >= 0 and inss >= 0 and irrf >= 0 and outras_retencoes >= 0
      and (valor_extraido is null or iss + inss + irrf + outras_retencoes <= valor_extraido)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prestacao_comprovantes_chave_acesso_check'
                 and conrelid = 'public.prestacao_comprovantes'::regclass) then
    -- 44 posições (NF-e e família, com o CNPJ alfanumérico) ou 50 (NFS-e nacional); o dígito a tela confere.
    alter table public.prestacao_comprovantes add constraint prestacao_comprovantes_chave_acesso_check check (
      chave_acesso is null or chave_acesso ~ '^([0-9A-Z]{44}|[0-9A-Z]{50})$'
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prestacao_comprovantes_identificacao_projeto_check'
                 and conrelid = 'public.prestacao_comprovantes'::regclass) then
    alter table public.prestacao_comprovantes add constraint prestacao_comprovantes_identificacao_projeto_check check (
      identificacao_projeto is null or identificacao_projeto in ('presente', 'declaracao', 'ausente')
    );
  end if;
end
$$;

create index if not exists prestacao_comprovantes_fornecedor_idx
  on public.prestacao_comprovantes (fornecedor_id) where fornecedor_id is not null;

create unique index if not exists prestacao_comprovantes_chave_acesso_key
  on public.prestacao_comprovantes (prestacao_id, chave_acesso) where chave_acesso is not null;

-- O fornecedor tem de ser da organização da prestação. Definer: quem é de
-- duas organizações vê os fornecedores das duas, e a regra não pode depender
-- do que a pessoa enxerga.
create or replace function public.fn_prestacao_comprovante_fornecedor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.fornecedor_id is not null and not exists (
    select 1
      from public.prestacao_fornecedores f
      join public.prestacoes_contas p on p.organization_id = f.organization_id
     where f.id = new.fornecedor_id and p.id = new.prestacao_id
  ) then
    raise exception 'fornecedor_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_comprovante_fornecedor'
                 and tgrelid = 'public.prestacao_comprovantes'::regclass) then
    create trigger trg_prestacao_comprovante_fornecedor
      before insert or update of fornecedor_id, prestacao_id on public.prestacao_comprovantes
      for each row execute function public.fn_prestacao_comprovante_fornecedor();
  end if;
end
$$;
