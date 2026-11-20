-- PD7.3 (primeiro corte): credenciais dos convidados e a leitura na porta.
--
-- producao_credenciais: a credencial de um convidado confirmado: um código que só o convidado conhece (guardado só o hash, como nos outros links) e
-- quantas entradas já foram usadas, até o número de lugares do convite. Uma por convidado; emitir de novo troca o código.
-- producao_porta_leituras: o registro da porta, uma linha por leitura, com o resultado (permitido, já entrou ou negado), o motivo e quem leu. É só de
-- acrescentar: ninguém altera nem apaga uma leitura (ela sai com a sessão). É a presença da sessão.
--
-- Funções: `fn_producao_credenciais_emitir(sessao)` cria a credencial de cada convidado confirmado que ainda não tem e devolve os
-- códigos, que aparecem só nessa hora; `fn_producao_credencial_reemitir(convidado)` troca o código de uma; `fn_producao_porta_ler(sessao,
-- código)` confere o código, conta a entrada e devolve o resultado; `fn_producao_credencial_achar` é só o auxiliar que acha a
-- credencial pelo código sem expor o hash a quem lê a tabela. Quem lê na porta é quem edita a produção e vê a sessão.
-- Código: 16 letras e números (0-9 e A-F), 64 bits, escrito em grupos de 4; a leitura ignora traços, espaços e caixa.
--
-- Acesso: o da sessão (e, por ela, o da pauta e do espaço: o recorte "só onde está vinculado" vale). O hash nunca sai para o navegador.
-- Expansão: duas tabelas novas e vazias, uma função de gatilho cada, quatro funções de negócio. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_credenciais (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sessao_id uuid not null references public.producao_sessoes (id) on delete cascade,
  convidado_id uuid not null references public.producao_convidados (id) on delete cascade,
  token_hash text not null,
  entradas integer not null default 0,
  ultima_entrada_em timestamptz,
  revogada_em timestamptz,
  emitida_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_credenciais_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint producao_credenciais_entradas_check check (entradas between 0 and 20),
  constraint producao_credenciais_hash_key unique (token_hash),
  constraint producao_credenciais_convidado_key unique (convidado_id)
);

create index if not exists producao_credenciais_org_idx on public.producao_credenciais (organization_id);
create index if not exists producao_credenciais_sessao_idx on public.producao_credenciais (sessao_id);

create table if not exists public.producao_porta_leituras (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sessao_id uuid not null references public.producao_sessoes (id) on delete cascade,
  credencial_id uuid references public.producao_credenciais (id) on delete set null,
  resultado text not null,
  motivo text,
  lida_em timestamptz not null default now(),
  lida_por uuid references auth.users (id) on delete set null,
  constraint producao_porta_leituras_resultado_check check (resultado in ('permitido', 'ja_entrou', 'negado')),
  constraint producao_porta_leituras_motivo_check check (motivo is null or char_length(motivo) <= 40)
);

create index if not exists producao_porta_leituras_org_idx on public.producao_porta_leituras (organization_id);
create index if not exists producao_porta_leituras_sessao_idx on public.producao_porta_leituras (sessao_id, lida_em);
create index if not exists producao_porta_leituras_credencial_idx on public.producao_porta_leituras (credencial_id);

-- Coerência da credencial: a organização, a sessão e o convidado não mudam; o convidado é daquela sessão e organização; as entradas
-- não passam dos lugares do convite. Erros (check_violation): organizacao_nao_muda, sessao_nao_muda, convidado_nao_muda,
-- convidado_de_outra_sessao, entradas_alem_dos_lugares.
create or replace function public.fn_producao_credencial_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lugares integer;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.sessao_id is distinct from old.sessao_id then
    raise exception 'sessao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.convidado_id is distinct from old.convidado_id then
    raise exception 'convidado_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select c.quantidade into v_lugares from public.producao_convidados c
  where c.id = new.convidado_id and c.sessao_id = new.sessao_id and c.organization_id = new.organization_id;
  if not found then
    raise exception 'convidado_de_outra_sessao' using errcode = 'check_violation';
  end if;
  if new.entradas > v_lugares then
    raise exception 'entradas_alem_dos_lugares' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência da leitura: a sessão é da organização e a credencial, quando há, é da mesma sessão. Só de acrescentar.
-- Erros (check_violation): sessao_de_outra_organizacao, credencial_de_outra_sessao.
create or replace function public.fn_producao_porta_leitura_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.organization_id is null then
    return new;
  end if;
  if not exists (select 1 from public.producao_sessoes s where s.id = new.sessao_id and s.organization_id = new.organization_id) then
    raise exception 'sessao_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.credencial_id is not null
     and not exists (select 1 from public.producao_credenciais c where c.id = new.credencial_id and c.sessao_id = new.sessao_id) then
    raise exception 'credencial_de_outra_sessao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_credenciais_coerencia
  before insert or update on public.producao_credenciais
  for each row execute function public.fn_producao_credencial_coerencia();
create or replace trigger producao_credenciais_updated_at
  before update on public.producao_credenciais
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_porta_leituras_coerencia
  before insert on public.producao_porta_leituras
  for each row execute function public.fn_producao_porta_leitura_coerencia();

alter table public.producao_credenciais enable row level security;
alter table public.producao_porta_leituras enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_credenciais' and policyname = 'producao_credenciais: le') then
    create policy "producao_credenciais: le" on public.producao_credenciais for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_sessoes s where s.id = producao_credenciais.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_credenciais' and policyname = 'producao_credenciais: leitura sem assinatura') then
    create policy "producao_credenciais: leitura sem assinatura" on public.producao_credenciais for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_sessoes s where s.id = producao_credenciais.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_credenciais' and policyname = 'producao_credenciais: insere') then
    create policy "producao_credenciais: insere" on public.producao_credenciais for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_credenciais.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_credenciais' and policyname = 'producao_credenciais: edita') then
    create policy "producao_credenciais: edita" on public.producao_credenciais for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_credenciais.sessao_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_credenciais.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_credenciais' and policyname = 'producao_credenciais: apaga') then
    create policy "producao_credenciais: apaga" on public.producao_credenciais for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_credenciais.sessao_id));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_porta_leituras' and policyname = 'producao_porta_leituras: le') then
    create policy "producao_porta_leituras: le" on public.producao_porta_leituras for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_sessoes s where s.id = producao_porta_leituras.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_porta_leituras' and policyname = 'producao_porta_leituras: leitura sem assinatura') then
    create policy "producao_porta_leituras: leitura sem assinatura" on public.producao_porta_leituras for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_sessoes s where s.id = producao_porta_leituras.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_porta_leituras' and policyname = 'producao_porta_leituras: insere') then
    create policy "producao_porta_leituras: insere" on public.producao_porta_leituras for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_porta_leituras.sessao_id));
  end if;
end
$$;

-- Emite a credencial de cada convidado confirmado da sessão que ainda não tem, e devolve os códigos (aparecem só agora).
-- As regras de acesso de quem chama valem (security invoker). Erros: P0002 sessao_nao_encontrada.
create or replace function public.fn_producao_credenciais_emitir(p_sessao uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_org uuid;
  v_conv record;
  v_codigo text;
  v_saida jsonb := '[]'::jsonb;
begin
  select s.organization_id into v_org from public.producao_sessoes s where s.id = p_sessao;
  if v_org is null then
    raise exception 'sessao_nao_encontrada' using errcode = 'P0002';
  end if;
  for v_conv in
    select c.id, c.nome, c.quantidade from public.producao_convidados c
    where c.sessao_id = p_sessao and c.situacao = 'confirmado'
      and not exists (select 1 from public.producao_credenciais k where k.convidado_id = c.id)
    order by c.nome
  loop
    v_codigo := upper(encode(extensions.gen_random_bytes(8), 'hex'));
    insert into public.producao_credenciais (organization_id, sessao_id, convidado_id, token_hash, emitida_por)
    values (v_org, p_sessao, v_conv.id, encode(extensions.digest(v_codigo, 'sha256'), 'hex'), auth.uid());
    v_saida := v_saida || jsonb_build_object('convidado_id', v_conv.id, 'nome', v_conv.nome, 'lugares', v_conv.quantidade, 'codigo', v_codigo);
  end loop;
  return v_saida;
end;
$$;

-- Troca o código da credencial de um convidado (e a reativa, se estava revogada) e devolve o código novo, que aparece só agora.
-- Erros: P0002 credencial_nao_encontrada.
create or replace function public.fn_producao_credencial_reemitir(p_convidado uuid)
returns text
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_codigo text := upper(encode(extensions.gen_random_bytes(8), 'hex'));
begin
  update public.producao_credenciais
  set token_hash = encode(extensions.digest(v_codigo, 'sha256'), 'hex'), revogada_em = null
  where convidado_id = p_convidado;
  if not found then
    raise exception 'credencial_nao_encontrada' using errcode = 'P0002';
  end if;
  return v_codigo;
end;
$$;

-- Auxiliar: acha a credencial de uma sessão pelo código lido, sem dar a quem lê a tabela o hash dela. Devolve só o id.
create or replace function public.fn_producao_credencial_achar(p_sessao uuid, p_codigo text)
returns uuid
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select c.id from public.producao_credenciais c
  where c.sessao_id = p_sessao
    and c.token_hash = encode(extensions.digest(upper(regexp_replace(coalesce(p_codigo, ''), '[^0-9A-Fa-f]', '', 'g')), 'sha256'), 'hex');
$$;

-- A leitura na porta: confere o código, conta a entrada e registra. Devolve {resultado, motivo, nome, afiliacao, tipo, lugares,
-- entradas, restantes}. Resultados: permitido (entrou mais um), ja_entrou (todos os lugares já entraram) e negado (motivo:
-- desconhecida, revogada ou nao_confirmado). Quem lê precisa editar a produção e ver a sessão (security invoker).
-- Erros: P0002 sessao_nao_encontrada, 42501 sem permissão.
create or replace function public.fn_producao_porta_ler(p_sessao uuid, p_codigo text)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_org uuid;
  v_id uuid;
  v_cred record;
  v_resultado text;
  v_motivo text;
  v_entradas integer;
begin
  select s.organization_id into v_org from public.producao_sessoes s where s.id = p_sessao;
  if v_org is null then
    raise exception 'sessao_nao_encontrada' using errcode = 'P0002';
  end if;
  if not public.auth_producao_pode(v_org, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  v_id := public.fn_producao_credencial_achar(p_sessao, p_codigo);
  if v_id is null then
    insert into public.producao_porta_leituras (organization_id, sessao_id, resultado, motivo, lida_por) values (v_org, p_sessao, 'negado', 'desconhecida', auth.uid());
    return jsonb_build_object('resultado', 'negado', 'motivo', 'desconhecida');
  end if;
  select k.id, k.entradas, k.revogada_em, c.nome, c.afiliacao, c.quantidade, c.situacao, t.nome as tipo
  into v_cred
  from public.producao_credenciais k
  join public.producao_convidados c on c.id = k.convidado_id
  left join public.producao_credencial_tipos t on t.id = c.tipo_id
  where k.id = v_id
  for update of k;
  v_entradas := v_cred.entradas;
  if v_cred.revogada_em is not null then
    v_resultado := 'negado'; v_motivo := 'revogada';
  elsif v_cred.situacao <> 'confirmado' then
    v_resultado := 'negado'; v_motivo := 'nao_confirmado';
  elsif v_cred.entradas >= v_cred.quantidade then
    v_resultado := 'ja_entrou';
  else
    update public.producao_credenciais set entradas = entradas + 1, ultima_entrada_em = now() where id = v_id;
    v_entradas := v_cred.entradas + 1;
    v_resultado := 'permitido';
  end if;
  insert into public.producao_porta_leituras (organization_id, sessao_id, credencial_id, resultado, motivo, lida_por)
  values (v_org, p_sessao, v_id, v_resultado, v_motivo, auth.uid());
  return jsonb_build_object('resultado', v_resultado, 'motivo', v_motivo, 'nome', v_cred.nome, 'afiliacao', v_cred.afiliacao, 'tipo', v_cred.tipo,
                            'lugares', v_cred.quantidade, 'entradas', v_entradas, 'restantes', v_cred.quantidade - v_entradas);
end;
$$;

revoke execute on function public.fn_producao_credencial_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_porta_leitura_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_credenciais_emitir(uuid) from public, anon;
revoke execute on function public.fn_producao_credencial_reemitir(uuid) from public, anon;
revoke execute on function public.fn_producao_credencial_achar(uuid, text) from public, anon;
revoke execute on function public.fn_producao_porta_ler(uuid, text) from public, anon;
grant execute on function public.fn_producao_credenciais_emitir(uuid) to authenticated;
grant execute on function public.fn_producao_credencial_reemitir(uuid) to authenticated;
grant execute on function public.fn_producao_credencial_achar(uuid, text) to authenticated;
grant execute on function public.fn_producao_porta_ler(uuid, text) to authenticated;
revoke all on public.producao_credenciais, public.producao_porta_leituras from anon, authenticated;
-- O hash do código nunca sai para o navegador: a produção lê as colunas da credencial menos ele.
grant select (id, organization_id, sessao_id, convidado_id, entradas, ultima_entrada_em, revogada_em, emitida_por, created_at, updated_at) on public.producao_credenciais to authenticated;
grant insert (organization_id, sessao_id, convidado_id, token_hash, emitida_por) on public.producao_credenciais to authenticated;
grant update (token_hash, entradas, ultima_entrada_em, revogada_em) on public.producao_credenciais to authenticated;
grant delete on public.producao_credenciais to authenticated;
grant select, insert on public.producao_porta_leituras to authenticated;

comment on table public.producao_credenciais is 'Credencial de um convidado confirmado: só o hash do código é guardado; conta as entradas usadas até o número de lugares.';
comment on table public.producao_porta_leituras is 'Registro da porta: uma linha por leitura (permitido, já entrou ou negado). Só de acrescentar; é a presença da sessão.';
