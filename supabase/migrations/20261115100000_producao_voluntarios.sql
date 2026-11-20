-- PD7.11 (primeiro corte): voluntários, inscrição por link e aprovação.
--
-- producao_voluntarios_links: o link de inscrição de voluntários de uma temporada (um por temporada, só o hash do código fica guardado, validade, vagas
-- opcionais e um título que a página mostra). producao_voluntarios: quem se inscreveu pelo link (nome, um contato, a disponibilidade em texto
-- livre curto, o momento em que concordou com o uso dos dados, e a situação: inscrito, aprovado ou recusado). Quem se inscreve não
-- tem conta: a página pública fala com o servidor, que grava pela função fn_producao_voluntario_inscrever (só service_role). A
-- produção aprova pela fn_producao_voluntario_aprovar, que cria a pessoa da equipe (tipo "apoio") e a liga à inscrição, para ela
-- poder ser escalada nos turnos pelas telas que já existem.
--
-- Dado pessoal: nome e um contato (e-mail ou telefone), só para organizar o voluntariado; a pessoa marca que concorda antes de enviar.
-- Sem CPF, sem documento, sem saúde. O histórico guarda o nome e deixa o contato e a disponibilidade de fora. O texto de privacidade
-- que cobre esta coleta é decisão do dono (pré-requisito de dados pessoais).
--
-- Acesso: o da temporada (quem lê a temporada lê; quem edita e vê a temporada escreve). O hash do código nunca sai para o navegador.
-- Apagar: sai com a temporada; apagar a pessoa aprovada só solta a ligação.
--
-- Expansão: duas tabelas novas e vazias, três funções de negócio, duas de gatilho e a função do histórico trocada (create or replace,
-- mesma assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_voluntarios_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  temporada_id uuid not null references public.producao_temporadas (id) on delete cascade,
  token_hash text,
  titulo text,
  vagas integer,
  expira_em timestamptz,
  revogado_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_voluntarios_links_temporada_key unique (temporada_id),
  constraint producao_voluntarios_links_token_hash_key unique (token_hash),
  constraint producao_voluntarios_links_token_hash_formato_check check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  constraint producao_voluntarios_links_titulo_check check (titulo is null or char_length(btrim(titulo)) between 1 and 120),
  constraint producao_voluntarios_links_vagas_check check (vagas is null or vagas between 1 and 5000)
);

create index if not exists producao_voluntarios_links_org_idx on public.producao_voluntarios_links (organization_id);

create table if not exists public.producao_voluntarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  temporada_id uuid not null references public.producao_temporadas (id) on delete cascade,
  nome text not null,
  email text,
  telefone text,
  disponibilidade text,
  consentiu_em timestamptz not null default now(),
  situacao text not null default 'inscrito',
  pessoa_id uuid references public.producao_pessoas (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_voluntarios_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint producao_voluntarios_email_check check (email is null or (char_length(email) between 3 and 200 and email ~ '^[^@\s]+@[^@\s]+$')),
  constraint producao_voluntarios_telefone_check check (telefone is null or char_length(btrim(telefone)) between 5 and 30),
  constraint producao_voluntarios_contato_check check (email is not null or telefone is not null),
  constraint producao_voluntarios_disponibilidade_check check (disponibilidade is null or char_length(btrim(disponibilidade)) between 1 and 500),
  constraint producao_voluntarios_situacao_check check (situacao in ('inscrito', 'aprovado', 'recusado'))
);

create index if not exists producao_voluntarios_org_idx on public.producao_voluntarios (organization_id);
create index if not exists producao_voluntarios_temporada_idx on public.producao_voluntarios (temporada_id, created_at);
create index if not exists producao_voluntarios_pessoa_idx on public.producao_voluntarios (pessoa_id) where pessoa_id is not null;
create unique index if not exists producao_voluntarios_email_idx on public.producao_voluntarios (temporada_id, lower(email)) where email is not null;

-- Coerência do link: a organização e a temporada não mudam; a temporada é da organização.
-- Erros (check_violation): organizacao_nao_muda, temporada_nao_muda, temporada_de_outra_organizacao.
create or replace function public.fn_producao_voluntarios_link_coerencia()
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
    return new;
  end if;
  if not exists (select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id) then
    raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência da inscrição: a organização e a temporada não mudam; a temporada e a pessoa ligada são da organização.
-- Erros: organizacao_nao_muda, temporada_nao_muda, temporada_de_outra_organizacao, pessoa_de_outra_organizacao.
create or replace function public.fn_producao_voluntario_coerencia()
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
    return new;
  end if;
  if not exists (select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id) then
    raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.pessoa_id is not null and not exists (select 1 from public.producao_pessoas p where p.id = new.pessoa_id and p.organization_id = new.organization_id) then
    raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_voluntarios_links_coerencia
  before insert or update of organization_id, temporada_id on public.producao_voluntarios_links
  for each row execute function public.fn_producao_voluntarios_link_coerencia();
create or replace trigger producao_voluntarios_links_updated_at
  before update on public.producao_voluntarios_links
  for each row execute function public.fn_producao_updated_at();

create or replace trigger producao_voluntarios_coerencia
  before insert or update of organization_id, temporada_id, pessoa_id on public.producao_voluntarios
  for each row execute function public.fn_producao_voluntario_coerencia();
create or replace trigger producao_voluntarios_updated_at
  before update on public.producao_voluntarios
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_voluntarios_historico
  after insert or update or delete on public.producao_voluntarios
  for each row execute function public.fn_producao_historico('email,telefone,disponibilidade', 'nome');

-- Quem vê o histórico: o texto de 20261115000000_producao_ocorrencias.sql com um ramo novo no fim.
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
    when 'producao_ocorrencias' then exists (select 1 from public.producao_ocorrencias x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_voluntarios' then exists (select 1 from public.producao_voluntarios x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

-- Gera (ou renova) o link de inscrição de voluntários da temporada e devolve o código, que aparece só esta vez; o banco guarda o hash.
-- O link vale de 1 a 180 dias; `p_vagas` limita as inscrições (0 = sem limite). As regras de acesso de quem chama valem (security invoker).
-- Erros: P0001 prazo_invalido, P0002 temporada_nao_encontrada.
create or replace function public.fn_producao_voluntarios_gerar_link(p_temporada uuid, p_dias integer, p_titulo text, p_vagas integer)
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
  v_vagas integer := nullif(p_vagas, 0);
begin
  if p_dias is null or p_dias < 1 or p_dias > 180 then
    raise exception 'prazo_invalido';
  end if;
  select t.organization_id into v_org from public.producao_temporadas t where t.id = p_temporada;
  if v_org is null then
    raise exception 'temporada_nao_encontrada' using errcode = 'P0002';
  end if;
  v_codigo := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_hash := encode(extensions.digest(v_codigo, 'sha256'), 'hex');
  -- Atualiza o link que já existe; se não houver, cria. (Sem ON CONFLICT: ele leria a coluna do hash, que o navegador não lê.)
  update public.producao_voluntarios_links
  set token_hash = v_hash, expira_em = now() + make_interval(days => p_dias), revogado_em = null, titulo = v_titulo, vagas = v_vagas
  where temporada_id = p_temporada;
  if not found then
    insert into public.producao_voluntarios_links (organization_id, temporada_id, token_hash, expira_em, titulo, vagas, criado_por)
    values (v_org, p_temporada, v_hash, now() + make_interval(days => p_dias), v_titulo, v_vagas, auth.uid());
  end if;
  return v_codigo;
end;
$$;

-- A inscrição pelo link: só a página pública chama (chave de serviço); o navegador não executa. O servidor já conferiu o formato dos
-- valores; aqui ficam a conferência do link, o limite de vagas, o e-mail repetido e a gravação. Devolve 'ok' ou o motivo:
-- inexistente, revogado, expirado, temporada_cancelada, lotado, ja_inscrito.
create or replace function public.fn_producao_voluntario_inscrever(p_hash text, p_nome text, p_email text, p_telefone text, p_disponibilidade text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.producao_voluntarios_links%rowtype;
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  select * into v_link from public.producao_voluntarios_links where token_hash = p_hash;
  if not found then return 'inexistente'; end if;
  if v_link.revogado_em is not null then return 'revogado'; end if;
  if v_link.expira_em is null or v_link.expira_em < now() then return 'expirado'; end if;
  if exists (select 1 from public.producao_temporadas t where t.id = v_link.temporada_id and t.situacao = 'cancelada') then return 'temporada_cancelada'; end if;
  if v_link.vagas is not null and (select count(*) from public.producao_voluntarios v where v.temporada_id = v_link.temporada_id) >= v_link.vagas then return 'lotado'; end if;
  if v_email is not null and exists (select 1 from public.producao_voluntarios v where v.temporada_id = v_link.temporada_id and lower(v.email) = v_email) then return 'ja_inscrito'; end if;
  insert into public.producao_voluntarios (organization_id, temporada_id, nome, email, telefone, disponibilidade)
  values (v_link.organization_id, v_link.temporada_id, btrim(p_nome), v_email, nullif(btrim(coalesce(p_telefone, '')), ''), nullif(btrim(coalesce(p_disponibilidade, '')), ''));
  return 'ok';
end;
$$;

-- A produção aprova uma inscrição: cria a pessoa da equipe (tipo "apoio", com o nome e o contato) e a liga à inscrição. Devolve o id da
-- pessoa. As regras de acesso de quem chama valem (security invoker): quem não edita não aprova. Aprovar de novo devolve a mesma pessoa.
-- Erros: P0002 inscricao_nao_encontrada, check_violation inscricao_recusada.
create or replace function public.fn_producao_voluntario_aprovar(p_voluntario uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v public.producao_voluntarios%rowtype;
  v_pessoa uuid;
begin
  select * into v from public.producao_voluntarios where id = p_voluntario;
  if not found then
    raise exception 'inscricao_nao_encontrada' using errcode = 'P0002';
  end if;
  if v.pessoa_id is not null then
    update public.producao_voluntarios set situacao = 'aprovado' where id = p_voluntario;
    return v.pessoa_id;
  end if;
  insert into public.producao_pessoas (organization_id, nome, email, telefone, tipo)
  values (v.organization_id, v.nome, v.email, v.telefone, 'apoio')
  returning id into v_pessoa;
  update public.producao_voluntarios set situacao = 'aprovado', pessoa_id = v_pessoa where id = p_voluntario;
  return v_pessoa;
end;
$$;

alter table public.producao_voluntarios_links enable row level security;
alter table public.producao_voluntarios enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_voluntarios_links' and policyname = 'producao_voluntarios_links: le') then
    create policy "producao_voluntarios_links: le" on public.producao_voluntarios_links for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_temporadas t where t.id = producao_voluntarios_links.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_voluntarios_links' and policyname = 'producao_voluntarios_links: leitura sem assinatura') then
    create policy "producao_voluntarios_links: leitura sem assinatura" on public.producao_voluntarios_links for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_temporadas t where t.id = producao_voluntarios_links.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_voluntarios_links' and policyname = 'producao_voluntarios_links: insere') then
    create policy "producao_voluntarios_links: insere" on public.producao_voluntarios_links for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas t where t.id = producao_voluntarios_links.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_voluntarios_links' and policyname = 'producao_voluntarios_links: edita') then
    create policy "producao_voluntarios_links: edita" on public.producao_voluntarios_links for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas t where t.id = producao_voluntarios_links.temporada_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas t where t.id = producao_voluntarios_links.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_voluntarios_links' and policyname = 'producao_voluntarios_links: apaga') then
    create policy "producao_voluntarios_links: apaga" on public.producao_voluntarios_links for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas t where t.id = producao_voluntarios_links.temporada_id));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_voluntarios' and policyname = 'producao_voluntarios: le') then
    create policy "producao_voluntarios: le" on public.producao_voluntarios for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_temporadas t where t.id = producao_voluntarios.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_voluntarios' and policyname = 'producao_voluntarios: leitura sem assinatura') then
    create policy "producao_voluntarios: leitura sem assinatura" on public.producao_voluntarios for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_temporadas t where t.id = producao_voluntarios.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_voluntarios' and policyname = 'producao_voluntarios: insere') then
    create policy "producao_voluntarios: insere" on public.producao_voluntarios for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas t where t.id = producao_voluntarios.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_voluntarios' and policyname = 'producao_voluntarios: edita') then
    create policy "producao_voluntarios: edita" on public.producao_voluntarios for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas t where t.id = producao_voluntarios.temporada_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas t where t.id = producao_voluntarios.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_voluntarios' and policyname = 'producao_voluntarios: apaga') then
    create policy "producao_voluntarios: apaga" on public.producao_voluntarios for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas t where t.id = producao_voluntarios.temporada_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_voluntarios_link_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_voluntario_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_voluntarios_gerar_link(uuid, integer, text, integer) from public, anon;
grant execute on function public.fn_producao_voluntarios_gerar_link(uuid, integer, text, integer) to authenticated;
revoke execute on function public.fn_producao_voluntario_inscrever(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fn_producao_voluntario_inscrever(text, text, text, text, text) to service_role;
revoke execute on function public.fn_producao_voluntario_aprovar(uuid) from public, anon;
grant execute on function public.fn_producao_voluntario_aprovar(uuid) to authenticated;
revoke all on public.producao_voluntarios_links, public.producao_voluntarios from anon, authenticated;
-- O hash do código nunca sai para o navegador: a produção lê as colunas do link menos ele.
grant select (id, organization_id, temporada_id, titulo, vagas, expira_em, revogado_em, criado_por, created_at, updated_at) on public.producao_voluntarios_links to authenticated;
grant insert (organization_id, temporada_id, token_hash, titulo, vagas, expira_em, criado_por) on public.producao_voluntarios_links to authenticated;
grant update (token_hash, titulo, vagas, expira_em, revogado_em) on public.producao_voluntarios_links to authenticated;
grant delete on public.producao_voluntarios_links to authenticated;
grant select, insert, update, delete on public.producao_voluntarios to authenticated;

comment on table public.producao_voluntarios_links is 'Link de inscrição de voluntários de uma temporada (só o hash do código é guardado), com validade, vagas opcionais e título.';
comment on table public.producao_voluntarios is 'Inscrição de voluntário pelo link (nome, um contato, disponibilidade, concordância e situação); aprovar cria a pessoa da equipe.';
