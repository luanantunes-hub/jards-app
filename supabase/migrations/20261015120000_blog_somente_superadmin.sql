-- Blog institucional: só o superadmin da Jards lê rascunhos e escreve.
-- Antes, as regras liberavam leitura de rascunhos, criar, editar e apagar para
-- qualquer usuário com papel 'admin' em QUALQUER organização, ou seja, para
-- todo cliente (cada conta é admin da própria organização) — 149 contas.
-- A leitura pública dos posts publicados continua como estava
-- ("blog: leitura publica", status = 'publicado').
drop policy if exists "blog: admin insere" on public.blog_posts;
drop policy if exists "blog: admin atualiza" on public.blog_posts;
drop policy if exists "blog: admin deleta" on public.blog_posts;
drop policy if exists "blog: admin ve tudo" on public.blog_posts;
drop policy if exists "blog: super admin gerencia" on public.blog_posts;

create policy "blog: super admin gerencia" on public.blog_posts
  for all to authenticated
  using (public.is_jards_super_admin())
  with check (public.is_jards_super_admin());
