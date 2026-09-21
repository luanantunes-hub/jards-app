-- Uma entrada de oportunidades; tipo técnico preservado para compatibilidade.
-- Cada organização começa com dois tipos sugeridos, ambos editáveis e excluíveis.
create table public.captador_oportunidade_etiquetas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 2 and 80),
  tipo_fluxo text not null check (tipo_fluxo in ('negociacoes', 'inscricoes')),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);
create unique index captador_oportunidade_etiquetas_nome_key
  on public.captador_oportunidade_etiquetas (organization_id, lower(nome));
create index captador_oportunidade_etiquetas_org_idx
  on public.captador_oportunidade_etiquetas (organization_id, ordem);

insert into public.captador_oportunidade_etiquetas (organization_id, nome, tipo_fluxo, ordem)
select o.id, sugestao.nome, sugestao.tipo_fluxo, sugestao.ordem
from public.organizations o
cross join (values
  ('Negociação', 'negociacoes', 1), ('Inscrição', 'inscricoes', 2)
) as sugestao(nome, tipo_fluxo, ordem)
on conflict do nothing;

create or replace function public.fn_captador_etiquetas_organizacao_nova()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.captador_oportunidade_etiquetas (organization_id, nome, tipo_fluxo, ordem)
  values (new.id, 'Negociação', 'negociacoes', 1),
    (new.id, 'Inscrição', 'inscricoes', 2);
  return new;
end;
$$;
create trigger trg_captador_etiquetas_organizacao_nova
after insert on public.organizations for each row
execute function public.fn_captador_etiquetas_organizacao_nova();

alter table public.captador_oportunidade_etiquetas enable row level security;
create policy "oportunidade etiquetas: participantes leem"
on public.captador_oportunidade_etiquetas for select to authenticated using (
  exists (select 1 from public.organization_members m
    where m.organization_id = captador_oportunidade_etiquetas.organization_id
      and m.user_id = auth.uid() and m.papel = 'admin')
  or exists (select 1 from public.captador_workspaces w
    join public.captadores c on c.id = w.captador_id
    where w.organization_id = captador_oportunidade_etiquetas.organization_id
      and c.user_id = auth.uid())
);
create policy "oportunidade etiquetas: admin insere"
on public.captador_oportunidade_etiquetas for insert to authenticated with check (
  exists (select 1 from public.organization_members m
    where m.organization_id = captador_oportunidade_etiquetas.organization_id
      and m.user_id = auth.uid() and m.papel = 'admin')
);
create policy "oportunidade etiquetas: admin atualiza"
on public.captador_oportunidade_etiquetas for update to authenticated using (
  exists (select 1 from public.organization_members m
    where m.organization_id = captador_oportunidade_etiquetas.organization_id
      and m.user_id = auth.uid() and m.papel = 'admin')
) with check (
  exists (select 1 from public.organization_members m
    where m.organization_id = captador_oportunidade_etiquetas.organization_id
      and m.user_id = auth.uid() and m.papel = 'admin')
);
create policy "oportunidade etiquetas: admin exclui"
on public.captador_oportunidade_etiquetas for delete to authenticated using (
  exists (select 1 from public.organization_members m
    where m.organization_id = captador_oportunidade_etiquetas.organization_id
      and m.user_id = auth.uid() and m.papel = 'admin')
);
revoke all on public.captador_oportunidade_etiquetas from anon, authenticated;
grant select, insert, update, delete on public.captador_oportunidade_etiquetas to authenticated;

alter table public.captador_workspace_pedidos
  add column oportunidade_titulo text
    check (oportunidade_titulo is null or char_length(trim(oportunidade_titulo)) between 2 and 200),
  add column oportunidade_etiqueta_id uuid
    references public.captador_oportunidade_etiquetas(id) on delete set null,
  add column empresa_site text
    check (empresa_site is null or (char_length(empresa_site) <= 500
      and empresa_site ~* '^https?://[a-z0-9][a-z0-9.-]*[.][a-z]{2,}(:[0-9]+)?([/?#][^[:space:]]*)?$'));

-- A etiqueta escolhida deve pertencer à organização do workspace.
create or replace function public.fn_workspace_validar_etiqueta_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.oportunidade_etiqueta_id is not null and not exists (
    select 1 from public.captador_oportunidade_etiquetas e
    join public.captador_workspaces w on w.organization_id = e.organization_id
    where w.id = new.workspace_id and e.id = new.oportunidade_etiqueta_id
      and e.tipo_fluxo = new.tipo
  ) then raise exception 'Tipo de oportunidade inválido para esta organização'; end if;
  return new;
end;
$$;
create trigger trg_workspace_validar_etiqueta_pedido
before insert or update of workspace_id, tipo, oportunidade_etiqueta_id
on public.captador_workspace_pedidos for each row
execute function public.fn_workspace_validar_etiqueta_pedido();

-- Um pedido pendente não modifica o CRM. O site passa à empresa somente
-- quando a oportunidade é atribuída; a logo usa o domínio já exibido no Jards.
create or replace function public.fn_workspace_aplicar_site_empresa()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_empresa_id uuid;
begin
  if new.status = 'aprovado' and new.atribuicao_id is not null
    and new.empresa_site is not null and
    (old.empresa_site is distinct from new.empresa_site
      or old.status is distinct from new.status
      or old.atribuicao_id is distinct from new.atribuicao_id) then
    select a.empresa_crm_id into v_empresa_id from public.atribuicoes a
    join public.captador_workspaces w on w.organization_id = a.organization_id
    where a.id = new.atribuicao_id and w.id = new.workspace_id;
    if v_empresa_id is not null then
      update public.empresas_crm set site = new.empresa_site,
        domain_key = lower(substring(new.empresa_site from '^https?://([^/:?#]+)'))
      where id = v_empresa_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_workspace_aplicar_site_empresa
after update of status, atribuicao_id, empresa_site
on public.captador_workspace_pedidos for each row
execute function public.fn_workspace_aplicar_site_empresa();

-- Reutiliza a verificação de disponibilidade existente e grava a identidade
-- da oportunidade na mesma transação, sem abrir UPDATE direto ao captador.
create or replace function public.fn_captador_consultar_oportunidade(
  p_workspace_id uuid, p_tipo text, p_nome_busca text,
  p_titulo text, p_etiqueta_id uuid, p_site text default null, p_mensagem text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_resultado jsonb;
begin
  if p_tipo not in ('negociacoes', 'inscricoes') then
    raise exception 'Tipo de oportunidade inválido';
  end if;
  if char_length(trim(coalesce(p_titulo, ''))) not between 2 and 200 then
    raise exception 'Informe um título entre 2 e 200 caracteres';
  end if;
  if char_length(trim(coalesce(p_mensagem, ''))) > 4000 then
    raise exception 'O contexto deve ter até 4.000 caracteres';
  end if;
  if p_etiqueta_id is null or not exists (
    select 1 from public.captador_oportunidade_etiquetas e
    join public.captador_workspaces w on w.organization_id = e.organization_id
    where w.id = p_workspace_id and e.id = p_etiqueta_id and e.tipo_fluxo = p_tipo
  ) then raise exception 'Escolha um tipo de oportunidade válido'; end if;
  if p_site is not null and (char_length(p_site) > 500
    or p_site !~* '^https?://[a-z0-9][a-z0-9.-]*[.][a-z]{2,}(:[0-9]+)?([/?#][^[:space:]]*)?$') then
    raise exception 'Informe um site válido';
  end if;
  v_resultado := public.fn_captador_consultar(p_workspace_id, p_tipo, p_nome_busca);
  if coalesce((v_resultado->>'livre')::boolean, false) then
    update public.captador_workspace_pedidos
      set oportunidade_titulo = trim(p_titulo), oportunidade_etiqueta_id = p_etiqueta_id,
        empresa_site = p_site, mensagem = nullif(trim(coalesce(p_mensagem, '')), '')
      where id = (v_resultado->>'pedido_id')::uuid and workspace_id = p_workspace_id;
  end if;
  return v_resultado;
end;
$$;
revoke all on function public.fn_captador_consultar_oportunidade(uuid, text, text, text, uuid, text, text)
from public, anon;
grant execute on function public.fn_captador_consultar_oportunidade(uuid, text, text, text, uuid, text, text)
to authenticated;

-- A leitura do captador continua restrita às atribuições dele, mas devolve
-- o domínio já registrado no CRM para a identidade visual do detalhe.
create or replace function public.fn_captador_minhas_atribuicoes(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org_id uuid; v_captador_id uuid;
begin
  select w.organization_id, c.id into v_org_id, v_captador_id
  from public.captador_workspaces w
  join public.captadores c on c.id = w.captador_id
  where w.id = p_workspace_id and c.user_id = auth.uid();
  if v_org_id is null then raise exception 'Workspace não encontrado'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'status', a.status, 'organizationId', a.organization_id,
      'empresaNome', coalesce(e.nome, '—'),
      'empresaSite', e.site, 'empresaDomainKey', e.domain_key
    ) order by a.created_at desc)
    from public.atribuicoes a
    left join public.empresas_crm e on e.id = a.empresa_crm_id
    where a.organization_id = v_org_id and a.captador_user_id = v_captador_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.fn_captador_minhas_atribuicoes(uuid) from public, anon;
grant execute on function public.fn_captador_minhas_atribuicoes(uuid) to authenticated;
