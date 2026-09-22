-- Coordenação flexível entre o captador vinculado e a organização.
-- Não altera o funil, nem exige atualizações periódicas.
alter table public.atribuicoes
  add column if not exists workspace_situacao text,
  add column if not exists workspace_resultado text,
  add column if not exists workspace_resultado_em timestamptz;

create table if not exists public.workspace_acoes (
  id uuid primary key default gen_random_uuid(),
  atribuicao_id uuid not null references public.atribuicoes(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  solicitante_id uuid not null references auth.users(id),
  destinatario text not null check (destinatario in ('captador', 'organizacao')),
  descricao text not null check (char_length(trim(descricao)) between 1 and 2000),
  prazo date,
  status text not null default 'pendente' check (status in ('pendente', 'respondida', 'resolvida')),
  resposta text check (resposta is null or char_length(trim(resposta)) between 1 and 2000),
  respondido_por uuid references auth.users(id),
  respondido_em timestamptz,
  resolvido_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists workspace_acoes_atribuicao_idx
  on public.workspace_acoes(atribuicao_id, created_at desc);
create index if not exists workspace_acoes_destinatario_idx
  on public.workspace_acoes(organization_id, destinatario, status);

-- SECURITY DEFINER faz a mutação; leitura direta continua protegida por RLS.
alter table public.workspace_acoes enable row level security;
drop policy if exists "workspace_acoes: participantes leem" on public.workspace_acoes;
create policy "workspace_acoes: participantes leem" on public.workspace_acoes
for select to authenticated using (exists (
  select 1 from public.atribuicoes a
  join public.captadores c on c.id = a.captador_user_id
  where a.id = workspace_acoes.atribuicao_id
    and a.organization_id = workspace_acoes.organization_id
    and (c.user_id = auth.uid() or exists (
      select 1 from public.organization_members m
      where m.organization_id = a.organization_id
        and m.user_id = auth.uid() and m.papel = 'admin'
    ))
));
revoke all on public.workspace_acoes from anon, authenticated;
grant select on public.workspace_acoes to authenticated;

create or replace function public.fn_workspace_papel(p_atribuicao_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_captador_user uuid;
begin
  select a.organization_id, c.user_id into v_org, v_captador_user
  from public.atribuicoes a
  join public.captadores c on c.id = a.captador_user_id
  where a.id = p_atribuicao_id;
  if not found then raise exception 'Atribuição não encontrada'; end if;
  if v_captador_user = auth.uid() then return 'captador'; end if;
  if exists (select 1 from public.organization_members m
    where m.organization_id = v_org and m.user_id = auth.uid() and m.papel = 'admin')
  then return 'organizacao'; end if;
  raise exception 'Sem acesso a esta atribuição';
end;
$$;

create or replace function public.fn_workspace_obter_coordenacao(p_atribuicao_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_atribuicao record;
begin
  perform public.fn_workspace_papel(p_atribuicao_id);
  select workspace_situacao, workspace_resultado, workspace_resultado_em
    into v_atribuicao from public.atribuicoes where id = p_atribuicao_id;
  return jsonb_build_object('situacao', v_atribuicao.workspace_situacao,
    'resultado', v_atribuicao.workspace_resultado,
    'resultado_em', v_atribuicao.workspace_resultado_em);
end;
$$;

create or replace function public.fn_workspace_definir_situacao(p_atribuicao_id uuid, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_status text;
begin
  perform public.fn_workspace_papel(p_atribuicao_id);
  if char_length(trim(coalesce(p_texto, ''))) not between 1 and 500
  then raise exception 'Descreva a situação em até 500 caracteres'; end if;
  select organization_id, status into v_org, v_status from public.atribuicoes
    where id = p_atribuicao_id for update;
  if v_status <> 'ativa' then raise exception 'A atribuição não está ativa'; end if;
  update public.atribuicoes set workspace_situacao = trim(p_texto) where id = p_atribuicao_id;
  insert into public.atribuicao_notas (atribuicao_id, organization_id, autor_id, autor_email, nota)
  values (p_atribuicao_id, v_org, auth.uid(), coalesce(auth.jwt()->>'email', 'Usuário'),
    'Situação atual: ' || trim(p_texto));
end;
$$;

create or replace function public.fn_workspace_registrar_resultado(p_atribuicao_id uuid, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_status text;
begin
  perform public.fn_workspace_papel(p_atribuicao_id);
  if char_length(trim(coalesce(p_texto, ''))) not between 1 and 2000
  then raise exception 'Descreva o resultado em até 2.000 caracteres'; end if;
  select organization_id, status into v_org, v_status from public.atribuicoes
    where id = p_atribuicao_id for update;
  if v_status <> 'ativa' then raise exception 'A atribuição não está ativa'; end if;
  update public.atribuicoes set workspace_resultado = trim(p_texto), workspace_resultado_em = now()
    where id = p_atribuicao_id;
  insert into public.atribuicao_notas (atribuicao_id, organization_id, autor_id, autor_email, nota)
  values (p_atribuicao_id, v_org, auth.uid(), coalesce(auth.jwt()->>'email', 'Usuário'),
    'Resultado registrado: ' || trim(p_texto));
end;
$$;

create or replace function public.fn_workspace_criar_acao(
  p_atribuicao_id uuid, p_destinatario text, p_descricao text, p_prazo date default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_papel text; v_org uuid; v_status text; v_id uuid;
begin
  v_papel := public.fn_workspace_papel(p_atribuicao_id);
  if p_destinatario is null or p_destinatario not in ('captador', 'organizacao')
    or p_destinatario = v_papel then raise exception 'Escolha o outro lado como destinatário'; end if;
  if char_length(trim(coalesce(p_descricao, ''))) not between 1 and 2000
  then raise exception 'Descreva o pedido em até 2.000 caracteres'; end if;
  select organization_id, status into v_org, v_status from public.atribuicoes
    where id = p_atribuicao_id for update;
  if v_status <> 'ativa' then raise exception 'A atribuição não está ativa'; end if;
  insert into public.workspace_acoes (atribuicao_id, organization_id, solicitante_id,
    destinatario, descricao, prazo)
  values (p_atribuicao_id, v_org, auth.uid(), p_destinatario, trim(p_descricao), p_prazo)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.fn_workspace_responder_acao(p_acao_id uuid, p_resposta text)
returns void language plpgsql security definer set search_path = public as $$
declare v_acao record;
begin
  select * into v_acao from public.workspace_acoes where id = p_acao_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if public.fn_workspace_papel(v_acao.atribuicao_id) <> v_acao.destinatario
    then raise exception 'Este pedido é destinado ao outro lado'; end if;
  if v_acao.status <> 'pendente' then raise exception 'Este pedido já foi respondido'; end if;
  if char_length(trim(coalesce(p_resposta, ''))) not between 1 and 2000
    then raise exception 'Escreva uma resposta em até 2.000 caracteres'; end if;
  update public.workspace_acoes set resposta = trim(p_resposta), respondido_por = auth.uid(),
    respondido_em = now(), status = 'respondida' where id = p_acao_id;
end;
$$;

create or replace function public.fn_workspace_resolver_acao(p_acao_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_acao record;
begin
  select * into v_acao from public.workspace_acoes where id = p_acao_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  perform public.fn_workspace_papel(v_acao.atribuicao_id);
  if v_acao.status <> 'respondida' then raise exception 'Responda antes de encerrar o pedido'; end if;
  update public.workspace_acoes set status = 'resolvida', resolvido_em = now() where id = p_acao_id;
end;
$$;

-- Notificações para novas solicitações e respostas, sem criar um funil paralelo.
create or replace function public.fn_workspace_notificar_acao()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_captador uuid; v_captador_user uuid; v_org_nome text; v_admin record; v_destino text;
begin
  select c.id, c.user_id, o.nome into v_captador, v_captador_user, v_org_nome
  from public.atribuicoes a
  join public.captadores c on c.id = a.captador_user_id
  join public.organizations o on o.id = a.organization_id
  where a.id = new.atribuicao_id;
  if tg_op = 'INSERT' then
    v_destino := new.destinatario;
  elsif new.status = 'respondida' and old.status = 'pendente' then
    v_destino := case when new.destinatario = 'captador' then 'organizacao' else 'captador' end;
  else return new; end if;
  if v_destino = 'captador' and v_captador_user is not null then
    perform public.fn_emit_notification('workspace_acao', new.organization_id, v_captador_user,
      case when tg_op = 'INSERT' then 'Novo pedido de ' || v_org_nome else 'Resposta ao seu pedido' end,
      left(case when tg_op = 'INSERT' then new.descricao else new.resposta end, 120),
      '/workspace-captador', 'captacao', 'normal', 'atribuicao', new.atribuicao_id,
      case when tg_op = 'INSERT' then new.solicitante_id else new.respondido_por end);
  elsif v_destino = 'organizacao' then
    for v_admin in select user_id from public.organization_members
      where organization_id = new.organization_id and papel = 'admin'
        and user_id is distinct from case when tg_op = 'INSERT' then new.solicitante_id else new.respondido_por end
    loop
      perform public.fn_emit_notification('workspace_acao', new.organization_id, v_admin.user_id,
        case when tg_op = 'INSERT' then 'Novo pedido do captador' else 'Resposta do captador' end,
        left(case when tg_op = 'INSERT' then new.descricao else new.resposta end, 120),
        '/captadores/' || v_captador, 'captacao', 'normal', 'atribuicao', new.atribuicao_id,
        case when tg_op = 'INSERT' then new.solicitante_id else new.respondido_por end);
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_workspace_notificar_acao on public.workspace_acoes;
create trigger trg_workspace_notificar_acao after insert or update of status on public.workspace_acoes
for each row execute function public.fn_workspace_notificar_acao();

revoke all on function public.fn_workspace_papel(uuid) from public, anon;
revoke all on function public.fn_workspace_obter_coordenacao(uuid) from public, anon;
revoke all on function public.fn_workspace_definir_situacao(uuid, text) from public, anon;
revoke all on function public.fn_workspace_registrar_resultado(uuid, text) from public, anon;
revoke all on function public.fn_workspace_criar_acao(uuid, text, text, date) from public, anon;
revoke all on function public.fn_workspace_responder_acao(uuid, text) from public, anon;
revoke all on function public.fn_workspace_resolver_acao(uuid) from public, anon;
grant execute on function public.fn_workspace_papel(uuid) to authenticated;
grant execute on function public.fn_workspace_obter_coordenacao(uuid) to authenticated;
grant execute on function public.fn_workspace_definir_situacao(uuid, text) to authenticated;
grant execute on function public.fn_workspace_registrar_resultado(uuid, text) to authenticated;
grant execute on function public.fn_workspace_criar_acao(uuid, text, text, date) to authenticated;
grant execute on function public.fn_workspace_responder_acao(uuid, text) to authenticated;
grant execute on function public.fn_workspace_resolver_acao(uuid) to authenticated;
