-- Leis/mecanismos personalizados por organização, usando a taxonomia já existente.
alter table public.crm_taxonomia_opcoes
  drop constraint if exists crm_taxonomia_opcoes_categoria_check;

alter table public.crm_taxonomia_opcoes
  add constraint crm_taxonomia_opcoes_categoria_check
  check (categoria in ('origem', 'canal', 'resultado', 'lei'));

-- Negociações passam a aceitar chaves estáveis criadas pela organização.
alter table public.captacoes drop constraint if exists captacoes_lei_check;
alter table public.captacoes
  add constraint captacoes_lei_check
  check (lei is null or lei ~ '^[a-z0-9_]{2,60}$');

drop policy if exists "crm_taxonomia: equipe cria leis" on public.crm_taxonomia_opcoes;
drop policy if exists "crm_taxonomia: equipe edita leis" on public.crm_taxonomia_opcoes;
drop policy if exists "crm_taxonomia: equipe exclui leis" on public.crm_taxonomia_opcoes;

create policy "crm_taxonomia: equipe cria leis" on public.crm_taxonomia_opcoes
  for insert to authenticated
  with check (categoria = 'lei' and public.auth_can_write_org(organization_id));

create policy "crm_taxonomia: equipe edita leis" on public.crm_taxonomia_opcoes
  for update to authenticated
  using (categoria = 'lei' and public.auth_can_write_org(organization_id))
  with check (categoria = 'lei' and public.auth_can_write_org(organization_id));

create policy "crm_taxonomia: equipe exclui leis" on public.crm_taxonomia_opcoes
  for delete to authenticated
  using (categoria = 'lei' and public.auth_can_write_org(organization_id));
