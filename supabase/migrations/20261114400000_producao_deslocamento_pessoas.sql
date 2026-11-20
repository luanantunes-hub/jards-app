-- PD6.2 (segundo corte): quem vai em cada deslocamento.
--
-- producao_deslocamento_pessoas: as pessoas do cadastro da equipe que fazem o deslocamento (passageiros e, se quiser, o
-- motorista também). Uma pessoa uma só vez por deslocamento. A tela avisa quando a mesma pessoa está em dois deslocamentos
-- de horários que se cruzam e quando vão mais pessoas do que o veículo tem de lugares; o banco não barra (a pessoa decide).
--
-- Acesso: o do deslocamento (quem lê o deslocamento lê quem vai; quem edita e vê o deslocamento escreve), então o recorte
-- "só onde está vinculado" vale. Para pôr uma pessoa, ela tem de estar à vista de quem grava (quem tem o recorte não traz
-- uma pessoa que não vê). Sem histórico (a ligação é só "esta pessoa vai"; o deslocamento tem o dele).
-- Apagar: sai com o deslocamento e com a organização; a pessoa que vai a algum deslocamento não se apaga.
--
-- Expansão: uma tabela nova e vazia e uma função de gatilho. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_deslocamento_pessoas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  deslocamento_id uuid not null references public.producao_deslocamentos (id) on delete cascade,
  pessoa_id uuid not null references public.producao_pessoas (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint producao_deslocamento_pessoas_pessoa_key unique (deslocamento_id, pessoa_id)
);

create index if not exists producao_deslocamento_pessoas_org_idx on public.producao_deslocamento_pessoas (organization_id);
create index if not exists producao_deslocamento_pessoas_pessoa_idx on public.producao_deslocamento_pessoas (pessoa_id);

-- Coerência: a organização, o deslocamento e a pessoa não mudam; o deslocamento e a pessoa são da organização.
-- Erros (check_violation): organizacao_nao_muda, deslocamento_nao_muda, pessoa_nao_muda, deslocamento_de_outra_organizacao,
-- pessoa_de_outra_organizacao.
create or replace function public.fn_producao_deslocamento_pessoa_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.deslocamento_id is distinct from old.deslocamento_id then
    raise exception 'deslocamento_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.pessoa_id is distinct from old.pessoa_id then
    raise exception 'pessoa_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_deslocamentos d where d.id = new.deslocamento_id and d.organization_id = new.organization_id) then
    raise exception 'deslocamento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.producao_pessoas p where p.id = new.pessoa_id and p.organization_id = new.organization_id) then
    raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_deslocamento_pessoas_coerencia
  before insert or update of organization_id, deslocamento_id, pessoa_id on public.producao_deslocamento_pessoas
  for each row execute function public.fn_producao_deslocamento_pessoa_coerencia();

alter table public.producao_deslocamento_pessoas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_deslocamento_pessoas' and policyname = 'producao_deslocamento_pessoas: le') then
    create policy "producao_deslocamento_pessoas: le" on public.producao_deslocamento_pessoas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_deslocamento_pessoas.deslocamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_deslocamento_pessoas' and policyname = 'producao_deslocamento_pessoas: leitura sem assinatura') then
    create policy "producao_deslocamento_pessoas: leitura sem assinatura" on public.producao_deslocamento_pessoas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_deslocamentos d where d.id = producao_deslocamento_pessoas.deslocamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_deslocamento_pessoas' and policyname = 'producao_deslocamento_pessoas: insere') then
    create policy "producao_deslocamento_pessoas: insere" on public.producao_deslocamento_pessoas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_deslocamento_pessoas.deslocamento_id) and exists (select 1 from public.producao_pessoas p where p.id = producao_deslocamento_pessoas.pessoa_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_deslocamento_pessoas' and policyname = 'producao_deslocamento_pessoas: edita') then
    create policy "producao_deslocamento_pessoas: edita" on public.producao_deslocamento_pessoas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_deslocamento_pessoas.deslocamento_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_deslocamento_pessoas.deslocamento_id) and exists (select 1 from public.producao_pessoas p where p.id = producao_deslocamento_pessoas.pessoa_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_deslocamento_pessoas' and policyname = 'producao_deslocamento_pessoas: apaga') then
    create policy "producao_deslocamento_pessoas: apaga" on public.producao_deslocamento_pessoas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_deslocamento_pessoas.deslocamento_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_deslocamento_pessoa_coerencia() from public, anon, authenticated;
revoke all on public.producao_deslocamento_pessoas from anon, authenticated;
grant select, insert, update, delete on public.producao_deslocamento_pessoas to authenticated;

comment on table public.producao_deslocamento_pessoas is
  'Quem faz cada deslocamento: uma pessoa da equipe, uma vez por deslocamento.';
