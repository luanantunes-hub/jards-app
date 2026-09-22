-- EXPERIMENTAL — conversa e continuidade entre pedido e atribuição.
-- Aplicar apenas em banco de teste antes de validar o fluxo no localhost.

alter table public.captador_workspace_pedidos
  add column if not exists atribuicao_id uuid references public.atribuicoes(id) on delete set null;

alter table public.captador_workspace_pedidos
  drop constraint if exists captador_workspace_pedidos_status_check;
alter table public.captador_workspace_pedidos
  add constraint captador_workspace_pedidos_status_check
  check (status in ('pendente', 'aguardando_captador', 'aprovado', 'recusado'));

drop policy if exists "captador_workspace_pedidos: captador insere" on public.captador_workspace_pedidos;
create policy "captador_workspace_pedidos: captador insere"
on public.captador_workspace_pedidos for insert to authenticated with check (
  status = 'pendente' and decidido_por is null and decidido_em is null
  and atribuicao_id is null and char_length(trim(nome_busca)) between 2 and 200
  and exists (
    select 1 from public.captador_workspaces w
    join public.captadores c on c.id = w.captador_id
    join public.captador_workspace_escopos e on e.workspace_id = w.id
    where w.id = workspace_id and c.user_id = auth.uid()
      and e.tipo = captador_workspace_pedidos.tipo
      and e.habilitado and e.modo = 'pedido'
  )
);

create table if not exists public.captador_workspace_mensagens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.captador_workspace_pedidos(id) on delete cascade,
  autor_id uuid not null references auth.users(id),
  autor_email text not null,
  texto text not null check (char_length(trim(texto)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists captador_workspace_mensagens_pedido_idx
  on public.captador_workspace_mensagens (pedido_id, created_at);

alter table public.captador_workspace_mensagens enable row level security;

create policy "workspace mensagens: participantes leem"
  on public.captador_workspace_mensagens for select to authenticated
  using (exists (
    select 1 from public.captador_workspace_pedidos p
    join public.captador_workspaces w on w.id = p.workspace_id
    join public.captadores c on c.id = w.captador_id
    where p.id = pedido_id and (
      c.user_id = auth.uid() or exists (
        select 1 from public.organization_members m
        where m.organization_id = w.organization_id and m.user_id = auth.uid() and m.papel = 'admin'
      )
    )
  ));

-- Escrita só por RPC: valida participante e atualiza o estado no mesmo commit.
grant select on public.captador_workspace_mensagens to authenticated;

create or replace function public.fn_workspace_enviar_mensagem(p_pedido_id uuid, p_texto text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pedido record;
  v_admin boolean;
  v_captador boolean;
  v_mensagem_id uuid;
begin
  if char_length(trim(coalesce(p_texto, ''))) not between 1 and 4000 then
    raise exception 'Escreva uma mensagem de até 4.000 caracteres';
  end if;

  select p.status, w.organization_id, c.user_id as captador_user_id
    into v_pedido
  from public.captador_workspace_pedidos p
  join public.captador_workspaces w on w.id = p.workspace_id
  join public.captadores c on c.id = w.captador_id
  where p.id = p_pedido_id for update of p;

  if not found then raise exception 'Pedido não encontrado'; end if;
  v_captador := coalesce(v_pedido.captador_user_id = auth.uid(), false);
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = v_pedido.organization_id
      and m.user_id = auth.uid() and m.papel = 'admin'
  ) into v_admin;
  if not (v_admin or v_captador) then raise exception 'Sem acesso a esta conversa'; end if;
  if v_pedido.status in ('aprovado', 'recusado') then
    raise exception 'Este pedido já foi decidido; continue a conversa na atribuição';
  end if;

  insert into public.captador_workspace_mensagens (pedido_id, autor_id, autor_email, texto)
  values (p_pedido_id, auth.uid(), coalesce(auth.jwt()->>'email', 'Usuário'), trim(p_texto))
  returning id into v_mensagem_id;

  if v_captador and v_pedido.status = 'aguardando_captador' then
    update public.captador_workspace_pedidos set status = 'pendente' where id = p_pedido_id;
  elsif v_admin and v_pedido.status = 'pendente' then
    update public.captador_workspace_pedidos set status = 'aguardando_captador' where id = p_pedido_id;
  end if;

  return jsonb_build_object('id', v_mensagem_id);
end;
$$;

create or replace function public.fn_workspace_recusar_pedido(p_pedido_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pedido record;
begin
  if char_length(trim(coalesce(p_motivo, ''))) not between 1 and 4000 then
    raise exception 'Informe o motivo da recusa';
  end if;
  select p.status, w.organization_id into v_pedido
  from public.captador_workspace_pedidos p
  join public.captador_workspaces w on w.id = p.workspace_id
  where p.id = p_pedido_id for update of p;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_pedido.organization_id and m.user_id = auth.uid() and m.papel = 'admin'
  ) then raise exception 'Sem permissão para decidir'; end if;
  if v_pedido.status not in ('pendente', 'aguardando_captador') then
    raise exception 'Pedido já foi decidido';
  end if;

  update public.captador_workspace_pedidos
  set status = 'recusado', decidido_por = auth.uid(), decidido_em = now()
  where id = p_pedido_id;

  insert into public.captador_workspace_mensagens (pedido_id, autor_id, autor_email, texto)
  values (p_pedido_id, auth.uid(), coalesce(auth.jwt()->>'email', 'Organização'), trim(p_motivo));
end;
$$;

-- Liga o pedido aprovado à atribuição, preservando seu contexto na tela de trabalho.
create or replace function public.fn_aprovar_pedido_workspace(p_pedido_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pedido record;
  v_empresa_crm_id uuid;
  v_atribuicao_id uuid;
begin
  select p.*, w.organization_id, c.id as captador_id into v_pedido
  from public.captador_workspace_pedidos p
  join public.captador_workspaces w on w.id = p.workspace_id
  join public.captadores c on c.id = w.captador_id
  where p.id = p_pedido_id for update of p;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_pedido.organization_id and m.user_id = auth.uid() and m.papel = 'admin'
  ) then raise exception 'Sem permissão para aprovar'; end if;
  if v_pedido.status not in ('pendente', 'aguardando_captador') then
    raise exception 'Pedido já foi decidido';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_pedido.organization_id::text || lower(v_pedido.nome_busca), 0
  ));

  select id into v_empresa_crm_id from public.empresas_crm
  where organization_id = v_pedido.organization_id
    and lower(nome) = lower(v_pedido.nome_busca) limit 1;
  if v_empresa_crm_id is null then
    insert into public.empresas_crm (nome, account_id, organization_id)
    values (v_pedido.nome_busca, auth.uid(), v_pedido.organization_id)
    returning id into v_empresa_crm_id;
  end if;

  if exists (
    select 1 from public.atribuicoes
    where organization_id = v_pedido.organization_id
      and empresa_crm_id = v_empresa_crm_id and status = 'ativa'
      and captador_user_id <> v_pedido.captador_id
  ) then
    raise exception 'Esta empresa já está atribuída a outro captador';
  end if;

  select id into v_atribuicao_id from public.atribuicoes
  where organization_id = v_pedido.organization_id
    and empresa_crm_id = v_empresa_crm_id
    and captador_user_id = v_pedido.captador_id
    and status = 'ativa'
  limit 1;

  if v_atribuicao_id is null then
    insert into public.atribuicoes (
      account_id, organization_id, empresa_crm_id, captador_user_id,
      tipo, status, motivo, aprovado_por
    ) values (
      auth.uid(), v_pedido.organization_id, v_empresa_crm_id, v_pedido.captador_id,
      'livre', 'ativa', 'Aprovado via workspace de captador', auth.uid()
    ) returning id into v_atribuicao_id;
  end if;

  update public.captador_workspace_pedidos
  set status = 'aprovado', decidido_por = auth.uid(), decidido_em = now(),
      atribuicao_id = v_atribuicao_id
  where id = p_pedido_id;

  return jsonb_build_object('ok', true, 'atribuicao_id', v_atribuicao_id);
end;
$$;

revoke all on function public.fn_workspace_enviar_mensagem(uuid, text) from public, anon;
revoke all on function public.fn_workspace_recusar_pedido(uuid, text) from public, anon;
revoke all on function public.fn_aprovar_pedido_workspace(uuid) from public, anon;
grant execute on function public.fn_workspace_enviar_mensagem(uuid, text) to authenticated;
grant execute on function public.fn_workspace_recusar_pedido(uuid, text) to authenticated;
grant execute on function public.fn_aprovar_pedido_workspace(uuid) to authenticated;

-- Consulta e visão aberta atribuem oportunidades livres sem aprovação prévia.
-- Uma empresa já cadastrada no CRM não é, por si só, um conflito.
create or replace function public.fn_captador_consultar(
  p_workspace_id uuid, p_tipo text, p_nome_busca text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_captador_id uuid;
  v_nome text := trim(coalesce(p_nome_busca, ''));
  v_empresa_crm_id uuid;
  v_atribuicao_id uuid;
  v_pedido_id uuid;
  v_modo text;
begin
  if p_tipo not in ('empresas', 'negociacoes', 'inscricoes') then
    raise exception 'Tipo inválido';
  end if;
  if char_length(v_nome) not between 2 and 200 then
    raise exception 'Informe um nome entre 2 e 200 caracteres';
  end if;

  select w.organization_id, c.id into v_org_id, v_captador_id
  from public.captador_workspaces w
  join public.captadores c on c.id = w.captador_id
  where w.id = p_workspace_id and c.user_id = auth.uid();
  if v_org_id is null then raise exception 'Workspace não encontrado'; end if;

  select modo into v_modo from public.captador_workspace_escopos
  where workspace_id = p_workspace_id and tipo = p_tipo and habilitado;
  if v_modo not in ('consulta', 'ver_tudo') then
    raise exception 'Consulta não habilitada';
  end if;

  -- Serializa consultas da mesma organização/nome para evitar dupla atribuição.
  perform pg_advisory_xact_lock(hashtextextended(v_org_id::text || lower(v_nome), 0));

  select id into v_empresa_crm_id from public.empresas_crm
  where organization_id = v_org_id and lower(nome) = lower(v_nome) limit 1;

  if v_empresa_crm_id is not null and exists (
    select 1 from public.atribuicoes a
    where a.organization_id = v_org_id and a.empresa_crm_id = v_empresa_crm_id and a.status = 'ativa'
  ) then
    return jsonb_build_object('livre', false, 'encontrado', jsonb_build_object('nome', v_nome));
  end if;

  if p_tipo = 'negociacoes' and exists (
    select 1 from public.captacoes cap
    join public.empresas_crm ec on ec.id = cap.empresa_crm_id
    where cap.organization_id = v_org_id and lower(ec.nome) = lower(v_nome)
      and cap.status not in ('aprovado', 'recusado')
  ) then
    return jsonb_build_object('livre', false, 'encontrado', jsonb_build_object('nome', v_nome));
  end if;
  if p_tipo = 'inscricoes' and exists (
    select 1 from public.editais_user ed
    join public.empresas_crm ec on ec.id = ed.empresa_crm_id
    where ed.organization_id = v_org_id and lower(ec.nome) = lower(v_nome)
      and ed.status not in ('aprovado', 'reprovado', 'cancelado')
  ) then
    return jsonb_build_object('livre', false, 'encontrado', jsonb_build_object('nome', v_nome));
  end if;

  if v_empresa_crm_id is null then
    insert into public.empresas_crm (nome, account_id, organization_id)
    values (v_nome, auth.uid(), v_org_id) returning id into v_empresa_crm_id;
  end if;

  insert into public.atribuicoes (
    account_id, organization_id, empresa_crm_id, captador_user_id, tipo, status, motivo
  ) values (
    auth.uid(), v_org_id, v_empresa_crm_id, v_captador_id, 'livre', 'ativa',
    'Atribuída após consulta no workspace de captador'
  ) returning id into v_atribuicao_id;

  insert into public.captador_workspace_pedidos (
    workspace_id, tipo, nome_busca, status, decidido_em, atribuicao_id
  ) values (
    p_workspace_id, p_tipo, v_nome, 'aprovado', now(), v_atribuicao_id
  ) returning id into v_pedido_id;

  return jsonb_build_object('livre', true, 'pedido_id', v_pedido_id, 'atribuicao_id', v_atribuicao_id);
end;
$$;

revoke all on function public.fn_captador_consultar(uuid, text, text) from public, anon;
grant execute on function public.fn_captador_consultar(uuid, text, text) to authenticated;

-- Avisos bilaterais: novo pedido, resposta e decisão. As funções de evento
-- já pertencem ao sistema de notificações da aplicação.
create or replace function public.fn_workspace_notificar_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_captador_id uuid;
  v_admin record;
begin
  select w.organization_id, c.user_id into v_org_id, v_captador_id
  from public.captador_workspaces w
  join public.captadores c on c.id = w.captador_id
  where w.id = new.workspace_id;

  if tg_op = 'INSERT' and new.status = 'pendente' then
    for v_admin in select user_id from public.organization_members
      where organization_id = v_org_id and papel = 'admin' and user_id <> v_captador_id
    loop
      perform public.fn_emit_notification(
        'workspace_pedido', v_org_id, v_admin.user_id, 'Nova oportunidade para avaliar',
        new.nome_busca, '/captadores/' || (select captador_id from public.captador_workspaces where id = new.workspace_id),
        'captacao', 'normal', 'captador_workspace_pedido', new.id, v_captador_id
      );
    end loop;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status
      and new.status in ('aprovado', 'recusado') and v_captador_id is not null then
      perform public.fn_emit_notification(
        'workspace_decisao', v_org_id, v_captador_id,
        case when new.status = 'aprovado' then 'Oportunidade aprovada' else 'Oportunidade recusada' end,
        new.nome_busca, '/workspace-captador', 'captacao', 'normal',
        'captador_workspace_pedido', new.id, new.decidido_por
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_workspace_notificar_pedido on public.captador_workspace_pedidos;
create trigger trg_workspace_notificar_pedido after insert or update of status
on public.captador_workspace_pedidos for each row
execute function public.fn_workspace_notificar_pedido();

create or replace function public.fn_workspace_notificar_mensagem()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pedido record;
  v_admin record;
begin
  select p.nome_busca, p.status, w.organization_id, o.nome as organization_name,
    w.captador_id, c.user_id as captador_user_id
    into v_pedido
  from public.captador_workspace_pedidos p
  join public.captador_workspaces w on w.id = p.workspace_id
  join public.captadores c on c.id = w.captador_id
  join public.organizations o on o.id = w.organization_id
  where p.id = new.pedido_id;

  if new.autor_id = v_pedido.captador_user_id then
    for v_admin in select user_id from public.organization_members
      where organization_id = v_pedido.organization_id and papel = 'admin' and user_id <> new.autor_id
    loop
      perform public.fn_emit_notification(
        'workspace_mensagem', v_pedido.organization_id, v_admin.user_id,
        'Resposta do captador', v_pedido.nome_busca,
        '/captadores/' || v_pedido.captador_id, 'captacao', 'normal',
        'captador_workspace_pedido', new.pedido_id, new.autor_id
      );
    end loop;
  elsif v_pedido.captador_user_id is not null and v_pedido.status not in ('recusado', 'aprovado') then
    perform public.fn_emit_notification(
      'workspace_mensagem', v_pedido.organization_id, v_pedido.captador_user_id,
      'Mensagem de ' || v_pedido.organization_name, v_pedido.nome_busca, '/workspace-captador',
      'captacao', 'normal', 'captador_workspace_pedido', new.pedido_id, new.autor_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_workspace_notificar_mensagem on public.captador_workspace_mensagens;
create trigger trg_workspace_notificar_mensagem after insert
on public.captador_workspace_mensagens for each row
execute function public.fn_workspace_notificar_mensagem();

create or replace function public.fn_workspace_notificar_atribuicao_nota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_captador_user_id uuid;
  v_org_nome text;
  v_admin record;
begin
  select c.user_id, o.nome into v_captador_user_id, v_org_nome
  from public.atribuicoes a
  join public.captadores c on c.id = a.captador_user_id
  join public.captador_workspaces w on w.captador_id = c.id
  join public.organizations o on o.id = a.organization_id
  where a.id = new.atribuicao_id;

  if v_captador_user_id is null then return new; end if;
  if new.autor_id = v_captador_user_id then
    for v_admin in select user_id from public.organization_members
      where organization_id = new.organization_id and papel = 'admin' and user_id <> new.autor_id
    loop
      perform public.fn_emit_notification(
        'workspace_atualizacao', new.organization_id, v_admin.user_id,
        'Atualização do captador', left(new.nota, 120), '/captadores/' ||
        (select a.captador_user_id from public.atribuicoes a where a.id = new.atribuicao_id),
        'captacao', 'normal', 'atribuicao', new.atribuicao_id, new.autor_id
      );
    end loop;
  else
    perform public.fn_emit_notification(
      'workspace_atualizacao', new.organization_id, v_captador_user_id,
      'Atualização de ' || v_org_nome, left(new.nota, 120), '/workspace-captador',
      'captacao', 'normal', 'atribuicao', new.atribuicao_id, new.autor_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_workspace_notificar_atribuicao_nota on public.atribuicao_notas;
create trigger trg_workspace_notificar_atribuicao_nota after insert
on public.atribuicao_notas for each row
execute function public.fn_workspace_notificar_atribuicao_nota();

-- O captador só pode ler/escrever na própria atribuição; o gestor da
-- organização acompanha as atribuições do seu time.
drop policy if exists "atribuicao_notas: all org" on public.atribuicao_notas;
create policy "atribuicao_notas: participantes leem"
on public.atribuicao_notas for select to authenticated using (
  exists (
    select 1 from public.atribuicoes a
    join public.captadores c on c.id = a.captador_user_id
    where a.id = atribuicao_id and a.organization_id = atribuicao_notas.organization_id
      and (c.user_id = auth.uid() or exists (
        select 1 from public.organization_members m
        where m.organization_id = a.organization_id and m.user_id = auth.uid() and m.papel = 'admin'
      ))
  )
);
create policy "atribuicao_notas: participantes escrevem"
on public.atribuicao_notas for insert to authenticated with check (
  autor_id = auth.uid() and exists (
    select 1 from public.atribuicoes a
    join public.captadores c on c.id = a.captador_user_id
    where a.id = atribuicao_id and a.organization_id = atribuicao_notas.organization_id
      and (c.user_id = auth.uid() or exists (
        select 1 from public.organization_members m
        where m.organization_id = a.organization_id and m.user_id = auth.uid() and m.papel = 'admin'
      ))
  )
);
revoke update, delete on public.atribuicao_notas from authenticated;
grant select, insert on public.atribuicao_notas to authenticated;

-- O papel captador não ganha acesso a todas as atribuições da organização
-- apenas por ser membro dela. Demais papéis conservam o acesso anterior.
drop policy if exists "atribuicoes: select org" on public.atribuicoes;
drop policy if exists "atribuicoes: insert org" on public.atribuicoes;
drop policy if exists "atribuicoes: update org" on public.atribuicoes;
drop policy if exists "atribuicoes: delete org" on public.atribuicoes;
create policy "atribuicoes: select org" on public.atribuicoes
for select to authenticated using (exists (
  select 1 from public.organization_members m
  where m.organization_id = atribuicoes.organization_id and m.user_id = auth.uid()
    and (m.papel <> 'captador' or exists (
      select 1 from public.captadores c
      where c.id = atribuicoes.captador_user_id and c.user_id = auth.uid()
    ))
));
create policy "atribuicoes: insert org" on public.atribuicoes
for insert to authenticated with check (exists (
  select 1 from public.organization_members m
  where m.organization_id = atribuicoes.organization_id and m.user_id = auth.uid()
    and m.papel <> 'captador'
));
create policy "atribuicoes: update org" on public.atribuicoes
for update to authenticated using (exists (
  select 1 from public.organization_members m
  where m.organization_id = atribuicoes.organization_id and m.user_id = auth.uid()
    and m.papel <> 'captador'
)) with check (exists (
  select 1 from public.organization_members m
  where m.organization_id = atribuicoes.organization_id and m.user_id = auth.uid()
    and m.papel <> 'captador'
));
create policy "atribuicoes: delete org" on public.atribuicoes
for delete to authenticated using (exists (
  select 1 from public.organization_members m
  where m.organization_id = atribuicoes.organization_id and m.user_id = auth.uid()
    and m.papel <> 'captador'
));

-- Um próximo passo explícito evita que a conversa vire apenas um arquivo de notas.
alter table public.atribuicoes
  add column if not exists workspace_proximo_passo text,
  add column if not exists workspace_proximo_passo_em date,
  add column if not exists workspace_aguardando text;
alter table public.atribuicoes
  drop constraint if exists atribuicoes_workspace_aguardando_check;
alter table public.atribuicoes
  add constraint atribuicoes_workspace_aguardando_check
  check (workspace_aguardando is null or workspace_aguardando in ('captador', 'gestor'));

create or replace function public.fn_workspace_obter_proximo_passo(p_atribuicao_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_atribuicao record;
begin
  select a.organization_id, a.workspace_proximo_passo, a.workspace_proximo_passo_em,
    a.workspace_aguardando, c.user_id as captador_user_id
  into v_atribuicao
  from public.atribuicoes a
  join public.captadores c on c.id = a.captador_user_id
  where a.id = p_atribuicao_id;
  if not found then raise exception 'Atribuição não encontrada'; end if;
  if v_atribuicao.captador_user_id is distinct from auth.uid() and not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_atribuicao.organization_id
      and m.user_id = auth.uid() and m.papel = 'admin'
  ) then raise exception 'Sem acesso a esta atribuição'; end if;
  return jsonb_build_object(
    'texto', v_atribuicao.workspace_proximo_passo,
    'data', v_atribuicao.workspace_proximo_passo_em,
    'aguardando', v_atribuicao.workspace_aguardando
  );
end;
$$;

create or replace function public.fn_workspace_definir_proximo_passo(
  p_atribuicao_id uuid, p_texto text, p_data date, p_aguardando text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_atribuicao record;
begin
  if char_length(trim(coalesce(p_texto, ''))) not between 1 and 500 then
    raise exception 'Descreva o próximo passo em até 500 caracteres';
  end if;
  if p_aguardando is null or p_aguardando not in ('captador', 'gestor') then
    raise exception 'Indique quem deve agir';
  end if;
  select a.organization_id, a.status, c.user_id as captador_user_id,
    o.nome as organization_name
    into v_atribuicao
  from public.atribuicoes a
  join public.captadores c on c.id = a.captador_user_id
  join public.organizations o on o.id = a.organization_id
  where a.id = p_atribuicao_id for update of a;
  if not found then raise exception 'Atribuição não encontrada'; end if;
  if v_atribuicao.captador_user_id is distinct from auth.uid() and not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_atribuicao.organization_id
      and m.user_id = auth.uid() and m.papel = 'admin'
  ) then raise exception 'Sem acesso a esta atribuição'; end if;
  if v_atribuicao.status <> 'ativa' then raise exception 'A atribuição não está ativa'; end if;

  update public.atribuicoes set
    workspace_proximo_passo = trim(p_texto),
    workspace_proximo_passo_em = p_data,
    workspace_aguardando = p_aguardando
  where id = p_atribuicao_id;

  insert into public.atribuicao_notas (
    atribuicao_id, organization_id, autor_id, autor_email, nota
  ) values (
    p_atribuicao_id, v_atribuicao.organization_id, auth.uid(),
    coalesce(auth.jwt()->>'email', 'Usuário'),
    'Próximo passo: ' || trim(p_texto) ||
      case when p_data is null then '' else ' · até ' || to_char(p_data, 'DD/MM/YYYY') end ||
      ' · com ' || case when p_aguardando = 'gestor' then v_atribuicao.organization_name else 'o captador' end
  );
end;
$$;

revoke all on function public.fn_workspace_obter_proximo_passo(uuid) from public, anon;
revoke all on function public.fn_workspace_definir_proximo_passo(uuid, text, date, text) from public, anon;
grant execute on function public.fn_workspace_obter_proximo_passo(uuid) to authenticated;
grant execute on function public.fn_workspace_definir_proximo_passo(uuid, text, date, text) to authenticated;
