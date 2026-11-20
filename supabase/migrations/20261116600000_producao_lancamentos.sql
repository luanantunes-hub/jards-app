-- PD5.3 (primeiro corte): lançamentos da temporada, com a divisão entre as linhas do orçamento.
--
-- producao_lancamentos: um pagamento feito (uma transação): quando, a quem, de que nota ou recibo, quanto. producao_lancamento_linhas: a divisão do valor entre as
-- linhas do orçamento (um cachê e uma diária numa transação só, por exemplo). A tela soma a divisão de cada linha e passa a mostrar isso como o PAGO da linha, no
-- lugar do valor digitado (o mesmo caminho do comprometido que vem dos acordos).
--
-- DINHEIRO: como o orçamento, só lê e escreve quem tem a permissão de dinheiro, sem histórico. Primeiro corte sem o documento enviado e sem a leitura por IA
-- (precisam do arquivo da produção e do deploy da função, que dependem do dono); o número do documento fica como texto, e a nota repetida do mesmo favorecido é
-- recusada (`producao_lancamentos_documento_idx`), que é o aviso de duplicata.
--
-- Regras no banco: o valor do lançamento é maior que zero e a divisão de cada linha também; a soma da divisão não passa do valor do lançamento (`divisao_passa_do_valor`;
-- o que falta dividir é conta da tela); a linha do orçamento da divisão é da mesma temporada e organização (`linha_de_outra_temporada`); uma linha aparece uma vez por
-- lançamento. Uma linha do orçamento que já recebeu pagamento não se apaga (chave sem cascata: `23503`).
--
-- Acesso: o da temporada mais o dinheiro. Expansão: duas tabelas novas e vazias e duas funções de gatilho. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_lancamentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  temporada_id uuid not null references public.producao_temporadas (id) on delete cascade,
  descricao text not null,
  favorecido text,
  documento text,
  data date not null,
  valor numeric(14, 2) not null,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_lancamentos_descricao_check check (char_length(btrim(descricao)) between 1 and 120),
  constraint producao_lancamentos_favorecido_check check (favorecido is null or char_length(btrim(favorecido)) between 1 and 120),
  constraint producao_lancamentos_documento_check check (documento is null or char_length(btrim(documento)) between 1 and 60),
  constraint producao_lancamentos_valor_check check (valor > 0 and valor <= 999999999999.99),
  constraint producao_lancamentos_observacao_check check (observacao is null or char_length(btrim(observacao)) between 1 and 300)
);

create index if not exists producao_lancamentos_org_idx on public.producao_lancamentos (organization_id);
create index if not exists producao_lancamentos_temporada_idx on public.producao_lancamentos (temporada_id, data);
create unique index if not exists producao_lancamentos_documento_idx on public.producao_lancamentos (temporada_id, lower(btrim(favorecido)), lower(btrim(documento))) where favorecido is not null and documento is not null;

create table if not exists public.producao_lancamento_linhas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lancamento_id uuid not null references public.producao_lancamentos (id) on delete cascade,
  orcamento_linha_id uuid not null references public.producao_orcamento_linhas (id) on delete restrict,
  valor numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  constraint producao_lancamento_linhas_valor_check check (valor > 0 and valor <= 999999999999.99),
  constraint producao_lancamento_linhas_key unique (lancamento_id, orcamento_linha_id)
);

create index if not exists producao_lancamento_linhas_org_idx on public.producao_lancamento_linhas (organization_id);
create index if not exists producao_lancamento_linhas_linha_idx on public.producao_lancamento_linhas (orcamento_linha_id);

-- Coerência do lançamento. Erros (check_violation): organizacao_nao_muda, temporada_nao_muda, temporada_de_outra_organizacao, divisao_passa_do_valor.
create or replace function public.fn_producao_lancamento_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
    end if;
    if new.temporada_id is distinct from old.temporada_id then
      raise exception 'temporada_nao_muda' using errcode = 'check_violation';
    end if;
    -- Baixar o valor abaixo do que já foi dividido deixaria a divisão passando do total.
    if new.valor < old.valor and (select coalesce(sum(l.valor), 0) from public.producao_lancamento_linhas l where l.lancamento_id = new.id) > new.valor then
      raise exception 'divisao_passa_do_valor' using errcode = 'check_violation';
    end if;
  else
    if new.organization_id is null then
      return new; -- a coluna é not null: quem recusa é a tabela
    end if;
    if not exists (select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id) then
      raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- Coerência da divisão. Erros (check_violation): organizacao_nao_muda, lancamento_nao_muda, lancamento_de_outra_organizacao, linha_de_outra_temporada, divisao_passa_do_valor.
create or replace function public.fn_producao_lancamento_linha_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_valor numeric;
  v_temporada uuid;
  v_ja_dividido numeric;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.lancamento_id is distinct from old.lancamento_id then
    raise exception 'lancamento_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select l.valor, l.temporada_id into v_valor, v_temporada from public.producao_lancamentos l where l.id = new.lancamento_id and l.organization_id = new.organization_id for update;
  if not found then
    raise exception 'lancamento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.producao_orcamento_linhas ol join public.producao_orcamentos o on o.id = ol.orcamento_id
    where ol.id = new.orcamento_linha_id and ol.organization_id = new.organization_id and o.temporada_id = v_temporada
  ) then
    raise exception 'linha_de_outra_temporada' using errcode = 'check_violation';
  end if;
  select coalesce(sum(l.valor), 0) into v_ja_dividido from public.producao_lancamento_linhas l where l.lancamento_id = new.lancamento_id and (tg_op = 'INSERT' or l.id <> new.id);
  if v_ja_dividido + new.valor > v_valor then
    raise exception 'divisao_passa_do_valor' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_lancamentos_coerencia
  before insert or update on public.producao_lancamentos
  for each row execute function public.fn_producao_lancamento_coerencia();
create or replace trigger producao_lancamentos_updated_at
  before update on public.producao_lancamentos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_lancamento_linhas_coerencia
  before insert or update on public.producao_lancamento_linhas
  for each row execute function public.fn_producao_lancamento_linha_coerencia();

alter table public.producao_lancamentos enable row level security;
alter table public.producao_lancamento_linhas enable row level security;

do $$
begin
  -- ─── Lançamentos ───
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_lancamentos' and policyname = 'producao_lancamentos: le') then
    create policy "producao_lancamentos: le" on public.producao_lancamentos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_temporadas t where t.id = producao_lancamentos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_lancamentos' and policyname = 'producao_lancamentos: leitura sem assinatura') then
    create policy "producao_lancamentos: leitura sem assinatura" on public.producao_lancamentos for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_temporadas t where t.id = producao_lancamentos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_lancamentos' and policyname = 'producao_lancamentos: insere') then
    create policy "producao_lancamentos: insere" on public.producao_lancamentos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_lancamentos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_lancamentos' and policyname = 'producao_lancamentos: edita') then
    create policy "producao_lancamentos: edita" on public.producao_lancamentos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_lancamentos.temporada_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_lancamentos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_lancamentos' and policyname = 'producao_lancamentos: apaga') then
    create policy "producao_lancamentos: apaga" on public.producao_lancamentos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_lancamentos.temporada_id));
  end if;
  -- ─── Divisão ───
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_lancamento_linhas' and policyname = 'producao_lancamento_linhas: le') then
    create policy "producao_lancamento_linhas: le" on public.producao_lancamento_linhas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_lancamentos l where l.id = producao_lancamento_linhas.lancamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_lancamento_linhas' and policyname = 'producao_lancamento_linhas: leitura sem assinatura') then
    create policy "producao_lancamento_linhas: leitura sem assinatura" on public.producao_lancamento_linhas for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_lancamentos l where l.id = producao_lancamento_linhas.lancamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_lancamento_linhas' and policyname = 'producao_lancamento_linhas: insere') then
    create policy "producao_lancamento_linhas: insere" on public.producao_lancamento_linhas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_lancamentos l where l.id = producao_lancamento_linhas.lancamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_lancamento_linhas' and policyname = 'producao_lancamento_linhas: edita') then
    create policy "producao_lancamento_linhas: edita" on public.producao_lancamento_linhas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_lancamentos l where l.id = producao_lancamento_linhas.lancamento_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_lancamentos l where l.id = producao_lancamento_linhas.lancamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_lancamento_linhas' and policyname = 'producao_lancamento_linhas: apaga') then
    create policy "producao_lancamento_linhas: apaga" on public.producao_lancamento_linhas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_lancamentos l where l.id = producao_lancamento_linhas.lancamento_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_lancamento_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_lancamento_linha_coerencia() from public, anon, authenticated;
revoke all on public.producao_lancamentos from anon, authenticated;
revoke all on public.producao_lancamento_linhas from anon, authenticated;
grant select, insert, update, delete on public.producao_lancamentos to authenticated;
grant select, insert, update, delete on public.producao_lancamento_linhas to authenticated;

comment on table public.producao_lancamentos is 'Pagamento feito na temporada: data, favorecido, documento e valor. Dividido entre linhas do orçamento; a soma da divisão por linha vira o pago. Dinheiro: só com a permissão. Sem histórico.';
comment on table public.producao_lancamento_linhas is 'A divisão do valor de um lançamento entre as linhas do orçamento (a soma não passa do valor do lançamento).';
