-- PD5.2 (primeiro corte): variáveis e fórmulas no orçamento, para montar cenários.
--
-- producao_orcamento_variaveis: números que o orçamento usa nas contas (praças, sessões, dias de estrada, pessoas viajando...), cada um com um nome
-- curto (`pessoas`, `dias_de_estrada`) e o valor. producao_orcamento_linhas.formula (nova coluna, opcional): a conta da estimativa da linha, escrita com
-- os nomes das variáveis (`pessoas * dias_de_estrada * 180`). A fórmula é lida e calculada na tela por um leitor próprio e seguro (lib/producao/formula.ts,
-- sem eval); o banco só guarda o texto (até 200 letras) e o valor que a tela calculou na estimativa.
--
-- Cenário: outro orçamento da mesma temporada (a PD5.1 já permite vários), com as mesmas variáveis em outros valores; a tela copia um orçamento como cenário
-- e põe os cenários lado a lado.
--
-- DINHEIRO: como o orçamento, só lê e escreve quem tem a permissão de dinheiro, sem histórico. As variáveis só mudam com o orçamento em rascunho
-- (aprovado: `orcamento_aprovado`; encerrado: `orcamento_encerrado`), e a fórmula da linha acompanha a estimativa: aprovado, não muda.
--
-- Expansão: uma tabela nova e vazia, uma coluna anulável e a função de gatilho da linha trocada (create or replace, mesma assinatura, a fórmula entra na
-- lista do que o aprovado trava). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.producao_orcamento_linhas add column if not exists formula text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'producao_orcamento_linhas_formula_check' and conrelid = 'public.producao_orcamento_linhas'::regclass) then
    alter table public.producao_orcamento_linhas add constraint producao_orcamento_linhas_formula_check check (formula is null or char_length(btrim(formula)) between 1 and 200);
  end if;
end
$$;

create table if not exists public.producao_orcamento_variaveis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  orcamento_id uuid not null references public.producao_orcamentos (id) on delete cascade,
  nome text not null,
  rotulo text,
  valor numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_orcamento_variaveis_nome_check check (nome ~ '^[a-z][a-z0-9_]{0,29}$' and nome not in ('min', 'max', 'round', 'ceil', 'floor')),
  constraint producao_orcamento_variaveis_rotulo_check check (rotulo is null or char_length(btrim(rotulo)) between 1 and 60),
  constraint producao_orcamento_variaveis_valor_check check (valor between 0 and 1000000000)
);

create index if not exists producao_orcamento_variaveis_org_idx on public.producao_orcamento_variaveis (organization_id);
create unique index if not exists producao_orcamento_variaveis_nome_idx on public.producao_orcamento_variaveis (orcamento_id, nome);

-- Coerência da variável. Erros (check_violation): organizacao_nao_muda, orcamento_nao_muda, orcamento_de_outra_organizacao, orcamento_encerrado, orcamento_aprovado.
create or replace function public.fn_producao_orcamento_variavel_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_situacao text;
begin
  if tg_op = 'DELETE' then
    select o.situacao into v_situacao from public.producao_orcamentos o where o.id = old.orcamento_id;
    if not found then
      return old; -- o orçamento está sendo apagado: a cascata segue
    end if;
  else
    if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
      raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
    end if;
    if tg_op = 'UPDATE' and new.orcamento_id is distinct from old.orcamento_id then
      raise exception 'orcamento_nao_muda' using errcode = 'check_violation';
    end if;
    if new.organization_id is null then
      return new; -- a coluna é not null: quem recusa é a tabela
    end if;
    select o.situacao into v_situacao from public.producao_orcamentos o where o.id = new.orcamento_id and o.organization_id = new.organization_id for share;
    if not found then
      raise exception 'orcamento_de_outra_organizacao' using errcode = 'check_violation';
    end if;
  end if;
  if v_situacao = 'encerrado' then
    raise exception 'orcamento_encerrado' using errcode = 'check_violation';
  end if;
  if v_situacao = 'aprovado' then
    raise exception 'orcamento_aprovado' using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- A coerência da linha (da PD5.1), agora com a fórmula na lista do que o aprovado trava.
create or replace function public.fn_producao_orcamento_linha_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_situacao text;
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
  select o.situacao into v_situacao from public.producao_orcamentos o where o.id = new.orcamento_id and o.organization_id = new.organization_id for share;
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
  return new;
end;
$$;

create or replace trigger producao_orcamento_variaveis_coerencia
  before insert or update or delete on public.producao_orcamento_variaveis
  for each row execute function public.fn_producao_orcamento_variavel_coerencia();
create or replace trigger producao_orcamento_variaveis_updated_at
  before update on public.producao_orcamento_variaveis
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_orcamento_variaveis enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamento_variaveis' and policyname = 'producao_orcamento_variaveis: le') then
    create policy "producao_orcamento_variaveis: le" on public.producao_orcamento_variaveis for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_orcamentos o where o.id = producao_orcamento_variaveis.orcamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamento_variaveis' and policyname = 'producao_orcamento_variaveis: leitura sem assinatura') then
    create policy "producao_orcamento_variaveis: leitura sem assinatura" on public.producao_orcamento_variaveis for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_orcamentos o where o.id = producao_orcamento_variaveis.orcamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamento_variaveis' and policyname = 'producao_orcamento_variaveis: insere') then
    create policy "producao_orcamento_variaveis: insere" on public.producao_orcamento_variaveis for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_orcamentos o where o.id = producao_orcamento_variaveis.orcamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamento_variaveis' and policyname = 'producao_orcamento_variaveis: edita') then
    create policy "producao_orcamento_variaveis: edita" on public.producao_orcamento_variaveis for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_orcamentos o where o.id = producao_orcamento_variaveis.orcamento_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_orcamentos o where o.id = producao_orcamento_variaveis.orcamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamento_variaveis' and policyname = 'producao_orcamento_variaveis: apaga') then
    create policy "producao_orcamento_variaveis: apaga" on public.producao_orcamento_variaveis for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_orcamentos o where o.id = producao_orcamento_variaveis.orcamento_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_orcamento_variavel_coerencia() from public, anon, authenticated;
revoke all on public.producao_orcamento_variaveis from anon, authenticated;
grant select, insert, update, delete on public.producao_orcamento_variaveis to authenticated;

comment on table public.producao_orcamento_variaveis is 'Variável do orçamento (pessoas, dias de estrada, praças...): nome curto e valor, usados nas fórmulas das linhas. Só muda com o orçamento em rascunho. Dinheiro: só com a permissão. Sem histórico.';
comment on column public.producao_orcamento_linhas.formula is 'Conta da estimativa da linha, com os nomes das variáveis do orçamento. A tela calcula (leitor seguro, sem eval) e grava o resultado na estimativa.';
