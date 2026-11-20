-- PD4.5 (primeiro corte): acordos da temporada, com as condições combinadas, as datas cobertas e a ligação com o orçamento.
--
-- producao_acordos: um acordo com uma contraparte (a casa, o contratante, o elenco, o fornecedor) numa temporada. Tem o tipo (cachê, bilheteria, misto, cessão de
-- espaço ou outro), o sentido (a pagar ou a receber), as condições em campos (valor fixo, garantia, percentual da bilheteria, bônus por público, quem arca com
-- cada despesa, retenções) e a situação: rascunho, revisão, para assinatura, assinado e encerrado, separada da situação da data. producao_acordo_datas: as datas
-- da temporada que o acordo cobre. producao_orcamento_linhas.acordo_id (nova coluna, opcional): a linha do orçamento que se cumpre por um acordo; a tela
-- passa a somar o comprometido dele (o valor firme do acordo assinado).
--
-- DINHEIRO: como o orçamento, só lê e escreve quem tem a permissão de dinheiro, sem histórico (as condições são valores). Primeiro corte sem arquivo: as
-- versões com o PDF e o hash (`producao_acordo_versoes`) e a assinatura eletrônica (PD4.6) vêm depois.
--
-- Regras no banco: o acordo nasce em rascunho; a situação anda um passo para a frente, e volta enquanto não está assinado (rascunho, revisão, para assinatura);
-- assinado só vai para encerrado; encerrado não muda (`acordo_situacao_invalida`, `acordo_encerrado`). Assinado, as condições, a contraparte, o tipo, o sentido
-- e as datas cobertas não mudam (`acordo_assinado`) e o acordo não se apaga. Assinar carimba o dia (`assinado_em`, o que a pessoa informar ou hoje). As datas
-- cobertas são da temporada do acordo. A linha do orçamento só liga a acordo da mesma temporada (`acordo_de_outra_temporada`).
--
-- Expansão: duas tabelas novas e vazias, uma coluna anulável e a função de gatilho da linha trocada (create or replace, mesma assinatura, mais uma
-- conferência). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_acordos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  temporada_id uuid not null references public.producao_temporadas (id) on delete cascade,
  contraparte text not null,
  tipo text not null default 'cache',
  sentido text not null default 'a_pagar',
  situacao text not null default 'rascunho',
  valor_fixo numeric(14, 2),
  garantia numeric(14, 2),
  percentual_bilheteria numeric(5, 2),
  bonus_publico integer,
  bonus_valor numeric(14, 2),
  despesas_nossas text,
  despesas_da_contraparte text,
  retencoes text,
  observacao text,
  assinado_em date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_acordos_contraparte_check check (char_length(btrim(contraparte)) between 1 and 120),
  constraint producao_acordos_tipo_check check (tipo in ('cache', 'bilheteria', 'misto', 'cessao_de_espaco', 'outro')),
  constraint producao_acordos_sentido_check check (sentido in ('a_pagar', 'a_receber')),
  constraint producao_acordos_situacao_check check (situacao in ('rascunho', 'revisao', 'para_assinatura', 'assinado', 'encerrado')),
  constraint producao_acordos_valores_check check (
    (valor_fixo is null or valor_fixo between 0 and 999999999999.99)
    and (garantia is null or garantia between 0 and 999999999999.99)
    and (percentual_bilheteria is null or percentual_bilheteria between 0 and 100)
    and (bonus_publico is null or bonus_publico between 1 and 1000000)
    and (bonus_valor is null or bonus_valor between 0 and 999999999999.99)
    and ((bonus_publico is null) = (bonus_valor is null))
  ),
  constraint producao_acordos_textos_check check (
    (despesas_nossas is null or char_length(btrim(despesas_nossas)) between 1 and 400)
    and (despesas_da_contraparte is null or char_length(btrim(despesas_da_contraparte)) between 1 and 400)
    and (retencoes is null or char_length(btrim(retencoes)) between 1 and 400)
    and (observacao is null or char_length(btrim(observacao)) between 1 and 500)
  )
);

create index if not exists producao_acordos_org_idx on public.producao_acordos (organization_id);
create index if not exists producao_acordos_temporada_idx on public.producao_acordos (temporada_id);

create table if not exists public.producao_acordo_datas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  acordo_id uuid not null references public.producao_acordos (id) on delete cascade,
  data_id uuid not null references public.producao_datas (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint producao_acordo_datas_key unique (acordo_id, data_id)
);

create index if not exists producao_acordo_datas_org_idx on public.producao_acordo_datas (organization_id);
create index if not exists producao_acordo_datas_data_idx on public.producao_acordo_datas (data_id);

alter table public.producao_orcamento_linhas add column if not exists acordo_id uuid references public.producao_acordos (id) on delete set null;
create index if not exists producao_orcamento_linhas_acordo_idx on public.producao_orcamento_linhas (acordo_id) where acordo_id is not null;

-- Coerência do acordo. Erros (check_violation): organizacao_nao_muda, temporada_nao_muda, temporada_de_outra_organizacao, acordo_nasce_rascunho,
-- acordo_situacao_invalida, acordo_encerrado, acordo_assinado.
create or replace function public.fn_producao_acordo_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ordem text[] := array['rascunho', 'revisao', 'para_assinatura', 'assinado', 'encerrado'];
  v_de int;
  v_para int;
begin
  if tg_op = 'DELETE' then
    if old.situacao in ('assinado', 'encerrado') and exists (select 1 from public.producao_temporadas t where t.id = old.temporada_id) then
      raise exception 'acordo_assinado' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.organization_id is null then
      return new; -- a coluna é not null: quem recusa é a tabela
    end if;
    if not exists (select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id) then
      raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if new.situacao <> 'rascunho' then
      raise exception 'acordo_nasce_rascunho' using errcode = 'check_violation';
    end if;
    new.assinado_em := null;
    return new;
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.temporada_id is distinct from old.temporada_id then
    raise exception 'temporada_nao_muda' using errcode = 'check_violation';
  end if;
  if old.situacao = 'encerrado' then
    raise exception 'acordo_encerrado' using errcode = 'check_violation';
  end if;
  v_de := array_position(v_ordem, old.situacao);
  v_para := array_position(v_ordem, new.situacao);
  if old.situacao = 'assinado' then
    if new.situacao not in ('assinado', 'encerrado') then
      raise exception 'acordo_assinado' using errcode = 'check_violation';
    end if;
    if new.contraparte is distinct from old.contraparte or new.tipo is distinct from old.tipo or new.sentido is distinct from old.sentido
       or new.valor_fixo is distinct from old.valor_fixo or new.garantia is distinct from old.garantia
       or new.percentual_bilheteria is distinct from old.percentual_bilheteria or new.bonus_publico is distinct from old.bonus_publico
       or new.bonus_valor is distinct from old.bonus_valor or new.despesas_nossas is distinct from old.despesas_nossas
       or new.despesas_da_contraparte is distinct from old.despesas_da_contraparte or new.retencoes is distinct from old.retencoes then
      raise exception 'acordo_assinado' using errcode = 'check_violation';
    end if;
    new.assinado_em := old.assinado_em;
    return new;
  end if;
  if v_para > v_de + 1 then
    raise exception 'acordo_situacao_invalida' using errcode = 'check_violation';
  end if;
  if new.situacao = 'assinado' then
    new.assinado_em := coalesce(new.assinado_em, current_date);
  else
    new.assinado_em := null;
  end if;
  return new;
end;
$$;

-- Coerência das datas cobertas. Erros (check_violation): organizacao_nao_muda, acordo_nao_muda, acordo_de_outra_organizacao, data_de_outra_temporada, acordo_assinado.
create or replace function public.fn_producao_acordo_data_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_situacao text;
  v_temporada uuid;
begin
  if tg_op = 'DELETE' then
    select a.situacao into v_situacao from public.producao_acordos a where a.id = old.acordo_id;
    if not found then
      return old; -- o acordo está sendo apagado: a cascata segue
    end if;
    if v_situacao in ('assinado', 'encerrado') then
      raise exception 'acordo_assinado' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.acordo_id is distinct from old.acordo_id then
    raise exception 'acordo_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select a.situacao, a.temporada_id into v_situacao, v_temporada from public.producao_acordos a where a.id = new.acordo_id and a.organization_id = new.organization_id for share;
  if not found then
    raise exception 'acordo_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if v_situacao in ('assinado', 'encerrado') then
    raise exception 'acordo_assinado' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.producao_datas d where d.id = new.data_id and d.organization_id = new.organization_id and d.temporada_id = v_temporada) then
    raise exception 'data_de_outra_temporada' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- A coerência da linha do orçamento (da PD5.2), agora também com a ligação ao acordo da mesma temporada.
create or replace function public.fn_producao_orcamento_linha_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_situacao text;
  v_temporada uuid;
begin
  if tg_op = 'DELETE' then
    select o.situacao into v_situacao from public.producao_orcamentos o where o.id = old.orcamento_id;
    if not found then
      return old; -- o orçamento está sendo apagado: a cascata segue
    end if;
    if v_situacao = 'encerrado' then
      raise exception 'orcamento_encerrado' using errcode = 'check_violation';
    end if;
    if v_situacao = 'aprovado' and old.aprovado is not null then
      raise exception 'orcamento_aprovado' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.orcamento_id is distinct from old.orcamento_id then
    raise exception 'orcamento_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select o.situacao, o.temporada_id into v_situacao, v_temporada from public.producao_orcamentos o where o.id = new.orcamento_id and o.organization_id = new.organization_id for share;
  if not found then
    raise exception 'orcamento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if v_situacao = 'encerrado' then
    raise exception 'orcamento_encerrado' using errcode = 'check_violation';
  end if;
  if v_situacao = 'aprovado' then
    if tg_op = 'INSERT' and new.aprovado is not null then
      raise exception 'orcamento_aprovado' using errcode = 'check_violation';
    end if;
    if tg_op = 'UPDATE' and (new.categoria is distinct from old.categoria or new.estimativa is distinct from old.estimativa
                              or new.aprovado is distinct from old.aprovado or new.formula is distinct from old.formula) then
      raise exception 'orcamento_aprovado' using errcode = 'check_violation';
    end if;
  end if;
  if new.acordo_id is not null and (tg_op = 'INSERT' or new.acordo_id is distinct from old.acordo_id) then
    if not exists (select 1 from public.producao_acordos a where a.id = new.acordo_id and a.organization_id = new.organization_id and a.temporada_id = v_temporada) then
      raise exception 'acordo_de_outra_temporada' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger producao_acordos_coerencia
  before insert or update or delete on public.producao_acordos
  for each row execute function public.fn_producao_acordo_coerencia();
create or replace trigger producao_acordos_updated_at
  before update on public.producao_acordos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_acordo_datas_coerencia
  before insert or update or delete on public.producao_acordo_datas
  for each row execute function public.fn_producao_acordo_data_coerencia();

alter table public.producao_acordos enable row level security;
alter table public.producao_acordo_datas enable row level security;

do $$
begin
  -- ─── Acordos ───
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordos' and policyname = 'producao_acordos: le') then
    create policy "producao_acordos: le" on public.producao_acordos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_temporadas t where t.id = producao_acordos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordos' and policyname = 'producao_acordos: leitura sem assinatura') then
    create policy "producao_acordos: leitura sem assinatura" on public.producao_acordos for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_temporadas t where t.id = producao_acordos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordos' and policyname = 'producao_acordos: insere') then
    create policy "producao_acordos: insere" on public.producao_acordos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_acordos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordos' and policyname = 'producao_acordos: edita') then
    create policy "producao_acordos: edita" on public.producao_acordos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_acordos.temporada_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_acordos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordos' and policyname = 'producao_acordos: apaga') then
    create policy "producao_acordos: apaga" on public.producao_acordos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_acordos.temporada_id));
  end if;
  -- ─── Datas cobertas ───
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordo_datas' and policyname = 'producao_acordo_datas: le') then
    create policy "producao_acordo_datas: le" on public.producao_acordo_datas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_acordos a where a.id = producao_acordo_datas.acordo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordo_datas' and policyname = 'producao_acordo_datas: leitura sem assinatura') then
    create policy "producao_acordo_datas: leitura sem assinatura" on public.producao_acordo_datas for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_acordos a where a.id = producao_acordo_datas.acordo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordo_datas' and policyname = 'producao_acordo_datas: insere') then
    create policy "producao_acordo_datas: insere" on public.producao_acordo_datas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_acordos a where a.id = producao_acordo_datas.acordo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordo_datas' and policyname = 'producao_acordo_datas: edita') then
    create policy "producao_acordo_datas: edita" on public.producao_acordo_datas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_acordos a where a.id = producao_acordo_datas.acordo_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_acordos a where a.id = producao_acordo_datas.acordo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordo_datas' and policyname = 'producao_acordo_datas: apaga') then
    create policy "producao_acordo_datas: apaga" on public.producao_acordo_datas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_acordos a where a.id = producao_acordo_datas.acordo_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_acordo_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_acordo_data_coerencia() from public, anon, authenticated;
revoke all on public.producao_acordos from anon, authenticated;
revoke all on public.producao_acordo_datas from anon, authenticated;
grant select, insert, update, delete on public.producao_acordos to authenticated;
grant select, insert, update, delete on public.producao_acordo_datas to authenticated;

comment on table public.producao_acordos is 'Acordo da temporada com uma contraparte: tipo, sentido, condições (fixo, garantia, % da bilheteria, bônus, despesas, retenções) e situação (rascunho a encerrado). Assinado não muda. Dinheiro: só com a permissão. Sem histórico.';
comment on table public.producao_acordo_datas is 'As datas da temporada que o acordo cobre. Acordo assinado não muda.';
comment on column public.producao_orcamento_linhas.acordo_id is 'O acordo pelo qual a linha se cumpre; a tela soma o comprometido dele quando está assinado.';
