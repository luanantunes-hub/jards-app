-- Sistema de solicitações entre organização e proponente, espelhando
-- workspace_acoes do captador (20260921011323_captador_coordenacao.sql),
-- mas ligado a um projeto em vez de uma atribuição — é essa a unidade de
-- trabalho do proponente. Tabela própria (não reaproveita workspace_acoes)
-- para não arriscar o mecanismo já em produção do captador.

create table if not exists public.projeto_workspace_acoes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos_crm(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  solicitante_id uuid not null references auth.users(id),
  destinatario text not null check (destinatario in ('proponente', 'organizacao')),
  descricao text not null check (char_length(trim(descricao)) between 1 and 2000),
  prazo date,
  status text not null default 'pendente' check (status in ('pendente', 'respondida', 'resolvida')),
  resposta text check (resposta is null or char_length(trim(resposta)) between 1 and 2000),
  respondido_por uuid references auth.users(id),
  respondido_em timestamptz,
  resolvido_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists projeto_workspace_acoes_projeto_idx
  on public.projeto_workspace_acoes(projeto_id, created_at desc);
create index if not exists projeto_workspace_acoes_destinatario_idx
  on public.projeto_workspace_acoes(organization_id, destinatario, status);

alter table public.projeto_workspace_acoes enable row level security;
drop policy if exists "projeto_workspace_acoes: participantes leem" on public.projeto_workspace_acoes;
create policy "projeto_workspace_acoes: participantes leem" on public.projeto_workspace_acoes
for select to authenticated using (exists (
  select 1 from public.projetos_crm p
  join public.proponentes pr on pr.id = p.proponente_id
  where p.id = projeto_workspace_acoes.projeto_id
    and p.organization_id = projeto_workspace_acoes.organization_id
    and (pr.user_id = auth.uid() or exists (
      select 1 from public.organization_members m
      where m.organization_id = p.organization_id
        and m.user_id = auth.uid() and m.papel = 'admin'
    ))
));
revoke all on public.projeto_workspace_acoes from anon, authenticated;
grant select on public.projeto_workspace_acoes to authenticated;

create or replace function public.fn_projeto_papel(p_projeto_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_proponente_user uuid;
begin
  select p.organization_id, pr.user_id into v_org, v_proponente_user
  from public.projetos_crm p
  join public.proponentes pr on pr.id = p.proponente_id
  where p.id = p_projeto_id;
  if not found then raise exception 'Projeto não encontrado'; end if;
  if v_proponente_user = auth.uid() then return 'proponente'; end if;
  if exists (select 1 from public.organization_members m
    where m.organization_id = v_org and m.user_id = auth.uid() and m.papel = 'admin')
  then return 'organizacao'; end if;
  raise exception 'Sem acesso a este projeto';
end;
$$;

create or replace function public.fn_projeto_criar_acao(
  p_projeto_id uuid, p_destinatario text, p_descricao text, p_prazo date default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_papel text; v_org uuid; v_id uuid;
begin
  v_papel := public.fn_projeto_papel(p_projeto_id);
  if p_destinatario is null or p_destinatario not in ('proponente', 'organizacao')
    or p_destinatario = v_papel then raise exception 'Escolha o outro lado como destinatário'; end if;
  if char_length(trim(coalesce(p_descricao, ''))) not between 1 and 2000
  then raise exception 'Descreva o pedido em até 2.000 caracteres'; end if;
  select organization_id into v_org from public.projetos_crm where id = p_projeto_id;
  insert into public.projeto_workspace_acoes (projeto_id, organization_id, solicitante_id,
    destinatario, descricao, prazo)
  values (p_projeto_id, v_org, auth.uid(), p_destinatario, trim(p_descricao), p_prazo)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.fn_projeto_responder_acao(p_acao_id uuid, p_resposta text)
returns void language plpgsql security definer set search_path = public as $$
declare v_acao record;
begin
  select * into v_acao from public.projeto_workspace_acoes where id = p_acao_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if public.fn_projeto_papel(v_acao.projeto_id) <> v_acao.destinatario
    then raise exception 'Este pedido é destinado ao outro lado'; end if;
  if v_acao.status <> 'pendente' then raise exception 'Este pedido já foi respondido'; end if;
  if char_length(trim(coalesce(p_resposta, ''))) not between 1 and 2000
    then raise exception 'Escreva uma resposta em até 2.000 caracteres'; end if;
  update public.projeto_workspace_acoes set resposta = trim(p_resposta), respondido_por = auth.uid(),
    respondido_em = now(), status = 'respondida' where id = p_acao_id;
end;
$$;

create or replace function public.fn_projeto_resolver_acao(p_acao_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_acao record;
begin
  select * into v_acao from public.projeto_workspace_acoes where id = p_acao_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  perform public.fn_projeto_papel(v_acao.projeto_id);
  if v_acao.status <> 'respondida' then raise exception 'Responda antes de encerrar o pedido'; end if;
  update public.projeto_workspace_acoes set status = 'resolvida', resolvido_em = now() where id = p_acao_id;
end;
$$;

create or replace function public.fn_projeto_notificar_acao()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_proponente_user uuid; v_org_nome text; v_admin record; v_destino text;
begin
  select pr.user_id, o.nome into v_proponente_user, v_org_nome
  from public.projetos_crm p
  join public.proponentes pr on pr.id = p.proponente_id
  join public.organizations o on o.id = p.organization_id
  where p.id = new.projeto_id;
  if tg_op = 'INSERT' then
    v_destino := new.destinatario;
  elsif new.status = 'respondida' and old.status = 'pendente' then
    v_destino := case when new.destinatario = 'proponente' then 'organizacao' else 'proponente' end;
  else return new; end if;
  if v_destino = 'proponente' and v_proponente_user is not null then
    perform public.fn_emit_notification('workspace_acao', new.organization_id, v_proponente_user,
      case when tg_op = 'INSERT' then 'Novo pedido de ' || v_org_nome else 'Resposta ao seu pedido' end,
      left(case when tg_op = 'INSERT' then new.descricao else new.resposta end, 120),
      '/workspace-proponente/' || new.projeto_id, 'captacao', 'normal', 'projeto', new.projeto_id,
      case when tg_op = 'INSERT' then new.solicitante_id else new.respondido_por end);
  elsif v_destino = 'organizacao' then
    for v_admin in select user_id from public.organization_members
      where organization_id = new.organization_id and papel = 'admin'
        and user_id is distinct from case when tg_op = 'INSERT' then new.solicitante_id else new.respondido_por end
    loop
      perform public.fn_emit_notification('workspace_acao', new.organization_id, v_admin.user_id,
        case when tg_op = 'INSERT' then 'Novo pedido do proponente' else 'Resposta do proponente' end,
        left(case when tg_op = 'INSERT' then new.descricao else new.resposta end, 120),
        '/projetos/' || new.projeto_id, 'captacao', 'normal', 'projeto', new.projeto_id,
        case when tg_op = 'INSERT' then new.solicitante_id else new.respondido_por end);
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_projeto_notificar_acao on public.projeto_workspace_acoes;
create trigger trg_projeto_notificar_acao after insert or update of status on public.projeto_workspace_acoes
for each row execute function public.fn_projeto_notificar_acao();

revoke all on function public.fn_projeto_papel(uuid) from public, anon;
revoke all on function public.fn_projeto_criar_acao(uuid, text, text, date) from public, anon;
revoke all on function public.fn_projeto_responder_acao(uuid, text) from public, anon;
revoke all on function public.fn_projeto_resolver_acao(uuid) from public, anon;
grant execute on function public.fn_projeto_papel(uuid) to authenticated;
grant execute on function public.fn_projeto_criar_acao(uuid, text, text, date) to authenticated;
grant execute on function public.fn_projeto_responder_acao(uuid, text) to authenticated;
grant execute on function public.fn_projeto_resolver_acao(uuid) to authenticated;
