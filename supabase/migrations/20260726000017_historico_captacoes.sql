-- ─── Tabela histórico de captações ──────────────────────────────────────────
-- Registra automaticamente cada alteração nos campos da tabela captacoes.

create table if not exists "historico_captações" (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid references auth.users(id) not null,
  organization_id uuid references organizations(id),
  captacao_id     uuid references captacoes(id) on delete cascade,
  user_id         uuid references auth.users(id),
  campo           text not null,
  valor_anterior  text,
  valor_novo      text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_historico_captacao on "historico_captações"(captacao_id);
create index if not exists idx_historico_org     on "historico_captações"(organization_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table "historico_captações" enable row level security;

drop policy if exists "historico: select org" on "historico_captações";
create policy "historico: select org"
  on "historico_captações" for select to authenticated
  using (organization_id = any(array(select auth_org_ids())));

drop policy if exists "historico: insert org" on "historico_captações";
create policy "historico: insert org"
  on "historico_captações" for insert to authenticated
  with check (organization_id = any(array(select auth_org_ids())));

-- ─── Trigger automático ─────────────────────────────────────────────────────
-- Compara cada coluna rastreável e insere registros no histórico quando há mudança.

create or replace function fn_historico_captacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _user uuid := auth.uid();
  _org  uuid := coalesce(NEW.organization_id, OLD.organization_id);
  _cap  uuid := coalesce(NEW.id, OLD.id);
begin
  if OLD.status is distinct from NEW.status then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_user, _org, _cap, _user, 'status', OLD.status::text, NEW.status::text);
  end if;

  if OLD.prioridade is distinct from NEW.prioridade then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_user, _org, _cap, _user, 'prioridade', OLD.prioridade::text, NEW.prioridade::text);
  end if;

  if OLD.valor_solicitado is distinct from NEW.valor_solicitado then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_user, _org, _cap, _user, 'valor_solicitado', OLD.valor_solicitado::text, NEW.valor_solicitado::text);
  end if;

  if OLD.valor_aprovado is distinct from NEW.valor_aprovado then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_user, _org, _cap, _user, 'valor_aprovado', OLD.valor_aprovado::text, NEW.valor_aprovado::text);
  end if;

  if OLD.meio_contato is distinct from NEW.meio_contato then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_user, _org, _cap, _user, 'meio_contato', OLD.meio_contato::text, NEW.meio_contato::text);
  end if;

  if OLD.proxima_prospeccao is distinct from NEW.proxima_prospeccao then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_user, _org, _cap, _user, 'proxima_prospeccao', OLD.proxima_prospeccao::text, NEW.proxima_prospeccao::text);
  end if;

  if OLD.data_previsao is distinct from NEW.data_previsao then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_user, _org, _cap, _user, 'data_previsao', OLD.data_previsao::text, NEW.data_previsao::text);
  end if;

  if OLD.empresa_crm_id is distinct from NEW.empresa_crm_id then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_user, _org, _cap, _user, 'empresa_crm_id', OLD.empresa_crm_id::text, NEW.empresa_crm_id::text);
  end if;

  if OLD.projeto_id is distinct from NEW.projeto_id then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_user, _org, _cap, _user, 'projeto_id', OLD.projeto_id::text, NEW.projeto_id::text);
  end if;

  if OLD.captador_id is distinct from NEW.captador_id then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_user, _org, _cap, _user, 'captador_id', OLD.captador_id::text, NEW.captador_id::text);
  end if;

  if OLD.retorno is distinct from NEW.retorno then
    insert into "historico_captações" (account_id, organization_id, captacao_id, user_id, campo, valor_anterior, valor_novo)
    values (_user, _org, _cap, _user, 'retorno', OLD.retorno::text, NEW.retorno::text);
  end if;

  return NEW;
end;
$$;

-- Só cria o trigger se ainda não existir
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_historico_captacao'
  ) then
    create trigger trg_historico_captacao
      after update on captacoes
      for each row
      execute function fn_historico_captacao();
  end if;
end;
$$;
