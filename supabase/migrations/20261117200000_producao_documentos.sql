-- PD4.8 (primeiro corte): pasta de documentos com validade, da organização e das pessoas.
--
-- producao_documentos: um documento que vence. O da organização (contrato social, certidão negativa, carta de exclusividade) ou o de uma
-- pessoa da equipe (CNH, passaporte, identidade), com o tipo, o título, o dia da emissão e a VALIDADE. O Jards avisa quando um vai vencer.
-- Este corte guarda só o que serve para avisar: tipo, de quem é, título, emissão, validade e uma nota. NÃO guarda o número do documento
-- (CPF, RG, CNH, passaporte) nem o arquivo: o arquivo entra num corte seguinte, quando a pasta de arquivos deixar de depender de uma
-- temporada. As telas pedem para não escrever número nenhum.
--
-- Acesso (a receita da pasta de arquivos da PD0.14):
--   documento da organização  ler: auth_producao_pasta_pode(org, 'documentos', 'ler'); escrever: 'editar'; vale toda a organização
--                             (auth_producao_ve_temporada(org, null)): o recorte "só onde está vinculado" não o vê.
--   documento de uma pessoa   é dado pessoal: só abre a quem pode `dinheiro` (pasta 'pessoas'): ler pede `dinheiro`, escrever pede
--                             `editar` e `dinheiro`; e a pessoa tem de ser visível a quem lê (auth_producao_ve_pessoa).
-- A produção só para leitura lê pelas regras "sem assinatura". Captador, proponente, quem não tem o módulo e outra organização não leem
-- nem escrevem.
--
-- Regras no banco: o escopo diz de quem é (organização: sem pessoa; pessoa: com pessoa da mesma organização); o tipo combina com o escopo
-- (CNH, passaporte e identidade só de pessoa; contrato social, certidão e carta só da organização; "outro" vale nos dois); a validade não
-- vem antes da emissão; título de 1 a 120 letras; nota de até 300. A organização, o escopo e a pessoa não mudam (para trocar, apague e
-- crie outro). Apagar a pessoa leva os documentos dela junto (dado pessoal não fica sem dono).
--
-- Histórico: o rótulo é o tipo; ficam fora o título e a nota (podem identificar a pessoa ou o documento). Quem vê o histórico: o mesmo
-- de quem lê o documento (o de uma pessoa, só quem pode `dinheiro`).
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho nova e a função do histórico trocada (create or replace, mesma assinatura, os
-- ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_documentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  escopo text not null default 'organizacao',
  pessoa_id uuid references public.producao_pessoas (id) on delete cascade,
  tipo text not null default 'outro',
  titulo text not null,
  emitido_em date,
  validade date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_documentos_escopo_check check (escopo in ('organizacao', 'pessoa')),
  constraint producao_documentos_dono_check check ((escopo = 'pessoa') = (pessoa_id is not null)),
  constraint producao_documentos_tipo_check check (tipo in ('contrato_social', 'certidao_negativa', 'carta_exclusividade', 'cnh', 'passaporte', 'identidade', 'outro')),
  constraint producao_documentos_tipo_escopo_check check (
    (tipo in ('cnh', 'passaporte', 'identidade') and escopo = 'pessoa')
    or (tipo in ('contrato_social', 'certidao_negativa', 'carta_exclusividade') and escopo = 'organizacao')
    or tipo = 'outro'
  ),
  constraint producao_documentos_titulo_check check (char_length(btrim(titulo)) between 1 and 120),
  constraint producao_documentos_validade_check check (validade is null or emitido_em is null or validade >= emitido_em),
  constraint producao_documentos_notas_check check (notas is null or char_length(notas) <= 300)
);

create index if not exists producao_documentos_org_idx on public.producao_documentos (organization_id);
create index if not exists producao_documentos_pessoa_idx on public.producao_documentos (pessoa_id) where pessoa_id is not null;
create index if not exists producao_documentos_validade_idx on public.producao_documentos (organization_id, validade) where validade is not null;

-- Coerência: a organização, o escopo e a pessoa não mudam; a pessoa é da organização. Erros (check_violation):
-- organizacao_nao_muda, escopo_nao_muda, pessoa_nao_muda, pessoa_de_outra_organizacao.
create or replace function public.fn_producao_documento_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.escopo is distinct from old.escopo then
    raise exception 'escopo_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.pessoa_id is distinct from old.pessoa_id then
    raise exception 'pessoa_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if new.pessoa_id is not null and not exists (
    select 1 from public.producao_pessoas p where p.id = new.pessoa_id and p.organization_id = new.organization_id
  ) then
    raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_documentos_coerencia
  before insert or update on public.producao_documentos
  for each row execute function public.fn_producao_documento_coerencia();
create or replace trigger producao_documentos_updated_at
  before update on public.producao_documentos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_documentos_historico
  after insert or update or delete on public.producao_documentos
  for each row execute function public.fn_producao_historico('titulo,notas', 'tipo');

-- Quem vê o histórico: o texto atual com um ramo novo no fim. O documento de uma pessoa, só a quem pode `dinheiro`.
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
    when 'producao_voluntarios' then exists (select 1 from public.producao_voluntarios x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_credencial_tipos' then exists (select 1 from public.producao_credencial_tipos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_convidados' then exists (select 1 from public.producao_convidados x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_acessibilidade' then exists (select 1 from public.producao_acessibilidade x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_visitas_horarios' then exists (select 1 from public.producao_visitas_horarios x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_visitas_agendamentos' then exists (select 1 from public.producao_visitas_agendamentos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_turmas' then exists (select 1 from public.producao_turmas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_turma_aulas' then exists (select 1 from public.producao_turma_aulas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_matriculas' then exists (select 1 from public.producao_matriculas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_setores' then exists (select 1 from public.producao_setores x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_setor_cotas' then exists (select 1 from public.producao_setor_cotas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_expografia' then exists (select 1 from public.producao_expografia x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_borderos' then exists (select 1 from public.producao_borderos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_documentos' then exists (
      select 1 from public.producao_documentos x
      where x.id = p_entidade_id and x.organization_id = p_org
        and (x.escopo = 'organizacao' or public.auth_producao_pode(p_org, 'dinheiro') or public.auth_producao_dinheiro_sem_assinatura(p_org))
    )
  end, false);
$$;

alter table public.producao_documentos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_documentos' and policyname = 'producao_documentos: le') then
    create policy "producao_documentos: le" on public.producao_documentos for select to authenticated
      using (case escopo
        when 'pessoa' then public.auth_producao_pasta_pode(organization_id, 'pessoas', 'ler') and public.auth_producao_ve_pessoa(organization_id, pessoa_id)
        else public.auth_producao_pasta_pode(organization_id, 'documentos', 'ler') and public.auth_producao_ve_temporada(organization_id, null)
      end);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_documentos' and policyname = 'producao_documentos: leitura sem assinatura') then
    create policy "producao_documentos: leitura sem assinatura" on public.producao_documentos for select to authenticated
      using (case escopo
        when 'pessoa' then public.auth_producao_pasta_pode(organization_id, 'pessoas', 'ler_sem_assinatura') and public.auth_producao_ve_pessoa(organization_id, pessoa_id)
        else public.auth_producao_pasta_pode(organization_id, 'documentos', 'ler_sem_assinatura') and public.auth_producao_ve_temporada(organization_id, null)
      end);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_documentos' and policyname = 'producao_documentos: insere') then
    create policy "producao_documentos: insere" on public.producao_documentos for insert to authenticated
      with check (case escopo
        when 'pessoa' then public.auth_producao_pasta_pode(organization_id, 'pessoas', 'editar') and public.auth_producao_ve_pessoa(organization_id, pessoa_id)
        else public.auth_producao_pasta_pode(organization_id, 'documentos', 'editar') and public.auth_producao_ve_temporada(organization_id, null)
      end);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_documentos' and policyname = 'producao_documentos: edita') then
    create policy "producao_documentos: edita" on public.producao_documentos for update to authenticated
      using (case escopo
        when 'pessoa' then public.auth_producao_pasta_pode(organization_id, 'pessoas', 'editar') and public.auth_producao_ve_pessoa(organization_id, pessoa_id)
        else public.auth_producao_pasta_pode(organization_id, 'documentos', 'editar') and public.auth_producao_ve_temporada(organization_id, null)
      end)
      with check (case escopo
        when 'pessoa' then public.auth_producao_pasta_pode(organization_id, 'pessoas', 'editar') and public.auth_producao_ve_pessoa(organization_id, pessoa_id)
        else public.auth_producao_pasta_pode(organization_id, 'documentos', 'editar') and public.auth_producao_ve_temporada(organization_id, null)
      end);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_documentos' and policyname = 'producao_documentos: apaga') then
    create policy "producao_documentos: apaga" on public.producao_documentos for delete to authenticated
      using (case escopo
        when 'pessoa' then public.auth_producao_pasta_pode(organization_id, 'pessoas', 'editar') and public.auth_producao_ve_pessoa(organization_id, pessoa_id)
        else public.auth_producao_pasta_pode(organization_id, 'documentos', 'editar') and public.auth_producao_ve_temporada(organization_id, null)
      end);
  end if;
end
$$;

revoke execute on function public.fn_producao_documento_coerencia() from public, anon, authenticated;
revoke all on public.producao_documentos from anon, authenticated;
grant select, insert, update, delete on public.producao_documentos to authenticated;

comment on table public.producao_documentos is
  'Documento com validade, da organização (contrato social, certidão, carta de exclusividade) ou de uma pessoa (CNH, passaporte, identidade). Só tipo, título, emissão, validade e nota: sem número de documento e sem arquivo. O de uma pessoa só abre a quem pode dinheiro.';
