-- Permite ordenar os campos de conteúdo separadamente em cada inscrição.

alter table public.respostas_inscricao
  add column if not exists ordem integer;

with ordenadas as (
  select
    id,
    row_number() over (
      partition by inscricao_id
      order by updated_at desc nulls last, id
    ) - 1 as nova_ordem
  from public.respostas_inscricao
)
update public.respostas_inscricao resposta
set ordem = ordenadas.nova_ordem
from ordenadas
where resposta.id = ordenadas.id
  and resposta.ordem is null;

create or replace function public.definir_ordem_resposta_inscricao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ordem is null then
    select coalesce(max(resposta.ordem), -1) + 1
      into new.ordem
    from public.respostas_inscricao resposta
    where resposta.inscricao_id = new.inscricao_id;
  end if;
  return new;
end;
$$;

drop trigger if exists respostas_inscricao_definir_ordem
  on public.respostas_inscricao;
create trigger respostas_inscricao_definir_ordem
before insert on public.respostas_inscricao
for each row execute function public.definir_ordem_resposta_inscricao();

alter table public.respostas_inscricao
  alter column ordem set not null;

create index if not exists respostas_inscricao_inscricao_ordem_idx
  on public.respostas_inscricao (inscricao_id, ordem);

create or replace function public.reordenar_respostas_inscricao(
  p_inscricao_id uuid,
  p_campo_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_total integer;
  v_distintos integer;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  if not exists (
    select 1
    from public.editais_user
    where id = p_inscricao_id
      and account_id = v_uid
  ) then
    raise exception 'Inscrição não encontrada ou sem acesso';
  end if;

  select count(*)
    into v_total
  from public.respostas_inscricao
  where inscricao_id = p_inscricao_id
    and account_id = v_uid;

  select count(distinct campo_id)
    into v_distintos
  from unnest(coalesce(p_campo_ids, array[]::uuid[])) as campo(campo_id);

  if cardinality(coalesce(p_campo_ids, array[]::uuid[])) <> v_total
     or v_distintos <> v_total
     or exists (
       select 1
       from unnest(coalesce(p_campo_ids, array[]::uuid[])) as campo(campo_id)
       where not exists (
         select 1
         from public.respostas_inscricao resposta
         where resposta.inscricao_id = p_inscricao_id
           and resposta.account_id = v_uid
           and resposta.campo_id = campo.campo_id
       )
     ) then
    raise exception 'A sequência informada não corresponde aos campos da inscrição';
  end if;

  update public.respostas_inscricao resposta
  set ordem = sequencia.posicao - 1
  from unnest(p_campo_ids) with ordinality as sequencia(campo_id, posicao)
  where resposta.inscricao_id = p_inscricao_id
    and resposta.account_id = v_uid
    and resposta.campo_id = sequencia.campo_id;
end;
$$;

grant execute on function public.reordenar_respostas_inscricao(uuid, uuid[])
  to authenticated;

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
  select
    campo.id,
    campo.nome,
    resposta.conteudo,
    modelo.conteudo,
    modelo.id is not null
  from public.editais_user inscricao
  join public.respostas_inscricao resposta
    on resposta.inscricao_id = inscricao.id
   and resposta.account_id = auth.uid()
  join public.campos_resposta campo
    on campo.id = resposta.campo_id
  left join public.respostas_modelo modelo
    on modelo.projeto_id = inscricao.projeto_id
   and modelo.campo_id = resposta.campo_id
  where inscricao.id = p_inscricao_id
    and inscricao.account_id = auth.uid()
  order by resposta.ordem, resposta.updated_at desc, campo.nome;
$$;

grant execute on function public.get_registros_inscricao(uuid, uuid)
  to authenticated;
