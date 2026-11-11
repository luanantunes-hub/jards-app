-- PD6.1: veículos da produção e os documentos deles, com validade.
--
-- producao_veiculos: o que leva gente e carga (placa, modelo, ano, categoria, combustível, como foi contratado, consumo,
-- capacidade de carga e de lugares). Próprio, locado sem motorista ou fretado com combustível incluso; o fretado e o locado
-- guardam o fornecedor. producao_veiculo_documentos: os papéis do veículo (documento do veículo, seguro, licença da ANTT,
-- vistoria) com número e validade, para avisar antes de vencer.
--
-- Acesso: é da organização inteira, como o inventário (quem tem o recorte "só onde está vinculado" não vê). Sem dinheiro:
-- o custo do frete e do combustível entra com a PD6.4. O histórico guarda o veículo; os documentos não têm histórico (o
-- veículo, o tipo e a validade dizem o que importa). Arquivar o veículo o tira das listas sem apagar.
--
-- Expansão: duas tabelas novas e vazias, duas funções de gatilho e a função do histórico trocada (create or replace,
-- mesma assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_veiculos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null,
  placa text,
  modelo text,
  ano integer,
  categoria text not null default 'van',
  combustivel text not null default 'flex',
  contratacao text not null default 'proprio',
  fornecedor text,
  consumo_km_por_litro numeric(5, 2),
  capacidade_carga_kg numeric(9, 0),
  capacidade_volume_m3 numeric(7, 2),
  lugares integer,
  notas text,
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_veiculos_nome_check check (char_length(btrim(nome)) between 1 and 200),
  constraint producao_veiculos_placa_check check (placa is null or placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  constraint producao_veiculos_modelo_check check (modelo is null or char_length(btrim(modelo)) between 1 and 200),
  constraint producao_veiculos_ano_check check (ano is null or ano between 1950 and 2100),
  constraint producao_veiculos_categoria_check check (categoria in ('leve', 'van', 'micro_onibus', 'onibus', 'caminhao')),
  constraint producao_veiculos_combustivel_check check (combustivel in ('gasolina', 'etanol', 'flex', 'diesel_s10', 'diesel_s500')),
  constraint producao_veiculos_contratacao_check check (contratacao in ('proprio', 'locado', 'fretado_combustivel_incluso')),
  constraint producao_veiculos_fornecedor_check check (fornecedor is null or char_length(btrim(fornecedor)) between 1 and 200),
  constraint producao_veiculos_fornecedor_contratacao_check check (contratacao <> 'proprio' or fornecedor is null),
  constraint producao_veiculos_consumo_check check (consumo_km_por_litro is null or consumo_km_por_litro between 0.1 and 99),
  constraint producao_veiculos_carga_check check (capacidade_carga_kg is null or capacidade_carga_kg between 0 and 999999),
  constraint producao_veiculos_volume_check check (capacidade_volume_m3 is null or capacidade_volume_m3 between 0 and 9999),
  constraint producao_veiculos_lugares_check check (lugares is null or lugares between 1 and 99),
  constraint producao_veiculos_notas_check check (notas is null or char_length(notas) <= 2000)
);

create index if not exists producao_veiculos_org_idx on public.producao_veiculos (organization_id, nome);
create unique index if not exists producao_veiculos_placa_idx on public.producao_veiculos (organization_id, placa) where placa is not null;

create table if not exists public.producao_veiculo_documentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  veiculo_id uuid not null references public.producao_veiculos (id) on delete cascade,
  tipo text not null default 'documento_do_veiculo',
  numero text,
  validade date,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_veiculo_documentos_tipo_check check (tipo in ('documento_do_veiculo', 'seguro', 'antt', 'vistoria', 'outro')),
  constraint producao_veiculo_documentos_numero_check check (numero is null or char_length(btrim(numero)) between 1 and 100),
  constraint producao_veiculo_documentos_observacoes_check check (observacoes is null or char_length(observacoes) <= 1000)
);

create index if not exists producao_veiculo_documentos_org_idx on public.producao_veiculo_documentos (organization_id);
create index if not exists producao_veiculo_documentos_veiculo_idx on public.producao_veiculo_documentos (veiculo_id, validade);

-- Coerência do veículo: a organização não muda.
-- Erros (check_violation): organizacao_nao_muda.
create or replace function public.fn_producao_veiculo_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência do documento: o veículo é da organização e não muda.
-- Erros: organizacao_nao_muda, veiculo_nao_muda, veiculo_de_outra_organizacao.
create or replace function public.fn_producao_veiculo_documento_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.veiculo_id is distinct from old.veiculo_id then
    raise exception 'veiculo_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_veiculos v where v.id = new.veiculo_id and v.organization_id = new.organization_id) then
    raise exception 'veiculo_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_veiculos_coerencia
  before update of organization_id on public.producao_veiculos
  for each row execute function public.fn_producao_veiculo_coerencia();
create or replace trigger producao_veiculos_updated_at
  before update on public.producao_veiculos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_veiculos_historico
  after insert or update or delete on public.producao_veiculos
  for each row execute function public.fn_producao_historico('', 'nome');

create or replace trigger producao_veiculo_documentos_coerencia
  before insert or update of organization_id, veiculo_id on public.producao_veiculo_documentos
  for each row execute function public.fn_producao_veiculo_documento_coerencia();
create or replace trigger producao_veiculo_documentos_updated_at
  before update on public.producao_veiculo_documentos
  for each row execute function public.fn_producao_updated_at();

-- Quem vê o histórico: o texto de 20261113150000_producao_sites.sql com um ramo novo no fim.
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
    when 'producao_modelos_dia' then exists (select 1 from public.producao_modelos_dia x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_pautas' then exists (select 1 from public.producao_pautas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_itens' then exists (select 1 from public.producao_itens x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_plantas' then exists (select 1 from public.producao_plantas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_riders' then exists (select 1 from public.producao_riders x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_equipamentos' then exists (select 1 from public.producao_equipamentos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_turnos' then exists (select 1 from public.producao_turnos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_licencas' then exists (select 1 from public.producao_licencas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_modelos_acerto' then exists (select 1 from public.producao_modelos_acerto x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_acertos' then exists (select 1 from public.producao_acertos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_sessoes' then exists (select 1 from public.producao_sessoes x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_sites' then exists (select 1 from public.producao_sites x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_site_paginas' then exists (select 1 from public.producao_site_paginas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_veiculos' then exists (select 1 from public.producao_veiculos x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

alter table public.producao_veiculos enable row level security;
alter table public.producao_veiculo_documentos enable row level security;

-- Os veículos são da organização inteira: quem tem o recorte "só onde está vinculado" não os vê
-- (auth_producao_ve_temporada(org, null) é verdadeiro só para quem não tem recorte).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_veiculos' and policyname = 'producao_veiculos: le') then
    create policy "producao_veiculos: le" on public.producao_veiculos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_veiculos' and policyname = 'producao_veiculos: leitura sem assinatura') then
    create policy "producao_veiculos: leitura sem assinatura" on public.producao_veiculos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_veiculos' and policyname = 'producao_veiculos: insere') then
    create policy "producao_veiculos: insere" on public.producao_veiculos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_veiculos' and policyname = 'producao_veiculos: edita') then
    create policy "producao_veiculos: edita" on public.producao_veiculos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_veiculos' and policyname = 'producao_veiculos: apaga') then
    create policy "producao_veiculos: apaga" on public.producao_veiculos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
end
$$;

-- O documento herda o veículo à vista (a subconsulta passa pelas regras de producao_veiculos).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_veiculo_documentos' and policyname = 'producao_veiculo_documentos: le') then
    create policy "producao_veiculo_documentos: le" on public.producao_veiculo_documentos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_veiculos v where v.id = producao_veiculo_documentos.veiculo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_veiculo_documentos' and policyname = 'producao_veiculo_documentos: leitura sem assinatura') then
    create policy "producao_veiculo_documentos: leitura sem assinatura" on public.producao_veiculo_documentos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_veiculos v where v.id = producao_veiculo_documentos.veiculo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_veiculo_documentos' and policyname = 'producao_veiculo_documentos: insere') then
    create policy "producao_veiculo_documentos: insere" on public.producao_veiculo_documentos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_veiculos v where v.id = producao_veiculo_documentos.veiculo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_veiculo_documentos' and policyname = 'producao_veiculo_documentos: edita') then
    create policy "producao_veiculo_documentos: edita" on public.producao_veiculo_documentos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_veiculos v where v.id = producao_veiculo_documentos.veiculo_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_veiculos v where v.id = producao_veiculo_documentos.veiculo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_veiculo_documentos' and policyname = 'producao_veiculo_documentos: apaga') then
    create policy "producao_veiculo_documentos: apaga" on public.producao_veiculo_documentos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_veiculos v where v.id = producao_veiculo_documentos.veiculo_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_veiculo_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_veiculo_documento_coerencia() from public, anon, authenticated;
revoke all on public.producao_veiculos, public.producao_veiculo_documentos from anon, authenticated;
grant select, insert, update, delete on public.producao_veiculos, public.producao_veiculo_documentos to authenticated;

comment on table public.producao_veiculos is
  'Veículo da produção: placa, modelo, ano, categoria, combustível, contratação (próprio, locado, fretado com combustível incluso), consumo e capacidade.';
comment on table public.producao_veiculo_documentos is
  'Documento de um veículo (documento do veículo, seguro, ANTT, vistoria) com número e validade.';
