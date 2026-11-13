-- PD7.2 (segundo corte): pedidos de convidados por link, com horário de corte.
--
-- producao_convidados_links: o link de pedidos de uma sessão (um por sessão, só o hash do código fica guardado), com o horário de corte (depois dele ninguém
-- pede), um título e o limite de pedidos que o link aceita. Quem recebe o link (alguém da equipe, da companhia ou da assessoria) escreve o
-- próprio nome e pede convidados pelo nome: cada pedido vira um convidado em situação "pedido", com o nome de quem pediu em
-- `producao_convidados.solicitante`, e a produção confirma ou recusa. A cota por tipo continua valendo no banco (cota_excedida).
--
-- Funções: `fn_producao_convidados_gerar_link(sessao, corte, titulo, limite)` (a produção logada; devolve o código uma vez) e
-- `fn_producao_convidado_pedir(hash, solicitante, nome, afiliacao, tipo, lugares)` (só o servidor, pela página pública; devolve 'ok' ou o
-- motivo: inexistente, revogado, encerrado, lotado, cota_cheia, tipo_invalido).
-- Acesso: o da sessão (e, por ela, o da pauta e do espaço). O hash nunca sai para o navegador. Apagar: o link sai com a sessão.
--
-- Expansão: uma tabela nova e vazia, uma coluna nova e anulável em `producao_convidados`, uma função de gatilho e duas de negócio.
-- Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.producao_convidados add column if not exists solicitante text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'producao_convidados_solicitante_check') then
    alter table public.producao_convidados add constraint producao_convidados_solicitante_check
      check (solicitante is null or char_length(btrim(solicitante)) between 1 and 120);
  end if;
end
$$;
create index if not exists producao_convidados_solicitante_idx on public.producao_convidados (sessao_id) where solicitante is not null;

create table if not exists public.producao_convidados_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sessao_id uuid not null references public.producao_sessoes (id) on delete cascade,
  token_hash text not null,
  titulo text,
  corte_em timestamptz not null,
  limite integer not null default 100,
  revogado_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_convidados_links_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint producao_convidados_links_titulo_check check (titulo is null or char_length(btrim(titulo)) between 1 and 120),
  constraint producao_convidados_links_limite_check check (limite between 1 and 500),
  constraint producao_convidados_links_hash_key unique (token_hash),
  constraint producao_convidados_links_sessao_key unique (sessao_id)
);

create index if not exists producao_convidados_links_org_idx on public.producao_convidados_links (organization_id);

-- Coerência do link: a organização e a sessão não mudam; a sessão é da organização.
-- Erros (check_violation): organizacao_nao_muda, sessao_nao_muda, sessao_de_outra_organizacao.
create or replace function public.fn_producao_convidados_link_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.sessao_id is distinct from old.sessao_id then
    raise exception 'sessao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_sessoes s where s.id = new.sessao_id and s.organization_id = new.organization_id) then
    raise exception 'sessao_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_convidados_links_coerencia
  before insert or update on public.producao_convidados_links
  for each row execute function public.fn_producao_convidados_link_coerencia();
create or replace trigger producao_convidados_links_updated_at
  before update on public.producao_convidados_links
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_convidados_links enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convidados_links' and policyname = 'producao_convidados_links: le') then
    create policy "producao_convidados_links: le" on public.producao_convidados_links for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_sessoes s where s.id = producao_convidados_links.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convidados_links' and policyname = 'producao_convidados_links: leitura sem assinatura') then
    create policy "producao_convidados_links: leitura sem assinatura" on public.producao_convidados_links for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_sessoes s where s.id = producao_convidados_links.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convidados_links' and policyname = 'producao_convidados_links: insere') then
    create policy "producao_convidados_links: insere" on public.producao_convidados_links for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_convidados_links.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convidados_links' and policyname = 'producao_convidados_links: edita') then
    create policy "producao_convidados_links: edita" on public.producao_convidados_links for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_convidados_links.sessao_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_convidados_links.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convidados_links' and policyname = 'producao_convidados_links: apaga') then
    create policy "producao_convidados_links: apaga" on public.producao_convidados_links for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_convidados_links.sessao_id));
  end if;
end
$$;

-- Gera (ou renova) o link de pedidos da sessão e devolve o código, que aparece só esta vez; o banco guarda o hash. O corte tem de
-- ser no futuro e a no máximo 365 dias; `p_limite` é de 1 a 500 (0 = o padrão de 100). As regras de acesso de quem chama valem
-- (security invoker). Erros: P0001 corte_invalido, P0001 limite_invalido, P0002 sessao_nao_encontrada.
create or replace function public.fn_producao_convidados_gerar_link(p_sessao uuid, p_corte timestamptz, p_titulo text, p_limite integer)
returns text
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_org uuid;
  v_codigo text;
  v_hash text;
  v_titulo text := nullif(btrim(coalesce(p_titulo, '')), '');
  v_limite integer := coalesce(nullif(p_limite, 0), 100);
begin
  if p_corte is null or p_corte <= now() or p_corte > now() + interval '365 days' then
    raise exception 'corte_invalido';
  end if;
  if v_limite < 1 or v_limite > 500 then
    raise exception 'limite_invalido';
  end if;
  select s.organization_id into v_org from public.producao_sessoes s where s.id = p_sessao;
  if v_org is null then
    raise exception 'sessao_nao_encontrada' using errcode = 'P0002';
  end if;
  v_codigo := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_hash := encode(extensions.digest(v_codigo, 'sha256'), 'hex');
  -- Atualiza o link que já existe; se não houver, cria. (Sem ON CONFLICT: ele leria a coluna do hash, que o navegador não lê.)
  update public.producao_convidados_links
  set token_hash = v_hash, corte_em = p_corte, titulo = v_titulo, limite = v_limite, revogado_em = null
  where sessao_id = p_sessao;
  if not found then
    insert into public.producao_convidados_links (organization_id, sessao_id, token_hash, corte_em, titulo, limite, criado_por)
    values (v_org, p_sessao, v_hash, p_corte, v_titulo, v_limite, auth.uid());
  end if;
  return v_codigo;
end;
$$;

-- O pedido pelo link: só a página pública chama (chave de serviço); o navegador não executa. O servidor já conferiu o formato dos
-- valores; aqui ficam a conferência do link, do corte e do limite, e a gravação (a cota do tipo é conferida pelo gatilho do convidado).
-- Devolve 'ok' ou o motivo: inexistente, revogado, encerrado, lotado, cota_cheia, tipo_invalido.
create or replace function public.fn_producao_convidado_pedir(p_hash text, p_solicitante text, p_nome text, p_afiliacao text, p_tipo uuid, p_quantidade integer)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.producao_convidados_links%rowtype;
begin
  select * into v_link from public.producao_convidados_links where token_hash = p_hash;
  if not found then return 'inexistente'; end if;
  if v_link.revogado_em is not null then return 'revogado'; end if;
  if v_link.corte_em <= now() then return 'encerrado'; end if;
  if (select count(*) from public.producao_convidados c where c.sessao_id = v_link.sessao_id and c.solicitante is not null) >= v_link.limite then return 'lotado'; end if;
  begin
    insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome, afiliacao, quantidade, situacao, solicitante)
    values (v_link.organization_id, v_link.sessao_id, p_tipo, p_nome, nullif(btrim(coalesce(p_afiliacao, '')), ''), p_quantidade, 'pedido', p_solicitante);
  exception when check_violation then
    if sqlerrm = 'cota_excedida' then return 'cota_cheia'; end if;
    if sqlerrm in ('tipo_arquivado', 'tipo_de_outra_organizacao') then return 'tipo_invalido'; end if;
    raise;
  end;
  return 'ok';
end;
$$;

revoke execute on function public.fn_producao_convidados_link_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_convidados_gerar_link(uuid, timestamptz, text, integer) from public, anon;
grant execute on function public.fn_producao_convidados_gerar_link(uuid, timestamptz, text, integer) to authenticated;
revoke execute on function public.fn_producao_convidado_pedir(text, text, text, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.fn_producao_convidado_pedir(text, text, text, text, uuid, integer) to service_role;
revoke all on public.producao_convidados_links from anon, authenticated;
-- O hash do código nunca sai para o navegador: a produção lê as colunas do link menos ele.
grant select (id, organization_id, sessao_id, titulo, corte_em, limite, revogado_em, criado_por, created_at, updated_at) on public.producao_convidados_links to authenticated;
grant insert (organization_id, sessao_id, token_hash, titulo, corte_em, limite, criado_por) on public.producao_convidados_links to authenticated;
grant update (token_hash, titulo, corte_em, limite, revogado_em) on public.producao_convidados_links to authenticated;
grant delete on public.producao_convidados_links to authenticated;

comment on table public.producao_convidados_links is 'Link de pedidos de convidados de uma sessão (só o hash do código é guardado), com horário de corte, título e limite de pedidos.';
comment on column public.producao_convidados.solicitante is 'Quem pediu o convidado pelo link de pedidos (nome digitado na página pública); vazio quando a produção cadastrou.';
