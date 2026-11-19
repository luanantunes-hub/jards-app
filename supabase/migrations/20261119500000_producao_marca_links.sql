-- PD9.2 (primeiro corte): o portal do patrocinador, por link só de leitura.
--
-- producao_marca_links: o link público de UMA marca que apresenta sessões (PD12.3): hash do código, validade e revogação. O código
-- aparece uma vez, quando o link é gerado; o banco guarda só o hash. Quem abre o link (a página /patrocinador/[código]) vê o nome e o
-- logo da marca e as sessões que ela apresenta — dia, hora, título, sala e espaço —, com o quanto já aconteceu. **Nada mais**: nem
-- equipe, nem pessoas, nem contato, nem dinheiro, nem outras marcas, nem o que não é sessão.
-- O servidor lê com a chave de serviço, conferindo o hash, a revogação e a validade a cada pedido.
-- A validade é obrigatória (de 1 a 90 dias, padrão 30): nem o que é só programação fica num endereço aberto para sempre.
--
-- Acesso: o da marca (quem lê a marca lê os links, sem o hash; quem edita escreve). O hash nunca sai para o navegador.
-- A função de criar é `security invoker`. Apagar: o link sai com a marca.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho e uma função de criar link. Aditiva e reaplicável; sem DROP. Sem histórico
-- (o hash é segredo): motivo no teste de texto.

set local lock_timeout = '10s';

create table if not exists public.producao_marca_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  marca_id uuid not null references public.producao_marcas (id) on delete cascade,
  token_hash text not null,
  expira_em timestamptz not null,
  revogado_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_marca_links_token_hash_key unique (token_hash),
  constraint producao_marca_links_token_hash_formato_check check (token_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists producao_marca_links_org_idx on public.producao_marca_links (organization_id);
create index if not exists producao_marca_links_marca_idx on public.producao_marca_links (marca_id);
create index if not exists producao_marca_links_criado_por_idx on public.producao_marca_links (criado_por) where criado_por is not null;

-- Coerência: a organização e a marca não mudam; a marca é da organização. Erros (check_violation):
-- organizacao_nao_muda, marca_nao_muda, marca_de_outra_organizacao.
create or replace function public.fn_producao_marca_link_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.marca_id is distinct from old.marca_id then
    raise exception 'marca_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_marcas m where m.id = new.marca_id and m.organization_id = new.organization_id) then
    raise exception 'marca_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_marca_links_coerencia
  before insert or update of organization_id, marca_id on public.producao_marca_links
  for each row execute function public.fn_producao_marca_link_coerencia();
create or replace trigger producao_marca_links_updated_at
  before update on public.producao_marca_links
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_marca_links enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_marca_links' and policyname = 'producao_marca_links: le') then
    create policy "producao_marca_links: le" on public.producao_marca_links for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_marcas m where m.id = producao_marca_links.marca_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_marca_links' and policyname = 'producao_marca_links: leitura sem assinatura') then
    create policy "producao_marca_links: leitura sem assinatura" on public.producao_marca_links for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_marcas m where m.id = producao_marca_links.marca_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_marca_links' and policyname = 'producao_marca_links: insere') then
    create policy "producao_marca_links: insere" on public.producao_marca_links for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_marcas m where m.id = producao_marca_links.marca_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_marca_links' and policyname = 'producao_marca_links: edita') then
    create policy "producao_marca_links: edita" on public.producao_marca_links for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_marcas m where m.id = producao_marca_links.marca_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_marcas m where m.id = producao_marca_links.marca_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_marca_links' and policyname = 'producao_marca_links: apaga') then
    create policy "producao_marca_links: apaga" on public.producao_marca_links for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_marcas m where m.id = producao_marca_links.marca_id));
  end if;
end
$$;

-- Gera o link do portal de uma marca e devolve o código, que aparece só esta vez; o banco guarda o hash. `p_dias` é a
-- validade, de 1 a 90 (nulo ou 0 = 30). As regras de acesso de quem chama valem (security invoker): quem não edita a marca não
-- gera. Erros: P0001 validade_invalida, P0002 marca_nao_encontrada, 42501 do banco (sem permissão).
create or replace function public.fn_producao_marca_criar_link(p_marca uuid, p_dias integer)
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
  select m.organization_id into v_org from public.producao_marcas m where m.id = p_marca;
  if not found then
    raise exception 'marca_nao_encontrada' using errcode = 'P0002';
  end if;
  v_codigo := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into public.producao_marca_links (organization_id, marca_id, token_hash, expira_em, criado_por)
  values (v_org, p_marca, encode(extensions.digest(v_codigo, 'sha256'), 'hex'), now() + make_interval(days => v_dias), auth.uid());
  return v_codigo;
end;
$$;

revoke execute on function public.fn_producao_marca_link_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_marca_criar_link(uuid, integer) from public, anon;
grant execute on function public.fn_producao_marca_criar_link(uuid, integer) to authenticated;
revoke all on public.producao_marca_links from anon, authenticated;
-- O hash do código nunca sai para o navegador: a produção lê as colunas do link menos ele.
grant select (id, organization_id, marca_id, expira_em, revogado_em, criado_por, created_at, updated_at) on public.producao_marca_links to authenticated;
grant insert (organization_id, marca_id, token_hash, expira_em, criado_por) on public.producao_marca_links to authenticated;
grant update (revogado_em) on public.producao_marca_links to authenticated;
grant delete on public.producao_marca_links to authenticated;

comment on table public.producao_marca_links is
  'Link público do portal de uma marca que apresenta sessões, com validade (só o hash do código é guardado). Mostra o nome e o logo da marca e as sessões que ela apresenta: nada de pessoas, contato ou dinheiro.';
