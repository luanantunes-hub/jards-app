-- Integra o banco de respostas padrão do projeto às inscrições vinculadas.

create or replace function public.salvar_resposta_padrao_projeto(
  p_projeto_id uuid,
  p_campo_id uuid,
  p_conteudo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  if not exists (
    select 1 from public.projetos_crm
    where id = p_projeto_id and account_id = v_uid
  ) then
    raise exception 'Projeto não encontrado ou sem acesso';
  end if;

  if not exists (
    select 1 from public.campos_resposta
    where id = p_campo_id and account_id = v_uid
  ) then
    raise exception 'Pergunta não encontrada ou sem acesso';
  end if;

  insert into public.perguntas_projeto (account_id, projeto_id, campo_id)
  values (v_uid, p_projeto_id, p_campo_id)
  on conflict (projeto_id, campo_id) do nothing;

  insert into public.respostas_modelo (account_id, projeto_id, campo_id, conteudo, updated_at)
  values (v_uid, p_projeto_id, p_campo_id, p_conteudo, now())
  on conflict (projeto_id, campo_id)
  do update set conteudo = excluded.conteudo, updated_at = now();
end;
$$;

create or replace function public.get_respostas_projeto(p_projeto_id uuid)
returns table (
  campo_id uuid,
  campo_nome text,
  modelo_texto text,
  tem_modelo boolean
)
language sql
security definer
set search_path = public
as $$
  select
    cr.id,
    cr.nome,
    coalesce(rm.conteudo, ''),
    rm.id is not null
  from public.perguntas_projeto pp
  join public.projetos_crm p
    on p.id = pp.projeto_id
   and p.account_id = auth.uid()
  join public.campos_resposta cr
    on cr.id = pp.campo_id
  left join public.respostas_modelo rm
    on rm.projeto_id = pp.projeto_id
   and rm.campo_id = pp.campo_id
  where pp.projeto_id = p_projeto_id
    and pp.account_id = auth.uid()
  order by cr.nome;
$$;

create or replace function public.get_registros_inscricao(
  p_inscricao_id uuid,
  p_projeto_id uuid
)
returns table (
  campo_id uuid,
  campo_nome text,
  conteudo text,
  modelo_texto text,
  tem_modelo boolean
)
language sql
security definer
set search_path = public
as $$
  with inscricao_autorizada as (
    select id
    from public.editais_user
    where id = p_inscricao_id
      and account_id = auth.uid()
  ),
  campos_vinculados as (
    select ri.campo_id
    from public.respostas_inscricao ri
    where ri.inscricao_id = p_inscricao_id
      and ri.account_id = auth.uid()

    union

    select pp.campo_id
    from public.perguntas_projeto pp
    where pp.projeto_id = p_projeto_id
      and pp.account_id = auth.uid()
  )
  select
    cr.id,
    cr.nome,
    ri.conteudo,
    rm.conteudo,
    rm.id is not null
  from campos_vinculados cv
  cross join inscricao_autorizada ia
  join public.campos_resposta cr on cr.id = cv.campo_id
  left join public.respostas_inscricao ri
    on ri.inscricao_id = ia.id
   and ri.campo_id = cv.campo_id
  left join public.respostas_modelo rm
    on rm.projeto_id = p_projeto_id
   and rm.campo_id = cv.campo_id
  order by coalesce(ri.updated_at, rm.updated_at, cr.created_at) desc, cr.nome;
$$;

grant execute on function public.salvar_resposta_padrao_projeto(uuid, uuid, text) to authenticated;
grant execute on function public.get_respostas_projeto(uuid) to authenticated;
grant execute on function public.get_registros_inscricao(uuid, uuid) to authenticated;
