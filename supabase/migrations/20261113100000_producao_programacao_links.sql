-- PD8.3 (primeiro corte): a programação pública de um espaço, por link.
--
-- producao_programacao_links: o link público da programação de um espaço (título que aparece na página, hash do código,
-- revogação). O código aparece uma vez, quando o link é gerado; o banco guarda só o hash. Quem abre o link (a página
-- /programacao/[código], a versão para embutir /embed/programacao/[código] e o JSON /api/programacao/[código]) vê só as
-- sessões das pautas CONFIRMADAS do espaço, com dia, hora, título e sala: nunca contratante, notas, pré-reservas,
-- consultas, dinheiro nem equipe. O servidor lê com a chave de serviço, conferindo o hash e a revogação a cada pedido.
--
-- Acesso: o do espaço (quem lê o espaço lê os links, sem o hash; quem edita e vê o espaço escreve). O hash nunca sai
-- para o navegador (as colunas do hash ficam fora do select). A função de criar é `security invoker`.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho e uma função de criar link. Aditiva e reaplicável; sem DROP. Não
-- entra em auth_producao_ve_historico: a tabela não tem histórico (motivo no teste de texto).

set local lock_timeout = '10s';

create table if not exists public.producao_programacao_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  espaco_id uuid not null references public.producao_espacos (id) on delete cascade,
  titulo text,
  token_hash text not null,
  revogado_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_programacao_links_token_hash_key unique (token_hash),
  constraint producao_programacao_links_token_hash_formato_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint producao_programacao_links_titulo_check check (titulo is null or char_length(btrim(titulo)) between 1 and 120)
);

create index if not exists producao_programacao_links_org_idx on public.producao_programacao_links (organization_id);
create index if not exists producao_programacao_links_espaco_idx on public.producao_programacao_links (espaco_id);
create index if not exists producao_programacao_links_criado_por_idx on public.producao_programacao_links (criado_por) where criado_por is not null;

-- Coerência: a organização e o espaço não mudam; o espaço é da organização. Erros (check_violation):
-- organizacao_nao_muda, espaco_nao_muda, espaco_de_outra_organizacao.
create or replace function public.fn_producao_programacao_link_coerencia()
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
  if not exists (select 1 from public.producao_espacos e where e.id = new.espaco_id and e.organization_id = new.organization_id) then
    raise exception 'espaco_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_programacao_links_coerencia
  before insert or update of organization_id, espaco_id on public.producao_programacao_links
  for each row execute function public.fn_producao_programacao_link_coerencia();
create or replace trigger producao_programacao_links_updated_at
  before update on public.producao_programacao_links
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_programacao_links enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_programacao_links' and policyname = 'producao_programacao_links: le') then
    create policy "producao_programacao_links: le" on public.producao_programacao_links for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_espacos e where e.id = producao_programacao_links.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_programacao_links' and policyname = 'producao_programacao_links: leitura sem assinatura') then
    create policy "producao_programacao_links: leitura sem assinatura" on public.producao_programacao_links for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_espacos e where e.id = producao_programacao_links.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_programacao_links' and policyname = 'producao_programacao_links: insere') then
    create policy "producao_programacao_links: insere" on public.producao_programacao_links for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_espacos e where e.id = producao_programacao_links.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_programacao_links' and policyname = 'producao_programacao_links: edita') then
    create policy "producao_programacao_links: edita" on public.producao_programacao_links for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_espacos e where e.id = producao_programacao_links.espaco_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_espacos e where e.id = producao_programacao_links.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_programacao_links' and policyname = 'producao_programacao_links: apaga') then
    create policy "producao_programacao_links: apaga" on public.producao_programacao_links for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_espacos e where e.id = producao_programacao_links.espaco_id));
  end if;
end
$$;

-- Gera o link da programação de um espaço: devolve o código, que aparece só esta vez; o banco guarda o hash. As regras de
-- acesso de quem chama valem (security invoker): quem não edita o espaço não gera. Erros: 42501 do banco (sem permissão).
create or replace function public.fn_producao_programacao_criar_link(p_espaco uuid, p_titulo text)
returns text
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_org uuid;
  v_codigo text;
begin
  select e.organization_id into v_org from public.producao_espacos e where e.id = p_espaco;
  if not found then
    raise exception 'espaco_nao_encontrado' using errcode = 'P0002';
  end if;
  v_codigo := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into public.producao_programacao_links (organization_id, espaco_id, titulo, token_hash, criado_por)
  values (v_org, p_espaco, nullif(btrim(coalesce(p_titulo, '')), ''), encode(extensions.digest(v_codigo, 'sha256'), 'hex'), auth.uid());
  return v_codigo;
end;
$$;

revoke execute on function public.fn_producao_programacao_link_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_programacao_criar_link(uuid, text) from public, anon;
grant execute on function public.fn_producao_programacao_criar_link(uuid, text) to authenticated;
revoke all on public.producao_programacao_links from anon, authenticated;
-- O hash do código nunca sai para o navegador: a produção lê as colunas do link menos ele.
grant select (id, organization_id, espaco_id, titulo, revogado_em, criado_por, created_at, updated_at) on public.producao_programacao_links to authenticated;
grant insert (organization_id, espaco_id, titulo, token_hash, criado_por) on public.producao_programacao_links to authenticated;
grant update (titulo, revogado_em) on public.producao_programacao_links to authenticated;
grant delete on public.producao_programacao_links to authenticated;

comment on table public.producao_programacao_links is
  'Link público da programação de um espaço (só o hash do código é guardado). Mostra só as sessões das pautas confirmadas: dia, hora, título e sala.';
