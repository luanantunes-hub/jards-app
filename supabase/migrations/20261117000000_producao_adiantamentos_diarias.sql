-- PD5.6 (primeiro corte): adiantamentos com prestação e saldo, e diárias com recibo.
--
-- producao_adiantamentos: dinheiro entregue a uma pessoa da equipe para gastar na temporada (a verba do produtor para a estrada, o cartão da equipe), com o valor,
-- o dia da entrega, o que foi devolvido e a situação (aberto ou encerrado). producao_adiantamento_gastos: a prestação de contas dele, gasto a gasto (descrição, valor,
-- dia e número do comprovante). O SALDO é conta da tela: o valor menos os gastos prestados menos o devolvido. Só se encerra com o saldo zerado.
--
-- producao_diarias: a diária de uma pessoa por um período (de, até), em dias de estrada, com o valor do dia (a tela sugere o da função da pessoa na temporada, e a pessoa
-- que lança pode mudar), o número do recibo e o dia do pagamento. O total (dias × valor do dia) é conta da tela.
--
-- DINHEIRO: como o orçamento, só leem e escrevem com a permissão de dinheiro, sem histórico.
--
-- Regras no banco: a prestação mais o devolvido não passam do valor do adiantamento (`prestacao_passa_do_adiantamento`); encerrado não muda nem se apaga
-- (`adiantamento_encerrado`) e só se encerra com o saldo zerado (`adiantamento_com_saldo`); a pessoa é da organização (`pessoa_de_outra_organizacao`). Na diária, o período
-- vale de 1 a 366 dias (`dias_ou_periodo_invalido`), a mesma pessoa não tem dois períodos que se cruzam (`diaria_sobreposta`), o dia do pagamento pede o número do
-- recibo (`diaria_sem_recibo`) e a diária paga não muda nem se apaga (`diaria_paga`).
--
-- Expansão: três tabelas novas e vazias e três funções de gatilho. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_adiantamentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  temporada_id uuid not null references public.producao_temporadas (id) on delete cascade,
  pessoa_id uuid not null references public.producao_pessoas (id) on delete restrict,
  descricao text not null,
  valor numeric(14, 2) not null,
  data date not null,
  devolvido numeric(14, 2) not null default 0,
  situacao text not null default 'aberto',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_adiantamentos_descricao_check check (char_length(btrim(descricao)) between 1 and 120),
  constraint producao_adiantamentos_valor_check check (valor > 0 and valor <= 999999999999.99 and devolvido >= 0 and devolvido <= valor),
  constraint producao_adiantamentos_situacao_check check (situacao in ('aberto', 'encerrado')),
  constraint producao_adiantamentos_observacao_check check (observacao is null or char_length(btrim(observacao)) between 1 and 300)
);

create index if not exists producao_adiantamentos_org_idx on public.producao_adiantamentos (organization_id);
create index if not exists producao_adiantamentos_temporada_idx on public.producao_adiantamentos (temporada_id, data);
create index if not exists producao_adiantamentos_pessoa_idx on public.producao_adiantamentos (pessoa_id);

create table if not exists public.producao_adiantamento_gastos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  adiantamento_id uuid not null references public.producao_adiantamentos (id) on delete cascade,
  descricao text not null,
  valor numeric(14, 2) not null,
  data date not null,
  documento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_adiantamento_gastos_descricao_check check (char_length(btrim(descricao)) between 1 and 120),
  constraint producao_adiantamento_gastos_valor_check check (valor > 0 and valor <= 999999999999.99),
  constraint producao_adiantamento_gastos_documento_check check (documento is null or char_length(btrim(documento)) between 1 and 60)
);

create index if not exists producao_adiantamento_gastos_org_idx on public.producao_adiantamento_gastos (organization_id);
create index if not exists producao_adiantamento_gastos_adiantamento_idx on public.producao_adiantamento_gastos (adiantamento_id, data);

create table if not exists public.producao_diarias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  temporada_id uuid not null references public.producao_temporadas (id) on delete cascade,
  pessoa_id uuid not null references public.producao_pessoas (id) on delete restrict,
  de date not null,
  ate date not null,
  dias integer not null,
  valor_dia numeric(14, 2) not null,
  recibo text,
  pago_em date,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_diarias_periodo_check check (ate >= de and dias between 1 and 366),
  constraint producao_diarias_valor_check check (valor_dia >= 0 and valor_dia <= 999999999999.99),
  constraint producao_diarias_recibo_check check (recibo is null or char_length(btrim(recibo)) between 1 and 60),
  constraint producao_diarias_observacao_check check (observacao is null or char_length(btrim(observacao)) between 1 and 300)
);

create index if not exists producao_diarias_org_idx on public.producao_diarias (organization_id);
create index if not exists producao_diarias_temporada_idx on public.producao_diarias (temporada_id, de);
create index if not exists producao_diarias_pessoa_idx on public.producao_diarias (pessoa_id, de);

-- Coerência do adiantamento. Erros (check_violation): organizacao_nao_muda, temporada_nao_muda, pessoa_nao_muda, temporada_de_outra_organizacao, pessoa_de_outra_organizacao,
-- adiantamento_nasce_aberto, adiantamento_encerrado, prestacao_passa_do_adiantamento, adiantamento_com_saldo.
create or replace function public.fn_producao_adiantamento_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gastos numeric;
begin
  if tg_op = 'DELETE' then
    if old.situacao = 'encerrado' and exists (select 1 from public.producao_temporadas t where t.id = old.temporada_id) then
      raise exception 'adiantamento_encerrado' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
    end if;
    if new.temporada_id is distinct from old.temporada_id then
      raise exception 'temporada_nao_muda' using errcode = 'check_violation';
    end if;
    if new.pessoa_id is distinct from old.pessoa_id then
      raise exception 'pessoa_nao_muda' using errcode = 'check_violation';
    end if;
    if old.situacao = 'encerrado' then
      raise exception 'adiantamento_encerrado' using errcode = 'check_violation';
    end if;
  else
    if new.organization_id is null then
      return new; -- a coluna é not null: quem recusa é a tabela
    end if;
    if not exists (select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id) then
      raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.producao_pessoas p where p.id = new.pessoa_id and p.organization_id = new.organization_id) then
      raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if new.situacao <> 'aberto' then
      raise exception 'adiantamento_nasce_aberto' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  select coalesce(sum(g.valor), 0) into v_gastos from public.producao_adiantamento_gastos g where g.adiantamento_id = new.id;
  if v_gastos + new.devolvido > new.valor then
    raise exception 'prestacao_passa_do_adiantamento' using errcode = 'check_violation';
  end if;
  if new.situacao = 'encerrado' and v_gastos + new.devolvido <> new.valor then
    raise exception 'adiantamento_com_saldo' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência da prestação (um gasto). Erros (check_violation): organizacao_nao_muda, adiantamento_nao_muda, adiantamento_de_outra_organizacao, adiantamento_encerrado,
-- prestacao_passa_do_adiantamento.
create or replace function public.fn_producao_adiantamento_gasto_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_situacao text;
  v_valor numeric;
  v_devolvido numeric;
  v_outros numeric;
begin
  if tg_op = 'DELETE' then
    select a.situacao into v_situacao from public.producao_adiantamentos a where a.id = old.adiantamento_id;
    if not found then
      return old; -- o adiantamento está sendo apagado: a cascata segue
    end if;
    if v_situacao = 'encerrado' then
      raise exception 'adiantamento_encerrado' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.adiantamento_id is distinct from old.adiantamento_id then
    raise exception 'adiantamento_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select a.situacao, a.valor, a.devolvido into v_situacao, v_valor, v_devolvido from public.producao_adiantamentos a
  where a.id = new.adiantamento_id and a.organization_id = new.organization_id for update;
  if not found then
    raise exception 'adiantamento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if v_situacao = 'encerrado' then
    raise exception 'adiantamento_encerrado' using errcode = 'check_violation';
  end if;
  select coalesce(sum(g.valor), 0) into v_outros from public.producao_adiantamento_gastos g where g.adiantamento_id = new.adiantamento_id and (tg_op = 'INSERT' or g.id <> new.id);
  if v_outros + new.valor + v_devolvido > v_valor then
    raise exception 'prestacao_passa_do_adiantamento' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência da diária. Erros (check_violation): organizacao_nao_muda, temporada_nao_muda, pessoa_nao_muda, temporada_de_outra_organizacao, pessoa_de_outra_organizacao,
-- dias_ou_periodo_invalido, diaria_sobreposta, diaria_sem_recibo, diaria_paga.
create or replace function public.fn_producao_diaria_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.pago_em is not null and exists (select 1 from public.producao_temporadas t where t.id = old.temporada_id) then
      raise exception 'diaria_paga' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
    end if;
    if new.temporada_id is distinct from old.temporada_id then
      raise exception 'temporada_nao_muda' using errcode = 'check_violation';
    end if;
    if new.pessoa_id is distinct from old.pessoa_id then
      raise exception 'pessoa_nao_muda' using errcode = 'check_violation';
    end if;
    if old.pago_em is not null then
      raise exception 'diaria_paga' using errcode = 'check_violation';
    end if;
  else
    if new.organization_id is null then
      return new; -- a coluna é not null: quem recusa é a tabela
    end if;
    if not exists (select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id) then
      raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.producao_pessoas p where p.id = new.pessoa_id and p.organization_id = new.organization_id) then
      raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
    end if;
  end if;
  if new.ate < new.de or new.dias < 1 or new.dias > (new.ate - new.de + 1) then
    raise exception 'dias_ou_periodo_invalido' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.producao_diarias d
    where d.pessoa_id = new.pessoa_id and d.organization_id = new.organization_id and (tg_op = 'INSERT' or d.id <> new.id) and d.de <= new.ate and d.ate >= new.de
  ) then
    raise exception 'diaria_sobreposta' using errcode = 'check_violation';
  end if;
  if new.pago_em is not null and (new.recibo is null or btrim(new.recibo) = '') then
    raise exception 'diaria_sem_recibo' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_adiantamentos_coerencia
  before insert or update or delete on public.producao_adiantamentos
  for each row execute function public.fn_producao_adiantamento_coerencia();
create or replace trigger producao_adiantamentos_updated_at
  before update on public.producao_adiantamentos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_adiantamento_gastos_coerencia
  before insert or update or delete on public.producao_adiantamento_gastos
  for each row execute function public.fn_producao_adiantamento_gasto_coerencia();
create or replace trigger producao_adiantamento_gastos_updated_at
  before update on public.producao_adiantamento_gastos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_diarias_coerencia
  before insert or update or delete on public.producao_diarias
  for each row execute function public.fn_producao_diaria_coerencia();
create or replace trigger producao_diarias_updated_at
  before update on public.producao_diarias
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_adiantamentos enable row level security;
alter table public.producao_adiantamento_gastos enable row level security;
alter table public.producao_diarias enable row level security;

do $$
begin
  -- ─── producao_adiantamentos ───
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_adiantamentos' and policyname = 'producao_adiantamentos: le') then
    create policy "producao_adiantamentos: le" on public.producao_adiantamentos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_temporadas t where t.id = producao_adiantamentos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_adiantamentos' and policyname = 'producao_adiantamentos: leitura sem assinatura') then
    create policy "producao_adiantamentos: leitura sem assinatura" on public.producao_adiantamentos for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_temporadas t where t.id = producao_adiantamentos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_adiantamentos' and policyname = 'producao_adiantamentos: insere') then
    create policy "producao_adiantamentos: insere" on public.producao_adiantamentos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_adiantamentos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_adiantamentos' and policyname = 'producao_adiantamentos: edita') then
    create policy "producao_adiantamentos: edita" on public.producao_adiantamentos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_adiantamentos.temporada_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_adiantamentos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_adiantamentos' and policyname = 'producao_adiantamentos: apaga') then
    create policy "producao_adiantamentos: apaga" on public.producao_adiantamentos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_adiantamentos.temporada_id));
  end if;
  -- ─── producao_diarias ───
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_diarias' and policyname = 'producao_diarias: le') then
    create policy "producao_diarias: le" on public.producao_diarias for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_temporadas t where t.id = producao_diarias.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_diarias' and policyname = 'producao_diarias: leitura sem assinatura') then
    create policy "producao_diarias: leitura sem assinatura" on public.producao_diarias for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_temporadas t where t.id = producao_diarias.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_diarias' and policyname = 'producao_diarias: insere') then
    create policy "producao_diarias: insere" on public.producao_diarias for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_diarias.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_diarias' and policyname = 'producao_diarias: edita') then
    create policy "producao_diarias: edita" on public.producao_diarias for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_diarias.temporada_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_diarias.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_diarias' and policyname = 'producao_diarias: apaga') then
    create policy "producao_diarias: apaga" on public.producao_diarias for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_diarias.temporada_id));
  end if;
  -- A prestação herda o adiantamento
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_adiantamento_gastos' and policyname = 'producao_adiantamento_gastos: le') then
    create policy "producao_adiantamento_gastos: le" on public.producao_adiantamento_gastos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_adiantamentos a where a.id = producao_adiantamento_gastos.adiantamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_adiantamento_gastos' and policyname = 'producao_adiantamento_gastos: leitura sem assinatura') then
    create policy "producao_adiantamento_gastos: leitura sem assinatura" on public.producao_adiantamento_gastos for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_adiantamentos a where a.id = producao_adiantamento_gastos.adiantamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_adiantamento_gastos' and policyname = 'producao_adiantamento_gastos: insere') then
    create policy "producao_adiantamento_gastos: insere" on public.producao_adiantamento_gastos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_adiantamentos a where a.id = producao_adiantamento_gastos.adiantamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_adiantamento_gastos' and policyname = 'producao_adiantamento_gastos: edita') then
    create policy "producao_adiantamento_gastos: edita" on public.producao_adiantamento_gastos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_adiantamentos a where a.id = producao_adiantamento_gastos.adiantamento_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_adiantamentos a where a.id = producao_adiantamento_gastos.adiantamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_adiantamento_gastos' and policyname = 'producao_adiantamento_gastos: apaga') then
    create policy "producao_adiantamento_gastos: apaga" on public.producao_adiantamento_gastos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_adiantamentos a where a.id = producao_adiantamento_gastos.adiantamento_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_adiantamento_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_adiantamento_gasto_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_diaria_coerencia() from public, anon, authenticated;
revoke all on public.producao_adiantamentos from anon, authenticated;
revoke all on public.producao_adiantamento_gastos from anon, authenticated;
revoke all on public.producao_diarias from anon, authenticated;
grant select, insert, update, delete on public.producao_adiantamentos to authenticated;
grant select, insert, update, delete on public.producao_adiantamento_gastos to authenticated;
grant select, insert, update, delete on public.producao_diarias to authenticated;

comment on table public.producao_adiantamentos is 'Dinheiro entregue a uma pessoa da equipe para gastar na temporada. O saldo (valor menos prestação menos devolvido) é conta da tela; só se encerra com saldo zero. Dinheiro: só com a permissão. Sem histórico.';
comment on table public.producao_adiantamento_gastos is 'A prestação de contas de um adiantamento, gasto a gasto. A soma não passa do valor do adiantamento.';
comment on table public.producao_diarias is 'Diária de uma pessoa por um período em dias de estrada: dias, valor do dia, recibo e o dia do pagamento. Paga, não muda. Dinheiro: só com a permissão. Sem histórico.';
