-- PD7.7 (primeiro corte): mapa da plateia, com setores por sala e cotas por sessão.
--
-- producao_setores: os setores de uma sala (Plateia baixa, Balcão, Camarote...), cada um com o número de lugares. producao_setor_cotas: o que a sessão faz com os
-- lugares de um setor, por categoria: venda, patrocinador, gratuidade, acessibilidade, imprensa ou bloqueio. É o "mapa" pintado: cada
-- setor mostra quantos lugares estão em cada categoria e quantos ainda não têm destino. O borderô por cima (receita, deduções) fica para
-- depois, com as decisões do dono sobre dinheiro.
--
-- Regras no banco: o setor é da sala da sessão (erro `setor_de_outra_sala`); e a soma dos lugares das categorias de um setor numa
-- sessão não passa dos lugares do setor (erro `lugares_excedidos`; a linha do setor é travada, e só confere quando o número aumenta, então
-- reduzir o setor depois não trava a edição). Uma linha por sessão, setor e categoria.
--
-- Acesso: os setores herdam o acesso da sala (e, por ela, o do espaço); as cotas, o da sessão. Sem dado pessoal e sem dinheiro. O histórico
-- guarda o nome do setor e a categoria da cota. Apagar: o setor sai com a sala e leva as cotas; a cota sai com a sessão.
--
-- Expansão: duas tabelas novas e vazias, duas funções de gatilho e a função do histórico trocada (create or replace, mesma assinatura,
-- os ramos de antes mais dois no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_setores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sala_id uuid not null references public.producao_salas (id) on delete cascade,
  nome text not null,
  lugares integer not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_setores_nome_check check (char_length(btrim(nome)) between 1 and 60),
  constraint producao_setores_lugares_check check (lugares between 1 and 20000),
  constraint producao_setores_ordem_check check (ordem between 0 and 999)
);

create index if not exists producao_setores_org_idx on public.producao_setores (organization_id);
create unique index if not exists producao_setores_nome_idx on public.producao_setores (sala_id, lower(btrim(nome)));

create table if not exists public.producao_setor_cotas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sessao_id uuid not null references public.producao_sessoes (id) on delete cascade,
  setor_id uuid not null references public.producao_setores (id) on delete cascade,
  categoria text not null,
  lugares integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_setor_cotas_categoria_check check (categoria in ('venda', 'patrocinador', 'gratuidade', 'acessibilidade', 'imprensa', 'bloqueio')),
  constraint producao_setor_cotas_lugares_check check (lugares between 1 and 20000),
  constraint producao_setor_cotas_unica_key unique (sessao_id, setor_id, categoria)
);

create index if not exists producao_setor_cotas_org_idx on public.producao_setor_cotas (organization_id);
create index if not exists producao_setor_cotas_setor_idx on public.producao_setor_cotas (setor_id);

-- Coerência do setor: a organização e a sala não mudam; a sala é da organização.
-- Erros (check_violation): organizacao_nao_muda, sala_nao_muda, sala_de_outra_organizacao.
create or replace function public.fn_producao_setor_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.sala_id is distinct from old.sala_id then
    raise exception 'sala_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_salas s where s.id = new.sala_id and s.organization_id = new.organization_id) then
    raise exception 'sala_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência da cota: a organização, a sessão e o setor não mudam; a sessão e o setor são da organização e da mesma sala; os lugares das
-- categorias do setor na sessão não passam dos lugares do setor (só confere quando o número aumenta).
-- Erros (check_violation): organizacao_nao_muda, sessao_nao_muda, setor_nao_muda, sessao_de_outra_organizacao, setor_de_outra_sala, lugares_excedidos.
create or replace function public.fn_producao_setor_cota_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sala_da_sessao uuid;
  v_lugares_do_setor integer;
  v_usados integer;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.sessao_id is distinct from old.sessao_id then
    raise exception 'sessao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.setor_id is distinct from old.setor_id then
    raise exception 'setor_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select p.sala_id into v_sala_da_sessao
  from public.producao_sessoes s join public.producao_pautas p on p.id = s.pauta_id
  where s.id = new.sessao_id and s.organization_id = new.organization_id;
  if not found then
    raise exception 'sessao_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  -- Trava a linha do setor: duas cotas ao mesmo tempo esperam uma pela outra e a soma sai certa.
  select t.lugares into v_lugares_do_setor from public.producao_setores t
  where t.id = new.setor_id and t.organization_id = new.organization_id and t.sala_id = v_sala_da_sessao for update;
  if not found then
    raise exception 'setor_de_outra_sala' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' or new.lugares > old.lugares then
    select coalesce(sum(c.lugares), 0) into v_usados from public.producao_setor_cotas c
    where c.sessao_id = new.sessao_id and c.setor_id = new.setor_id and (tg_op = 'INSERT' or c.id <> new.id);
    if v_usados + new.lugares > v_lugares_do_setor then
      raise exception 'lugares_excedidos' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger producao_setores_coerencia before insert or update on public.producao_setores for each row execute function public.fn_producao_setor_coerencia();
create or replace trigger producao_setores_updated_at before update on public.producao_setores for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_setores_historico after insert or update or delete on public.producao_setores for each row execute function public.fn_producao_historico('', 'nome');
create or replace trigger producao_setor_cotas_coerencia before insert or update on public.producao_setor_cotas for each row execute function public.fn_producao_setor_cota_coerencia();
create or replace trigger producao_setor_cotas_updated_at before update on public.producao_setor_cotas for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_setor_cotas_historico after insert or update or delete on public.producao_setor_cotas for each row execute function public.fn_producao_historico('', 'categoria');

-- Quem vê o histórico: o texto de 20261115700000_producao_formacao.sql com dois ramos novos no fim.
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
  end, false);
$$;

alter table public.producao_setores enable row level security;
alter table public.producao_setor_cotas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_setores' and policyname = 'producao_setores: le') then
    create policy "producao_setores: le" on public.producao_setores for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_salas s where s.id = producao_setores.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_setores' and policyname = 'producao_setores: leitura sem assinatura') then
    create policy "producao_setores: leitura sem assinatura" on public.producao_setores for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_salas s where s.id = producao_setores.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_setores' and policyname = 'producao_setores: insere') then
    create policy "producao_setores: insere" on public.producao_setores for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_salas s where s.id = producao_setores.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_setores' and policyname = 'producao_setores: edita') then
    create policy "producao_setores: edita" on public.producao_setores for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_salas s where s.id = producao_setores.sala_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_salas s where s.id = producao_setores.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_setores' and policyname = 'producao_setores: apaga') then
    create policy "producao_setores: apaga" on public.producao_setores for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_salas s where s.id = producao_setores.sala_id));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_setor_cotas' and policyname = 'producao_setor_cotas: le') then
    create policy "producao_setor_cotas: le" on public.producao_setor_cotas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_sessoes s where s.id = producao_setor_cotas.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_setor_cotas' and policyname = 'producao_setor_cotas: leitura sem assinatura') then
    create policy "producao_setor_cotas: leitura sem assinatura" on public.producao_setor_cotas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_sessoes s where s.id = producao_setor_cotas.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_setor_cotas' and policyname = 'producao_setor_cotas: insere') then
    create policy "producao_setor_cotas: insere" on public.producao_setor_cotas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_setor_cotas.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_setor_cotas' and policyname = 'producao_setor_cotas: edita') then
    create policy "producao_setor_cotas: edita" on public.producao_setor_cotas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_setor_cotas.sessao_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_setor_cotas.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_setor_cotas' and policyname = 'producao_setor_cotas: apaga') then
    create policy "producao_setor_cotas: apaga" on public.producao_setor_cotas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_setor_cotas.sessao_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_setor_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_setor_cota_coerencia() from public, anon, authenticated;
revoke all on public.producao_setores, public.producao_setor_cotas from anon, authenticated;
grant select, insert, update, delete on public.producao_setores, public.producao_setor_cotas to authenticated;

comment on table public.producao_setores is 'Setor de uma sala (plateia baixa, balcão...) com o número de lugares.';
comment on table public.producao_setor_cotas is 'Cota de uma sessão num setor, por categoria (venda, patrocinador, gratuidade, acessibilidade, imprensa, bloqueio); a soma não passa dos lugares do setor.';
