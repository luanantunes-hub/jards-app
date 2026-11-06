-- PD2.2: o motor da planta (primeiro corte).
--
-- producao_plantas: o desenho de um palco, sala, hospedagem ou exposição, em metros (largura × profundidade), com
-- ligação opcional a um espaço, a uma sala e a uma data.
-- producao_planta_objetos: o que está na planta: um item do inventário (ou um objeto solto, só com rótulo) com posição
-- (x, y em metros, do canto superior esquerdo), tamanho em metros e rotação em graus. Não é um CAD: retângulos
-- numerados e rotulados, para o mapa de palco (PD2.4) e a lista de canais (PD2.5) nascerem dele.
--
-- Acesso: o das plantas é da organização inteira, como o inventário (quem tem o recorte "só onde está vinculado" não as
-- vê). Lê quem lê a produção; cria, altera e apaga quem edita. O histórico guarda o nome da planta; a posição de cada
-- objeto não tem histórico (muda a cada arrasto).
-- Apagar: a planta leva os objetos; apagar o item só solta o objeto (fica o rótulo e o tamanho); apagar o espaço, a
-- sala ou a data só solta a ligação.
--
-- Expansão: duas tabelas novas e vazias, duas funções de gatilho e a função do histórico trocada (create or replace,
-- mesma assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_plantas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null,
  tipo text not null default 'palco',
  largura_m numeric(7, 2) not null,
  profundidade_m numeric(7, 2) not null,
  espaco_id uuid references public.producao_espacos (id) on delete set null,
  sala_id uuid references public.producao_salas (id) on delete set null,
  data_id uuid references public.producao_datas (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_plantas_nome_check check (char_length(btrim(nome)) between 1 and 200),
  constraint producao_plantas_tipo_check check (tipo in ('palco', 'sala', 'hospedagem', 'exposicao', 'outro')),
  constraint producao_plantas_largura_check check (largura_m between 0.5 and 500),
  constraint producao_plantas_profundidade_check check (profundidade_m between 0.5 and 500)
);

create index if not exists producao_plantas_org_idx on public.producao_plantas (organization_id, nome);
create index if not exists producao_plantas_sala_idx on public.producao_plantas (sala_id) where sala_id is not null;
create index if not exists producao_plantas_data_idx on public.producao_plantas (data_id) where data_id is not null;

create table if not exists public.producao_planta_objetos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  planta_id uuid not null references public.producao_plantas (id) on delete cascade,
  item_id uuid references public.producao_itens (id) on delete set null,
  rotulo text not null,
  x_m numeric(8, 2) not null default 0,
  y_m numeric(8, 2) not null default 0,
  largura_m numeric(7, 2) not null default 1,
  profundidade_m numeric(7, 2) not null default 1,
  rotacao_graus numeric(5, 1) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_planta_objetos_rotulo_check check (char_length(btrim(rotulo)) between 1 and 120),
  constraint producao_planta_objetos_posicao_check check (x_m between -1000 and 1000 and y_m between -1000 and 1000),
  constraint producao_planta_objetos_tamanho_check check (largura_m between 0.05 and 500 and profundidade_m between 0.05 and 500),
  constraint producao_planta_objetos_rotacao_check check (rotacao_graus >= 0 and rotacao_graus < 360)
);

create index if not exists producao_planta_objetos_org_idx on public.producao_planta_objetos (organization_id);
create index if not exists producao_planta_objetos_planta_idx on public.producao_planta_objetos (planta_id);
create index if not exists producao_planta_objetos_item_idx on public.producao_planta_objetos (item_id) where item_id is not null;

-- Coerência da planta: a organização não muda; espaço, sala e data são da organização, e a sala é do espaço quando os
-- dois estão. Erros (check_violation): organizacao_nao_muda, espaco_de_outra_organizacao, sala_de_outra_organizacao,
-- sala_de_outro_espaco, data_de_outra_organizacao.
create or replace function public.fn_producao_planta_coerencia()
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
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if new.espaco_id is not null and not exists (select 1 from public.producao_espacos e where e.id = new.espaco_id and e.organization_id = new.organization_id) then
    raise exception 'espaco_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.sala_id is not null then
    select s.espaco_id into v_espaco_da_sala from public.producao_salas s where s.id = new.sala_id and s.organization_id = new.organization_id;
    if not found then
      raise exception 'sala_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if new.espaco_id is not null and new.espaco_id is distinct from v_espaco_da_sala then
      raise exception 'sala_de_outro_espaco' using errcode = 'check_violation';
    end if;
  end if;
  if new.data_id is not null and not exists (select 1 from public.producao_datas d where d.id = new.data_id and d.organization_id = new.organization_id) then
    raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência do objeto: planta e item são da organização, e a planta não muda.
-- Erros: organizacao_nao_muda, planta_nao_muda, planta_de_outra_organizacao, item_de_outra_organizacao.
create or replace function public.fn_producao_planta_objeto_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.planta_id is distinct from old.planta_id then
    raise exception 'planta_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new;
  end if;
  if not exists (select 1 from public.producao_plantas p where p.id = new.planta_id and p.organization_id = new.organization_id) then
    raise exception 'planta_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.item_id is not null and not exists (select 1 from public.producao_itens i where i.id = new.item_id and i.organization_id = new.organization_id) then
    raise exception 'item_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_plantas_coerencia
  before insert or update of organization_id, espaco_id, sala_id, data_id on public.producao_plantas
  for each row execute function public.fn_producao_planta_coerencia();
create or replace trigger producao_plantas_updated_at
  before update on public.producao_plantas
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_plantas_historico
  after insert or update or delete on public.producao_plantas
  for each row execute function public.fn_producao_historico('', 'nome');

create or replace trigger producao_planta_objetos_coerencia
  before insert or update of organization_id, planta_id, item_id on public.producao_planta_objetos
  for each row execute function public.fn_producao_planta_objeto_coerencia();
create or replace trigger producao_planta_objetos_updated_at
  before update on public.producao_planta_objetos
  for each row execute function public.fn_producao_updated_at();

-- Quem vê o histórico: o texto de 20261106121234_producao_inventario.sql com um ramo novo no fim.
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
  end, false);
$$;

alter table public.producao_plantas enable row level security;
alter table public.producao_planta_objetos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_plantas' and policyname = 'producao_plantas: le') then
    create policy "producao_plantas: le" on public.producao_plantas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_plantas' and policyname = 'producao_plantas: leitura sem assinatura') then
    create policy "producao_plantas: leitura sem assinatura" on public.producao_plantas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_plantas' and policyname = 'producao_plantas: insere') then
    create policy "producao_plantas: insere" on public.producao_plantas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_plantas' and policyname = 'producao_plantas: edita') then
    create policy "producao_plantas: edita" on public.producao_plantas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_plantas' and policyname = 'producao_plantas: apaga') then
    create policy "producao_plantas: apaga" on public.producao_plantas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
end
$$;

-- Os objetos herdam a planta à vista (a subconsulta passa pelas regras de producao_plantas).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_planta_objetos' and policyname = 'producao_planta_objetos: le') then
    create policy "producao_planta_objetos: le" on public.producao_planta_objetos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_plantas p where p.id = producao_planta_objetos.planta_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_planta_objetos' and policyname = 'producao_planta_objetos: leitura sem assinatura') then
    create policy "producao_planta_objetos: leitura sem assinatura" on public.producao_planta_objetos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_plantas p where p.id = producao_planta_objetos.planta_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_planta_objetos' and policyname = 'producao_planta_objetos: insere') then
    create policy "producao_planta_objetos: insere" on public.producao_planta_objetos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_plantas p where p.id = producao_planta_objetos.planta_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_planta_objetos' and policyname = 'producao_planta_objetos: edita') then
    create policy "producao_planta_objetos: edita" on public.producao_planta_objetos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_plantas p where p.id = producao_planta_objetos.planta_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_plantas p where p.id = producao_planta_objetos.planta_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_planta_objetos' and policyname = 'producao_planta_objetos: apaga') then
    create policy "producao_planta_objetos: apaga" on public.producao_planta_objetos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_plantas p where p.id = producao_planta_objetos.planta_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_planta_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_planta_objeto_coerencia() from public, anon, authenticated;
revoke all on public.producao_plantas, public.producao_planta_objetos from anon, authenticated;
grant select, insert, update, delete on public.producao_plantas, public.producao_planta_objetos to authenticated;

comment on table public.producao_plantas is
  'Planta de um palco, sala, hospedagem ou exposição, em metros (largura x profundidade).';
comment on table public.producao_planta_objetos is
  'Objeto na planta: um item do inventário (ou solto), com posição, tamanho em metros e rotação em graus.';
