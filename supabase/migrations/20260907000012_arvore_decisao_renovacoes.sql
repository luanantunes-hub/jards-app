-- Árvores de decisão editáveis por organização e avaliação preservada por renovação.

create table if not exists public.renovacao_arvores_decisao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  nome text not null default 'Renovação de parceria',
  nos jsonb not null default '[]'::jsonb check (jsonb_typeof(nos) = 'array'),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.renovacoes_cliente
  add column if not exists arvore_snapshot jsonb,
  add column if not exists arvore_respostas jsonb not null default '{}'::jsonb,
  add column if not exists no_atual text,
  add column if not exists diagnostico text,
  add column if not exists avaliacao_status text not null default 'nao_avaliada'
    check (avaliacao_status in ('nao_avaliada','em_andamento','concluida'));

alter table public.renovacao_arvores_decisao enable row level security;

drop policy if exists renovacao_arvores_org_select on public.renovacao_arvores_decisao;
create policy renovacao_arvores_org_select on public.renovacao_arvores_decisao
  for select to authenticated
  using (organization_id = any(array(select public.auth_org_ids())));

drop policy if exists renovacao_arvores_org_insert on public.renovacao_arvores_decisao;
create policy renovacao_arvores_org_insert on public.renovacao_arvores_decisao
  for insert to authenticated
  with check (public.auth_can_write_org(organization_id));

drop policy if exists renovacao_arvores_org_update on public.renovacao_arvores_decisao;
create policy renovacao_arvores_org_update on public.renovacao_arvores_decisao
  for update to authenticated
  using (public.auth_can_write_org(organization_id))
  with check (public.auth_can_write_org(organization_id));

grant select, insert, update on public.renovacao_arvores_decisao to authenticated;

create or replace function public.fn_salvar_avaliacao_renovacao(
  p_renovacao_id uuid,
  p_arvore_snapshot jsonb,
  p_respostas jsonb,
  p_no_atual text,
  p_diagnostico text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_renovacao public.renovacoes_cliente%rowtype;
begin
  select * into v_renovacao from public.renovacoes_cliente where id = p_renovacao_id;
  if not found then raise exception 'Renovação não encontrada.'; end if;
  if not public.auth_can_write_org(v_renovacao.organization_id) then
    raise exception 'Sem permissão para avaliar esta renovação.' using errcode = '42501';
  end if;
  if p_status not in ('nao_avaliada','em_andamento','concluida') then
    raise exception 'Estado da avaliação inválido.' using errcode = '23514';
  end if;
  if jsonb_typeof(p_arvore_snapshot) <> 'array' or jsonb_typeof(p_respostas) <> 'object' then
    raise exception 'Estrutura da árvore inválida.' using errcode = '23514';
  end if;

  update public.renovacoes_cliente
  set arvore_snapshot = p_arvore_snapshot,
      arvore_respostas = p_respostas,
      no_atual = nullif(p_no_atual, ''),
      diagnostico = nullif(p_diagnostico, ''),
      avaliacao_status = p_status,
      updated_at = now()
  where id = p_renovacao_id;

  return jsonb_build_object('id', p_renovacao_id, 'status', p_status, 'diagnostico', p_diagnostico);
end;
$$;

revoke all on function public.fn_salvar_avaliacao_renovacao(uuid,jsonb,jsonb,text,text,text) from public, anon;
grant execute on function public.fn_salvar_avaliacao_renovacao(uuid,jsonb,jsonb,text,text,text) to authenticated, service_role;

