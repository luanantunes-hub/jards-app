-- P0.2, contração: toda prestação tem organização, e o acesso vem só dela.
--
-- A expansão (20261005100000) criou a coluna anulável e manteve, para as
-- prestações sem organização, a exceção de quem criou e o acesso pelo projeto
-- ou pela captação. Em 05/10/2026 nenhuma prestação está sem organização e o
-- app publicado grava a organização atual ao criar. Então:
--   - organization_id passa a ser obrigatório;
--   - can_access_prestacao e auth_prestacao_pode perdem o ramo "sem organização";
--   - a regra permissiva deixa de liberar quem criou e passa a olhar a
--     organização da própria linha (no insert, can_access_prestacao(id) ainda
--     não encontra a linha; era a exceção de quem criou que deixava inserir);
--   - as regras restritivas perdem o "organization_id is null or".
-- Quem criou e saiu da organização deixa de ver a prestação, como qualquer
-- ex-membro. Sem DROP: as regras mudam com ALTER POLICY.
--
-- Para desfazer: tirar o not null da coluna e voltar as funções e as regras
-- ao texto de 20261005100000, 20261005110000 e 20261005140000.

do $$
begin
  if exists (select 1 from public.prestacoes_contas where organization_id is null) then
    raise exception 'Há prestação sem organização: preencha antes da contração';
  end if;
end
$$;

alter table public.prestacoes_contas alter column organization_id set not null;

-- ─── Novas prestações ───────────────────────────────────────────────────────
-- Continua preenchendo pela organização do projeto ou da captação; sem
-- nenhuma das três, a mensagem diz o que falta em vez do erro da coluna.

create or replace function public.fn_prestacao_organizacao()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  org_projeto uuid;
  org_captacao uuid;
begin
  select organization_id into org_projeto from public.projetos_crm where id = new.projeto_id;
  select organization_id into org_captacao from public.captacoes where id = new.captacao_id;

  if new.organization_id is null then
    new.organization_id := coalesce(org_projeto, org_captacao);
  end if;

  if new.organization_id is null then
    raise exception 'A prestação precisa de uma organização' using errcode = 'not_null_violation';
  end if;
  if org_projeto is not null and org_projeto <> new.organization_id then
    raise exception 'O projeto é de outra organização' using errcode = 'check_violation';
  end if;
  if org_captacao is not null and org_captacao <> new.organization_id then
    raise exception 'A negociação é de outra organização' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ─── Acesso ─────────────────────────────────────────────────────────────────

create or replace function public.can_access_prestacao(target_prestacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.prestacoes_contas p
    where p.id = target_prestacao_id
      and p.organization_id = any(array(select public.auth_org_ids()))
      and public.auth_tem_modulo(p.organization_id, 'prestacao')
  );
$$;

create or replace function public.auth_prestacao_pode(p_prestacao_id uuid, p_acao text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_jards_super_admin() or exists (
    select 1
    from public.prestacoes_contas p
    join public.organization_members membro
      on membro.organization_id = p.organization_id
     and membro.user_id = auth.uid()
    where p.id = p_prestacao_id
      and public.can_access_prestacao(p.id)
      and public.auth_prestacao_papel_permite(membro.papel, membro.prestacao_funcao, p_acao)
  );
$$;

alter policy "auth users can manage prestacoes" on public.prestacoes_contas
  using (
    organization_id = any(array(select public.auth_org_ids()))
    and public.auth_tem_modulo(organization_id, 'prestacao')
  )
  with check (
    organization_id = any(array(select public.auth_org_ids()))
    and public.auth_tem_modulo(organization_id, 'prestacao')
  );

alter policy "prestacoes_contas: organizacao do usuario ao criar" on public.prestacoes_contas
  with check (organization_id = any(array(select public.auth_org_ids())));

alter policy "prestacoes_contas: organizacao do usuario ao alterar" on public.prestacoes_contas
  with check (organization_id = any(array(select public.auth_org_ids())));

alter policy "prestacoes_contas: papel cria" on public.prestacoes_contas
  with check (public.auth_prestacao_pode_criar(organization_id));
