-- Passo 2: só aplicar DEPOIS que a página do patrocinador (que passa a ler por
-- fn_responsaveis_empresa) estiver no ar. Fecha a leitura direta da tabela
-- responsaveis, que hoje deixa qualquer conta logada baixar todos os contatos
-- sem plano, sem crédito e sem desbloqueio.
--
-- Para desfazer: recriar a policy antiga
--   create policy "responsaveis: leitura pública autenticada" on public.responsaveis
--     for select to authenticated using (true);

drop policy if exists "responsaveis: leitura pública autenticada" on public.responsaveis;

-- A área administrativa do Jards continua lendo a tabela diretamente.
drop policy if exists "responsaveis: leitura super admin" on public.responsaveis;
create policy "responsaveis: leitura super admin" on public.responsaveis
  for select to authenticated using (public.is_jards_super_admin());
