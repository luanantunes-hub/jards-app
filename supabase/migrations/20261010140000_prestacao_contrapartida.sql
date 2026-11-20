-- P7.2: de onde sai o dinheiro de cada despesa.
--
-- Na ANCINE a contrapartida (ao menos 5% do orçamento global quando há
-- mecanismo da Lei do Audiovisual; Lei 8.685, art. 4º, § 2º, I, e IN 159,
-- art. 16, § 1º) é comprovada com despesas, em dinheiro ou por doação de
-- bens e serviços (IN 159, art. 18, XXXIV). Vazio é o recurso do projeto, o
-- incentivado; as despesas que já existem continuam assim.
--
-- A coluna entra na regra de acesso, na trava depois do envio e no retrato do
-- envio como as outras da despesa, sem mudança nelas.

alter table public.prestacao_comprovantes add column if not exists contrapartida text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prestacao_comprovantes_contrapartida_check'
                 and conrelid = 'public.prestacao_comprovantes'::regclass) then
    alter table public.prestacao_comprovantes add constraint prestacao_comprovantes_contrapartida_check check (
      contrapartida is null or contrapartida in ('financeira', 'doacao')
    );
  end if;
end
$$;

comment on column public.prestacao_comprovantes.contrapartida is
  'Despesa paga como contrapartida: financeira (em dinheiro) ou doacao (bens e serviços); vazio é o recurso do projeto.';
