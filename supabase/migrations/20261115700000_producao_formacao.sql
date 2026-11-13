-- PD7.10 (primeiro corte): formação, com turmas, aulas, matrículas, frequência por aula e certificado.
--
-- producao_turmas: uma turma de formação (oficina, curso, residência): nome, período, vagas, a frequência mínima para o certificado (padrão 75%) e
-- a situação. producao_turma_aulas: as aulas da turma (dia, hora e tema). producao_matriculas: quem está matriculado (nome, contato opcional, situação inscrito,
-- confirmado ou desistente, e quando o certificado foi emitido). producao_presencas: a presença de cada matriculado em cada aula, uma linha por par.
--
-- Regras no banco: as vagas da turma (erro `vagas_esgotadas`: matrículas que não desistiram não passam das vagas); a matrícula e a aula
-- são da mesma turma; e o certificado só é emitido (`certificado_emitido_em`) para matrícula confirmada, de turma não cancelada, com
-- aulas já realizadas e frequência igual ou acima da mínima (erros `matricula_nao_confirmada`, `turma_cancelada`, `sem_aulas_realizadas`,
-- `frequencia_insuficiente`). A frequência é as presenças dividido pelas aulas realizadas (dia até hoje). Tirar o certificado é livre.
--
-- Acesso: as turmas são da organização (mesmo recorte das outras tabelas de cadastro); aulas e matrículas herdam o da turma; a presença,
-- o da aula. Dado pessoal: nome e contato opcional só para a turma; o histórico guarda a matrícula e deixa o contato de fora. As presenças
-- são marcas de alto volume e ficam sem histórico. Sem página pública neste corte: a matrícula é feita pela produção.
--
-- Expansão: quatro tabelas novas e vazias, quatro funções de gatilho e a função do histórico trocada (create or replace, mesma
-- assinatura, os ramos de antes mais três no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_turmas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null,
  inicio date,
  fim date,
  vagas integer,
  frequencia_minima integer not null default 75,
  situacao text not null default 'aberta',
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_turmas_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint producao_turmas_periodo_check check (inicio is null or fim is null or fim >= inicio),
  constraint producao_turmas_vagas_check check (vagas is null or vagas between 1 and 5000),
  constraint producao_turmas_frequencia_check check (frequencia_minima between 0 and 100),
  constraint producao_turmas_situacao_check check (situacao in ('aberta', 'em_andamento', 'concluida', 'cancelada')),
  constraint producao_turmas_notas_check check (notas is null or char_length(btrim(notas)) between 1 and 300)
);

create index if not exists producao_turmas_org_idx on public.producao_turmas (organization_id, inicio);

create table if not exists public.producao_turma_aulas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  turma_id uuid not null references public.producao_turmas (id) on delete cascade,
  dia date not null,
  inicio time not null,
  fim time not null,
  tema text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_turma_aulas_horas_check check (fim > inicio),
  constraint producao_turma_aulas_tema_check check (tema is null or char_length(btrim(tema)) between 1 and 120),
  constraint producao_turma_aulas_unica_key unique (turma_id, dia, inicio)
);

create index if not exists producao_turma_aulas_org_idx on public.producao_turma_aulas (organization_id);
create index if not exists producao_turma_aulas_turma_idx on public.producao_turma_aulas (turma_id, dia);

create table if not exists public.producao_matriculas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  turma_id uuid not null references public.producao_turmas (id) on delete cascade,
  nome text not null,
  email text,
  telefone text,
  situacao text not null default 'inscrito',
  certificado_emitido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_matriculas_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint producao_matriculas_email_check check (email is null or (char_length(email) between 3 and 200 and email ~ '^[^@\s]+@[^@\s]+$')),
  constraint producao_matriculas_telefone_check check (telefone is null or char_length(btrim(telefone)) between 5 and 30),
  constraint producao_matriculas_situacao_check check (situacao in ('inscrito', 'confirmado', 'desistente'))
);

create index if not exists producao_matriculas_org_idx on public.producao_matriculas (organization_id);
create index if not exists producao_matriculas_turma_idx on public.producao_matriculas (turma_id, situacao);
create unique index if not exists producao_matriculas_email_idx on public.producao_matriculas (turma_id, lower(email)) where email is not null;

create table if not exists public.producao_presencas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  aula_id uuid not null references public.producao_turma_aulas (id) on delete cascade,
  matricula_id uuid not null references public.producao_matriculas (id) on delete cascade,
  presente boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_presencas_par_key unique (aula_id, matricula_id)
);

create index if not exists producao_presencas_org_idx on public.producao_presencas (organization_id);
create index if not exists producao_presencas_matricula_idx on public.producao_presencas (matricula_id);

-- Coerência da turma: a organização não muda.
create or replace function public.fn_producao_turma_coerencia()
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

-- Coerência da aula: a organização e a turma não mudam; a turma é da organização.
-- Erros (check_violation): organizacao_nao_muda, turma_nao_muda, turma_de_outra_organizacao.
create or replace function public.fn_producao_turma_aula_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.turma_id is distinct from old.turma_id then
    raise exception 'turma_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_turmas t where t.id = new.turma_id and t.organization_id = new.organization_id) then
    raise exception 'turma_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência da matrícula: a organização e a turma não mudam; a turma é da organização; as vagas valem (só quando o número de
-- matriculados aumenta); e o certificado só sai com a frequência pedida.
-- Erros (check_violation): organizacao_nao_muda, turma_nao_muda, turma_de_outra_organizacao, vagas_esgotadas, turma_cancelada,
-- matricula_nao_confirmada, sem_aulas_realizadas, frequencia_insuficiente.
create or replace function public.fn_producao_matricula_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vagas integer;
  v_minima integer;
  v_turma_situacao text;
  v_ocupadas integer;
  v_aulas integer;
  v_presencas integer;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.turma_id is distinct from old.turma_id then
    raise exception 'turma_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  -- Trava a linha da turma: duas matrículas ao mesmo tempo esperam uma pela outra e a soma sai certa.
  select t.vagas, t.frequencia_minima, t.situacao into v_vagas, v_minima, v_turma_situacao
  from public.producao_turmas t where t.id = new.turma_id and t.organization_id = new.organization_id for update;
  if not found then
    raise exception 'turma_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.situacao <> 'desistente' and v_vagas is not null and (tg_op = 'INSERT' or old.situacao = 'desistente') then
    select count(*) into v_ocupadas from public.producao_matriculas m
    where m.turma_id = new.turma_id and m.situacao <> 'desistente' and (tg_op = 'INSERT' or m.id <> new.id);
    if v_ocupadas + 1 > v_vagas then
      raise exception 'vagas_esgotadas' using errcode = 'check_violation';
    end if;
  end if;
  if new.certificado_emitido_em is not null and (tg_op = 'INSERT' or old.certificado_emitido_em is null) then
    if tg_op = 'INSERT' then
      raise exception 'matricula_nao_confirmada' using errcode = 'check_violation';
    end if;
    if v_turma_situacao = 'cancelada' then
      raise exception 'turma_cancelada' using errcode = 'check_violation';
    end if;
    if new.situacao <> 'confirmado' then
      raise exception 'matricula_nao_confirmada' using errcode = 'check_violation';
    end if;
    select count(*) into v_aulas from public.producao_turma_aulas a where a.turma_id = new.turma_id and a.dia <= current_date;
    if v_aulas = 0 then
      raise exception 'sem_aulas_realizadas' using errcode = 'check_violation';
    end if;
    select count(*) into v_presencas from public.producao_presencas p join public.producao_turma_aulas a on a.id = p.aula_id
    where p.matricula_id = new.id and p.presente and a.dia <= current_date;
    if (100.0 * v_presencas / v_aulas) < v_minima then
      raise exception 'frequencia_insuficiente' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- Coerência da presença: a organização, a aula e a matrícula não mudam; a aula e a matrícula são da mesma turma e da organização.
-- Erros (check_violation): organizacao_nao_muda, aula_nao_muda, matricula_nao_muda, aula_e_matricula_de_turmas_diferentes.
create or replace function public.fn_producao_presenca_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.aula_id is distinct from old.aula_id then
    raise exception 'aula_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.matricula_id is distinct from old.matricula_id then
    raise exception 'matricula_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (
    select 1 from public.producao_turma_aulas a join public.producao_matriculas m on m.turma_id = a.turma_id
    where a.id = new.aula_id and m.id = new.matricula_id and a.organization_id = new.organization_id and m.organization_id = new.organization_id
  ) then
    raise exception 'aula_e_matricula_de_turmas_diferentes' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_turmas_coerencia before insert or update on public.producao_turmas for each row execute function public.fn_producao_turma_coerencia();
create or replace trigger producao_turmas_updated_at before update on public.producao_turmas for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_turmas_historico after insert or update or delete on public.producao_turmas for each row execute function public.fn_producao_historico('', 'nome');
create or replace trigger producao_turma_aulas_coerencia before insert or update on public.producao_turma_aulas for each row execute function public.fn_producao_turma_aula_coerencia();
create or replace trigger producao_turma_aulas_updated_at before update on public.producao_turma_aulas for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_turma_aulas_historico after insert or update or delete on public.producao_turma_aulas for each row execute function public.fn_producao_historico('', 'dia');
create or replace trigger producao_matriculas_coerencia before insert or update on public.producao_matriculas for each row execute function public.fn_producao_matricula_coerencia();
create or replace trigger producao_matriculas_updated_at before update on public.producao_matriculas for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_matriculas_historico after insert or update or delete on public.producao_matriculas for each row execute function public.fn_producao_historico('email,telefone', 'nome');
create or replace trigger producao_presencas_coerencia before insert or update on public.producao_presencas for each row execute function public.fn_producao_presenca_coerencia();
create or replace trigger producao_presencas_updated_at before update on public.producao_presencas for each row execute function public.fn_producao_updated_at();

-- Quem vê o histórico: o texto de 20261115600000_producao_visitacao.sql com três ramos novos no fim.
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
  end, false);
$$;

alter table public.producao_turmas enable row level security;
alter table public.producao_turma_aulas enable row level security;
alter table public.producao_matriculas enable row level security;
alter table public.producao_presencas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turmas' and policyname = 'producao_turmas: le') then
    create policy "producao_turmas: le" on public.producao_turmas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turmas' and policyname = 'producao_turmas: leitura sem assinatura') then
    create policy "producao_turmas: leitura sem assinatura" on public.producao_turmas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turmas' and policyname = 'producao_turmas: insere') then
    create policy "producao_turmas: insere" on public.producao_turmas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turmas' and policyname = 'producao_turmas: edita') then
    create policy "producao_turmas: edita" on public.producao_turmas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turmas' and policyname = 'producao_turmas: apaga') then
    create policy "producao_turmas: apaga" on public.producao_turmas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turma_aulas' and policyname = 'producao_turma_aulas: le') then
    create policy "producao_turma_aulas: le" on public.producao_turma_aulas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_turmas t where t.id = producao_turma_aulas.turma_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turma_aulas' and policyname = 'producao_turma_aulas: leitura sem assinatura') then
    create policy "producao_turma_aulas: leitura sem assinatura" on public.producao_turma_aulas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_turmas t where t.id = producao_turma_aulas.turma_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turma_aulas' and policyname = 'producao_turma_aulas: insere') then
    create policy "producao_turma_aulas: insere" on public.producao_turma_aulas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_turmas t where t.id = producao_turma_aulas.turma_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turma_aulas' and policyname = 'producao_turma_aulas: edita') then
    create policy "producao_turma_aulas: edita" on public.producao_turma_aulas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_turmas t where t.id = producao_turma_aulas.turma_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_turmas t where t.id = producao_turma_aulas.turma_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turma_aulas' and policyname = 'producao_turma_aulas: apaga') then
    create policy "producao_turma_aulas: apaga" on public.producao_turma_aulas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_turmas t where t.id = producao_turma_aulas.turma_id));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_matriculas' and policyname = 'producao_matriculas: le') then
    create policy "producao_matriculas: le" on public.producao_matriculas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_turmas t where t.id = producao_matriculas.turma_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_matriculas' and policyname = 'producao_matriculas: leitura sem assinatura') then
    create policy "producao_matriculas: leitura sem assinatura" on public.producao_matriculas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_turmas t where t.id = producao_matriculas.turma_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_matriculas' and policyname = 'producao_matriculas: insere') then
    create policy "producao_matriculas: insere" on public.producao_matriculas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_turmas t where t.id = producao_matriculas.turma_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_matriculas' and policyname = 'producao_matriculas: edita') then
    create policy "producao_matriculas: edita" on public.producao_matriculas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_turmas t where t.id = producao_matriculas.turma_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_turmas t where t.id = producao_matriculas.turma_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_matriculas' and policyname = 'producao_matriculas: apaga') then
    create policy "producao_matriculas: apaga" on public.producao_matriculas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_turmas t where t.id = producao_matriculas.turma_id));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_presencas' and policyname = 'producao_presencas: le') then
    create policy "producao_presencas: le" on public.producao_presencas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_turma_aulas a where a.id = producao_presencas.aula_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_presencas' and policyname = 'producao_presencas: leitura sem assinatura') then
    create policy "producao_presencas: leitura sem assinatura" on public.producao_presencas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_turma_aulas a where a.id = producao_presencas.aula_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_presencas' and policyname = 'producao_presencas: insere') then
    create policy "producao_presencas: insere" on public.producao_presencas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_turma_aulas a where a.id = producao_presencas.aula_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_presencas' and policyname = 'producao_presencas: edita') then
    create policy "producao_presencas: edita" on public.producao_presencas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_turma_aulas a where a.id = producao_presencas.aula_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_turma_aulas a where a.id = producao_presencas.aula_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_presencas' and policyname = 'producao_presencas: apaga') then
    create policy "producao_presencas: apaga" on public.producao_presencas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_turma_aulas a where a.id = producao_presencas.aula_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_turma_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_turma_aula_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_matricula_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_presenca_coerencia() from public, anon, authenticated;
revoke all on public.producao_turmas, public.producao_turma_aulas, public.producao_matriculas, public.producao_presencas from anon, authenticated;
grant select, insert, update, delete on public.producao_turmas, public.producao_turma_aulas, public.producao_matriculas, public.producao_presencas to authenticated;

comment on table public.producao_turmas is 'Turma de formação (oficina, curso, residência): período, vagas e frequência mínima para o certificado.';
comment on table public.producao_turma_aulas is 'Aula de uma turma: dia, hora e tema.';
comment on table public.producao_matriculas is 'Matrícula numa turma: nome, contato opcional, situação e quando o certificado foi emitido (o banco confere a frequência).';
comment on table public.producao_presencas is 'Presença de um matriculado numa aula (uma linha por par).';
