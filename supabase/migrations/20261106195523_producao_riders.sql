-- PD2.5: o rider estruturado.
--
-- producao_riders: o rider técnico de uma produção (o que a casa precisa providenciar), com as medidas mínimas do palco
-- e, se vier de uma planta, a ligação a ela. producao_rider_itens: as linhas do rider, por seção (palco, som, luz,
-- energia, camarim, catering ou geral), com texto, quantidade opcional e se é obrigatório. O rider nasce do mapa de
-- palco (lib/producao/rider.ts monta as linhas a partir da planta), sem redigitar, e depois se edita.
--
-- Acesso: o das plantas (da organização inteira; quem tem o recorte "só onde está vinculado" não vê). Lê quem lê a
-- produção; cria, altera e apaga quem edita. O histórico guarda o nome do rider; as linhas não têm histórico.
-- Apagar: o rider leva as linhas; apagar a planta ou a obra só solta a ligação.
--
-- Expansão: duas tabelas novas e vazias, duas funções de gatilho e a função do histórico trocada (create or replace,
-- mesma assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_riders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null,
  planta_id uuid references public.producao_plantas (id) on delete set null,
  obra_id uuid references public.producao_obras (id) on delete set null,
  palco_largura_min_m numeric(7, 2),
  palco_profundidade_min_m numeric(7, 2),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_riders_nome_check check (char_length(btrim(nome)) between 1 and 200),
  constraint producao_riders_largura_check check (palco_largura_min_m is null or palco_largura_min_m between 0.5 and 500),
  constraint producao_riders_profundidade_check check (palco_profundidade_min_m is null or palco_profundidade_min_m between 0.5 and 500),
  constraint producao_riders_observacoes_check check (observacoes is null or char_length(observacoes) <= 4000)
);

create index if not exists producao_riders_org_idx on public.producao_riders (organization_id, nome);
create index if not exists producao_riders_planta_idx on public.producao_riders (planta_id) where planta_id is not null;
create index if not exists producao_riders_obra_idx on public.producao_riders (obra_id) where obra_id is not null;

create table if not exists public.producao_rider_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rider_id uuid not null references public.producao_riders (id) on delete cascade,
  secao text not null default 'geral',
  texto text not null,
  quantidade integer,
  obrigatorio boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_rider_itens_secao_check check (secao in ('palco', 'som', 'luz', 'energia', 'camarim', 'catering', 'geral')),
  constraint producao_rider_itens_texto_check check (char_length(btrim(texto)) between 1 and 500),
  constraint producao_rider_itens_quantidade_check check (quantidade is null or quantidade between 1 and 9999),
  constraint producao_rider_itens_ordem_check check (ordem between 0 and 100000)
);

create index if not exists producao_rider_itens_org_idx on public.producao_rider_itens (organization_id);
create index if not exists producao_rider_itens_rider_idx on public.producao_rider_itens (rider_id, secao, ordem);

-- Coerência do rider: a organização não muda; planta e obra são da organização.
-- Erros (check_violation): organizacao_nao_muda, planta_de_outra_organizacao, obra_de_outra_organizacao.
create or replace function public.fn_producao_rider_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if new.planta_id is not null and not exists (select 1 from public.producao_plantas p where p.id = new.planta_id and p.organization_id = new.organization_id) then
    raise exception 'planta_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.obra_id is not null and not exists (select 1 from public.producao_obras o where o.id = new.obra_id and o.organization_id = new.organization_id) then
    raise exception 'obra_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência da linha do rider: o rider é da organização e não muda. Erros: organizacao_nao_muda, rider_nao_muda,
-- rider_de_outra_organizacao.
create or replace function public.fn_producao_rider_item_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.rider_id is distinct from old.rider_id then
    raise exception 'rider_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new;
  end if;
  if not exists (select 1 from public.producao_riders r where r.id = new.rider_id and r.organization_id = new.organization_id) then
    raise exception 'rider_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_riders_coerencia
  before insert or update of organization_id, planta_id, obra_id on public.producao_riders
  for each row execute function public.fn_producao_rider_coerencia();
create or replace trigger producao_riders_updated_at
  before update on public.producao_riders
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_riders_historico
  after insert or update or delete on public.producao_riders
  for each row execute function public.fn_producao_historico('', 'nome');

create or replace trigger producao_rider_itens_coerencia
  before insert or update of organization_id, rider_id on public.producao_rider_itens
  for each row execute function public.fn_producao_rider_item_coerencia();
create or replace trigger producao_rider_itens_updated_at
  before update on public.producao_rider_itens
  for each row execute function public.fn_producao_updated_at();

-- Quem vê o histórico: o texto de 20261106185546_producao_plantas.sql com um ramo novo no fim.
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
  end, false);
$$;

alter table public.producao_riders enable row level security;
alter table public.producao_rider_itens enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_riders' and policyname = 'producao_riders: le') then
    create policy "producao_riders: le" on public.producao_riders for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_riders' and policyname = 'producao_riders: leitura sem assinatura') then
    create policy "producao_riders: leitura sem assinatura" on public.producao_riders for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_riders' and policyname = 'producao_riders: insere') then
    create policy "producao_riders: insere" on public.producao_riders for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_riders' and policyname = 'producao_riders: edita') then
    create policy "producao_riders: edita" on public.producao_riders for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_riders' and policyname = 'producao_riders: apaga') then
    create policy "producao_riders: apaga" on public.producao_riders for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
end
$$;

-- As linhas herdam o rider à vista (a subconsulta passa pelas regras de producao_riders).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_rider_itens' and policyname = 'producao_rider_itens: le') then
    create policy "producao_rider_itens: le" on public.producao_rider_itens for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_riders r where r.id = producao_rider_itens.rider_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_rider_itens' and policyname = 'producao_rider_itens: leitura sem assinatura') then
    create policy "producao_rider_itens: leitura sem assinatura" on public.producao_rider_itens for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_riders r where r.id = producao_rider_itens.rider_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_rider_itens' and policyname = 'producao_rider_itens: insere') then
    create policy "producao_rider_itens: insere" on public.producao_rider_itens for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_riders r where r.id = producao_rider_itens.rider_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_rider_itens' and policyname = 'producao_rider_itens: edita') then
    create policy "producao_rider_itens: edita" on public.producao_rider_itens for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_riders r where r.id = producao_rider_itens.rider_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_riders r where r.id = producao_rider_itens.rider_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_rider_itens' and policyname = 'producao_rider_itens: apaga') then
    create policy "producao_rider_itens: apaga" on public.producao_rider_itens for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_riders r where r.id = producao_rider_itens.rider_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_rider_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_rider_item_coerencia() from public, anon, authenticated;
revoke all on public.producao_riders, public.producao_rider_itens from anon, authenticated;
grant select, insert, update, delete on public.producao_riders, public.producao_rider_itens to authenticated;

comment on table public.producao_riders is
  'Rider técnico: o que a casa precisa providenciar, com as medidas mínimas do palco. Nasce do mapa de palco.';
comment on table public.producao_rider_itens is
  'Linha do rider, por seção (palco, som, luz, energia, camarim, catering, geral), com quantidade opcional e se é obrigatório.';
