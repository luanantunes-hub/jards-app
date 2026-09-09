-- O seed de notas-modelo era feito client-side como "select vazio? então
-- insere" — duas chamadas concorrentes (ex: sair e voltar pra aba Notas
-- antes do primeiro insert terminar) passavam ambas pelo select vazio e
-- inseriam os 2 títulos duas vezes. Movendo para uma função com
-- ON CONFLICT DO NOTHING sobre o índice único de título por empresa, o
-- próprio banco garante que o segundo insert concorrente é descartado —
-- não importa quantas vezes ou quão rápido isso rode em paralelo.
create or replace function public.fn_seed_notas_modelo(p_empresa_crm_id uuid, p_account_id uuid)
returns void
language sql
security invoker
as $$
  insert into public.notas (titulo, conteudo, empresa_crm_id, account_id)
  select t.titulo, '', p_empresa_crm_id, p_account_id
  from unnest(array['Que tipo de projetos patrocina?', 'Quais contrapartidas geram valor?']) as t(titulo)
  on conflict (empresa_crm_id, lower(titulo)) where titulo is not null do nothing;
$$;
