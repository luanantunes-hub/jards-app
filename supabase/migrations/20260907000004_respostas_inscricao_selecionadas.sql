-- Mantém separados o banco reutilizável do projeto e as respostas de cada inscrição.
-- A inscrição exibe somente campos explicitamente adicionados a ela; o projeto
-- continua sendo a fonte de sugestões e respostas padrão.

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
    cr.id,
    cr.nome,
    ri.conteudo,
    rm.conteudo,
    rm.id is not null
  from public.editais_user eu
  join public.respostas_inscricao ri
    on ri.inscricao_id = eu.id
   and ri.account_id = auth.uid()
  join public.campos_resposta cr
    on cr.id = ri.campo_id
  left join public.respostas_modelo rm
    on rm.projeto_id = eu.projeto_id
   and rm.campo_id = ri.campo_id
  where eu.id = p_inscricao_id
    and eu.account_id = auth.uid()
  order by ri.updated_at desc, cr.nome;
$$;

comment on function public.get_registros_inscricao(uuid, uuid) is
  'Retorna somente respostas adicionadas à inscrição; padrões do projeto são usados como sugestão e conteúdo-base.';

grant execute on function public.get_registros_inscricao(uuid, uuid) to authenticated;
