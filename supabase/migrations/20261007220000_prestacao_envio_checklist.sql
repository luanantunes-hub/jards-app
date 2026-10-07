-- P4.1: checklist de envio.
--
-- O regime diz o que o envio pede (parametros->'envio'): os documentos de cada
-- etapa (parcial ou final), com os obrigatórios, e as condições do sistema
-- oficial (na Rouanet, o que o Salic exige para liberar o botão de envio); a
-- prestação parcial tem as condições dela (parametros->'prestacaoParcial').
-- Boa parte do checklist o app responde com os dados que já existem (metas,
-- peças, bens, extratos, verificações); o resto é a pessoa que resolve.
--
-- prestacao_envio_checklist guarda essa marcação, uma por prestação, etapa e
-- item: "pronto" (feito, ou conferido no sistema oficial) ou "não se aplica",
-- com o motivo. Documento obrigatório e condição que bloqueia o envio não
-- aceitam "não se aplica".
--
-- prestacao_envio_arquivos guarda os arquivos anexados a um documento do
-- checklist, na pasta envio da prestação; o app os leva ao pacote (P4.5).
--
-- O código precisa existir no regime da prestação, para a etapa: os dois
-- gatilhos conferem. Marcação de um regime anterior fica guardada e o app a
-- ignora. Idempotente.

-- O documento ou a condição do regime da prestação, para a etapa; null quando
-- não há. Lê com a permissão de quem chama: quem vê a prestação lê o regime dela.
create or replace function public.prestacao_envio_item_do_regime(
  p_prestacao_id uuid, p_etapa text, p_tipo text, p_codigo text)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with regime as (
    select r.parametros
      from public.prestacoes_contas p
      join public.prestacao_regimes r on r.id = p.regime_id
     where p.id = p_prestacao_id
  )
  select item
    from regime,
         lateral (
           select d as item
             from jsonb_array_elements(case when jsonb_typeof(parametros->'envio'->'documentos') = 'array'
                                            then parametros->'envio'->'documentos' else '[]'::jsonb end) d
            where p_tipo = 'documento' and d->>'codigo' = p_codigo and (d->'em') ? p_etapa
           union all
           select c
             from jsonb_array_elements(case when jsonb_typeof(parametros->'envio'->'regras') = 'array'
                                            then parametros->'envio'->'regras' else '[]'::jsonb end) c
            where p_tipo = 'condicao' and c->>'codigo' = p_codigo
           union all
           select c
             from jsonb_array_elements(case when p_etapa = 'parcial' and jsonb_typeof(parametros->'prestacaoParcial'->'regras') = 'array'
                                            then parametros->'prestacaoParcial'->'regras' else '[]'::jsonb end) c
            where p_tipo = 'condicao' and c->>'codigo' = p_codigo
         ) itens
   limit 1;
$$;
revoke execute on function public.prestacao_envio_item_do_regime(uuid, text, text, text) from public, anon;
grant execute on function public.prestacao_envio_item_do_regime(uuid, text, text, text) to authenticated, service_role;

-- ─── Marcação ───────────────────────────────────────────────────────────────

create table if not exists public.prestacao_envio_checklist (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  etapa text not null check (etapa in ('parcial', 'final')),
  tipo text not null check (tipo in ('documento', 'condicao')),
  codigo text not null check (codigo ~ '^[a-z][a-z0-9_]{0,79}$'),
  situacao text not null check (situacao in ('pronto', 'nao_se_aplica')),
  justificativa text check (justificativa is null or char_length(justificativa) <= 1000),
  marcado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prestacao_envio_checklist_item unique (prestacao_id, etapa, tipo, codigo),
  -- "Não se aplica" diz por quê.
  constraint prestacao_envio_checklist_motivo
    check (situacao <> 'nao_se_aplica' or char_length(btrim(coalesce(justificativa, ''))) >= 5)
);

create or replace function public.fn_prestacao_envio_checklist_conferir()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  item jsonb;
begin
  -- Quem não vê a prestação recebe a recusa das regras de acesso, não esta.
  if not exists (select 1 from public.prestacoes_contas where id = new.prestacao_id) then
    return new;
  end if;
  item := public.prestacao_envio_item_do_regime(new.prestacao_id, new.etapa, new.tipo, new.codigo);
  if item is null then
    raise exception 'item_fora_do_regime' using errcode = 'check_violation';
  end if;
  if new.situacao = 'nao_se_aplica' and (
       (new.tipo = 'documento' and coalesce((item->>'obrigatorio')::boolean, false))
       or (new.tipo = 'condicao' and item->>'severidade' = 'bloqueio')) then
    raise exception 'obrigatorio_nao_se_dispensa' using errcode = 'check_violation';
  end if;
  new.marcado_por := auth.uid();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_envio_checklist_conferir'
                 and tgrelid = 'public.prestacao_envio_checklist'::regclass) then
    create trigger prestacao_envio_checklist_conferir
      before insert or update on public.prestacao_envio_checklist
      for each row execute function public.fn_prestacao_envio_checklist_conferir();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_envio_checklist_updated_at'
                 and tgrelid = 'public.prestacao_envio_checklist'::regclass) then
    create trigger prestacao_envio_checklist_updated_at
      before update on public.prestacao_envio_checklist
      for each row execute function public.set_prestacao_updated_at();
  end if;
end
$$;

-- ─── Arquivos ───────────────────────────────────────────────────────────────

create table if not exists public.prestacao_envio_arquivos (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  etapa text not null check (etapa in ('parcial', 'final')),
  codigo text not null check (codigo ~ '^[a-z][a-z0-9_]{0,79}$'),
  storage_path text not null,
  nome_arquivo text not null check (char_length(btrim(nome_arquivo)) between 1 and 300),
  mime_type text check (mime_type is null or char_length(mime_type) <= 200),
  tamanho_bytes bigint check (tamanho_bytes is null or tamanho_bytes >= 0),
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint prestacao_envio_arquivos_caminho unique (storage_path)
);

create index if not exists prestacao_envio_arquivos_item_idx on public.prestacao_envio_arquivos (prestacao_id, etapa, codigo, created_at);

-- O arquivo é de um documento do regime e fica na pasta envio da própria prestação.
create or replace function public.fn_prestacao_envio_arquivo_conferir()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.prestacoes_contas where id = new.prestacao_id) then
    return new;
  end if;
  if public.prestacao_envio_item_do_regime(new.prestacao_id, new.etapa, 'documento', new.codigo) is null then
    raise exception 'item_fora_do_regime' using errcode = 'check_violation';
  end if;
  if split_part(new.storage_path, '/', 2) <> 'prestacoes'
     or split_part(new.storage_path, '/', 3) <> new.prestacao_id::text
     or split_part(new.storage_path, '/', 4) <> 'envio'
     or split_part(new.storage_path, '/', 5) = ''
     or split_part(new.storage_path, '/', 6) <> '' then
    raise exception 'caminho_invalido' using errcode = 'check_violation';
  end if;
  new.criado_por := auth.uid();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_envio_arquivos_conferir'
                 and tgrelid = 'public.prestacao_envio_arquivos'::regclass) then
    create trigger prestacao_envio_arquivos_conferir
      before insert or update on public.prestacao_envio_arquivos
      for each row execute function public.fn_prestacao_envio_arquivo_conferir();
  end if;
end
$$;

-- ─── Acesso: lê quem acessa a prestação; escreve quem edita ─────────────────

alter table public.prestacao_envio_checklist enable row level security;
alter table public.prestacao_envio_arquivos enable row level security;

do $$
declare
  tabela text;
begin
  foreach tabela in array array['prestacao_envio_checklist', 'prestacao_envio_arquivos'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabela
                   and policyname = tabela || ': acesso pela prestacao') then
      execute format($p$create policy %I on public.%I for all to authenticated
        using (public.can_access_prestacao(prestacao_id)) with check (public.can_access_prestacao(prestacao_id))$p$,
        tabela || ': acesso pela prestacao', tabela);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabela
                   and policyname = tabela || ': papel insere') then
      execute format($p$create policy %I on public.%I as restrictive for insert to authenticated
        with check (public.auth_prestacao_pode(prestacao_id, 'editar'))$p$, tabela || ': papel insere', tabela);
      execute format($p$create policy %I on public.%I as restrictive for update to authenticated
        using (public.auth_prestacao_pode(prestacao_id, 'editar')) with check (public.auth_prestacao_pode(prestacao_id, 'editar'))$p$,
        tabela || ': papel edita', tabela);
      execute format($p$create policy %I on public.%I as restrictive for delete to authenticated
        using (public.auth_prestacao_pode(prestacao_id, 'editar'))$p$, tabela || ': papel apaga', tabela);
    end if;
  end loop;
end
$$;

revoke all on public.prestacao_envio_checklist from anon;
revoke all on public.prestacao_envio_arquivos from anon;
grant select, insert, update, delete on public.prestacao_envio_checklist to authenticated;
grant select, insert, update, delete on public.prestacao_envio_arquivos to authenticated;
grant all on public.prestacao_envio_checklist to service_role;
grant all on public.prestacao_envio_arquivos to service_role;
