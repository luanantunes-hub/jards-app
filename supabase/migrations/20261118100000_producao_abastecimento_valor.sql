-- PD6.4 (segundo corte): o valor pago em cada abastecimento.
--
-- producao_abastecimento_valores: uma linha por abastecimento que tem valor (o valor pago em reais, de 0 a 99.999,99). Fica numa tabela à parte, e não
-- numa coluna do abastecimento, porque DINHEIRO só lê e escreve quem tem a permissão de dinheiro (a regra das tabelas de valores): o motorista e a
-- equipe que veem os litros não veem quanto custou. Sem histórico (o valor iria para uma linha que quem não vê o dinheiro também lê).
--
-- Acesso: o do abastecimento (que vale o recorte "só onde está vinculado") mais o dinheiro. O abastecimento apagado leva o valor junto. O valor sempre é da
-- mesma organização do abastecimento (`abastecimento_de_outra_organizacao`) e a organização não muda (`organizacao_nao_muda`).
-- A função da folha do motorista (fn_equipe_registrar_viagem) NÃO muda: o valor entra pela tela da produção.
-- Tabela nova e vazia; aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_abastecimento_valores (
  abastecimento_id uuid primary key references public.producao_abastecimentos (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  valor numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_abastecimento_valores_valor_check check (valor between 0 and 99999.99)
);

create index if not exists producao_abastecimento_valores_org_idx on public.producao_abastecimento_valores (organization_id);

-- Erros (check_violation): organizacao_nao_muda, abastecimento_de_outra_organizacao.
create or replace function public.fn_producao_abastecimento_valor_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_abastecimentos a where a.id = new.abastecimento_id and a.organization_id = new.organization_id) then
    raise exception 'abastecimento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_abastecimento_valores_coerencia
  before insert or update of organization_id, abastecimento_id on public.producao_abastecimento_valores
  for each row execute function public.fn_producao_abastecimento_valor_coerencia();
create or replace trigger producao_abastecimento_valores_updated_at
  before update on public.producao_abastecimento_valores
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_abastecimento_valores enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_abastecimento_valores' and policyname = 'producao_abastecimento_valores: le') then
    create policy "producao_abastecimento_valores: le" on public.producao_abastecimento_valores for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_abastecimentos a where a.id = producao_abastecimento_valores.abastecimento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_abastecimento_valores' and policyname = 'producao_abastecimento_valores: leitura sem assinatura') then
    create policy "producao_abastecimento_valores: leitura sem assinatura" on public.producao_abastecimento_valores for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_abastecimentos a where a.id = producao_abastecimento_valores.abastecimento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_abastecimento_valores' and policyname = 'producao_abastecimento_valores: insere') then
    create policy "producao_abastecimento_valores: insere" on public.producao_abastecimento_valores for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_abastecimentos a where a.id = producao_abastecimento_valores.abastecimento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_abastecimento_valores' and policyname = 'producao_abastecimento_valores: edita') then
    create policy "producao_abastecimento_valores: edita" on public.producao_abastecimento_valores for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_abastecimentos a where a.id = producao_abastecimento_valores.abastecimento_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_abastecimentos a where a.id = producao_abastecimento_valores.abastecimento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_abastecimento_valores' and policyname = 'producao_abastecimento_valores: apaga') then
    create policy "producao_abastecimento_valores: apaga" on public.producao_abastecimento_valores for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_abastecimentos a where a.id = producao_abastecimento_valores.abastecimento_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_abastecimento_valor_coerencia() from public, anon, authenticated;
revoke all on public.producao_abastecimento_valores from anon, authenticated;
grant select, delete on public.producao_abastecimento_valores to authenticated;
grant insert (abastecimento_id, organization_id, valor) on public.producao_abastecimento_valores to authenticated;
grant update (valor) on public.producao_abastecimento_valores to authenticated;

comment on table public.producao_abastecimento_valores is 'O valor pago em cada abastecimento (reais). Dinheiro: só lê e escreve quem tem a permissão de dinheiro; sem histórico.';
