-- PD3.4: a equipe fixa da casa, com turnos.
--
-- producao_turnos: um turno de uma pessoa no espaço, em um dia, com hora de início e de fim (no mesmo dia), a função e,
-- se quiser, a pauta a que serve (o evento recebido). É a escala da equipe fixa: por pauta e por dia, com a carga semanal
-- somada na tela (lib/producao/turnos.ts). O vínculo da pessoa com o espaço continua sendo `producao_vinculos` com
-- `espaco_id` (PD1.9); o turno é o que a pessoa faz em cada dia.
--
-- Acesso: o do espaço (quem lê o espaço lê os turnos; quem edita e vê o espaço escreve), então o recorte "só onde está
-- vinculado" vale. Sem dinheiro. O histórico usa o dia como rótulo.
-- Apagar: o turno sai com o espaço, com a pessoa e com a organização; apagar a pauta só solta o turno dela.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho e a função do histórico trocada (create or replace, mesma
-- assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_turnos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  espaco_id uuid not null references public.producao_espacos (id) on delete cascade,
  pessoa_id uuid not null references public.producao_pessoas (id) on delete cascade,
  pauta_id uuid references public.producao_pautas (id) on delete set null,
  dia date not null,
  inicio time not null,
  fim time not null,
  funcao text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_turnos_pessoa_dia_inicio_key unique (pessoa_id, dia, inicio),
  constraint producao_turnos_horas_check check (fim > inicio),
  constraint producao_turnos_funcao_check check (funcao is null or char_length(btrim(funcao)) between 1 and 80),
  constraint producao_turnos_notas_check check (notas is null or char_length(notas) <= 500)
);

create index if not exists producao_turnos_org_idx on public.producao_turnos (organization_id);
create index if not exists producao_turnos_espaco_dia_idx on public.producao_turnos (espaco_id, dia);
create index if not exists producao_turnos_pessoa_idx on public.producao_turnos (pessoa_id, dia);
create index if not exists producao_turnos_pauta_idx on public.producao_turnos (pauta_id) where pauta_id is not null;

-- Coerência do turno: a organização e o espaço não mudam; a pessoa, o espaço e a pauta são da organização; a pauta, se
-- houver, é de uma sala do mesmo espaço. Erros (check_violation): organizacao_nao_muda, espaco_nao_muda,
-- espaco_de_outra_organizacao, pessoa_de_outra_organizacao, pauta_de_outra_organizacao, pauta_de_outro_espaco.
create or replace function public.fn_producao_turno_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_espaco_da_pauta uuid;
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
  if not exists (select 1 from public.producao_pessoas p where p.id = new.pessoa_id and p.organization_id = new.organization_id) then
    raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.pauta_id is not null then
    select s.espaco_id into v_espaco_da_pauta
    from public.producao_pautas pa join public.producao_salas s on s.id = pa.sala_id
    where pa.id = new.pauta_id and pa.organization_id = new.organization_id;
    if not found then
      raise exception 'pauta_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if v_espaco_da_pauta is distinct from new.espaco_id then
      raise exception 'pauta_de_outro_espaco' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger producao_turnos_coerencia
  before insert or update of organization_id, espaco_id, pessoa_id, pauta_id on public.producao_turnos
  for each row execute function public.fn_producao_turno_coerencia();
create or replace trigger producao_turnos_updated_at
  before update on public.producao_turnos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_turnos_historico
  after insert or update or delete on public.producao_turnos
  for each row execute function public.fn_producao_historico('', 'dia');

-- Quem vê o histórico: o texto de 20261110223739_producao_equipamentos.sql com um ramo novo no fim.
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
  end, false);
$$;

alter table public.producao_turnos enable row level security;

-- O turno herda o espaço à vista (a subconsulta passa pelas regras de producao_espacos, com o recorte) e a pessoa à vista.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turnos' and policyname = 'producao_turnos: le') then
    create policy "producao_turnos: le" on public.producao_turnos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_espacos e where e.id = producao_turnos.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turnos' and policyname = 'producao_turnos: leitura sem assinatura') then
    create policy "producao_turnos: leitura sem assinatura" on public.producao_turnos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_espacos e where e.id = producao_turnos.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turnos' and policyname = 'producao_turnos: insere') then
    create policy "producao_turnos: insere" on public.producao_turnos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_espacos e where e.id = producao_turnos.espaco_id)
                  and exists (select 1 from public.producao_pessoas p where p.id = producao_turnos.pessoa_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turnos' and policyname = 'producao_turnos: edita') then
    create policy "producao_turnos: edita" on public.producao_turnos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_espacos e where e.id = producao_turnos.espaco_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_espacos e where e.id = producao_turnos.espaco_id)
                  and exists (select 1 from public.producao_pessoas p where p.id = producao_turnos.pessoa_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_turnos' and policyname = 'producao_turnos: apaga') then
    create policy "producao_turnos: apaga" on public.producao_turnos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_espacos e where e.id = producao_turnos.espaco_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_turno_coerencia() from public, anon, authenticated;
revoke all on public.producao_turnos from anon, authenticated;
grant select, insert, update, delete on public.producao_turnos to authenticated;

comment on table public.producao_turnos is
  'Turno de uma pessoa da equipe no espaço, em um dia, com hora de início e fim, função e, se quiser, a pauta a que serve. A carga semanal sai da soma.';
