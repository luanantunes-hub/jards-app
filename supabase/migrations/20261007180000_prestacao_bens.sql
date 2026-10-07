-- P3.5: bens permanentes adquiridos, produzidos ou construídos.
--
-- A IN 29/2026 só aceita bem permanente previsto na planilha, com a
-- destinação declarada (art. 30), e pede no relatório final a relação de bens
-- móveis e obras de arte com o comprovante da cotação, a de imóveis e o recibo
-- de quem recebeu o bem doado (art. 69, VI, VII e X). No Salic, cada bem doado
-- traz o item orçamentário, o documento de doação, quem recebeu (CPF ou CNPJ,
-- nome, quantidade), o aceite e observações de até 1.000 caracteres.
--
--  * prestacao_orcamento_nos.bem_permanente marca o item da planilha que é
--    bem permanente; a cópia de versão leva a marca;
--  * prestacao_bens guarda o bem: tipo (móvel, equipamento, obra de arte,
--    imóvel), descrição, quantidade, valor, número de patrimônio, registro do
--    imóvel, até três cotações, destinação, quem recebeu, o termo de doação e
--    o aceite, a justificativa e observações. Liga ao item e à despesa da
--    mesma prestação (gatilho); os arquivos ficam na pasta bens dela;
--  * ao ativar outra versão do orçamento, metas e bens passam para o nó
--    correspondente, como as despesas (as metas da P3.1 ficavam presas à
--    versão anterior);
--  * prestacao_verificacoes passa a aceitar bem como entidade.
-- Idempotente.

-- ─── Item da planilha que é bem permanente ──────────────────────────────────

alter table public.prestacao_orcamento_nos add column if not exists bem_permanente boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prestacao_orcamento_nos_bem_permanente_check'
                 and conrelid = 'public.prestacao_orcamento_nos'::regclass) then
    alter table public.prestacao_orcamento_nos
      add constraint prestacao_orcamento_nos_bem_permanente_check check (tipo = 'item' or not bem_permanente);
  end if;
end
$$;

-- A cópia de versão leva a marca (texto de 20261006180000, com bem_permanente).
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
     unidade, quantidade, ocorrencias, valor_unitario, valor_total, fonte, ordem, cnaes_aceitos, bem_permanente)
  select nova, n.prestacao_id, n.id, n.tipo, n.codigo, n.nome, n.descricao, n.uf, n.municipio, n.grupo_custo,
         n.unidade, n.quantidade, n.ocorrencias,
         case when n.valor_remanejado = 0 then n.valor_unitario end,
         n.valor_total + n.valor_remanejado, n.fonte, n.ordem, n.cnaes_aceitos, n.bem_permanente
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

-- ─── Bens ───────────────────────────────────────────────────────────────────

create table if not exists public.prestacao_bens (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  -- Item da planilha (art. 30) e despesa que pagou o bem, da mesma prestação.
  no_id uuid references public.prestacao_orcamento_nos(id) on delete set null,
  despesa_id uuid references public.prestacao_comprovantes(id) on delete set null,
  tipo text not null check (tipo in ('movel', 'equipamento', 'obra_de_arte', 'imovel')),
  descricao text not null check (char_length(btrim(descricao)) between 1 and 300),
  quantidade integer not null default 1 check (quantidade > 0),
  valor numeric(14, 2) check (valor is null or valor >= 0),
  numero_patrimonio text check (numero_patrimonio is null or char_length(numero_patrimonio) <= 100),
  -- Imóvel: cartório, número do registro e folha, como o Salic pede.
  registro_imovel text check (registro_imovel is null or char_length(registro_imovel) <= 500),
  -- Até três cotações: [{fornecedor, documento?, valor, data?, storage_path?, nome_arquivo?}].
  cotacoes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(cotacoes) = 'array' and jsonb_array_length(cotacoes) <= 3),
  destinacao text check (destinacao is null or destinacao in ('doacao', 'proponente', 'outra')),
  destinacao_descricao text check (destinacao_descricao is null or char_length(destinacao_descricao) <= 1000),
  beneficiario text check (beneficiario is null or char_length(beneficiario) <= 200),
  beneficiario_documento text check (beneficiario_documento is null or beneficiario_documento ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$'),
  doacao_storage_path text,
  doacao_nome_arquivo text check (doacao_nome_arquivo is null or char_length(doacao_nome_arquivo) <= 300),
  aceite_storage_path text,
  aceite_nome_arquivo text check (aceite_nome_arquivo is null or char_length(aceite_nome_arquivo) <= 300),
  justificativa text check (justificativa is null or char_length(justificativa) <= 2000),
  observacoes text check (observacoes is null or char_length(observacoes) <= 1000),
  ordem integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prestacao_bens_prestacao_idx on public.prestacao_bens (prestacao_id, ordem, created_at);
create index if not exists prestacao_bens_despesa_idx on public.prestacao_bens (despesa_id) where despesa_id is not null;
create index if not exists prestacao_bens_no_idx on public.prestacao_bens (no_id) where no_id is not null;

-- Arquivo do bem: na pasta bens da própria prestação.
create or replace function public.fn_prestacao_arquivo_do_bem(p_caminho text, p_prestacao_id uuid)
returns boolean
language sql
immutable
as $$
  select p_caminho is null
      or (split_part(p_caminho, '/', 3) = p_prestacao_id::text and split_part(p_caminho, '/', 4) = 'bens'
          and split_part(p_caminho, '/', 6) = '');
$$;

-- Item e despesa da mesma prestação; arquivos e cotações bem formados.
create or replace function public.fn_prestacao_bem_vinculos()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  cotacao jsonb;
begin
  if new.no_id is not null and not exists (
    select 1 from public.prestacao_orcamento_nos n
    where n.id = new.no_id and n.prestacao_id = new.prestacao_id and n.tipo = 'item'
  ) then
    raise exception 'item_invalido' using errcode = 'check_violation';
  end if;
  if new.despesa_id is not null and not exists (
    select 1 from public.prestacao_comprovantes c where c.id = new.despesa_id and c.prestacao_id = new.prestacao_id
  ) then
    raise exception 'despesa_de_outra_prestacao' using errcode = 'check_violation';
  end if;
  if not public.fn_prestacao_arquivo_do_bem(new.doacao_storage_path, new.prestacao_id)
     or not public.fn_prestacao_arquivo_do_bem(new.aceite_storage_path, new.prestacao_id) then
    raise exception 'caminho_invalido' using errcode = 'check_violation';
  end if;
  for cotacao in select value from jsonb_array_elements(new.cotacoes) loop
    if jsonb_typeof(cotacao) <> 'object'
       or jsonb_typeof(cotacao->'fornecedor') is distinct from 'string'
       or char_length(btrim(cotacao->>'fornecedor')) not between 1 and 200
       -- Entre parênteses: o THEN do case não pode fechar o IF.
       or (case when jsonb_typeof(cotacao->'valor') = 'number' then (cotacao->>'valor')::numeric <= 0 else true end)
       or (cotacao ? 'data' and jsonb_typeof(cotacao->'data') <> 'null'
           and coalesce(cotacao->>'data', '') !~ '^\d{4}-\d{2}-\d{2}$') then
      raise exception 'cotacao_invalida' using errcode = 'check_violation';
    end if;
    if cotacao ? 'storage_path' and jsonb_typeof(cotacao->'storage_path') = 'string'
       and not public.fn_prestacao_arquivo_do_bem(cotacao->>'storage_path', new.prestacao_id) then
      raise exception 'caminho_invalido' using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_bens_vinculos'
                 and tgrelid = 'public.prestacao_bens'::regclass) then
    create trigger prestacao_bens_vinculos
      before insert or update of no_id, despesa_id, doacao_storage_path, aceite_storage_path, cotacoes, prestacao_id
      on public.prestacao_bens
      for each row execute function public.fn_prestacao_bem_vinculos();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_bens_updated_at'
                 and tgrelid = 'public.prestacao_bens'::regclass) then
    create trigger prestacao_bens_updated_at
      before update on public.prestacao_bens
      for each row execute function public.set_prestacao_updated_at();
  end if;
end
$$;

-- ─── Ativar versão: despesas, metas e bens vão para o nó correspondente ──────
-- Texto de 20261005180000, com as metas e os bens.

create or replace function public.fn_prestacao_orcamento_ativar_versao(p_versao_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  alvo public.prestacao_orcamento_versoes%rowtype;
  anterior uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = 'insufficient_privilege';
  end if;
  select * into alvo from public.prestacao_orcamento_versoes where id = p_versao_id;
  if alvo.id is null or not public.can_access_prestacao(alvo.prestacao_id) then
    raise exception 'prestacao_inexistente' using errcode = 'no_data_found';
  end if;
  if not public.auth_prestacao_pode(alvo.prestacao_id, 'decidir') then
    raise exception 'sem_permissao' using errcode = 'insufficient_privilege';
  end if;

  perform 1 from public.prestacoes_contas where id = alvo.prestacao_id for update;
  anterior := (select v.id from public.prestacao_orcamento_versoes v
               where v.prestacao_id = alvo.prestacao_id and v.ativa);
  if anterior = alvo.id then
    return;
  end if;

  update public.prestacao_orcamento_versoes set ativa = false where id = anterior;
  update public.prestacao_orcamento_versoes set ativa = true where id = alvo.id;

  update public.prestacao_comprovantes c
  set no_id = correspondente.id
  from public.prestacao_orcamento_nos atual, public.prestacao_orcamento_nos correspondente
  where c.prestacao_id = alvo.prestacao_id
    and atual.id = c.no_id
    and atual.versao_id = anterior
    and correspondente.versao_id = alvo.id
    and correspondente.tipo = 'item'
    and (correspondente.origem_no_id = atual.id or atual.origem_no_id = correspondente.id);

  update public.prestacao_metas m
  set no_id = correspondente.id
  from public.prestacao_orcamento_nos atual, public.prestacao_orcamento_nos correspondente
  where m.prestacao_id = alvo.prestacao_id
    and atual.id = m.no_id
    and atual.versao_id = anterior
    and correspondente.versao_id = alvo.id
    and correspondente.tipo <> 'item'
    and (correspondente.origem_no_id = atual.id or atual.origem_no_id = correspondente.id);

  update public.prestacao_bens b
  set no_id = correspondente.id
  from public.prestacao_orcamento_nos atual, public.prestacao_orcamento_nos correspondente
  where b.prestacao_id = alvo.prestacao_id
    and atual.id = b.no_id
    and atual.versao_id = anterior
    and correspondente.versao_id = alvo.id
    and correspondente.tipo = 'item'
    and (correspondente.origem_no_id = atual.id or atual.origem_no_id = correspondente.id);
end;
$$;

revoke execute on function public.fn_prestacao_orcamento_copiar_versao(uuid, text, text) from public, anon;
revoke execute on function public.fn_prestacao_orcamento_ativar_versao(uuid) from public, anon;
grant execute on function public.fn_prestacao_orcamento_copiar_versao(uuid, text, text) to authenticated;
grant execute on function public.fn_prestacao_orcamento_ativar_versao(uuid) to authenticated;

-- ─── Verificações: bem como entidade ────────────────────────────────────────

alter table public.prestacao_verificacoes drop constraint if exists prestacao_verificacoes_entidade_tipo_check;
alter table public.prestacao_verificacoes add constraint prestacao_verificacoes_entidade_tipo_check
  check (entidade_tipo in ('prestacao', 'despesa', 'pagamento', 'lancamento', 'meta', 'local', 'atividade', 'evidencia', 'distribuicao', 'bem'));

-- ─── Acesso ─────────────────────────────────────────────────────────────────

alter table public.prestacao_bens enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_bens'
                 and policyname = 'prestacao_bens: acesso pela prestacao') then
    create policy "prestacao_bens: acesso pela prestacao" on public.prestacao_bens
      for all to authenticated
      using (public.can_access_prestacao(prestacao_id))
      with check (public.can_access_prestacao(prestacao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_bens'
                 and policyname = 'prestacao_bens: papel insere') then
    create policy "prestacao_bens: papel insere" on public.prestacao_bens
      as restrictive for insert to authenticated
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_bens: papel edita" on public.prestacao_bens
      as restrictive for update to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'))
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_bens: papel apaga" on public.prestacao_bens
      as restrictive for delete to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'));
  end if;
end
$$;

revoke all on public.prestacao_bens from anon;
grant select, insert, update, delete on public.prestacao_bens to authenticated;
grant all on public.prestacao_bens to service_role;
