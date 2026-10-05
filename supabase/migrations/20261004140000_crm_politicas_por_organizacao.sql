-- Corrige as regras de acesso de crm_interacoes, crm_followups e crm_duvidas.
--
-- Em 20260828000010 a comparação era "om.organization_id = organization_id"
-- dentro do EXISTS. Sem prefixo, o Postgres lê organization_id como a coluna
-- de "om", e a condição fica sempre verdadeira: qualquer membro de qualquer
-- organização via e alterava os registros de todas as outras.
-- Aplicada em produção em 04/10/2026. Idempotente.

do $$
declare
  tabela text;
  condicao text;
begin
  foreach tabela in array array['crm_interacoes', 'crm_duvidas', 'crm_followups'] loop
    condicao := format(
      'exists (select 1 from public.organization_members om where om.organization_id = %I.organization_id and om.user_id = auth.uid())',
      tabela);
    execute format('alter policy %I on public.%I using (%s)', tabela || '_org_select', tabela, condicao);
    execute format('alter policy %I on public.%I using (%s) with check (%s)', tabela || '_org_manage', tabela, condicao, condicao);
  end loop;
end
$$;
