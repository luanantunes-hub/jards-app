-- PD1.6: notas da data.
--
-- producao_notas: uma nota de texto livre numa data (combinado por telefone, lembrete, o que o contratante pediu).
-- Interna da organização: não entra na folha da equipe (a folha é outra entrega). Quem escreveu fica em `autor`
-- (padrão auth.uid()); o texto é o rótulo do histórico.
--
-- Acesso: o da data (quem lê a data lê as notas; quem edita e vê a data escreve). Sem dinheiro.
-- Apagar: a nota sai com a data e com a organização.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho e a função do histórico trocada (create or replace,
-- mesma assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_notas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  data_id uuid not null references public.producao_datas (id) on delete cascade,
  texto text not null,
  autor uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_notas_texto_check check (char_length(btrim(texto)) between 1 and 4000)
);

create index if not exists producao_notas_org_idx on public.producao_notas (organization_id);
create index if not exists producao_notas_data_idx on public.producao_notas (data_id, created_at desc);

-- Coerência: a nota está na organização da data, e nem a data nem a organização mudam. Erros (check_violation):
-- organizacao_nao_muda, data_nao_muda, data_de_outra_organizacao.
create or replace function public.fn_producao_nota_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.data_id is distinct from old.data_id then
    raise exception 'data_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  perform 1 from public.producao_datas d where d.id = new.data_id and d.organization_id = new.organization_id;
  if new.data_id is not null and not found then
    raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_notas_coerencia
  before insert or update of organization_id, data_id on public.producao_notas
  for each row execute function public.fn_producao_nota_coerencia();
create or replace trigger producao_notas_updated_at
  before update on public.producao_notas
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_notas_historico
  after insert or update or delete on public.producao_notas
  for each row execute function public.fn_producao_historico('', 'texto');

-- Quem vê o histórico: o texto de 20261104045907_producao_tarefas.sql com um ramo novo no fim.
create or replace function public.auth_producao_ve_historico(p_org uuid, p_entidade text, p_entidade_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(case p_entidade
    when 'producao_obras' then exists (select 1 from public.producao_obras x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_temporadas' then exists (select 1 from public.producao_temporadas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_datas' then exists (select 1 from public.producao_datas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_blocos' then exists (select 1 from public.producao_blocos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_espacos' then exists (select 1 from public.producao_espacos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_salas' then exists (select 1 from public.producao_salas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_funcoes' then exists (select 1 from public.producao_funcoes x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_arquivos' then exists (select 1 from public.producao_arquivos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_pessoas' then exists (select 1 from public.producao_pessoas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_vinculos' then exists (select 1 from public.producao_vinculos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_escalas' then exists (select 1 from public.producao_escalas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_cartoes_dia' then exists (select 1 from public.producao_cartoes_dia x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_tarefas' then exists (select 1 from public.producao_tarefas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_notas' then exists (select 1 from public.producao_notas x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

alter table public.producao_notas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_notas' and policyname = 'producao_notas: le') then
    create policy "producao_notas: le" on public.producao_notas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_datas d where d.id = producao_notas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_notas' and policyname = 'producao_notas: leitura sem assinatura') then
    create policy "producao_notas: leitura sem assinatura" on public.producao_notas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_datas d where d.id = producao_notas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_notas' and policyname = 'producao_notas: insere') then
    create policy "producao_notas: insere" on public.producao_notas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_notas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_notas' and policyname = 'producao_notas: edita') then
    create policy "producao_notas: edita" on public.producao_notas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_notas.data_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_notas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_notas' and policyname = 'producao_notas: apaga') then
    create policy "producao_notas: apaga" on public.producao_notas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_notas.data_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_nota_coerencia() from public, anon, authenticated;
revoke all on public.producao_notas from anon, authenticated;
grant select, insert, update, delete on public.producao_notas to authenticated;

comment on table public.producao_notas is
  'Nota de texto livre numa data da produção. Interna da organização; não entra na folha da equipe.';
