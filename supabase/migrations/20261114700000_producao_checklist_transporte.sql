-- PD6.3 (primeiro corte): checklist de transporte de cada deslocamento.
--
-- producao_checklist_itens: as linhas do que vai no deslocamento: itens (ligados ao inventário ou digitados) e documentos (CNH do motorista,
-- documento do veículo, licença da ANTT, lista de passageiros, nota de remessa), cada uma com a quantidade e duas conferências:
-- a da saída e a da volta (pendente, conferido, faltou ou avariado). A hora de cada conferência é carimbada pelo banco quando a
-- situação muda. A tela soma peso e volume dos itens do inventário e avisa quando passam da capacidade do veículo; fotos, a fila
-- offline do motorista e o abastecimento ficam para os próximos cortes.
--
-- Acesso: o do deslocamento (quem lê o deslocamento lê o checklist; quem edita e vê o deslocamento escreve), então o recorte
-- "só onde está vinculado" vale. Sem dinheiro. Sem histórico (a situação e a hora de cada conferência ficam na própria linha).
-- Apagar: a linha sai com o deslocamento e com a organização; apagar o item do inventário só solta a ligação (a linha fica com o nome).
--
-- Expansão: uma tabela nova e vazia e uma função de gatilho. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_checklist_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  deslocamento_id uuid not null references public.producao_deslocamentos (id) on delete cascade,
  tipo text not null default 'item',
  nome text not null,
  quantidade integer not null default 1,
  item_id uuid references public.producao_itens (id) on delete set null,
  saida text not null default 'pendente',
  saida_em timestamptz,
  volta text not null default 'pendente',
  volta_em timestamptz,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_checklist_itens_tipo_check check (tipo in ('item', 'documento')),
  constraint producao_checklist_itens_nome_check check (char_length(btrim(nome)) between 1 and 200),
  constraint producao_checklist_itens_quantidade_check check (quantidade between 1 and 99999),
  constraint producao_checklist_itens_saida_check check (saida in ('pendente', 'conferido', 'faltou', 'avariado')),
  constraint producao_checklist_itens_volta_check check (volta in ('pendente', 'conferido', 'faltou', 'avariado')),
  constraint producao_checklist_itens_documento_check check (tipo = 'item' or item_id is null),
  constraint producao_checklist_itens_notas_check check (notas is null or char_length(btrim(notas)) between 1 and 1000)
);

create index if not exists producao_checklist_itens_org_idx on public.producao_checklist_itens (organization_id);
create index if not exists producao_checklist_itens_deslocamento_idx on public.producao_checklist_itens (deslocamento_id, tipo, nome);
create index if not exists producao_checklist_itens_item_idx on public.producao_checklist_itens (item_id) where item_id is not null;

-- Coerência: a organização e o deslocamento não mudam; o deslocamento e o item do inventário são da organização; a hora de cada
-- conferência é carimbada aqui quando a situação muda (volta a pendente, limpa).
-- Erros (check_violation): organizacao_nao_muda, deslocamento_nao_muda, deslocamento_de_outra_organizacao, item_de_outra_organizacao.
create or replace function public.fn_producao_checklist_item_coerencia()
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
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_deslocamentos d where d.id = new.deslocamento_id and d.organization_id = new.organization_id) then
    raise exception 'deslocamento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.item_id is not null and not exists (select 1 from public.producao_itens i where i.id = new.item_id and i.organization_id = new.organization_id) then
    raise exception 'item_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' then
    new.saida_em := case when new.saida = 'pendente' then null else now() end;
    new.volta_em := case when new.volta = 'pendente' then null else now() end;
  else
    if new.saida is distinct from old.saida then
      new.saida_em := case when new.saida = 'pendente' then null else now() end;
    end if;
    if new.volta is distinct from old.volta then
      new.volta_em := case when new.volta = 'pendente' then null else now() end;
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger producao_checklist_itens_coerencia
  before insert or update on public.producao_checklist_itens
  for each row execute function public.fn_producao_checklist_item_coerencia();
create or replace trigger producao_checklist_itens_updated_at
  before update on public.producao_checklist_itens
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_checklist_itens enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_checklist_itens' and policyname = 'producao_checklist_itens: le') then
    create policy "producao_checklist_itens: le" on public.producao_checklist_itens for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_checklist_itens.deslocamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_checklist_itens' and policyname = 'producao_checklist_itens: leitura sem assinatura') then
    create policy "producao_checklist_itens: leitura sem assinatura" on public.producao_checklist_itens for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_deslocamentos d where d.id = producao_checklist_itens.deslocamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_checklist_itens' and policyname = 'producao_checklist_itens: insere') then
    create policy "producao_checklist_itens: insere" on public.producao_checklist_itens for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_checklist_itens.deslocamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_checklist_itens' and policyname = 'producao_checklist_itens: edita') then
    create policy "producao_checklist_itens: edita" on public.producao_checklist_itens for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_checklist_itens.deslocamento_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_checklist_itens.deslocamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_checklist_itens' and policyname = 'producao_checklist_itens: apaga') then
    create policy "producao_checklist_itens: apaga" on public.producao_checklist_itens for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_checklist_itens.deslocamento_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_checklist_item_coerencia() from public, anon, authenticated;
revoke all on public.producao_checklist_itens from anon, authenticated;
grant select, insert, update, delete on public.producao_checklist_itens to authenticated;

comment on table public.producao_checklist_itens is
  'Checklist de transporte de um deslocamento: itens e documentos, com a conferência da saída e a da volta (pendente, conferido, faltou, avariado) e a hora de cada uma.';
