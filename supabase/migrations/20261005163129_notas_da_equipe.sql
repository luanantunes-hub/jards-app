-- Notas visíveis para a equipe: quem vê o registro vê as notas dele.
-- A visibilidade segue a do registro (o RLS de cada tabela vale dentro do
-- exists): notas de uma empresa aparecem para quem vê a empresa, as de uma
-- negociação para quem vê a negociação, e assim por diante. Editar e excluir
-- continuam só para quem escreveu (políticas "próprio", inalteradas).
-- Esta migration é idempotente.

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'notas' and policyname = 'notas: select do registro'
  ) then
    create policy "notas: select do registro" on public.notas
      for select to authenticated
      using (
        (empresa_crm_id is not null and exists (select 1 from public.empresas_crm e where e.id = notas.empresa_crm_id))
        or (captacao_id is not null and exists (select 1 from public.captacoes c where c.id = notas.captacao_id))
        or (edital_user_id is not null and exists (select 1 from public.editais_user i where i.id = notas.edital_user_id))
        or (proponente_id is not null and exists (select 1 from public.proponentes p where p.id = notas.proponente_id))
        or (contato_id is not null and exists (select 1 from public.contatos ct where ct.id = notas.contato_id))
      );
  end if;
end;
$$;

create index if not exists notas_edital_user_id_idx on public.notas (edital_user_id) where edital_user_id is not null;
