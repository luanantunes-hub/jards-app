-- PD8.6 (segundo corte): as tabelas para a transportadora e para a locadora, por link só de leitura.
--
-- producao_temporada_links: o link público de UMA lista de uma temporada, de um tipo: `transfers` (os deslocamentos da temporada, para a
-- transportadora) ou `locacao` (os itens locados da obra da temporada que ainda não foram devolvidos, para a locadora). Um filtro opcional
-- deixa só o que é daquele parceiro (a companhia do transfer, o fornecedor do item). Guarda o hash do código, a validade e a revogação;
-- o código aparece uma vez, quando o link é gerado. Quem abre o link (/tabela/[código]) vê só o que `lib/producao/tabelas-publicas.ts` deixa
-- passar: nunca contato, documento, nota, dinheiro, odômetro, placa nem motorista. O servidor lê com a chave de serviço, conferindo o hash, a
-- revogação e a validade a cada pedido. A validade é obrigatória (de 1 a 90 dias, padrão 30), como no link do hotel.
--
-- Acesso: o da temporada (quem lê a temporada lê os links, sem o hash; quem edita escreve). O hash nunca sai para o navegador. A função de
-- criar é `security invoker`. Apagar: o link sai com a temporada.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho e uma função de criar link. Aditiva e reaplicável; sem DROP. Sem histórico (o
-- hash é segredo): motivo no teste de texto.

set local lock_timeout = '10s';

create table if not exists public.producao_temporada_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  temporada_id uuid not null references public.producao_temporadas (id) on delete cascade,
  tipo text not null,
  filtro text,
  token_hash text not null,
  expira_em timestamptz not null,
  revogado_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_temporada_links_token_hash_key unique (token_hash),
  constraint producao_temporada_links_token_hash_formato_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint producao_temporada_links_tipo_check check (tipo in ('transfers', 'locacao')),
  constraint producao_temporada_links_filtro_check check (filtro is null or char_length(btrim(filtro)) between 1 and 120)
);

create index if not exists producao_temporada_links_org_idx on public.producao_temporada_links (organization_id);
create index if not exists producao_temporada_links_temporada_idx on public.producao_temporada_links (temporada_id);
create index if not exists producao_temporada_links_criado_por_idx on public.producao_temporada_links (criado_por) where criado_por is not null;

-- Coerência: a organização e a temporada não mudam; a temporada é da organização. Erros (check_violation):
-- organizacao_nao_muda, temporada_nao_muda, temporada_de_outra_organizacao.
create or replace function public.fn_producao_temporada_link_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.temporada_id is distinct from old.temporada_id then
    raise exception 'temporada_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id) then
    raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_temporada_links_coerencia
  before insert or update of organization_id, temporada_id on public.producao_temporada_links
  for each row execute function public.fn_producao_temporada_link_coerencia();
create or replace trigger producao_temporada_links_updated_at
  before update on public.producao_temporada_links
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_temporada_links enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_temporada_links' and policyname = 'producao_temporada_links: le') then
    create policy "producao_temporada_links: le" on public.producao_temporada_links for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_temporada_links.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_temporada_links' and policyname = 'producao_temporada_links: leitura sem assinatura') then
    create policy "producao_temporada_links: leitura sem assinatura" on public.producao_temporada_links for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_temporadas t where t.id = producao_temporada_links.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_temporada_links' and policyname = 'producao_temporada_links: insere') then
    create policy "producao_temporada_links: insere" on public.producao_temporada_links for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_temporada_links.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_temporada_links' and policyname = 'producao_temporada_links: edita') then
    create policy "producao_temporada_links: edita" on public.producao_temporada_links for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_temporada_links.temporada_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_temporada_links.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_temporada_links' and policyname = 'producao_temporada_links: apaga') then
    create policy "producao_temporada_links: apaga" on public.producao_temporada_links for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_temporada_links.temporada_id));
  end if;
end
$$;

-- Gera o link de uma lista da temporada e devolve o código, que aparece só esta vez; o banco guarda o hash. `p_tipo` é `transfers` ou
-- `locacao` (esta só numa temporada ligada a uma obra, porque os itens locados são da obra). `p_filtro` deixa só o que é de um parceiro
-- (vazio = tudo). `p_dias` é a validade, de 1 a 90 (nulo ou 0 = 30). As regras de acesso de quem chama valem (security invoker).
-- Erros: P0001 tipo_invalido, validade_invalida, filtro_invalido, temporada_sem_obra; P0002 temporada_nao_encontrada; 42501 do banco.
create or replace function public.fn_producao_temporada_criar_link(p_temporada uuid, p_tipo text, p_filtro text, p_dias integer)
returns text
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_org uuid;
  v_obra uuid;
  v_codigo text;
  v_dias integer := coalesce(nullif(p_dias, 0), 30);
  v_filtro text := nullif(btrim(coalesce(p_filtro, '')), '');
begin
  if p_tipo is null or p_tipo not in ('transfers', 'locacao') then
    raise exception 'tipo_invalido';
  end if;
  if v_dias < 1 or v_dias > 90 then
    raise exception 'validade_invalida';
  end if;
  if v_filtro is not null and char_length(v_filtro) > 120 then
    raise exception 'filtro_invalido';
  end if;
  select t.organization_id, t.obra_id into v_org, v_obra from public.producao_temporadas t where t.id = p_temporada;
  if not found then
    raise exception 'temporada_nao_encontrada' using errcode = 'P0002';
  end if;
  if p_tipo = 'locacao' and v_obra is null then
    raise exception 'temporada_sem_obra';
  end if;
  v_codigo := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into public.producao_temporada_links (organization_id, temporada_id, tipo, filtro, token_hash, expira_em, criado_por)
  values (v_org, p_temporada, p_tipo, v_filtro, encode(extensions.digest(v_codigo, 'sha256'), 'hex'), now() + make_interval(days => v_dias), auth.uid());
  return v_codigo;
end;
$$;

revoke execute on function public.fn_producao_temporada_link_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_temporada_criar_link(uuid, text, text, integer) from public, anon;
grant execute on function public.fn_producao_temporada_criar_link(uuid, text, text, integer) to authenticated;
revoke all on public.producao_temporada_links from anon, authenticated;
-- O hash do código nunca sai para o navegador: a produção lê as colunas do link menos ele.
grant select (id, organization_id, temporada_id, tipo, filtro, expira_em, revogado_em, criado_por, created_at, updated_at) on public.producao_temporada_links to authenticated;
grant insert (organization_id, temporada_id, tipo, filtro, token_hash, expira_em, criado_por) on public.producao_temporada_links to authenticated;
grant update (revogado_em) on public.producao_temporada_links to authenticated;
grant delete on public.producao_temporada_links to authenticated;

comment on table public.producao_temporada_links is
  'Link público de uma lista da temporada (transfers para a transportadora, itens locados para a locadora), com validade (só o hash do código é guardado). Nada de contato, nota ou dinheiro.';
