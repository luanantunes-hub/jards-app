-- PD7.4 (primeiro corte): borderô da sessão, com o público, a receita por categoria de ingresso e as deduções.
--
-- Decisões do dono (13/11/2026): (1) as deduções são uma LISTA ABERTA por sessão (nome, porcentagem da receita ou valor fixo, e quem recebe), sem
-- alíquota pronta: o percentual vem do contrato ou do município e o contador confere; (2) os valores só aparecem para quem tem a permissão de dinheiro;
-- (3) o público é o digitado pela casa junto com as leituras da porta (o aviso de divergência é da tela); (4) o acerto de contas sai daqui (PD7.9).
--
-- producao_borderos: o borderô de uma sessão (um por sessão): o público presente que a casa contou, a situação (rascunho, conferido ou fechado) e quando fechou.
-- Sem dinheiro: quem vê a sessão vê o borderô. producao_bordero_receitas: a receita por categoria de ingresso (inteira, meia, social...): quantidade e valor
-- unitário. producao_bordero_deducoes: as deduções: nome, forma (percentual ou fixo), valor e quem recebe. As duas últimas são DINHEIRO: só lê e escreve quem tem a
-- permissão de dinheiro (a regra das tabelas de valores do inventário e da equipe), e ficam SEM histórico (o valor iria para uma linha que quem não vê
-- o dinheiro também lê). O histórico do borderô guarda a situação e o público.
--
-- Regras no banco: depois de fechado o borderô não muda (nem o público, nem a receita, nem as deduções: erro `bordero_fechado`); para mudar,
-- reabre-se (muda a situação). Fechar carimba a hora; reabrir apaga o carimbo. A categoria de receita é única no borderô; a porcentagem vai de 0 a 100.
-- O bruto, as deduções e o líquido são contas da tela (lib/producao/bordero.ts), não ficam gravados: assim não divergem do que está escrito.
--
-- Acesso: o borderô herda o da sessão (e, por ela, o da pauta e do espaço); receita e deduções, o do borderô mais o dinheiro.
--
-- Expansão: três tabelas novas e vazias, duas funções de gatilho e a função do histórico trocada (create or replace, mesma assinatura, os ramos de
-- antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_borderos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sessao_id uuid not null references public.producao_sessoes (id) on delete cascade,
  publico_casa integer,
  situacao text not null default 'rascunho',
  observacao text,
  fechado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_borderos_publico_check check (publico_casa is null or publico_casa between 0 and 100000),
  constraint producao_borderos_situacao_check check (situacao in ('rascunho', 'conferido', 'fechado')),
  constraint producao_borderos_observacao_check check (observacao is null or char_length(btrim(observacao)) between 1 and 300),
  constraint producao_borderos_sessao_key unique (sessao_id)
);

create index if not exists producao_borderos_org_idx on public.producao_borderos (organization_id);

create table if not exists public.producao_bordero_receitas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bordero_id uuid not null references public.producao_borderos (id) on delete cascade,
  categoria text not null,
  quantidade integer not null default 0,
  valor_unitario numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_bordero_receitas_categoria_check check (char_length(btrim(categoria)) between 1 and 60),
  constraint producao_bordero_receitas_quantidade_check check (quantidade between 0 and 1000000),
  constraint producao_bordero_receitas_valor_check check (valor_unitario between 0 and 10000000)
);

create index if not exists producao_bordero_receitas_org_idx on public.producao_bordero_receitas (organization_id);
create unique index if not exists producao_bordero_receitas_categoria_idx on public.producao_bordero_receitas (bordero_id, lower(btrim(categoria)));

create table if not exists public.producao_bordero_deducoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bordero_id uuid not null references public.producao_borderos (id) on delete cascade,
  nome text not null,
  forma text not null default 'percentual',
  valor numeric(14, 2) not null default 0,
  beneficiario text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_bordero_deducoes_nome_check check (char_length(btrim(nome)) between 1 and 80),
  constraint producao_bordero_deducoes_forma_check check (forma in ('percentual', 'fixo')),
  constraint producao_bordero_deducoes_valor_check check (valor between 0 and 999999999999.99 and (forma <> 'percentual' or valor <= 100)),
  constraint producao_bordero_deducoes_beneficiario_check check (beneficiario is null or char_length(btrim(beneficiario)) between 1 and 80),
  constraint producao_bordero_deducoes_ordem_check check (ordem between 0 and 999)
);

create index if not exists producao_bordero_deducoes_org_idx on public.producao_bordero_deducoes (organization_id);
create index if not exists producao_bordero_deducoes_bordero_idx on public.producao_bordero_deducoes (bordero_id, ordem);

-- Coerência do borderô: a organização e a sessão não mudam; a sessão é da organização; depois de fechado o público e a observação não mudam; fechar
-- carimba a hora e reabrir apaga. Erros (check_violation): organizacao_nao_muda, sessao_nao_muda, sessao_de_outra_organizacao, bordero_fechado.
create or replace function public.fn_producao_bordero_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.sessao_id is distinct from old.sessao_id then
    raise exception 'sessao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_sessoes s where s.id = new.sessao_id and s.organization_id = new.organization_id) then
    raise exception 'sessao_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and old.situacao = 'fechado' and new.situacao = 'fechado'
     and (new.publico_casa is distinct from old.publico_casa or new.observacao is distinct from old.observacao) then
    raise exception 'bordero_fechado' using errcode = 'check_violation';
  end if;
  if new.situacao = 'fechado' then
    if tg_op = 'INSERT' or old.situacao <> 'fechado' then
      new.fechado_em := now();
    end if;
  else
    new.fechado_em := null;
  end if;
  return new;
end;
$$;

-- Coerência da receita e da dedução: a organização e o borderô não mudam; o borderô é da organização; e o borderô fechado não aceita mudança.
-- Erros (check_violation): organizacao_nao_muda, bordero_nao_muda, bordero_de_outra_organizacao, bordero_fechado.
create or replace function public.fn_producao_bordero_filha_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_situacao text;
  v_bordero uuid := case when tg_op = 'DELETE' then old.bordero_id else new.bordero_id end;
  v_org uuid := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.bordero_id is distinct from old.bordero_id then
    raise exception 'bordero_nao_muda' using errcode = 'check_violation';
  end if;
  select b.situacao into v_situacao from public.producao_borderos b where b.id = v_bordero and b.organization_id = v_org;
  if not found then
    if tg_op = 'DELETE' then
      return old; -- o borderô já saiu (a sessão ou a organização foi apagada): a cascata segue
    end if;
    raise exception 'bordero_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if v_situacao = 'fechado' then
    raise exception 'bordero_fechado' using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace trigger producao_borderos_coerencia before insert or update on public.producao_borderos for each row execute function public.fn_producao_bordero_coerencia();
create or replace trigger producao_borderos_updated_at before update on public.producao_borderos for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_borderos_historico after insert or update or delete on public.producao_borderos for each row execute function public.fn_producao_historico('', 'situacao');
create or replace trigger producao_bordero_receitas_coerencia before insert or update or delete on public.producao_bordero_receitas for each row execute function public.fn_producao_bordero_filha_coerencia();
create or replace trigger producao_bordero_receitas_updated_at before update on public.producao_bordero_receitas for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_bordero_deducoes_coerencia before insert or update or delete on public.producao_bordero_deducoes for each row execute function public.fn_producao_bordero_filha_coerencia();
create or replace trigger producao_bordero_deducoes_updated_at before update on public.producao_bordero_deducoes for each row execute function public.fn_producao_updated_at();

-- Quem vê o histórico: o texto de 20261116000000_producao_expografia.sql com um ramo novo no fim (só o borderô: a receita e as deduções não têm histórico).
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
  end, false);
$$;

alter table public.producao_borderos enable row level security;
alter table public.producao_bordero_receitas enable row level security;
alter table public.producao_bordero_deducoes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_borderos' and policyname = 'producao_borderos: le') then
    create policy "producao_borderos: le" on public.producao_borderos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_sessoes s where s.id = producao_borderos.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_borderos' and policyname = 'producao_borderos: leitura sem assinatura') then
    create policy "producao_borderos: leitura sem assinatura" on public.producao_borderos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_sessoes s where s.id = producao_borderos.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_borderos' and policyname = 'producao_borderos: insere') then
    create policy "producao_borderos: insere" on public.producao_borderos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_borderos.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_borderos' and policyname = 'producao_borderos: edita') then
    create policy "producao_borderos: edita" on public.producao_borderos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_borderos.sessao_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_borderos.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_borderos' and policyname = 'producao_borderos: apaga') then
    create policy "producao_borderos: apaga" on public.producao_borderos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_borderos.sessao_id));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_receitas' and policyname = 'producao_bordero_receitas: le') then
    create policy "producao_bordero_receitas: le" on public.producao_bordero_receitas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_receitas.bordero_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_receitas' and policyname = 'producao_bordero_receitas: leitura sem assinatura') then
    create policy "producao_bordero_receitas: leitura sem assinatura" on public.producao_bordero_receitas for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_receitas.bordero_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_receitas' and policyname = 'producao_bordero_receitas: insere') then
    create policy "producao_bordero_receitas: insere" on public.producao_bordero_receitas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_receitas.bordero_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_receitas' and policyname = 'producao_bordero_receitas: edita') then
    create policy "producao_bordero_receitas: edita" on public.producao_bordero_receitas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_receitas.bordero_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_receitas.bordero_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_receitas' and policyname = 'producao_bordero_receitas: apaga') then
    create policy "producao_bordero_receitas: apaga" on public.producao_bordero_receitas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_receitas.bordero_id));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_deducoes' and policyname = 'producao_bordero_deducoes: le') then
    create policy "producao_bordero_deducoes: le" on public.producao_bordero_deducoes for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_deducoes.bordero_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_deducoes' and policyname = 'producao_bordero_deducoes: leitura sem assinatura') then
    create policy "producao_bordero_deducoes: leitura sem assinatura" on public.producao_bordero_deducoes for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_deducoes.bordero_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_deducoes' and policyname = 'producao_bordero_deducoes: insere') then
    create policy "producao_bordero_deducoes: insere" on public.producao_bordero_deducoes for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_deducoes.bordero_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_deducoes' and policyname = 'producao_bordero_deducoes: edita') then
    create policy "producao_bordero_deducoes: edita" on public.producao_bordero_deducoes for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_deducoes.bordero_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_deducoes.bordero_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_deducoes' and policyname = 'producao_bordero_deducoes: apaga') then
    create policy "producao_bordero_deducoes: apaga" on public.producao_bordero_deducoes for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_deducoes.bordero_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_bordero_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_bordero_filha_coerencia() from public, anon, authenticated;
revoke all on public.producao_borderos, public.producao_bordero_receitas, public.producao_bordero_deducoes from anon, authenticated;
grant select, insert, update, delete on public.producao_borderos, public.producao_bordero_receitas, public.producao_bordero_deducoes to authenticated;

comment on table public.producao_borderos is 'Borderô de uma sessão: público que a casa contou, situação (rascunho, conferido, fechado) e quando fechou. Sem dinheiro.';
comment on table public.producao_bordero_receitas is 'Receita do borderô por categoria de ingresso: quantidade e valor unitário. Dinheiro: só quem tem a permissão. Sem histórico.';
comment on table public.producao_bordero_deducoes is 'Dedução do borderô: nome, forma (percentual ou fixo), valor e quem recebe. Dinheiro: só quem tem a permissão. Sem histórico.';
