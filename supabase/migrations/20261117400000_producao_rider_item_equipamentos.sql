-- PD4.4 (primeiro corte): a lista do que levar. Liga uma linha do rider a um equipamento da casa que a atende.
--
-- producao_rider_item_equipamentos: "esta linha do rider (2 refletores PAR) é atendida por este equipamento da casa (Refletor PAR 64, 6 unidades)". É a ligação
-- que a pessoa escolhe, uma a uma; o Jards só sugere. A lista do que levar sai daí: a linha do rider sem equipamento ligado na sala, ou com menos unidades em uso do
-- que ela pede, entra na lista. Como o equipamento é de uma sala (ou do espaço todo), trocar a sala muda a lista sozinho: o que estava ligado a outra sala não conta.
--
-- Acesso (o do rider, e a leitura sem assinatura como nas outras tabelas): lê quem lê a produção; escreve quem edita; a linha do rider e o equipamento têm de ser
-- visíveis a quem liga (as regras deles valem pela existência). Sem histórico (é só a ligação; o rider e o equipamento têm o deles).
--
-- Regras no banco: a linha do rider e o equipamento são da mesma organização (`item_de_outra_organizacao`, `equipamento_de_outra_organizacao`); a ligação não muda
-- (`ligacao_nao_muda`: tire e ligue de novo); a mesma linha liga a um equipamento uma vez. Apagar a linha do rider ou o equipamento leva a ligação.
--
-- Expansão: uma tabela nova e vazia e uma função de gatilho nova. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_rider_item_equipamentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rider_item_id uuid not null references public.producao_rider_itens (id) on delete cascade,
  equipamento_id uuid not null references public.producao_equipamentos (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint producao_rider_item_equipamentos_key unique (rider_item_id, equipamento_id)
);

create index if not exists producao_rider_item_equipamentos_org_idx on public.producao_rider_item_equipamentos (organization_id);
create index if not exists producao_rider_item_equipamentos_equipamento_idx on public.producao_rider_item_equipamentos (equipamento_id);

create or replace function public.fn_producao_rider_item_equipamento_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and (new.organization_id is distinct from old.organization_id or new.rider_item_id is distinct from old.rider_item_id
                           or new.equipamento_id is distinct from old.equipamento_id) then
    raise exception 'ligacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_rider_itens i where i.id = new.rider_item_id and i.organization_id = new.organization_id) then
    raise exception 'item_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.producao_equipamentos e where e.id = new.equipamento_id and e.organization_id = new.organization_id) then
    raise exception 'equipamento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_rider_item_equipamentos_coerencia
  before insert or update on public.producao_rider_item_equipamentos
  for each row execute function public.fn_producao_rider_item_equipamento_coerencia();

alter table public.producao_rider_item_equipamentos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_rider_item_equipamentos' and policyname = 'producao_rider_item_equipamentos: le') then
    create policy "producao_rider_item_equipamentos: le" on public.producao_rider_item_equipamentos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_rider_itens i where i.id = producao_rider_item_equipamentos.rider_item_id)
             and exists (select 1 from public.producao_equipamentos e where e.id = producao_rider_item_equipamentos.equipamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_rider_item_equipamentos' and policyname = 'producao_rider_item_equipamentos: leitura sem assinatura') then
    create policy "producao_rider_item_equipamentos: leitura sem assinatura" on public.producao_rider_item_equipamentos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_rider_itens i where i.id = producao_rider_item_equipamentos.rider_item_id)
             and exists (select 1 from public.producao_equipamentos e where e.id = producao_rider_item_equipamentos.equipamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_rider_item_equipamentos' and policyname = 'producao_rider_item_equipamentos: insere') then
    create policy "producao_rider_item_equipamentos: insere" on public.producao_rider_item_equipamentos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_rider_itens i where i.id = producao_rider_item_equipamentos.rider_item_id)
                  and exists (select 1 from public.producao_equipamentos e where e.id = producao_rider_item_equipamentos.equipamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_rider_item_equipamentos' and policyname = 'producao_rider_item_equipamentos: edita') then
    create policy "producao_rider_item_equipamentos: edita" on public.producao_rider_item_equipamentos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_rider_itens i where i.id = producao_rider_item_equipamentos.rider_item_id)
             and exists (select 1 from public.producao_equipamentos e where e.id = producao_rider_item_equipamentos.equipamento_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_rider_itens i where i.id = producao_rider_item_equipamentos.rider_item_id)
                  and exists (select 1 from public.producao_equipamentos e where e.id = producao_rider_item_equipamentos.equipamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_rider_item_equipamentos' and policyname = 'producao_rider_item_equipamentos: apaga') then
    create policy "producao_rider_item_equipamentos: apaga" on public.producao_rider_item_equipamentos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_rider_itens i where i.id = producao_rider_item_equipamentos.rider_item_id)
             and exists (select 1 from public.producao_equipamentos e where e.id = producao_rider_item_equipamentos.equipamento_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_rider_item_equipamento_coerencia() from public, anon, authenticated;
revoke all on public.producao_rider_item_equipamentos from anon, authenticated;
grant select, insert, update, delete on public.producao_rider_item_equipamentos to authenticated;

comment on table public.producao_rider_item_equipamentos is
  'Liga uma linha do rider ao equipamento da casa que a atende. A lista do que levar sai das linhas sem equipamento em uso na sala. Sem histórico.';
