-- PD3.2: equipamentos da casa e manutenção.
--
-- producao_equipamentos: o que o espaço tem (refletores, mesa de som, projetor, praticáveis…), com categoria, quantidade
-- e estado (em uso, em manutenção, avariado ou baixado), de um espaço e, se quiser, de uma sala dele. O que está em uso
-- alimenta a ficha; o avariado sai da ficha e vira pendência. producao_manutencoes: as manutenções de cada equipamento,
-- preventivas (com recorrência opcional em dias) ou corretivas, com a data prevista e a em que foi feita.
--
-- Acesso: o do espaço (quem lê o espaço lê os equipamentos; quem edita e vê o espaço escreve), então o recorte "só onde
-- está vinculado" vale. Sem dinheiro. O histórico guarda o nome do equipamento; as manutenções não têm histórico (o
-- equipamento e a data dizem o que importa).
-- Apagar: o equipamento sai com o espaço e leva as manutenções; apagar a sala só solta o equipamento da sala.
--
-- Expansão: duas tabelas novas e vazias, duas funções de gatilho e a função do histórico trocada (create or replace,
-- mesma assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_equipamentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  espaco_id uuid not null references public.producao_espacos (id) on delete cascade,
  sala_id uuid references public.producao_salas (id) on delete set null,
  nome text not null,
  categoria text not null default 'outro',
  quantidade integer not null default 1,
  estado text not null default 'em_uso',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_equipamentos_nome_check check (char_length(btrim(nome)) between 1 and 200),
  constraint producao_equipamentos_categoria_check check (categoria in ('cenario', 'figurino', 'instrumento', 'luz', 'som', 'video', 'praticavel', 'adereco', 'obra_de_arte', 'outro')),
  constraint producao_equipamentos_quantidade_check check (quantidade between 1 and 99999),
  constraint producao_equipamentos_estado_check check (estado in ('em_uso', 'manutencao', 'avariado', 'baixado')),
  constraint producao_equipamentos_observacoes_check check (observacoes is null or char_length(observacoes) <= 2000)
);

create index if not exists producao_equipamentos_org_idx on public.producao_equipamentos (organization_id);
create index if not exists producao_equipamentos_espaco_idx on public.producao_equipamentos (espaco_id, nome);
create index if not exists producao_equipamentos_sala_idx on public.producao_equipamentos (sala_id) where sala_id is not null;

create table if not exists public.producao_manutencoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  equipamento_id uuid not null references public.producao_equipamentos (id) on delete cascade,
  tipo text not null default 'preventiva',
  descricao text not null,
  prevista_para date not null,
  feita_em date,
  recorrencia_dias integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_manutencoes_tipo_check check (tipo in ('preventiva', 'corretiva')),
  constraint producao_manutencoes_descricao_check check (char_length(btrim(descricao)) between 1 and 500),
  constraint producao_manutencoes_recorrencia_check check (recorrencia_dias is null or recorrencia_dias between 1 and 3650),
  constraint producao_manutencoes_recorrencia_tipo_check check (recorrencia_dias is null or tipo = 'preventiva')
);

create index if not exists producao_manutencoes_org_idx on public.producao_manutencoes (organization_id);
create index if not exists producao_manutencoes_equipamento_idx on public.producao_manutencoes (equipamento_id, prevista_para);
create index if not exists producao_manutencoes_abertas_idx on public.producao_manutencoes (organization_id, prevista_para) where feita_em is null;

-- Coerência do equipamento: a organização e o espaço não mudam; a sala, se houver, é do mesmo espaço.
-- Erros (check_violation): organizacao_nao_muda, espaco_nao_muda, espaco_de_outra_organizacao, sala_de_outra_organizacao,
-- sala_de_outro_espaco.
create or replace function public.fn_producao_equipamento_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_espaco_da_sala uuid;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.espaco_id is distinct from old.espaco_id then
    raise exception 'espaco_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_espacos e where e.id = new.espaco_id and e.organization_id = new.organization_id) then
    raise exception 'espaco_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.sala_id is not null then
    select s.espaco_id into v_espaco_da_sala from public.producao_salas s where s.id = new.sala_id and s.organization_id = new.organization_id;
    if not found then
      raise exception 'sala_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if v_espaco_da_sala is distinct from new.espaco_id then
      raise exception 'sala_de_outro_espaco' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- Coerência da manutenção: o equipamento é da organização e não muda.
-- Erros: organizacao_nao_muda, equipamento_nao_muda, equipamento_de_outra_organizacao.
create or replace function public.fn_producao_manutencao_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.equipamento_id is distinct from old.equipamento_id then
    raise exception 'equipamento_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new;
  end if;
  if not exists (select 1 from public.producao_equipamentos q where q.id = new.equipamento_id and q.organization_id = new.organization_id) then
    raise exception 'equipamento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_equipamentos_coerencia
  before insert or update of organization_id, espaco_id, sala_id on public.producao_equipamentos
  for each row execute function public.fn_producao_equipamento_coerencia();
create or replace trigger producao_equipamentos_updated_at
  before update on public.producao_equipamentos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_equipamentos_historico
  after insert or update or delete on public.producao_equipamentos
  for each row execute function public.fn_producao_historico('', 'nome');

create or replace trigger producao_manutencoes_coerencia
  before insert or update of organization_id, equipamento_id on public.producao_manutencoes
  for each row execute function public.fn_producao_manutencao_coerencia();
create or replace trigger producao_manutencoes_updated_at
  before update on public.producao_manutencoes
  for each row execute function public.fn_producao_updated_at();

-- Quem vê o histórico: o texto de 20261106195523_producao_riders.sql com um ramo novo no fim.
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
  end, false);
$$;

alter table public.producao_equipamentos enable row level security;
alter table public.producao_manutencoes enable row level security;

-- O equipamento herda o espaço à vista (a subconsulta passa pelas regras de producao_espacos, com o recorte).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_equipamentos' and policyname = 'producao_equipamentos: le') then
    create policy "producao_equipamentos: le" on public.producao_equipamentos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_espacos e where e.id = producao_equipamentos.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_equipamentos' and policyname = 'producao_equipamentos: leitura sem assinatura') then
    create policy "producao_equipamentos: leitura sem assinatura" on public.producao_equipamentos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_espacos e where e.id = producao_equipamentos.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_equipamentos' and policyname = 'producao_equipamentos: insere') then
    create policy "producao_equipamentos: insere" on public.producao_equipamentos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_espacos e where e.id = producao_equipamentos.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_equipamentos' and policyname = 'producao_equipamentos: edita') then
    create policy "producao_equipamentos: edita" on public.producao_equipamentos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_espacos e where e.id = producao_equipamentos.espaco_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_espacos e where e.id = producao_equipamentos.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_equipamentos' and policyname = 'producao_equipamentos: apaga') then
    create policy "producao_equipamentos: apaga" on public.producao_equipamentos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_espacos e where e.id = producao_equipamentos.espaco_id));
  end if;
end
$$;

-- A manutenção herda o equipamento à vista.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_manutencoes' and policyname = 'producao_manutencoes: le') then
    create policy "producao_manutencoes: le" on public.producao_manutencoes for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_equipamentos q where q.id = producao_manutencoes.equipamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_manutencoes' and policyname = 'producao_manutencoes: leitura sem assinatura') then
    create policy "producao_manutencoes: leitura sem assinatura" on public.producao_manutencoes for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_equipamentos q where q.id = producao_manutencoes.equipamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_manutencoes' and policyname = 'producao_manutencoes: insere') then
    create policy "producao_manutencoes: insere" on public.producao_manutencoes for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_equipamentos q where q.id = producao_manutencoes.equipamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_manutencoes' and policyname = 'producao_manutencoes: edita') then
    create policy "producao_manutencoes: edita" on public.producao_manutencoes for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_equipamentos q where q.id = producao_manutencoes.equipamento_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_equipamentos q where q.id = producao_manutencoes.equipamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_manutencoes' and policyname = 'producao_manutencoes: apaga') then
    create policy "producao_manutencoes: apaga" on public.producao_manutencoes for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_equipamentos q where q.id = producao_manutencoes.equipamento_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_equipamento_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_manutencao_coerencia() from public, anon, authenticated;
revoke all on public.producao_equipamentos, public.producao_manutencoes from anon, authenticated;
grant select, insert, update, delete on public.producao_equipamentos, public.producao_manutencoes to authenticated;

comment on table public.producao_equipamentos is
  'Equipamento da casa (de um espaço e, se quiser, de uma sala): categoria, quantidade e estado (em uso, manutenção, avariado, baixado).';
comment on table public.producao_manutencoes is
  'Manutenção de um equipamento: preventiva (com recorrência opcional em dias) ou corretiva, com a data prevista e a em que foi feita.';
