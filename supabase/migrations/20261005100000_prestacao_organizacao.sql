-- P0.2: cada prestação pertence a uma organização.
--
-- Antes, o acesso dependia de olhar o projeto ou a captação vinculados; uma
-- prestação sem os dois só era vista por quem criou. Agora a organização fica
-- na própria prestação. Etapa de expansão: a coluna aceita null enquanto o
-- app antigo ainda puder criar prestações sem ela; o "not null" e o fim da
-- exceção de quem criou entram depois, em migration própria.
-- Idempotente; sem DROP.

alter table public.prestacoes_contas
  add column if not exists organization_id uuid references public.organizations(id);

create index if not exists prestacoes_contas_organization_id_idx
  on public.prestacoes_contas (organization_id);

-- ─── Preenchimento ──────────────────────────────────────────────────────────
-- Organização do projeto; senão a da captação; senão a de quem criou, se for
-- uma só. O que sobrar fica null e continua visível só para quem criou.

update public.prestacoes_contas p
set organization_id = coalesce(
  (select projeto.organization_id from public.projetos_crm projeto where projeto.id = p.projeto_id),
  (select captacao.organization_id from public.captacoes captacao where captacao.id = p.captacao_id),
  (select membro.organization_id from public.organization_members membro
    where membro.user_id = p.criado_por
      and (select count(*) from public.organization_members outro where outro.user_id = p.criado_por) = 1)
)
where p.organization_id is null;

-- ─── Novas prestações ───────────────────────────────────────────────────────
-- Sem organização informada, usa a do projeto ou a da captação. Projeto ou
-- captação de outra organização é recusado. SECURITY INVOKER de propósito:
-- só enxerga o projeto e a captação que a pessoa já pode ler.

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

  if new.organization_id is not null then
    if org_projeto is not null and org_projeto <> new.organization_id then
      raise exception 'O projeto é de outra organização' using errcode = 'check_violation';
    end if;
    if org_captacao is not null and org_captacao <> new.organization_id then
      raise exception 'A negociação é de outra organização' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger
                 where tgname = 'trg_prestacao_organizacao'
                   and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger trg_prestacao_organizacao
      before insert or update of organization_id, projeto_id, captacao_id on public.prestacoes_contas
      for each row execute function public.fn_prestacao_organizacao();
  end if;
end
$$;

-- ─── Acesso ─────────────────────────────────────────────────────────────────
-- Com organização: membros dela. Sem organização (transição): quem criou, ou
-- membro da organização do projeto ou da captação, como antes.

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
      and (
        p.organization_id = any(array(select public.auth_org_ids()))
        or (
          p.organization_id is null
          and (
            p.criado_por = auth.uid()
            or exists (
              select 1 from public.projetos_crm projeto
              where projeto.id = p.projeto_id
                and projeto.organization_id = any(array(select public.auth_org_ids()))
            )
            or exists (
              select 1 from public.captacoes captacao
              where captacao.id = p.captacao_id
                and captacao.organization_id = any(array(select public.auth_org_ids()))
            )
          )
        )
      )
  );
$$;

-- Ninguém cria nem move prestação para organização da qual não é membro.
-- Regras RESTRICTIVE: somam-se às regras de acesso que já existem.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacoes_contas'
                 and policyname = 'prestacoes_contas: organizacao do usuario ao criar') then
    create policy "prestacoes_contas: organizacao do usuario ao criar" on public.prestacoes_contas
      as restrictive for insert to authenticated
      with check (organization_id is null or organization_id = any(array(select public.auth_org_ids())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacoes_contas'
                 and policyname = 'prestacoes_contas: organizacao do usuario ao alterar') then
    create policy "prestacoes_contas: organizacao do usuario ao alterar" on public.prestacoes_contas
      as restrictive for update to authenticated
      using (true)
      with check (organization_id is null or organization_id = any(array(select public.auth_org_ids())));
  end if;
end
$$;
