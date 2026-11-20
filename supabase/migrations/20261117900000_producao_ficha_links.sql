-- PD3.5 (segundo corte): a ficha técnica do espaço por link, para quem vai ocupar a sala (sem conta, só leitura, com validade).
--
-- producao_ficha_links: o link público da ficha técnica de UM espaço: hash do código, validade, revogação e se o contato do espaço aparece (padrão: não).
-- O código aparece uma vez, quando o link é gerado; o banco guarda só o hash. Quem abre o link (/ficha/[código]) vê a mesma ficha do PDF da PD3.5: o
-- espaço (funcionamento, acessibilidade, carga e descarga, doca, veículo), uma seção por sala com a ficha técnica e os equipamentos da casa em uso; o
-- contato do espaço só se a pessoa que gerou o link marcou. Nunca programação, equipe, pauta de terceiros, dinheiro nem outras organizações. O
-- servidor lê com a chave de serviço, conferindo o hash, a revogação e a validade a cada pedido. A validade é obrigatória (de 1 a 90 dias, padrão 30).
--
-- Acesso: o do espaço (quem lê o espaço lê os links, sem o hash; quem edita o espaço escreve). O hash nunca sai para o navegador. A função de criar é
-- `security invoker`. Apagar: o link sai com o espaço.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho e uma função de criar link. Aditiva e reaplicável; sem DROP. Sem histórico (o hash é
-- segredo): motivo no teste de texto.

set local lock_timeout = '10s';

create table if not exists public.producao_ficha_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  espaco_id uuid not null references public.producao_espacos (id) on delete cascade,
  token_hash text not null,
  expira_em timestamptz not null,
  incluir_contato boolean not null default false,
  revogado_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_ficha_links_token_hash_key unique (token_hash),
  constraint producao_ficha_links_token_hash_formato_check check (token_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists producao_ficha_links_org_idx on public.producao_ficha_links (organization_id);
create index if not exists producao_ficha_links_espaco_idx on public.producao_ficha_links (espaco_id);
create index if not exists producao_ficha_links_criado_por_idx on public.producao_ficha_links (criado_por) where criado_por is not null;

-- Coerência: a organização e o espaço não mudam; o espaço é da organização. Erros (check_violation):
-- organizacao_nao_muda, espaco_nao_muda, espaco_de_outra_organizacao.
create or replace function public.fn_producao_ficha_link_coerencia()
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
  if not exists (select 1 from public.producao_espacos h where h.id = new.espaco_id and h.organization_id = new.organization_id) then
    raise exception 'espaco_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_ficha_links_coerencia
  before insert or update of organization_id, espaco_id on public.producao_ficha_links
  for each row execute function public.fn_producao_ficha_link_coerencia();
create or replace trigger producao_ficha_links_updated_at
  before update on public.producao_ficha_links
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_ficha_links enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ficha_links' and policyname = 'producao_ficha_links: le') then
    create policy "producao_ficha_links: le" on public.producao_ficha_links for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_espacos h where h.id = producao_ficha_links.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ficha_links' and policyname = 'producao_ficha_links: leitura sem assinatura') then
    create policy "producao_ficha_links: leitura sem assinatura" on public.producao_ficha_links for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_espacos h where h.id = producao_ficha_links.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ficha_links' and policyname = 'producao_ficha_links: insere') then
    create policy "producao_ficha_links: insere" on public.producao_ficha_links for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_espacos h where h.id = producao_ficha_links.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ficha_links' and policyname = 'producao_ficha_links: edita') then
    create policy "producao_ficha_links: edita" on public.producao_ficha_links for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_espacos h where h.id = producao_ficha_links.espaco_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_espacos h where h.id = producao_ficha_links.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ficha_links' and policyname = 'producao_ficha_links: apaga') then
    create policy "producao_ficha_links: apaga" on public.producao_ficha_links for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_espacos h where h.id = producao_ficha_links.espaco_id));
  end if;
end
$$;

-- Gera o link da ficha técnica de um espaço e devolve o código, que aparece só esta vez; o banco guarda o hash. `p_dias` é a
-- validade, de 1 a 90 (nulo ou 0 = 30). As regras de acesso de quem chama valem (security invoker): quem não edita o espaço não
-- gera. Erros: P0001 validade_invalida, P0002 espaco_nao_encontrado, 42501 do banco (sem permissão).
create or replace function public.fn_producao_ficha_criar_link(p_espaco uuid, p_dias integer, p_contato boolean)
returns text
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_org uuid;
  v_codigo text;
  v_dias integer := coalesce(nullif(p_dias, 0), 30);
begin
  if v_dias < 1 or v_dias > 90 then
    raise exception 'validade_invalida';
  end if;
  select h.organization_id into v_org from public.producao_espacos h where h.id = p_espaco;
  if not found then
    raise exception 'espaco_nao_encontrado' using errcode = 'P0002';
  end if;
  v_codigo := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into public.producao_ficha_links (organization_id, espaco_id, token_hash, expira_em, incluir_contato, criado_por)
  values (v_org, p_espaco, encode(extensions.digest(v_codigo, 'sha256'), 'hex'), now() + make_interval(days => v_dias), coalesce(p_contato, false), auth.uid());
  return v_codigo;
end;
$$;

revoke execute on function public.fn_producao_ficha_link_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_ficha_criar_link(uuid, integer, boolean) from public, anon;
grant execute on function public.fn_producao_ficha_criar_link(uuid, integer, boolean) to authenticated;
revoke all on public.producao_ficha_links from anon, authenticated;
-- O hash do código nunca sai para o navegador: a produção lê as colunas do link menos ele.
grant select (id, organization_id, espaco_id, expira_em, incluir_contato, revogado_em, criado_por, created_at, updated_at) on public.producao_ficha_links to authenticated;
grant insert (organization_id, espaco_id, token_hash, expira_em, incluir_contato, criado_por) on public.producao_ficha_links to authenticated;
grant update (revogado_em) on public.producao_ficha_links to authenticated;
grant delete on public.producao_ficha_links to authenticated;

comment on table public.producao_ficha_links is
  'Link público da ficha técnica de um espaço, com validade (só o hash do código é guardado). Mostra o espaço, as salas e os equipamentos; o contato só se o link foi gerado com ele.';
