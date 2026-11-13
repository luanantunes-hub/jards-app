-- PD8.5 (primeiro corte): planta expográfica, com as obras de arte de uma sala, a posição, a altura, a ordem de montagem e a luz.
--
-- producao_expografia: onde cada obra de arte do inventário (`producao_itens` da categoria obra_de_arte) fica numa sala de exposição: na parede, no piso,
-- no teto (suspensa), numa vitrine ou em outro lugar; a altura da instalação (centro da obra, em cm do piso), a ordem de montagem, a luz
-- (sem luz, difusa, pontual, natural ou baixa luminosidade) com o nível em lux, uma nota e quando foi instalada. Uma obra aparece uma vez por sala.
-- A posição na planta desenhada (x e y) e os termos de empréstimo e seguro como acordos ficam para os próximos cortes.
--
-- Regras no banco: a obra é um item da mesma organização e da categoria obra de arte (erro `item_nao_e_obra_de_arte`); a sala é da
-- organização. Acesso: o da sala (e, por ela, o do espaço: o recorte "só onde está vinculado" vale). Sem dado pessoal e sem dinheiro. O histórico
-- guarda a posição, a altura, a ordem, a luz e a instalação. Apagar: sai com a sala e com o item.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho e a função do histórico trocada (create or replace, mesma assinatura, os ramos
-- de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_expografia (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sala_id uuid not null references public.producao_salas (id) on delete cascade,
  item_id uuid not null references public.producao_itens (id) on delete cascade,
  posicao text not null default 'parede',
  altura_instalacao_cm integer,
  ordem_montagem integer not null default 0,
  luz text not null default 'difusa',
  lux integer,
  notas text,
  instalada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_expografia_posicao_check check (posicao in ('parede', 'piso', 'teto', 'vitrine', 'outro')),
  constraint producao_expografia_altura_check check (altura_instalacao_cm is null or altura_instalacao_cm between 0 and 2000),
  constraint producao_expografia_ordem_check check (ordem_montagem between 0 and 999),
  constraint producao_expografia_luz_check check (luz in ('sem_luz', 'difusa', 'pontual', 'natural', 'baixa')),
  constraint producao_expografia_lux_check check (lux is null or lux between 0 and 100000),
  constraint producao_expografia_notas_check check (notas is null or char_length(btrim(notas)) between 1 and 300),
  constraint producao_expografia_unica_key unique (sala_id, item_id)
);

create index if not exists producao_expografia_org_idx on public.producao_expografia (organization_id);
create index if not exists producao_expografia_sala_idx on public.producao_expografia (sala_id, ordem_montagem);
create index if not exists producao_expografia_item_idx on public.producao_expografia (item_id);

-- Coerência: a organização, a sala e a obra não mudam; a sala e a obra são da organização; a obra é um item da categoria obra de arte.
-- Erros (check_violation): organizacao_nao_muda, sala_nao_muda, item_nao_muda, sala_de_outra_organizacao, item_de_outra_organizacao, item_nao_e_obra_de_arte.
create or replace function public.fn_producao_expografia_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_categoria text;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.sala_id is distinct from old.sala_id then
    raise exception 'sala_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.item_id is distinct from old.item_id then
    raise exception 'item_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_salas s where s.id = new.sala_id and s.organization_id = new.organization_id) then
    raise exception 'sala_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  select i.categoria into v_categoria from public.producao_itens i where i.id = new.item_id and i.organization_id = new.organization_id;
  if not found then
    raise exception 'item_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if v_categoria <> 'obra_de_arte' then
    raise exception 'item_nao_e_obra_de_arte' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_expografia_coerencia before insert or update on public.producao_expografia for each row execute function public.fn_producao_expografia_coerencia();
create or replace trigger producao_expografia_updated_at before update on public.producao_expografia for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_expografia_historico after insert or update or delete on public.producao_expografia for each row execute function public.fn_producao_historico('', 'posicao');

-- Quem vê o histórico: o texto de 20261115800000_producao_plateia.sql com um ramo novo no fim.
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
  end, false);
$$;

alter table public.producao_expografia enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_expografia' and policyname = 'producao_expografia: le') then
    create policy "producao_expografia: le" on public.producao_expografia for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_salas s where s.id = producao_expografia.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_expografia' and policyname = 'producao_expografia: leitura sem assinatura') then
    create policy "producao_expografia: leitura sem assinatura" on public.producao_expografia for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_salas s where s.id = producao_expografia.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_expografia' and policyname = 'producao_expografia: insere') then
    create policy "producao_expografia: insere" on public.producao_expografia for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_salas s where s.id = producao_expografia.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_expografia' and policyname = 'producao_expografia: edita') then
    create policy "producao_expografia: edita" on public.producao_expografia for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_salas s where s.id = producao_expografia.sala_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_salas s where s.id = producao_expografia.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_expografia' and policyname = 'producao_expografia: apaga') then
    create policy "producao_expografia: apaga" on public.producao_expografia for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_salas s where s.id = producao_expografia.sala_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_expografia_coerencia() from public, anon, authenticated;
revoke all on public.producao_expografia from anon, authenticated;
grant select, insert, update, delete on public.producao_expografia to authenticated;

comment on table public.producao_expografia is 'Obra de arte numa sala de exposição: posição (parede, piso, teto, vitrine), altura de instalação, ordem de montagem, luz (com lux) e quando foi instalada.';
