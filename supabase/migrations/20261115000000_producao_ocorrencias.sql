-- PD7.8 (primeiro corte): ocorrências do dia.
--
-- producao_ocorrencias: o que aconteceu durante uma data (um problema de segurança, de saúde, técnico, com o público, um atraso, um equipamento que
-- falhou), com a gravidade, a descrição, a providência tomada e se já foi resolvida. Quem registra é quem edita a data, pelo celular
-- ou pelo computador. Foto da ocorrência e o relatório da sessão com público e borderô ficam para os próximos cortes.
--
-- Acesso: o da data (quem lê a data lê as ocorrências; quem edita e vê a data escreve), então o recorte "só onde está vinculado" vale.
-- A hora da resolução é carimbada pelo banco quando a ocorrência passa a resolvida. O histórico guarda a ocorrência e deixa a descrição
-- e a providência de fora (podem falar de saúde ou de pessoas): o tipo é o rótulo.
-- Apagar: a ocorrência sai com a data e com a organização; apagar quem registrou só solta o autor.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho e a função do histórico trocada (create or replace, mesma assinatura, os
-- ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  data_id uuid not null references public.producao_datas (id) on delete cascade,
  tipo text not null default 'outro',
  gravidade text not null default 'media',
  descricao text not null,
  providencia text,
  ocorreu_em timestamptz not null default now(),
  resolvida boolean not null default false,
  resolvida_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_ocorrencias_tipo_check check (tipo in ('seguranca', 'saude', 'tecnica', 'publico', 'atraso', 'equipamento', 'outro')),
  constraint producao_ocorrencias_gravidade_check check (gravidade in ('baixa', 'media', 'alta')),
  constraint producao_ocorrencias_descricao_check check (char_length(btrim(descricao)) between 1 and 2000),
  constraint producao_ocorrencias_providencia_check check (providencia is null or char_length(btrim(providencia)) between 1 and 1000),
  constraint producao_ocorrencias_resolucao_check check (resolvida_em is null or resolvida)
);

create index if not exists producao_ocorrencias_org_idx on public.producao_ocorrencias (organization_id);
create index if not exists producao_ocorrencias_data_idx on public.producao_ocorrencias (data_id, ocorreu_em);
create index if not exists producao_ocorrencias_abertas_idx on public.producao_ocorrencias (organization_id, gravidade) where not resolvida;

-- Coerência: a organização e a data não mudam; a data é da organização; a hora da resolução é carimbada aqui.
-- Erros (check_violation): organizacao_nao_muda, data_nao_muda, data_de_outra_organizacao.
create or replace function public.fn_producao_ocorrencia_coerencia()
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
  if tg_op = 'INSERT' then
    new.resolvida_em := case when new.resolvida then now() end;
  elsif new.resolvida is distinct from old.resolvida then
    new.resolvida_em := case when new.resolvida then now() end;
  end if;
  return new;
end;
$$;

create or replace trigger producao_ocorrencias_coerencia
  before insert or update on public.producao_ocorrencias
  for each row execute function public.fn_producao_ocorrencia_coerencia();
create or replace trigger producao_ocorrencias_updated_at
  before update on public.producao_ocorrencias
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_ocorrencias_historico
  after insert or update or delete on public.producao_ocorrencias
  for each row execute function public.fn_producao_historico('descricao,providencia', 'tipo');

-- Quem vê o histórico: o texto de 20261114600000_producao_convites.sql com um ramo novo no fim.
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
    when 'producao_hospedagens' then exists (select 1 from public.producao_hospedagens x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_convites' then exists (select 1 from public.producao_convites x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_ocorrencias' then exists (select 1 from public.producao_ocorrencias x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

alter table public.producao_ocorrencias enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ocorrencias' and policyname = 'producao_ocorrencias: le') then
    create policy "producao_ocorrencias: le" on public.producao_ocorrencias for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_datas d where d.id = producao_ocorrencias.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ocorrencias' and policyname = 'producao_ocorrencias: leitura sem assinatura') then
    create policy "producao_ocorrencias: leitura sem assinatura" on public.producao_ocorrencias for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_datas d where d.id = producao_ocorrencias.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ocorrencias' and policyname = 'producao_ocorrencias: insere') then
    create policy "producao_ocorrencias: insere" on public.producao_ocorrencias for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_datas d where d.id = producao_ocorrencias.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ocorrencias' and policyname = 'producao_ocorrencias: edita') then
    create policy "producao_ocorrencias: edita" on public.producao_ocorrencias for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_datas d where d.id = producao_ocorrencias.data_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_datas d where d.id = producao_ocorrencias.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ocorrencias' and policyname = 'producao_ocorrencias: apaga') then
    create policy "producao_ocorrencias: apaga" on public.producao_ocorrencias for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_datas d where d.id = producao_ocorrencias.data_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_ocorrencia_coerencia() from public, anon, authenticated;
revoke all on public.producao_ocorrencias from anon, authenticated;
grant select, insert, update, delete on public.producao_ocorrencias to authenticated;

comment on table public.producao_ocorrencias is
  'Ocorrência do dia de uma data: tipo, gravidade, descrição, providência e se já foi resolvida (hora carimbada pelo banco).';
