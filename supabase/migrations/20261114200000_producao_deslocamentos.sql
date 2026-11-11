-- PD6.2 (primeiro corte): deslocamentos da data.
--
-- producao_deslocamentos: uma viagem que serve a uma data (voo, ônibus, van, carro, caminhão, trem, balsa), com origem,
-- destino, saída e chegada (instantes absolutos; a tela mostra na hora do lugar da data), o veículo do cadastro e o
-- motorista da equipe, a companhia, o localizador e notas. Dois deslocamentos com o mesmo veículo ou o mesmo motorista em
-- horários que se cruzam são avisados pela tela (lib/producao/deslocamentos.ts), não barrados no banco: a pessoa
-- decide. Quem vai em cada viagem, a migração dos cartões de viagem da PD1.8 e a entrada na escala e na folha ficam
-- para os próximos cortes; os cartões continuam como estão.
--
-- Acesso: o da data (quem lê a data lê os deslocamentos; quem edita e vê a data escreve), então o recorte "só onde está
-- vinculado" vale. Sem dinheiro (o custo entra com a PD6.4). O histórico deixa o localizador de fora (código de reserva)
-- e usa o tipo como rótulo.
-- Apagar: o deslocamento sai com a data e com a organização; apagar o veículo ou a pessoa só os solta do deslocamento.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho e a função do histórico trocada (create or replace, mesma
-- assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_deslocamentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  data_id uuid not null references public.producao_datas (id) on delete cascade,
  tipo text not null default 'van',
  origem text,
  destino text,
  saida timestamptz,
  chegada timestamptz,
  veiculo_id uuid references public.producao_veiculos (id) on delete set null,
  motorista_id uuid references public.producao_pessoas (id) on delete set null,
  companhia text,
  localizador text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_deslocamentos_tipo_check check (tipo in ('aviao', 'onibus', 'van', 'carro', 'caminhao', 'trem', 'balsa', 'outro')),
  constraint producao_deslocamentos_origem_check check (origem is null or char_length(btrim(origem)) between 1 and 200),
  constraint producao_deslocamentos_destino_check check (destino is null or char_length(btrim(destino)) between 1 and 200),
  constraint producao_deslocamentos_periodo_check check (chegada is null or (saida is not null and chegada >= saida)),
  constraint producao_deslocamentos_companhia_check check (companhia is null or char_length(btrim(companhia)) between 1 and 200),
  constraint producao_deslocamentos_localizador_check check (localizador is null or char_length(btrim(localizador)) between 1 and 80),
  constraint producao_deslocamentos_notas_check check (notas is null or char_length(btrim(notas)) between 1 and 2000)
);

create index if not exists producao_deslocamentos_org_idx on public.producao_deslocamentos (organization_id, saida);
create index if not exists producao_deslocamentos_data_idx on public.producao_deslocamentos (data_id, saida);
create index if not exists producao_deslocamentos_veiculo_idx on public.producao_deslocamentos (veiculo_id) where veiculo_id is not null;
create index if not exists producao_deslocamentos_motorista_idx on public.producao_deslocamentos (motorista_id) where motorista_id is not null;

-- Coerência do deslocamento: a organização e a data não mudam; a data, o veículo e o motorista são da organização.
-- Erros (check_violation): organizacao_nao_muda, data_nao_muda, data_de_outra_organizacao, veiculo_de_outra_organizacao,
-- motorista_de_outra_organizacao.
create or replace function public.fn_producao_deslocamento_coerencia()
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
  if not exists (select 1 from public.producao_datas d where d.id = new.data_id and d.organization_id = new.organization_id) then
    raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.veiculo_id is not null and not exists (select 1 from public.producao_veiculos v where v.id = new.veiculo_id and v.organization_id = new.organization_id) then
    raise exception 'veiculo_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.motorista_id is not null and not exists (select 1 from public.producao_pessoas p where p.id = new.motorista_id and p.organization_id = new.organization_id) then
    raise exception 'motorista_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_deslocamentos_coerencia
  before insert or update of organization_id, data_id, veiculo_id, motorista_id on public.producao_deslocamentos
  for each row execute function public.fn_producao_deslocamento_coerencia();
create or replace trigger producao_deslocamentos_updated_at
  before update on public.producao_deslocamentos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_deslocamentos_historico
  after insert or update or delete on public.producao_deslocamentos
  for each row execute function public.fn_producao_historico('localizador', 'tipo');

-- Quem vê o histórico: o texto de 20261114100000_producao_veiculos.sql com um ramo novo no fim.
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
    when 'producao_deslocamentos' then exists (select 1 from public.producao_deslocamentos x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

alter table public.producao_deslocamentos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_deslocamentos' and policyname = 'producao_deslocamentos: le') then
    create policy "producao_deslocamentos: le" on public.producao_deslocamentos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_datas d where d.id = producao_deslocamentos.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_deslocamentos' and policyname = 'producao_deslocamentos: leitura sem assinatura') then
    create policy "producao_deslocamentos: leitura sem assinatura" on public.producao_deslocamentos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_datas d where d.id = producao_deslocamentos.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_deslocamentos' and policyname = 'producao_deslocamentos: insere') then
    create policy "producao_deslocamentos: insere" on public.producao_deslocamentos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_deslocamentos.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_deslocamentos' and policyname = 'producao_deslocamentos: edita') then
    create policy "producao_deslocamentos: edita" on public.producao_deslocamentos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_deslocamentos.data_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_deslocamentos.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_deslocamentos' and policyname = 'producao_deslocamentos: apaga') then
    create policy "producao_deslocamentos: apaga" on public.producao_deslocamentos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_deslocamentos.data_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_deslocamento_coerencia() from public, anon, authenticated;
revoke all on public.producao_deslocamentos from anon, authenticated;
grant select, insert, update, delete on public.producao_deslocamentos to authenticated;

comment on table public.producao_deslocamentos is
  'Deslocamento que serve a uma data: tipo, origem, destino, saída e chegada, veículo do cadastro, motorista da equipe, companhia, localizador e notas.';
