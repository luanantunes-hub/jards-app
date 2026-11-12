-- PD6.9 (primeiro corte): convite em massa com resposta sem login.
--
-- producao_convites: um convite por pessoa e temporada, com um link próprio (só o hash do código fica guardado). A pessoa abre o
-- link no celular, sem conta, e responde se vai ou não, quando chega e quando sai e deixa uma observação; a produção vê tudo
-- numa lista. Quem responde pela página pública é o servidor, com a chave de serviço, pela função
-- fn_producao_convite_responder (só service_role). A produção gera ou renova os links de várias pessoas de uma vez pela
-- fn_producao_convite_gerar (security invoker: as regras de acesso de quem chama valem) e vê o código só nessa hora.
--
-- Sem saúde: o convite NÃO pede alergia nem restrição alimentar (esperam a política de dados pessoais e a autorização da
-- pessoa); a observação é texto livre curto e a página pede para não pôr dado de saúde nela. Nada de dinheiro.
-- Acesso: o da temporada (quem lê a temporada lê os convites; quem edita e vê a temporada escreve); a pessoa convidada tem de
-- estar à vista de quem grava. O histórico guarda o convite e deixa de fora o hash do código, as datas e horas de viagem e a
-- observação (a produção as lê na própria linha). Apagar: o convite sai com a temporada; a pessoa convidada não se apaga.
--
-- Expansão: uma tabela nova e vazia, duas funções de negócio, uma de gatilho e a função do histórico trocada (create or
-- replace, mesma assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_convites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  temporada_id uuid not null references public.producao_temporadas (id) on delete cascade,
  pessoa_id uuid not null references public.producao_pessoas (id) on delete restrict,
  token_hash text,
  link_expira_em timestamptz,
  link_revogado_em timestamptz,
  resposta text not null default 'pendente',
  chegada_dia date,
  chegada_hora time,
  saida_dia date,
  saida_hora time,
  observacao text,
  respondido_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_convites_pessoa_key unique (temporada_id, pessoa_id),
  constraint producao_convites_token_hash_key unique (token_hash),
  constraint producao_convites_token_hash_formato_check check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  constraint producao_convites_resposta_check check (resposta in ('pendente', 'vou', 'nao_vou')),
  constraint producao_convites_observacao_check check (observacao is null or char_length(btrim(observacao)) between 1 and 500),
  constraint producao_convites_viagem_check check (resposta = 'vou' or (chegada_dia is null and chegada_hora is null and saida_dia is null and saida_hora is null)),
  constraint producao_convites_periodo_check check (chegada_dia is null or saida_dia is null or saida_dia >= chegada_dia)
);

create index if not exists producao_convites_org_idx on public.producao_convites (organization_id);
create index if not exists producao_convites_temporada_idx on public.producao_convites (temporada_id);
create index if not exists producao_convites_pessoa_idx on public.producao_convites (pessoa_id);

-- Coerência: a organização, a temporada e a pessoa não mudam; a temporada e a pessoa são da organização.
-- Erros (check_violation): organizacao_nao_muda, temporada_nao_muda, pessoa_nao_muda, temporada_de_outra_organizacao, pessoa_de_outra_organizacao.
create or replace function public.fn_producao_convite_coerencia()
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
  if tg_op = 'UPDATE' and new.pessoa_id is distinct from old.pessoa_id then
    raise exception 'pessoa_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id) then
    raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.producao_pessoas p where p.id = new.pessoa_id and p.organization_id = new.organization_id) then
    raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_convites_coerencia
  before insert or update of organization_id, temporada_id, pessoa_id on public.producao_convites
  for each row execute function public.fn_producao_convite_coerencia();
create or replace trigger producao_convites_updated_at
  before update on public.producao_convites
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_convites_historico
  after insert or update or delete on public.producao_convites
  for each row execute function public.fn_producao_historico('token_hash,chegada_dia,chegada_hora,saida_dia,saida_hora,observacao', 'resposta');

-- Quem vê o histórico: o texto de 20261114300000_producao_hospedagens.sql com um ramo novo no fim.
create or replace function public.auth_producao_ve_historico(p_org uuid, p_entidade text, p_entidade_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(case p_entidade
    when 'producao_obras' then exists (select 1 from public.producao_obras x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_temporadas' then exists (select 1 from public.producao_temporadas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_datas' then exists (select 1 from public.producao_datas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_blocos' then exists (select 1 from public.producao_blocos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_espacos' then exists (select 1 from public.producao_espacos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_salas' then exists (select 1 from public.producao_salas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_funcoes' then exists (select 1 from public.producao_funcoes x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_arquivos' then exists (select 1 from public.producao_arquivos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_pessoas' then exists (select 1 from public.producao_pessoas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_vinculos' then exists (select 1 from public.producao_vinculos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_escalas' then exists (select 1 from public.producao_escalas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_cartoes_dia' then exists (select 1 from public.producao_cartoes_dia x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_tarefas' then exists (select 1 from public.producao_tarefas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_notas' then exists (select 1 from public.producao_notas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_modelos_dia' then exists (select 1 from public.producao_modelos_dia x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_pautas' then exists (select 1 from public.producao_pautas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_itens' then exists (select 1 from public.producao_itens x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_plantas' then exists (select 1 from public.producao_plantas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_riders' then exists (select 1 from public.producao_riders x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_equipamentos' then exists (select 1 from public.producao_equipamentos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_turnos' then exists (select 1 from public.producao_turnos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_licencas' then exists (select 1 from public.producao_licencas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_modelos_acerto' then exists (select 1 from public.producao_modelos_acerto x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_acertos' then exists (select 1 from public.producao_acertos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_sessoes' then exists (select 1 from public.producao_sessoes x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_sites' then exists (select 1 from public.producao_sites x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_site_paginas' then exists (select 1 from public.producao_site_paginas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_veiculos' then exists (select 1 from public.producao_veiculos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_deslocamentos' then exists (select 1 from public.producao_deslocamentos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_hospedagens' then exists (select 1 from public.producao_hospedagens x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_convites' then exists (select 1 from public.producao_convites x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

-- Gera (ou renova) o convite de cada pessoa da lista para a temporada e devolve uma lista de {pessoa_id, codigo}, com o código de cada um, que aparece só esta vez;
-- o banco guarda o hash. O link vale de 1 a 90 dias (o app usa 30). Quem já respondeu mantém a resposta e ganha um link novo (o
-- anterior deixa de valer). Pessoas que quem chama não vê, ou de outra organização, não entram. Erros: P0001 prazo_invalido,
-- P0002 temporada_nao_encontrada.
create or replace function public.fn_producao_convite_gerar(p_temporada uuid, p_pessoas uuid[], p_dias integer)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_org uuid;
  v_pessoa uuid;
  v_codigo text;
  v_saida jsonb := '[]'::jsonb;
begin
  if p_dias is null or p_dias < 1 or p_dias > 90 then
    raise exception 'prazo_invalido';
  end if;
  select t.organization_id into v_org from public.producao_temporadas t where t.id = p_temporada;
  if v_org is null then
    raise exception 'temporada_nao_encontrada' using errcode = 'P0002';
  end if;
  for v_pessoa in select distinct x from unnest(p_pessoas) as x loop
    if not exists (select 1 from public.producao_pessoas p where p.id = v_pessoa and p.organization_id = v_org) then
      continue;
    end if;
    v_codigo := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
    -- Atualiza o convite que já existe; se não houver, cria. (Sem ON CONFLICT: ele leria a coluna do hash, que o navegador não lê.)
    update public.producao_convites
    set token_hash = encode(extensions.digest(v_codigo, 'sha256'), 'hex'), link_expira_em = now() + make_interval(days => p_dias), link_revogado_em = null
    where temporada_id = p_temporada and pessoa_id = v_pessoa;
    if not found then
      insert into public.producao_convites (organization_id, temporada_id, pessoa_id, token_hash, link_expira_em, criado_por)
      values (v_org, p_temporada, v_pessoa, encode(extensions.digest(v_codigo, 'sha256'), 'hex'), now() + make_interval(days => p_dias), auth.uid());
    end if;
    v_saida := v_saida || jsonb_build_object('pessoa_id', v_pessoa, 'codigo', v_codigo);
  end loop;
  return v_saida;
end;
$$;

-- A resposta da pessoa pelo link: só a página pública chama (chave de serviço); o navegador não executa. O servidor já conferiu
-- o formato dos valores; aqui ficam a conferência do link e a gravação. Devolve 'ok' ou o motivo: inexistente, revogado,
-- expirado, temporada_cancelada. Quem responde "não vou" tem as datas e horas limpas.
create or replace function public.fn_producao_convite_responder(
  p_hash text, p_resposta text, p_chegada_dia date, p_chegada_hora time, p_saida_dia date, p_saida_hora time, p_observacao text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_convite public.producao_convites%rowtype;
begin
  if p_resposta is null or p_resposta not in ('vou', 'nao_vou') then
    raise exception 'resposta_invalida' using errcode = 'check_violation';
  end if;
  select * into v_convite from public.producao_convites where token_hash = p_hash for update;
  if not found then return 'inexistente'; end if;
  if v_convite.link_revogado_em is not null then return 'revogado'; end if;
  if v_convite.link_expira_em is null or v_convite.link_expira_em < now() then return 'expirado'; end if;
  if exists (select 1 from public.producao_temporadas t where t.id = v_convite.temporada_id and t.situacao = 'cancelada') then return 'temporada_cancelada'; end if;
  update public.producao_convites
  set resposta = p_resposta,
      chegada_dia = case when p_resposta = 'vou' then p_chegada_dia end, chegada_hora = case when p_resposta = 'vou' then p_chegada_hora end,
      saida_dia = case when p_resposta = 'vou' then p_saida_dia end, saida_hora = case when p_resposta = 'vou' then p_saida_hora end,
      observacao = nullif(btrim(coalesce(p_observacao, '')), ''), respondido_em = now()
  where id = v_convite.id;
  return 'ok';
end;
$$;

alter table public.producao_convites enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convites' and policyname = 'producao_convites: le') then
    create policy "producao_convites: le" on public.producao_convites for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_temporadas t where t.id = producao_convites.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convites' and policyname = 'producao_convites: leitura sem assinatura') then
    create policy "producao_convites: leitura sem assinatura" on public.producao_convites for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_temporadas t where t.id = producao_convites.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convites' and policyname = 'producao_convites: insere') then
    create policy "producao_convites: insere" on public.producao_convites for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas t where t.id = producao_convites.temporada_id) and exists (select 1 from public.producao_pessoas p where p.id = producao_convites.pessoa_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convites' and policyname = 'producao_convites: edita') then
    create policy "producao_convites: edita" on public.producao_convites for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas t where t.id = producao_convites.temporada_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas t where t.id = producao_convites.temporada_id) and exists (select 1 from public.producao_pessoas p where p.id = producao_convites.pessoa_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convites' and policyname = 'producao_convites: apaga') then
    create policy "producao_convites: apaga" on public.producao_convites for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas t where t.id = producao_convites.temporada_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_convite_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_convite_gerar(uuid, uuid[], integer) from public, anon;
grant execute on function public.fn_producao_convite_gerar(uuid, uuid[], integer) to authenticated;
revoke execute on function public.fn_producao_convite_responder(text, text, date, time, date, time, text) from public, anon, authenticated;
grant execute on function public.fn_producao_convite_responder(text, text, date, time, date, time, text) to service_role;
revoke all on public.producao_convites from anon, authenticated;
-- O hash do código nunca sai para o navegador: a produção lê as colunas do convite menos ele.
grant select (id, organization_id, temporada_id, pessoa_id, link_expira_em, link_revogado_em, resposta, chegada_dia, chegada_hora, saida_dia, saida_hora, observacao, respondido_em, criado_por, created_at, updated_at)
  on public.producao_convites to authenticated;
-- Quem edita muda o link (a função de gerar é `security invoker` e precisa destas colunas) e apaga o convite.
grant insert (organization_id, temporada_id, pessoa_id, token_hash, link_expira_em, criado_por) on public.producao_convites to authenticated;
grant update (token_hash, link_expira_em, link_revogado_em) on public.producao_convites to authenticated;
grant delete on public.producao_convites to authenticated;

comment on table public.producao_convites is
  'Convite de uma pessoa para uma temporada, com link próprio (só o hash do código é guardado) e a resposta dela sem conta: vou ou não vou, chegada, saída e observação.';
