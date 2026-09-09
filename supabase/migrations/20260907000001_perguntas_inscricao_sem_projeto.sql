-- Permite criar perguntas exclusivas de uma inscrição sem exigir projeto.
-- Quando houver projeto, preserva o comportamento atual e adiciona a pergunta
-- ao banco reutilizável daquele projeto.

create or replace function public.criar_pergunta_inscricao(
  p_inscricao_id uuid,
  p_projeto_id uuid,
  p_nome text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_campo_id uuid;
  v_modelo text := '';
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe a pergunta';
  end if;

  if not exists (
    select 1
    from public.editais_user
    where id = p_inscricao_id
      and account_id = v_uid
      and (p_projeto_id is null or projeto_id = p_projeto_id)
  ) then
    raise exception 'Inscrição não encontrada ou sem acesso';
  end if;

  if p_projeto_id is not null and not exists (
    select 1
    from public.projetos_crm
    where id = p_projeto_id
      and account_id = v_uid
  ) then
    raise exception 'Projeto não encontrado ou sem acesso';
  end if;

  insert into public.campos_resposta (account_id, nome)
  values (v_uid, trim(p_nome))
  on conflict (account_id, nome_key)
  do update set nome = excluded.nome
  returning id into v_campo_id;

  if p_projeto_id is not null then
    insert into public.perguntas_projeto (account_id, projeto_id, campo_id)
    values (v_uid, p_projeto_id, v_campo_id)
    on conflict (projeto_id, campo_id) do nothing;

    select conteudo
      into v_modelo
    from public.respostas_modelo
    where projeto_id = p_projeto_id
      and campo_id = v_campo_id;
  end if;

  insert into public.respostas_inscricao (
    account_id,
    inscricao_id,
    campo_id,
    conteudo,
    updated_at
  )
  values (
    v_uid,
    p_inscricao_id,
    v_campo_id,
    coalesce(v_modelo, ''),
    now()
  )
  on conflict (inscricao_id, campo_id) do nothing;

  return v_campo_id;
end;
$$;

grant execute on function public.criar_pergunta_inscricao(uuid, uuid, text) to authenticated;
