-- PD8.1: a grade de programação (primeiro corte): as sessões de uma pauta.
--
-- producao_sessoes: uma sessão (um show, uma peça, uma aula) dentro do período de uma pauta, num dia, com hora de início e de
-- fim no mesmo dia, um título próprio (se não há, vale o da pauta) e notas. A sala é a da pauta: a grade mostra salas nas
-- linhas e dias nas colunas, e dois horários que se cruzam na mesma sala no mesmo dia viram aviso na tela (como o conflito
-- de pauta, é aviso, não trava: duas sessões podem dividir a sala com uma troca de cenário).
--
-- Acesso: o da pauta (quem lê a pauta lê as sessões; quem edita e vê a pauta escreve), então o recorte "só onde está
-- vinculado" vale pelo espaço da sala. Sem dinheiro. O histórico usa o dia como rótulo. Apagar: a sessão sai com a pauta e com
-- a organização.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho nova e a função do histórico trocada (create or replace, mesma
-- assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_sessoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pauta_id uuid not null references public.producao_pautas (id) on delete cascade,
  dia date not null,
  inicio time not null,
  fim time not null,
  titulo text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_sessoes_horas_check check (fim > inicio),
  constraint producao_sessoes_titulo_check check (titulo is null or char_length(btrim(titulo)) between 1 and 200),
  constraint producao_sessoes_notas_check check (notas is null or char_length(notas) <= 500)
);

create index if not exists producao_sessoes_org_idx on public.producao_sessoes (organization_id);
create index if not exists producao_sessoes_pauta_dia_idx on public.producao_sessoes (pauta_id, dia, inicio);
create index if not exists producao_sessoes_dia_idx on public.producao_sessoes (organization_id, dia);

-- Coerência da sessão: a organização e a pauta não mudam; a pauta é da organização e o dia fica dentro do período dela.
-- Erros (check_violation): organizacao_nao_muda, pauta_nao_muda, pauta_de_outra_organizacao, dia_fora_da_pauta.
create or replace function public.fn_producao_sessao_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inicio date;
  v_fim date;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.pauta_id is distinct from old.pauta_id then
    raise exception 'pauta_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select p.inicio, p.fim into v_inicio, v_fim from public.producao_pautas p where p.id = new.pauta_id and p.organization_id = new.organization_id;
  if not found then
    raise exception 'pauta_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.dia < v_inicio or new.dia > v_fim then
    raise exception 'dia_fora_da_pauta' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_sessoes_coerencia
  before insert or update of organization_id, pauta_id, dia on public.producao_sessoes
  for each row execute function public.fn_producao_sessao_coerencia();
create or replace trigger producao_sessoes_updated_at
  before update on public.producao_sessoes
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_sessoes_historico
  after insert or update or delete on public.producao_sessoes
  for each row execute function public.fn_producao_historico('', 'dia');

-- Quem vê o histórico: o texto de 20261112090000_producao_acertos.sql com um ramo novo no fim.
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
  end, false);
$$;

alter table public.producao_sessoes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sessoes' and policyname = 'producao_sessoes: le') then
    create policy "producao_sessoes: le" on public.producao_sessoes for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_pautas p where p.id = producao_sessoes.pauta_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sessoes' and policyname = 'producao_sessoes: leitura sem assinatura') then
    create policy "producao_sessoes: leitura sem assinatura" on public.producao_sessoes for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_pautas p where p.id = producao_sessoes.pauta_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sessoes' and policyname = 'producao_sessoes: insere') then
    create policy "producao_sessoes: insere" on public.producao_sessoes for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_pautas p where p.id = producao_sessoes.pauta_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sessoes' and policyname = 'producao_sessoes: edita') then
    create policy "producao_sessoes: edita" on public.producao_sessoes for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_pautas p where p.id = producao_sessoes.pauta_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_pautas p where p.id = producao_sessoes.pauta_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sessoes' and policyname = 'producao_sessoes: apaga') then
    create policy "producao_sessoes: apaga" on public.producao_sessoes for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_pautas p where p.id = producao_sessoes.pauta_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_sessao_coerencia() from public, anon, authenticated;
revoke all on public.producao_sessoes from anon, authenticated;
grant select, insert, update, delete on public.producao_sessoes to authenticated;

comment on table public.producao_sessoes is
  'Sessão (show, peça, aula) dentro do período de uma pauta, num dia, com hora de início e fim. A sala é a da pauta; horários que se cruzam na mesma sala e dia viram aviso na grade.';
