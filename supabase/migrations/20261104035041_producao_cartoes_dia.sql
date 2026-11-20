-- PD1.8: viagem e hospedagem do dia, dois cartões simples na data.
--
-- producao_cartoes_dia: um cartão de "viagem" e um de "hospedagem" por data, com título, horário
-- (início e fim), endereço, localizador e notas. Aparecem na folha do dia (PD1.12). A fase 6
-- transforma os cartões em deslocamentos e hospedagens completos e migra o que já foi digitado. O
-- arquivo (voucher, passagem) fica nos arquivos da data (producao_arquivos), não aqui.
--
-- Acesso: o da data. Lê quem lê a data; escreve quem edita e vê a data (a regra pergunta à própria
-- tabela das datas, então o recorte "só onde está vinculado" vale). Sem dinheiro. O histórico deixa o
-- localizador de fora (é um código de reserva) e usa o título como rótulo.
--
-- Apagar: o cartão sai com a data (on delete cascade) e com a organização. Expansão: uma tabela nova e
-- vazia, uma função de coerência e a função do histórico trocada (create or replace, mesma
-- assinatura, os ramos de antes e um novo no fim). Nenhuma organização real usa a produção além do
-- piloto. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_cartoes_dia (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  data_id uuid not null references public.producao_datas (id) on delete cascade,
  tipo text not null,
  titulo text,
  inicio timestamptz,
  fim timestamptz,
  endereco text,
  localizador text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_cartoes_dia_data_tipo_key unique (data_id, tipo),
  constraint producao_cartoes_dia_tipo_check check (tipo in ('viagem', 'hospedagem')),
  constraint producao_cartoes_dia_titulo_check check (titulo is null or char_length(btrim(titulo)) between 1 and 200),
  constraint producao_cartoes_dia_periodo_check check (fim is null or (inicio is not null and fim >= inicio)),
  constraint producao_cartoes_dia_endereco_check check (endereco is null or char_length(btrim(endereco)) between 1 and 300),
  constraint producao_cartoes_dia_localizador_check check (localizador is null or char_length(btrim(localizador)) between 1 and 80),
  constraint producao_cartoes_dia_notas_check check (notas is null or char_length(btrim(notas)) between 1 and 2000)
);

create index if not exists producao_cartoes_dia_org_idx on public.producao_cartoes_dia (organization_id);

create or replace function public.fn_producao_cartao_dia_coerencia()
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
  if new.data_id is not null and not exists (
    select 1 from public.producao_datas d where d.id = new.data_id and d.organization_id = new.organization_id
  ) then
    raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Quem vê o histórico: o texto de 20261030205545_producao_equipe.sql com um ramo novo no fim.
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
  end, false);
$$;

create or replace trigger producao_cartoes_dia_coerencia
  before insert or update of organization_id, data_id on public.producao_cartoes_dia
  for each row execute function public.fn_producao_cartao_dia_coerencia();
create or replace trigger producao_cartoes_dia_updated_at
  before update on public.producao_cartoes_dia
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_cartoes_dia_historico
  after insert or update or delete on public.producao_cartoes_dia
  for each row execute function public.fn_producao_historico('localizador', 'titulo');

alter table public.producao_cartoes_dia enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_cartoes_dia'
                 and policyname = 'producao_cartoes_dia: le') then
    create policy "producao_cartoes_dia: le" on public.producao_cartoes_dia for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_datas d where d.id = producao_cartoes_dia.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_cartoes_dia'
                 and policyname = 'producao_cartoes_dia: leitura sem assinatura') then
    create policy "producao_cartoes_dia: leitura sem assinatura" on public.producao_cartoes_dia for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_datas d where d.id = producao_cartoes_dia.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_cartoes_dia'
                 and policyname = 'producao_cartoes_dia: insere') then
    create policy "producao_cartoes_dia: insere" on public.producao_cartoes_dia for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_cartoes_dia.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_cartoes_dia'
                 and policyname = 'producao_cartoes_dia: edita') then
    create policy "producao_cartoes_dia: edita" on public.producao_cartoes_dia for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_cartoes_dia.data_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_cartoes_dia.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_cartoes_dia'
                 and policyname = 'producao_cartoes_dia: apaga') then
    create policy "producao_cartoes_dia: apaga" on public.producao_cartoes_dia for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_cartoes_dia.data_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_cartao_dia_coerencia() from public, anon, authenticated;
revoke all on public.producao_cartoes_dia from anon, authenticated;
grant select, insert, update, delete on public.producao_cartoes_dia to authenticated;

comment on table public.producao_cartoes_dia is
  'Viagem e hospedagem do dia: um cartão de cada por data, com título, horário, endereço, localizador e notas. Vão para a folha do dia. O arquivo fica nos arquivos da data.';
